/**
 * Migration — Initial data migration logic for first-time sign-in.
 *
 * On first sign-in:
 * 1. Check if migrationComplete is already true → skip
 * 2. Pull from cloud (GET /api/store)
 * 3. If 404 → check if local store has real data → if yes, PUT local to cloud
 * 4. If 404 and local is default → create empty document on API
 * 5. If remote exists → write remote to local cache
 * 6. Set migrationComplete: true
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { TrackItStore } from "../../types";
import * as apiClient from "./apiClient";
import { getSyncMetadata, setSyncMetadata } from "./offlineQueue";
import { getStore } from "../store";

const STORAGE_KEY = "trackit.store";

/**
 * Write a store directly to chrome.storage.local without modifying updatedAt
 * or triggering sync. Used during migration to preserve the remote store's timestamp.
 */
function writeStoreToLocal(store: TrackItStore): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: store }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

export type MigrationStatus =
  | "idle"
  | "in-progress"
  | "success"
  | "error";

export interface MigrationResult {
  status: "success" | "error";
  message: string;
}

type MigrationStatusListener = (status: MigrationStatus) => void;

const statusListeners = new Set<MigrationStatusListener>();
let currentStatus: MigrationStatus = "idle";

function setMigrationStatus(status: MigrationStatus): void {
  currentStatus = status;
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch {
      // Listener errors should not break migration
    }
  }
}

/**
 * Subscribe to migration status changes.
 * Returns an unsubscribe function.
 */
export function onMigrationStatusChange(cb: MigrationStatusListener): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

/**
 * Get the current migration status.
 */
export function getMigrationStatus(): MigrationStatus {
  return currentStatus;
}

/**
 * Determine if the local store has user modifications
 * (i.e., it is NOT just the default store).
 *
 * The default store has exactly 2 groups and 5 tasks with known IDs,
 * and empty arrays for entries, todos, notes, habits, habitEntries.
 */
export function hasUserModifications(store: TrackItStore): boolean {
  // If any of these arrays have content, the user has made modifications
  if (store.entries.length > 0) return true;
  if (store.todos.length > 0) return true;
  if (store.notes.length > 0) return true;
  if (store.habits.length > 0) return true;
  if (store.habitEntries.length > 0) return true;

  // Check if groups differ from default (2 default groups)
  const defaultGroupIds = new Set(["grp-daily", "grp-habits"]);
  if (store.groups.length !== 2) return true;
  if (!store.groups.every((g) => defaultGroupIds.has(g.id))) return true;

  // Check if tasks differ from default (5 default tasks)
  const defaultTaskIds = new Set(["task-1", "task-2", "task-3", "task-4", "task-5"]);
  if (store.tasks.length !== 5) return true;
  if (!store.tasks.every((t) => defaultTaskIds.has(t.id))) return true;

  return false;
}

/**
 * Run the initial data migration on first sign-in.
 *
 * - If migrationComplete is already true, returns immediately.
 * - Displays progress indicator (in-progress status) during migration.
 * - On success: sets migrationComplete: true, emits "success" status.
 * - On failure: emits "error" status, retains local data unchanged.
 */
export async function runMigration(): Promise<MigrationResult> {
  // Step 1: Check if migration already completed
  const meta = await getSyncMetadata();
  if (meta.migrationComplete) {
    return { status: "success", message: "Migration already complete" };
  }

  // Set in-progress status (for UI progress indicator)
  setMigrationStatus("in-progress");

  try {
    // Step 2: Pull from cloud (GET /api/store)
    const remoteResponse = await apiClient.getStore();

    // Handle network/auth errors
    if (remoteResponse.status === 0 && remoteResponse.error) {
      setMigrationStatus("error");
      return {
        status: "error",
        message: remoteResponse.error,
      };
    }

    if (remoteResponse.status === 404) {
      // Step 3: No remote document exists
      const localStore = await getStore();

      if (hasUserModifications(localStore)) {
        // Step 3a: Local has real data → upload to cloud
        const putResponse = await apiClient.putStore(localStore);

        if (putResponse.status >= 200 && putResponse.status < 300) {
          // Success — mark migration complete
          await setSyncMetadata({ migrationComplete: true });
          setMigrationStatus("success");
          return {
            status: "success",
            message: "Local data synced to cloud",
          };
        } else {
          // Upload failed
          setMigrationStatus("error");
          return {
            status: "error",
            message: putResponse.error || `Upload failed with status ${putResponse.status}`,
          };
        }
      } else {
        // Step 3b: Local is default store → create empty document on API
        const putResponse = await apiClient.putStore(localStore);

        if (putResponse.status >= 200 && putResponse.status < 300) {
          await setSyncMetadata({ migrationComplete: true });
          setMigrationStatus("success");
          return {
            status: "success",
            message: "Empty document created on cloud",
          };
        } else {
          setMigrationStatus("error");
          return {
            status: "error",
            message: putResponse.error || `Failed to create document with status ${putResponse.status}`,
          };
        }
      }
    } else if (
      remoteResponse.status >= 200 &&
      remoteResponse.status < 300 &&
      remoteResponse.data
    ) {
      // Step 4: Remote exists → write remote to local cache (preserving remote updatedAt)
      await writeStoreToLocal(remoteResponse.data);
      await setSyncMetadata({ migrationComplete: true });
      setMigrationStatus("success");
      return {
        status: "success",
        message: "Cloud data synced to local",
      };
    } else {
      // Unexpected response
      setMigrationStatus("error");
      return {
        status: "error",
        message: remoteResponse.error || `Unexpected response status ${remoteResponse.status}`,
      };
    }
  } catch (err) {
    setMigrationStatus("error");
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown migration error",
    };
  }
}
