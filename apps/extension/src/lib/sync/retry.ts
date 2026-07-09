import type { SyncMetadata } from "../../types";

/**
 * Configuration for retry with exponential backoff.
 * Delay formula: 1000 * 2^(attempt - 1) ms → 1s, 2s, 4s
 */
export interface RetryConfig {
  maxRetries: number; // Maximum number of retry attempts (default: 3)
  baseDelayMs: number; // Base delay in milliseconds (default: 1000)
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  retriesUsed: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

/**
 * Calculates the delay before attempt N using exponential backoff.
 * delay = baseDelayMs * 2^(attempt - 1)
 * Attempt 1: 1000ms, Attempt 2: 2000ms, Attempt 3: 4000ms
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = DEFAULT_CONFIG.baseDelayMs
): number {
  return baseDelayMs * Math.pow(2, attempt - 1);
}

/**
 * Delays execution for the specified number of milliseconds.
 * Accepts an optional AbortSignal to cancel the delay early.
 */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("Aborted"));
        },
        { once: true }
      );
    }
  });
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 *
 * On each failure, waits `baseDelayMs * 2^(attempt - 1)` ms before retrying.
 * After all retries are exhausted, returns a failure result.
 *
 * @param operation - The async function to retry
 * @param config - Retry configuration (defaults to 3 retries, 1000ms base delay)
 * @returns RetryResult with success status, data, and retries used
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const { maxRetries, baseDelayMs } = { ...DEFAULT_CONFIG, ...config };
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();
      return { success: true, data, retriesUsed: attempt - 1 };
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : String(err);

      // Don't delay after the last attempt
      if (attempt < maxRetries) {
        const backoffDelay = calculateBackoffDelay(attempt, baseDelayMs);
        await delay(backoffDelay);
      }
    }
  }

  return {
    success: false,
    error: lastError,
    retriesUsed: maxRetries,
  };
}

/**
 * Marks pending push in sync metadata stored in chrome.storage.local.
 */
export async function markPendingPush(pending: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["trackit.sync_metadata"],
      (items: Record<string, unknown>) => {
        const metadata: SyncMetadata = (items["trackit.sync_metadata"] as SyncMetadata) || {
          lastSyncedAt: 0,
          lastSyncedStoreHash: "",
          pendingPush: false,
          migrationComplete: false,
        };

        metadata.pendingPush = pending;

        chrome.storage.local.set(
          { "trackit.sync_metadata": metadata },
          () => resolve()
        );
      }
    );
  });
}

/**
 * Reads sync metadata from chrome.storage.local.
 */
export async function getSyncMetadata(): Promise<SyncMetadata> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["trackit.sync_metadata"],
      (items: Record<string, unknown>) => {
        const metadata: SyncMetadata = (items["trackit.sync_metadata"] as SyncMetadata) || {
          lastSyncedAt: 0,
          lastSyncedStoreHash: "",
          pendingPush: false,
          migrationComplete: false,
        };
        resolve(metadata);
      }
    );
  });
}

/**
 * Manages the online event listener to re-attempt pending pushes when
 * network connectivity is restored.
 */
export class OnlineRetryManager {
  private listener: (() => void) | null = null;
  private pushFn: (() => Promise<void>) | null = null;

  /**
   * Registers a push function to be called when the browser comes online
   * and there are pending pushes.
   *
   * The push is attempted within 10 seconds of the online event firing
   * (using a small random jitter to avoid thundering herd).
   */
  start(pushFn: () => Promise<void>): void {
    this.pushFn = pushFn;

    if (this.listener) {
      // Already listening
      return;
    }

    this.listener = () => {
      this.handleOnline();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.listener);
    }
  }

  /**
   * Removes the online event listener and stops monitoring.
   */
  stop(): void {
    if (this.listener && typeof window !== "undefined") {
      window.removeEventListener("online", this.listener);
    }
    this.listener = null;
    this.pushFn = null;
  }

  private async handleOnline(): Promise<void> {
    if (!this.pushFn) return;

    const metadata = await getSyncMetadata();
    if (!metadata.pendingPush) return;

    // Add a small random delay (0–3s) to avoid thundering herd,
    // but always within the 10-second requirement
    const jitter = Math.floor(Math.random() * 3000);
    await delay(jitter);

    try {
      await this.pushFn();
    } catch {
      // Push function handles its own retry logic
    }
  }
}
