import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TrackItStore } from "../../types";

// --- Mock chrome.storage.session (same pattern as tokenManager.test.ts) ---

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

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

function clearSessionStore() {
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
}

// --- Mock fetch ---

const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

// --- Import after mocks are set ---

import { getStore, putStore } from "./apiClient";

const sampleStore: TrackItStore = {
  groups: [],
  tasks: [],
  entries: [],
  todos: [],
  notes: [],
  habits: [],
  habitEntries: [],
  schemaVersion: 1,
  updatedAt: Date.now(),
};

describe("ApiClient", () => {
  beforeEach(() => {
    clearSessionStore();
    mockFetch.mockReset();
  });

  describe("getStore", () => {
    it("aborts request and returns error when no token is available", async () => {
      const result = await getStore();

      expect(result.status).toBe(0);
      expect(result.error).toBe("No auth token available");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends GET request with Bearer token when token is available", async () => {
      sessionStore["trackit.auth_token"] = "test-token-123";
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleStore,
      });

      const result = await getStore();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/store",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
      expect(result.status).toBe(200);
      expect(result.data).toEqual(sampleStore);
    });

    it("returns error with status for non-ok responses", async () => {
      sessionStore["trackit.auth_token"] = "some-token";
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid token",
      });

      const result = await getStore();

      expect(result.status).toBe(401);
      expect(result.error).toBe("Invalid token");
      expect(result.data).toBeUndefined();
    });

    it("returns error with status 404 when no store exists", async () => {
      sessionStore["trackit.auth_token"] = "valid-token";
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "No store found for this user",
      });

      const result = await getStore();

      expect(result.status).toBe(404);
      expect(result.error).toBe("No store found for this user");
    });

    it("handles network errors gracefully", async () => {
      sessionStore["trackit.auth_token"] = "valid-token";
      mockFetch.mockRejectedValue(new Error("Failed to fetch"));

      const result = await getStore();

      expect(result.status).toBe(0);
      expect(result.error).toBe("Failed to fetch");
    });

    it("falls back to statusText when response body is empty", async () => {
      sessionStore["trackit.auth_token"] = "valid-token";
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "",
      });

      const result = await getStore();

      expect(result.status).toBe(500);
      expect(result.error).toBe("Internal Server Error");
    });
  });

  describe("putStore", () => {
    it("aborts request and returns error when no token is available", async () => {
      const result = await putStore(sampleStore);

      expect(result.status).toBe(0);
      expect(result.error).toBe("No auth token available");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends PUT request with Bearer token and JSON body", async () => {
      sessionStore["trackit.auth_token"] = "put-token-456";
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await putStore(sampleStore);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/store",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: "Bearer put-token-456",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(sampleStore),
        })
      );
      expect(result.status).toBe(200);
      expect(result.error).toBeUndefined();
    });

    it("returns error with status for non-ok responses", async () => {
      sessionStore["trackit.auth_token"] = "put-token";
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Missing required fields: groups",
      });

      const result = await putStore(sampleStore);

      expect(result.status).toBe(400);
      expect(result.error).toBe("Missing required fields: groups");
    });

    it("handles network errors gracefully", async () => {
      sessionStore["trackit.auth_token"] = "put-token";
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      const result = await putStore(sampleStore);

      expect(result.status).toBe(0);
      expect(result.error).toBe("Network timeout");
    });

    it("handles non-Error thrown objects", async () => {
      sessionStore["trackit.auth_token"] = "put-token";
      mockFetch.mockRejectedValue("string error");

      const result = await putStore(sampleStore);

      expect(result.status).toBe(0);
      expect(result.error).toBe("Network error");
    });
  });
});
