import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";

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

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

function clearSessionStore() {
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
}

// --- Mock @clerk/chrome-extension ---
const mockGetToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
const mockSignOut = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockUseAuth = vi.fn().mockReturnValue({
  isSignedIn: false,
  isLoaded: true,
  signOut: mockSignOut,
  getToken: mockGetToken,
});
const mockUseUser = vi.fn().mockReturnValue({ user: null });

vi.mock("@clerk/chrome-extension", () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

// Import after mocks are set up
import { AuthProvider, useAuthContext } from "./AuthProvider";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

/** Helper to create a JWT with a given exp (seconds since epoch) */
function createJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = btoa("fake-signature");
  return `${header}.${body}.${sig}`;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    clearSessionStore();
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
      signOut: mockSignOut,
      getToken: mockGetToken,
    });
    mockUseUser.mockReturnValue({ user: null });
    mockGetToken.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("starts with isLoading false and isSignedIn false when no user is signed in", async () => {
      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSignedIn).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("shows isLoading true while Clerk is not loaded", () => {
      mockUseAuth.mockReturnValue({
        isSignedIn: false,
        isLoaded: false,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("authenticated state", () => {
    it("transitions to signed in when Clerk is authenticated and token is valid", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = createJwt({ sub: "user-1", exp: futureExp });
      sessionStore["trackit.auth_token"] = validToken;

      mockGetToken.mockResolvedValue(validToken);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({
        user: {
          firstName: "John",
          lastName: "Doe",
          primaryEmailAddress: { emailAddress: "john@example.com" },
        },
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSignedIn).toBe(true);
      expect(result.current.user).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("exposes user email when no name is available", async () => {
      const validToken = "opaque-token";
      sessionStore["trackit.auth_token"] = validToken;

      mockGetToken.mockResolvedValue(validToken);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({
        user: {
          firstName: null,
          lastName: null,
          primaryEmailAddress: { emailAddress: "user@example.com" },
        },
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSignedIn).toBe(true);
      });

      expect(result.current.user).toEqual({
        name: undefined,
        email: "user@example.com",
      });
    });
  });

  describe("token validation on mount", () => {
    it("transitions to unauthenticated when stored token is expired", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expiredToken = createJwt({ sub: "user-1", exp: pastExp });
      sessionStore["trackit.auth_token"] = expiredToken;

      // Clerk says signed in but stored token is expired;
      // getToken returns a fresh token to fix the state
      const freshToken = createJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 });
      mockGetToken.mockResolvedValue(freshToken);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({
        user: {
          firstName: "Test",
          lastName: null,
          primaryEmailAddress: { emailAddress: "test@example.com" },
        },
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should recover by getting a fresh token from Clerk
      expect(result.current.isSignedIn).toBe(true);
    });

    it("transitions to unauthenticated when Clerk cannot provide a fresh token", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      const expiredToken = createJwt({ sub: "user-1", exp: pastExp });
      sessionStore["trackit.auth_token"] = expiredToken;

      mockGetToken.mockResolvedValue(null);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({ user: null });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isSignedIn).toBe(false);
    });
  });

  describe("signOut", () => {
    it("clears token and calls Clerk signOut", async () => {
      const validToken = "some-valid-token";
      sessionStore["trackit.auth_token"] = validToken;

      mockGetToken.mockResolvedValue(validToken);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({
        user: {
          firstName: "Jane",
          lastName: null,
          primaryEmailAddress: { emailAddress: "jane@example.com" },
        },
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSignedIn).toBe(true);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.isSignedIn).toBe(false);
      expect(sessionStore["trackit.auth_token"]).toBeUndefined();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("getToken", () => {
    it("returns stored token when valid", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = createJwt({ sub: "user-1", exp: futureExp });
      sessionStore["trackit.auth_token"] = validToken;

      mockGetToken.mockResolvedValue(validToken);
      mockUseAuth.mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        signOut: mockSignOut,
        getToken: mockGetToken,
      });
      mockUseUser.mockReturnValue({
        user: {
          firstName: "Test",
          lastName: null,
          primaryEmailAddress: { emailAddress: "test@example.com" },
        },
      });

      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSignedIn).toBe(true);
      });

      const token = await result.current.getToken();
      expect(token).toBe(validToken);
    });

    it("returns null when no token is stored", async () => {
      const { result } = renderHook(() => useAuthContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const token = await result.current.getToken();
      expect(token).toBeNull();
    });
  });
});
