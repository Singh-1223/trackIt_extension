import { useEffect, useRef, useState } from "react";
import type { SyncStatus } from "../lib/sync/syncEngine";

/**
 * SyncStatusIndicator — shows sync state in the toolbar area.
 *
 * - Spinning icon while pushing/pulling
 * - Success checkmark for 3 seconds after sync completes
 * - Error icon when sync fails
 * - Offline indicator when network is unavailable
 * - Hidden (or subtle "synced") when idle with no recent activity
 *
 * Requirements: 3.6, 3.7
 */

interface SyncStatusIndicatorProps {
  status: SyncStatus;
}

/** Duration to show the success checkmark after sync completes (ms). */
const SUCCESS_DISPLAY_MS = 3000;

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const prevStatus = useRef<SyncStatus>(status);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Detect transition from pushing/pulling → idle (successful sync)
    const wasSyncing =
      prevStatus.current === "pushing" || prevStatus.current === "pulling";

    if (wasSyncing && status === "idle") {
      setShowSuccess(true);
      successTimer.current = setTimeout(() => {
        setShowSuccess(false);
      }, SUCCESS_DISPLAY_MS);
    }

    // If status moves away from idle, clear any active success display
    if (status !== "idle") {
      setShowSuccess(false);
      if (successTimer.current) {
        clearTimeout(successTimer.current);
        successTimer.current = null;
      }
    }

    prevStatus.current = status;

    return () => {
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
    };
  }, [status]);

  // Idle with no recent sync — render nothing
  if (status === "idle" && !showSuccess) {
    return null;
  }

  return (
    <div
      className="sync-status-indicator"
      role="status"
      aria-live="polite"
      aria-label={getAriaLabel(status, showSuccess)}
    >
      {(status === "pushing" || status === "pulling") && (
        <span className="sync-status-syncing" title="Syncing…">
          <SyncIcon />
        </span>
      )}

      {status === "idle" && showSuccess && (
        <span className="sync-status-success" title="Synced">
          <CheckIcon />
        </span>
      )}

      {status === "error" && (
        <span className="sync-status-error" title="Sync error">
          <ErrorIcon />
        </span>
      )}

      {status === "offline" && (
        <span className="sync-status-offline" title="Offline">
          <OfflineIcon />
        </span>
      )}
    </div>
  );
}

function getAriaLabel(status: SyncStatus, showSuccess: boolean): string {
  if (status === "pushing") return "Syncing changes to cloud";
  if (status === "pulling") return "Pulling changes from cloud";
  if (status === "idle" && showSuccess) return "Sync complete";
  if (status === "error") return "Sync error";
  if (status === "offline") return "Offline";
  return "Sync status";
}

/** Spinning sync/arrows icon */
function SyncIcon() {
  return (
    <svg
      className="sync-icon-spin"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M2.5 8a5.5 5.5 0 0 1 9.3-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8a5.5 5.5 0 0 1-9.3 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.5 2v2.5H14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 14v-2.5H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Checkmark icon */
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 8.5l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Error/exclamation icon */
function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5v4" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Offline/cloud-off icon */
function OfflineIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M4 12.5h7.5a3 3 0 0 0 .5-5.96A4.5 4.5 0 0 0 4 7.5a3.5 3.5 0 0 0 0 5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 2l12 12" strokeLinecap="round" />
    </svg>
  );
}
