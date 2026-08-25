import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fc from "fast-check";
import { HistoryView } from "./HistoryView";
import type { TrackItStore, Task, TaskGroup, DayEntry } from "../types/index";

/**
 * Bug Condition Exploration Test
 * 
 * Property 1: History Resolves From Live Store After Task Modification
 * 
 * These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * The bug is that HistoryView resolves task titles, group names, and totalTasks
 * from the LIVE store.tasks / store.groups at render time, rather than from
 * a snapshot of the configuration that existed when entries were recorded.
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

// Mock getLastNDays to always include our test date "2025-01-10"
vi.mock("../lib/utils", () => ({
  getTodayString: () => "2025-01-15",
  formatDateLabel: (d: string) => d,
  getLastNDays: (n: number) => {
    // Return a list that includes our test date
    const dates: string[] = [];
    const base = new Date(2025, 0, 15); // Jan 15 2025
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    return dates;
  },
  generateId: (prefix = "ti") => `${prefix}_test_${Math.random().toString(36).slice(2, 8)}`,
  pruneOldEntries: (entries: DayEntry[]) => entries,
}));

function buildBaseStore(overrides: Partial<TrackItStore> = {}): TrackItStore {
  return {
    groups: [],
    tasks: [],
    entries: [],
    snapshots: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    books: [],
    schemaVersion: 1,
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("HistoryView — Bug Condition Exploration", () => {
  /**
   * Test Scenario 1: Deleted Task
   * 
   * Build a store with entries for "2025-01-10" referencing task-1,
   * then remove task-1 from store.tasks. Render HistoryView for "2025-01-10" —
   * assert original task title "Read 20 pages" is displayed.
   * 
   * Will FAIL on unfixed code because the task is gone from live data.
   */
  it("Scenario 1 (Deleted Task): should display original task title after task is deleted from store", () => {
    const store = buildBaseStore({
      groups: [{ id: "grp-1", name: "Daily Goals", order: 0 }],
      // task-1 has been DELETED — it's no longer in the tasks array
      tasks: [],
      entries: [
        { date: "2025-01-10", taskId: "task-1", done: true, comment: "", updatedAt: 1 },
      ],
      // Snapshot captures the original state when the entry was recorded
      snapshots: [{
        date: "2025-01-10",
        tasks: [{ id: "task-1", groupId: "grp-1", title: "Read 20 pages", order: 0 }],
        groups: [{ id: "grp-1", name: "Daily Goals", order: 0 }],
      }],
    });

    const { container } = render(<HistoryView store={store} />);

    // Click on the date cell for 2025-01-10 to open the detail panel
    const dateCell = screen.getByText("01-10");
    fireEvent.click(dateCell.closest("button")!);

    // The original task title "Read 20 pages" should appear even though
    // the task has been deleted from store.tasks
    // On unfixed code, this will FAIL because the task doesn't exist in store.tasks
    expect(container.textContent).toContain("Read 20 pages");
  });

  /**
   * Test Scenario 2: Renamed Task
   * 
   * Build a store with entries for "2025-01-10" where task title WAS "Morning workout",
   * rename task to "Gym session" in store.tasks. Render HistoryView —
   * assert "Morning workout" is displayed.
   * 
   * Will FAIL on unfixed code because it shows the CURRENT title "Gym session".
   */
  it("Scenario 2 (Renamed Task): should display original task title, not the renamed title", () => {
    const store = buildBaseStore({
      groups: [{ id: "grp-1", name: "Habits", order: 0 }],
      // Task has been RENAMED from "Morning workout" to "Gym session"
      tasks: [{ id: "task-1", groupId: "grp-1", title: "Gym session", order: 0 }],
      entries: [
        { date: "2025-01-10", taskId: "task-1", done: true, comment: "", updatedAt: 1 },
      ],
      // Snapshot captures the original title when the entry was recorded
      snapshots: [{
        date: "2025-01-10",
        tasks: [{ id: "task-1", groupId: "grp-1", title: "Morning workout", order: 0 }],
        groups: [{ id: "grp-1", name: "Habits", order: 0 }],
      }],
    });

    const { container } = render(<HistoryView store={store} />);

    // Click on the date cell for 2025-01-10
    const dateCell = screen.getByText("01-10");
    fireEvent.click(dateCell.closest("button")!);

    // The original title "Morning workout" should appear, not "Gym session"
    // On unfixed code, this will FAIL — it shows "Gym session" (the current title)
    expect(container.textContent).toContain("Morning workout");
    expect(container.textContent).not.toContain("Gym session");
  });

  /**
   * Test Scenario 3: Added Tasks / totalTasks inflation
   * 
   * Build a store with 3 tasks and entries for "2025-01-10",
   * add 2 more tasks to store.tasks. Render HistoryView —
   * assert totalTasks count shows "3" for that date, not "5".
   * 
   * Will FAIL on unfixed code because totalTasks = store.tasks.length (currently 5).
   */
  it("Scenario 3 (Added Tasks): should show historical totalTasks count, not current inflated count", () => {
    const store = buildBaseStore({
      groups: [{ id: "grp-1", name: "Daily Goals", order: 0 }],
      // NOW there are 5 tasks (2 were added AFTER 2025-01-10)
      tasks: [
        { id: "task-1", groupId: "grp-1", title: "Task A", order: 0 },
        { id: "task-2", groupId: "grp-1", title: "Task B", order: 1 },
        { id: "task-3", groupId: "grp-1", title: "Task C", order: 2 },
        { id: "task-4", groupId: "grp-1", title: "Task D (new)", order: 3 },
        { id: "task-5", groupId: "grp-1", title: "Task E (new)", order: 4 },
      ],
      // Only 3 tasks existed on 2025-01-10, all done
      entries: [
        { date: "2025-01-10", taskId: "task-1", done: true, comment: "", updatedAt: 1 },
        { date: "2025-01-10", taskId: "task-2", done: true, comment: "", updatedAt: 1 },
        { date: "2025-01-10", taskId: "task-3", done: true, comment: "", updatedAt: 1 },
      ],
      // Snapshot captures only the 3 tasks that existed on 2025-01-10
      snapshots: [{
        date: "2025-01-10",
        tasks: [
          { id: "task-1", groupId: "grp-1", title: "Task A", order: 0 },
          { id: "task-2", groupId: "grp-1", title: "Task B", order: 1 },
          { id: "task-3", groupId: "grp-1", title: "Task C", order: 2 },
        ],
        groups: [{ id: "grp-1", name: "Daily Goals", order: 0 }],
      }],
    });

    const { container } = render(<HistoryView store={store} />);

    // The day cell for 2025-01-10 should show "3/3" (3 done out of 3 that existed)
    // On unfixed code it will show "3/5" because totalTasks = store.tasks.length = 5
    expect(container.textContent).toContain("3/3");
    expect(container.textContent).not.toContain("3/5");
  });

  /**
   * Test Scenario 4: Deleted Group
   * 
   * Build a store with entries under "Habits" group for "2025-01-10",
   * delete the group from store.groups. Render HistoryView —
   * assert "Habits" group section still appears.
   * 
   * Will FAIL on unfixed code because the group no longer exists in store.groups.
   */
  it("Scenario 4 (Deleted Group): should display original group name after group is deleted", () => {
    const store = buildBaseStore({
      // Group has been DELETED — no longer in store.groups
      groups: [],
      // Tasks that belonged to the deleted group are also gone
      tasks: [],
      entries: [
        { date: "2025-01-10", taskId: "task-1", done: true, comment: "", updatedAt: 1 },
        { date: "2025-01-10", taskId: "task-2", done: false, comment: "", updatedAt: 1 },
      ],
      // Snapshot captures the original group and tasks
      snapshots: [{
        date: "2025-01-10",
        tasks: [
          { id: "task-1", groupId: "grp-1", title: "Meditate", order: 0 },
          { id: "task-2", groupId: "grp-1", title: "Journal", order: 1 },
        ],
        groups: [{ id: "grp-1", name: "Habits", order: 0 }],
      }],
    });

    const { container } = render(<HistoryView store={store} />);

    // Click on the date cell for 2025-01-10
    const dateCell = screen.getByText("01-10");
    fireEvent.click(dateCell.closest("button")!);

    // The group name "Habits" should still appear even though the group was deleted
    // On unfixed code, this will FAIL because store.groups is empty
    expect(container.textContent).toContain("Habits");
  });

  /**
   * Property-Based Test using fast-check
   * 
   * Property: for all (originalTitle, currentTitle) where originalTitle !== currentTitle,
   * when a task was recorded under originalTitle and then renamed to currentTitle,
   * the history view should display originalTitle (not currentTitle).
   * 
   * This generalizes Scenario 2 across arbitrary task titles.
   * 
   * Validates: Requirements 1.2, 1.5
   */
  it("PBT: renamed tasks should show original title in history, not current title", () => {
    // Use alphanumeric strings to avoid false matches with UI characters (/, ✓, ○, etc.)
    const alphaArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{2,25}$/).filter(s => s.trim().length >= 3);
    const groupArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{2,15}$/).filter(s => s.trim().length >= 3);

    fc.assert(
      fc.property(
        alphaArb,
        alphaArb,
        groupArb,
        (originalTitle, currentTitle, groupName) => {
          // Only test when titles are different (a rename actually happened)
          fc.pre(originalTitle.trim() !== currentTitle.trim());
          // Ensure neither title is a substring of the other to avoid ambiguous containment checks
          fc.pre(!originalTitle.includes(currentTitle) && !currentTitle.includes(originalTitle));

          const store = buildBaseStore({
            groups: [{ id: "grp-1", name: groupName, order: 0 }],
            tasks: [{ id: "task-1", groupId: "grp-1", title: currentTitle, order: 0 }],
            entries: [
              { date: "2025-01-10", taskId: "task-1", done: true, comment: "", updatedAt: 1 },
            ],
            // Snapshot captures the original title
            snapshots: [{
              date: "2025-01-10",
              tasks: [{ id: "task-1", groupId: "grp-1", title: originalTitle, order: 0 }],
              groups: [{ id: "grp-1", name: groupName, order: 0 }],
            }],
          });

          const { container, unmount } = render(<HistoryView store={store} />);

          // Click on the date cell
          const dateCell = screen.getByText("01-10");
          fireEvent.click(dateCell.closest("button")!);

          // The history should show the ORIGINAL title, not the current one
          const text = container.textContent || "";
          const showsOriginal = text.includes(originalTitle);
          const showsCurrent = text.includes(currentTitle);

          unmount();

          // With the fix: history uses snapshot data (originalTitle)
          // not live data (currentTitle)
          return showsOriginal && !showsCurrent;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property-Based Test: totalTasks count inflation
   * 
   * Property: for all (numOriginalTasks, numAddedTasks) where numAddedTasks > 0,
   * after adding tasks, the history view should still show the original count.
   * 
   * This generalizes Scenario 3 across arbitrary task counts.
   * 
   * Validates: Requirements 1.3, 1.4
   */
  it("PBT: totalTasks in history should reflect historical count, not current count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (numOriginalTasks, numAddedTasks) => {
          const allTasks: Task[] = [];
          const snapshotTasks: Task[] = [];
          const entries: DayEntry[] = [];

          // Original tasks that existed on 2025-01-10
          for (let i = 0; i < numOriginalTasks; i++) {
            const task = {
              id: `task-orig-${i}`,
              groupId: "grp-1",
              title: `Original Task ${i}`,
              order: i,
            };
            allTasks.push(task);
            snapshotTasks.push(task);
            entries.push({
              date: "2025-01-10",
              taskId: `task-orig-${i}`,
              done: true,
              comment: "",
              updatedAt: 1,
            });
          }

          // Tasks added AFTER 2025-01-10 (should not inflate totalTasks)
          for (let i = 0; i < numAddedTasks; i++) {
            allTasks.push({
              id: `task-new-${i}`,
              groupId: "grp-1",
              title: `New Task ${i}`,
              order: numOriginalTasks + i,
            });
          }

          const store = buildBaseStore({
            groups: [{ id: "grp-1", name: "Goals", order: 0 }],
            tasks: allTasks,
            entries,
            // Snapshot only has the original tasks
            snapshots: [{
              date: "2025-01-10",
              tasks: snapshotTasks,
              groups: [{ id: "grp-1", name: "Goals", order: 0 }],
            }],
          });

          const { container, unmount } = render(<HistoryView store={store} />);

          // Find the specific day cell for 2025-01-10 and check its count text
          const dayCells = container.querySelectorAll(".history-day-cell");
          let targetCellText = "";
          for (const cell of dayCells) {
            if (cell.textContent?.includes("01-10")) {
              targetCellText = cell.textContent;
              break;
            }
          }

          unmount();

          const totalCurrent = numOriginalTasks + numAddedTasks;
          // The specific day cell for 2025-01-10 should show "numOriginalTasks/numOriginalTasks"
          // NOT "numOriginalTasks/totalCurrent" (inflated by new tasks)
          const expectedCount = `${numOriginalTasks}/${numOriginalTasks}`;
          const wrongCount = `${numOriginalTasks}/${totalCurrent}`;

          // With the fix: totalTasks = snapshot.tasks.length = numOriginalTasks
          return targetCellText.includes(expectedCount) && !targetCellText.includes(wrongCount);
        }
      ),
      { numRuns: 20 }
    );
  });
});
