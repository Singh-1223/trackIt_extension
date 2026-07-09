import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  storeToken,
  getToken,
  clearToken,
  validateToken,
  refreshToken,
  setRefreshCallback,
} from "./tokenManager";

// --- Mock chrome.storage.session ---

const sessionStore: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    session: {
      get(keys: string[], callback: (items: Record<string, unknown>) => void) {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          if (key in sessionStore) {
            result[key] = sessionStore[key];
          }
        }
        callback(result);
      },
      set(items: Record<string, unknown>, callback: () => void) {
        Object.assign(sessionStore, items);
        callback();
      },
      remove(key: string, callback: () => void) {
        delete sessionStore[key];
        callback();
      },
    },
  },
  runtime: {
    lastError: undefined as { message: string } | undefined,
  },
};

// Attach mock to global
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

function clearSessionStore() {
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
}

/** Helper to create a JWT with a given exp (seconds since epoch) */
function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = btoa("fake-signature");
  return `${header}.${body}.${sig}`;
}

describe("TokenManager", () => {
  beforeEach(() => {
    clearSessionStore();
    setRefreshCallback(null as unknown as () => Promise<string | null>);
    vi.restoreAllMocks();
  });

  describe("storeToken", () => {
    it("stores a token in chrome.storage.session", async () => {
      await storeToken("my-token-123");
      expect(sessionStore["trackit.auth_token"]).toBe("my-token-123");
    });

    it("overwrites a previously stored token", async () => {
      await storeToken("old-token");
      await storeToken("new-token");
      expect(sessionStore["trackit.auth_token"]).toBe("new-token");
    });
  });

  describe("getToken", () => {
    it("returns the stored token", async () => {
      sessionStore["trackit.auth_token"] = "stored-token";
      const token = await getToken();
      expect(token).toBe("stored-token");
    });

    it("returns null when no token is stored", async () => {
      const token = await getToken();
      expect(token).toBeNull();
    });

    it("returns null for empty string token", async () => {
      sessionStore["trackit.auth_token"] = "";
      const token = await getToken();
      expect(token).toBeNull();
    });

    it("returns null for non-string values", async () => {
      sessionStore["trackit.auth_token"] = 42;
      const token = await getToken();
      expect(token).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("removes the token from storage", async () => {
      sessionStore["trackit.auth_token"] = "to-be-removed";
      await clearToken();
      expect(sessionStore["trackit.auth_token"]).toBeUndefined();
    });

    it("does not throw when no token exists", async () => {
      await expect(clearToken()).resolves.toBeUndefined();
    });
  });

  describe("validateToken", () => {
    it("returns false when no token is stored", async () => {
      const valid = await validateToken();
      expect(valid).toBe(false);
    });

    it("returns true for a non-JWT token string", async () => {
      sessionStore["trackit.auth_token"] = "opaque-token-abc";
      const valid = await validateToken();
      expect(valid).toBe(true);
    });

    it("returns true for a JWT that is not expired", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createJwt({ sub: "user-1", exp: futureExp });
      sessionStore["trackit.auth_token"] = token;
      const valid = await validateToken();
      expect(valid).toBe(true);
    });

    it("returns false for an expired JWT", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const token = createJwt({ sub: "user-1", exp: pastExp });
      sessionStore["trackit.auth_token"] = token;
      const valid = await validateToken();
      expect(valid).toBe(false);
    });

    it("returns true for a JWT without exp claim", async () => {
      const token = createJwt({ sub: "user-1" });
      sessionStore["trackit.auth_token"] = token;
      const valid = await validateToken();
      expect(valid).toBe(true);
    });
  });

  describe("refreshToken", () => {
    it("returns null when no refresh callback is registered", async () => {
      const result = await refreshToken();
      expect(result).toBeNull();
    });

    it("stores and returns the new token on successful refresh", async () => {
      const cb = vi.fn().mockResolvedValue("new-fresh-token");
      setRefreshCallback(cb);

      const result = await refreshToken(1);
      expect(result).toBe("new-fresh-token");
      expect(sessionStore["trackit.auth_token"]).toBe("new-fresh-token");
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds on later attempt", async () => {
      vi.useFakeTimers();
      const cb = vi
        .fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce("refreshed-token");
      setRefreshCallback(cb);

      const promise = refreshToken(3);

      // Advance past the 2s delay after first failure
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe("refreshed-token");
      expect(cb).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("returns null after all retries are exhausted", async () => {
      vi.useFakeTimers();
      const cb = vi.fn().mockRejectedValue(new Error("always fails"));
      setRefreshCallback(cb);

      const promise = refreshToken(3);

      // Advance past all delays (2s + 2s)
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBeNull();
      expect(cb).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it("returns null when callback returns null", async () => {
      vi.useFakeTimers();
      const cb = vi.fn().mockResolvedValue(null);
      setRefreshCallback(cb);

      const promise = refreshToken(2);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBeNull();
      expect(cb).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });
});
