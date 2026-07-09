import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";

// --- Mock chrome APIs ---
const chromeMock = {
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    create: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn((_keys: string[], cb: (items: Record<string, unknown>) => void) => cb({})),
      set: vi.fn((_items: Record<string, unknown>, cb: () => void) => cb()),
      remove: vi.fn((_key: string, cb: () => void) => cb()),
    },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;

// --- Mock useAuthContext ---
const mockSignOut = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

let mockAuthState = {
  isSignedIn: false,
  isLoading: false,
  user: null as { name?: string; email: string } | null,
  getToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
  signOut: mockSignOut,
};

vi.mock("../lib/auth/AuthProvider", () => ({
  useAuthContext: () => mockAuthState,
}));

import { AuthButton } from "./AuthButton";

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockAuthState = {
      isSignedIn: false,
      isLoading: false,
      user: null,
      getToken: vi.fn().mockResolvedValue(null),
      signOut: mockSignOut,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("unauthenticated state", () => {
    it("shows Sign In button when not signed in (Requirement 1.1)", () => {
      render(<AuthButton />);
      const signInBtn = screen.getByRole("button", { name: /sign in/i });
      expect(signInBtn).toBeDefined();
    });

    it("opens a new tab with Clerk sign-in flow on click (Requirement 1.2)", () => {
      render(<AuthButton />);

      const signInBtn = screen.getByRole("button", { name: /sign in/i });
      fireEvent.click(signInBtn);

      expect(chromeMock.tabs.create).toHaveBeenCalledWith({
        url: expect.stringContaining("popup.html#/sign-in"),
      });
    });
  });

  describe("authenticated state", () => {
    it("shows user name and Sign Out button when signed in (Requirement 1.4)", () => {
      mockAuthState = {
        ...mockAuthState,
        isSignedIn: true,
        user: { name: "John Doe", email: "john@example.com" },
      };

      render(<AuthButton />);
      expect(screen.getByText("John Doe")).toBeDefined();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeDefined();
    });

    it("shows email when no name is available (Requirement 1.4)", () => {
      mockAuthState = {
        ...mockAuthState,
        isSignedIn: true,
        user: { email: "user@example.com" },
      };

      render(<AuthButton />);
      expect(screen.getByText("user@example.com")).toBeDefined();
    });

    it("calls signOut from AuthContext when Sign Out is clicked (Requirement 1.5)", async () => {
      mockAuthState = {
        ...mockAuthState,
        isSignedIn: true,
        user: { name: "Jane", email: "jane@example.com" },
      };

      render(<AuthButton />);

      const signOutBtn = screen.getByRole("button", { name: /sign out/i });
      await act(async () => {
        fireEvent.click(signOutBtn);
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows loading text while auth is loading", () => {
      mockAuthState = {
        ...mockAuthState,
        isLoading: true,
      };

      render(<AuthButton />);
      expect(screen.getByText("Loading…")).toBeDefined();
    });
  });

  describe("session expiry notification", () => {
    it("shows a 5-second notification on session expiry (Requirement 1.8)", () => {
      // Start as signed in
      mockAuthState = {
        ...mockAuthState,
        isSignedIn: true,
        isLoading: false,
        user: { name: "Test User", email: "test@example.com" },
      };

      const { rerender } = render(<AuthButton />);

      // Simulate session expiry: transition to signed out (not via manual sign-out)
      mockAuthState = {
        ...mockAuthState,
        isSignedIn: false,
        isLoading: false,
        user: null,
      };

      rerender(<AuthButton />);

      // Notification should appear
      expect(screen.getByRole("status")).toBeDefined();
      expect(screen.getByText(/session has expired/i)).toBeDefined();

      // After 5 seconds, notification should disappear
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByRole("status")).toBeNull();
    });

    it("does not show notification on manual sign-out", async () => {
      // Mock that signOut takes some time
      mockSignOut.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      mockAuthState = {
        ...mockAuthState,
        isSignedIn: true,
        isLoading: false,
        user: { name: "Test", email: "test@example.com" },
      };

      const { rerender } = render(<AuthButton />);

      // Click sign out
      const signOutBtn = screen.getByRole("button", { name: /sign out/i });
      await act(async () => {
        fireEvent.click(signOutBtn);
      });

      // Transition to signed out after signOut completes
      act(() => {
        vi.advanceTimersByTime(200);
      });

      mockAuthState = {
        ...mockAuthState,
        isSignedIn: false,
        isLoading: false,
        user: null,
      };

      rerender(<AuthButton />);

      // No notification should appear since it was a manual sign-out
      expect(screen.queryByText(/session has expired/i)).toBeNull();
    });
  });
});
