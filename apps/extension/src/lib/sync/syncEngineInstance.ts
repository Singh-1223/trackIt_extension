/**
 * Singleton SyncEngine instance for use across the extension.
 *
 * Provides a lazily-initialized sync engine that other modules (e.g. saveStore)
 * can import to trigger push/pull without managing lifecycle themselves.
 */

import { createSyncEngine, type SyncEngine } from "./syncEngine";

let instance: SyncEngine | null = null;

/**
 * Get the singleton SyncEngine instance (creates one on first call).
 */
export function getSyncEngine(): SyncEngine {
  if (!instance) {
    instance = createSyncEngine();
  }
  return instance;
}

/**
 * Replace the singleton instance (useful for testing or reinitialization).
 */
export function setSyncEngine(engine: SyncEngine | null): void {
  if (instance && engine !== instance) {
    instance.destroy();
  }
  instance = engine;
}

/**
 * Destroy the current instance and reset to null.
 */
export function destroySyncEngine(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
