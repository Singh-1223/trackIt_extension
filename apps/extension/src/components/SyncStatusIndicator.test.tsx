import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

describe("SyncStatusIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when status is idle and no recent sync", () => {
    const { container } = render(<SyncStatusIndicator status="idle" />);
    expect(container.querySelector(".sync-status-indicator")).toBeNull();
  });

  it("shows syncing icon when status is pushing", () => {
    render(<SyncStatusIndicator status="pushing" />);
    const indicator = screen.getByRole("status");
    expect(indicator).toBeTruthy();
    expect(indicator.querySelector(".sync-status-syncing")).toBeTruthy();
  });

  it("shows syncing icon when status is pulling", () => {
    render(<SyncStatusIndicator status="pulling" />);
    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-syncing")).toBeTruthy();
  });

  it("shows success checkmark for 3 seconds after transitioning from pushing to idle", () => {
    const { rerender } = render(<SyncStatusIndicator status="pushing" />);

    // Transition to idle
    rerender(<SyncStatusIndicator status="idle" />);

    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-success")).toBeTruthy();

    // After 3 seconds, success should disappear
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows success checkmark for 3 seconds after transitioning from pulling to idle", () => {
    const { rerender } = render(<SyncStatusIndicator status="pulling" />);

    // Transition to idle
    rerender(<SyncStatusIndicator status="idle" />);

    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-success")).toBeTruthy();

    // After 3 seconds, success disappears
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows error icon when status is error", () => {
    render(<SyncStatusIndicator status="error" />);
    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-error")).toBeTruthy();
  });

  it("shows offline indicator when status is offline", () => {
    render(<SyncStatusIndicator status="offline" />);
    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-offline")).toBeTruthy();
  });

  it("clears success display when status moves away from idle", () => {
    const { rerender } = render(<SyncStatusIndicator status="pushing" />);

    // Transition to idle → success shown
    rerender(<SyncStatusIndicator status="idle" />);
    expect(screen.getByRole("status").querySelector(".sync-status-success")).toBeTruthy();

    // Now transition to pushing again — success should be cleared
    rerender(<SyncStatusIndicator status="pushing" />);
    const indicator = screen.getByRole("status");
    expect(indicator.querySelector(".sync-status-success")).toBeNull();
    expect(indicator.querySelector(".sync-status-syncing")).toBeTruthy();
  });

  it("has correct aria-label for pushing status", () => {
    render(<SyncStatusIndicator status="pushing" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Syncing changes to cloud"
    );
  });

  it("has correct aria-label for pulling status", () => {
    render(<SyncStatusIndicator status="pulling" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Pulling changes from cloud"
    );
  });

  it("has correct aria-label for error status", () => {
    render(<SyncStatusIndicator status="error" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Sync error");
  });

  it("has correct aria-label for offline status", () => {
    render(<SyncStatusIndicator status="offline" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Offline");
  });
});
