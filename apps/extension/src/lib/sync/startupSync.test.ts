import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import type { TrackItStore } from "../../types";
import type { SyncEngine, SyncStatus } from "./syncEngine";

// --- Mocks ---

// Mock AuthProvider
const mockGetToken = vi.fn<() => Promise<string | null>>();
vi.mock("../auth/AuthProvider", () => ({
  useAuthContext: () => ({
    isSignedIn: mockIsSignedIn,
    isLoading: mockIsLoading,
    getToken: mockGetToken,
    user: null,
    signOut: vi.fn(),
  }),
}));

// Mock store functions
const mockGetStore = vi.fn<() => Promise<TrackItStore>>();
const mockSaveStore = vi.fn<(store: TrackItStore) => Promise<void>>();
vi.mock("../store", () => ({
  getStore: (...args: unknown[]) => mockGetStore(...(args as [])),
  saveStore: (...args: unknown[]) => mockSaveStore(...(args as [TrackItStore])),
}));

// Mock offlineQueue
const mockGetSyncMetadata = vi.fn();
const mockSetSyncMetadata = vi.fn();
vi.mock("./offlineQueue", () => ({
  getSyncMetadata: (...args: unknown[]) => mockGetSyncMetadata(...(args as [])),
  setSyncMetadata: (...args: unknown[]) => mockSetSyncMetadata(...(args as [])),
}));

// Mock syncEngine module
vi.mock("./syncEngine", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./syncEngine")>();
  return {
    ...orig,
    createSyncEngine: () => mockSyncEngine,
  };
});

// Auth state control variables
let mockIsSignedIn = false;
let mockIsLoading = false;

function makeStore(overrides?: Partial<TrackItStore>): TrackItStore {
  return {
    groups: [],
    tasks: [],
    entries: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    schemaVersion: 1,
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Mock sync engine
let mockSyncEngine: SyncEngine;

function createMockSyncEngine(overrides?: Partial<SyncEngine>): SyncEngine {
  return {
    push: vi.fn().mockResolvedValue({ success: true, retriesUsed: 0 }),
    pull: vi.fn().mockResolvedValue(null),
    getStatus: vi.fn().mockReturnValue("idle" as SyncStatus),
    onStatusChange: vi.fn().mockReturnValue(() => {}),
    destroy: vi.fn(),
    ...overrides,
  };
}

describe("useStartupSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSignedIn = false;
    mockIsLoading = false;
    mockSyncEngine = createMockSyncEngine();
    mockGetSyncMetadata.mockResolvedValue({
      lastSyncedAt: 0,
      lastSyncedStoreHash: "",
      pendingPush: false,
      migrationComplete: false,
    });
    mockSetSyncMetadata.mockResolvedValue(undefined);
    mockSaveStore.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Lazy-import to ensure mocks are set up before module load
  async function importHook() {
    const mod = await import("./startupSync");
    return mod.useStartupSync;
  }

  it("should load local store when user is not signed in", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });
    mockGetStore.mockResolvedValue(localStore);
    mockIsSignedIn = false;
    mockIsLoading = false;

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.store).toEqual(localStore);
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.conflictResolved).toBe(false);
    expect(mockSyncEngine.pull).not.toHaveBeenCalled();
  });

  it("should not run while auth is still loading", async () => {
    const useStartupSync = await importHook();
    mockIsLoading = true;
    mockIsSignedIn = false;

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    // Should stay idle
    expect(result.current.status).toBe("idle");
    expect(result.current.store).toBeNull();
    expect(mockGetStore).not.toHaveBeenCalled();
  });

  it("should fall back to local data when token is unavailable", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });
    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue(null);
    mockGetStore.mockResolvedValue(localStore);

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.store).toEqual(localStore);
    });

    expect(result.current.status).toBe("idle");
    expect(mockSyncEngine.pull).not.toHaveBeenCalled();
  });

  it("should pull remote and use remote if remote is newer", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });
    const remoteStore = makeStore({ updatedAt: 2000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(result.current.store).toEqual(remoteStore);
    expect(mockSaveStore).toHaveBeenCalledWith(remoteStore);
    expect(mockSyncEngine.push).not.toHaveBeenCalled();
  });

  it("should push local if local is newer than remote", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 3000 });
    const remoteStore = makeStore({ updatedAt: 1000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(result.current.store).toEqual(localStore);
    expect(mockSyncEngine.push).toHaveBeenCalledWith(localStore);
    expect(mockSaveStore).not.toHaveBeenCalled();
  });

  it("should push local to cloud if no remote document exists (404)", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockSyncEngine.getStatus as ReturnType<typeof vi.fn>).mockReturnValue("idle");

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(result.current.store).toEqual(localStore);
    expect(mockSyncEngine.push).toHaveBeenCalledWith(localStore);
  });

  it("should set offline status when pull fails due to network error", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (mockSyncEngine.getStatus as ReturnType<typeof vi.fn>).mockReturnValue("error");

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });

    expect(result.current.store).toEqual(localStore);
    expect(result.current.error).toBeNull();
  });

  it("should handle exception during pull gracefully and fall back to local data", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network timeout")
    );

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });

    expect(result.current.store).toEqual(localStore);
    expect(result.current.error).toBe("Network timeout");
  });

  it("should detect and flag conflict when both local and remote changed since last sync", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 3000 });
    const remoteStore = makeStore({ updatedAt: 2000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    // Last sync was at 1000, both local (3000) and remote (2000) have changed
    mockGetSyncMetadata.mockResolvedValue({
      lastSyncedAt: 1000,
      lastSyncedStoreHash: "",
      pendingPush: false,
      migrationComplete: true,
    });

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(result.current.conflictResolved).toBe(true);
    // Local wins because it has higher updatedAt
    expect(result.current.store).toEqual(localStore);
    expect(mockSyncEngine.push).toHaveBeenCalledWith(localStore);
  });

  it("should not flag conflict when only one side changed", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 }); // Same as last sync
    const remoteStore = makeStore({ updatedAt: 2000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    // Last sync was at 1000, local hasn't changed but remote has
    mockGetSyncMetadata.mockResolvedValue({
      lastSyncedAt: 1000,
      lastSyncedStoreHash: "",
      pendingPush: false,
      migrationComplete: true,
    });

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(result.current.conflictResolved).toBe(false);
    // Remote wins
    expect(result.current.store).toEqual(remoteStore);
    expect(mockSaveStore).toHaveBeenCalledWith(remoteStore);
  });

  it("should update sync metadata after successful sync", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });
    const remoteStore = makeStore({ updatedAt: 2000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    expect(mockSetSyncMetadata).toHaveBeenCalledWith({
      lastSyncedAt: 2000,
      pendingPush: false,
    });
  });

  it("should not run sync when enabled is false", async () => {
    const useStartupSync = await importHook();
    mockIsSignedIn = true;
    mockIsLoading = false;

    const { result } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine, enabled: false })
    );

    // Nothing should happen
    expect(result.current.status).toBe("idle");
    expect(result.current.store).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockGetStore).not.toHaveBeenCalled();
  });

  it("should only run once per mount", async () => {
    const useStartupSync = await importHook();
    const localStore = makeStore({ updatedAt: 1000 });
    const remoteStore = makeStore({ updatedAt: 2000 });

    mockIsSignedIn = true;
    mockIsLoading = false;
    mockGetToken.mockResolvedValue("valid-token");
    mockGetStore.mockResolvedValue(localStore);
    (mockSyncEngine.pull as ReturnType<typeof vi.fn>).mockResolvedValue(remoteStore);

    const { result, rerender } = renderHook(() =>
      useStartupSync({ syncEngine: mockSyncEngine })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("synced");
    });

    // Re-render should not trigger another sync
    rerender();

    expect(mockSyncEngine.pull).toHaveBeenCalledTimes(1);
  });
});
