import { describe, it, expect } from "vitest";
import { validateStore } from "./validateStore";

function makeValidStore() {
  return {
    groups: [],
    tasks: [],
    entries: [],
    snapshots: [],
    todos: [],
    notes: [],
    habits: [],
    habitEntries: [],
    schemaVersion: 1,
    updatedAt: Date.now(),
  };
}

describe("validateStore", () => {
  describe("valid payloads", () => {
    it("accepts a store with all required fields and correct types", () => {
      const result = validateStore(makeValidStore());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("accepts a store with populated arrays", () => {
      const store = {
        ...makeValidStore(),
        groups: [{ id: "1", name: "Work", order: 0 }],
        tasks: [{ id: "1", groupId: "1", title: "Do stuff", order: 0 }],
      };
      const result = validateStore(store);
      expect(result.valid).toBe(true);
    });

    it("accepts a store with extra fields beyond required ones", () => {
      const store = { ...makeValidStore(), extraField: "hello" };
      const result = validateStore(store);
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid payloads - non-object", () => {
    it("rejects null", () => {
      const result = validateStore(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Payload must be a non-null object");
    });

    it("rejects undefined", () => {
      const result = validateStore(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Payload must be a non-null object");
    });

    it("rejects arrays", () => {
      const result = validateStore([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Payload must be a non-null object");
    });

    it("rejects strings", () => {
      const result = validateStore("hello");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Payload must be a non-null object");
    });

    it("rejects numbers", () => {
      const result = validateStore(42);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Payload must be a non-null object");
    });
  });

  describe("invalid payloads - missing fields", () => {
    it("reports a single missing field", () => {
      const store = makeValidStore();
      delete (store as Record<string, unknown>).groups;
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes("groups"))).toBe(true);
    });

    it("reports multiple missing fields", () => {
      const store = makeValidStore();
      delete (store as Record<string, unknown>).groups;
      delete (store as Record<string, unknown>).tasks;
      delete (store as Record<string, unknown>).schemaVersion;
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      const missingError = result.errors!.find((e) =>
        e.includes("Missing required fields")
      );
      expect(missingError).toBeDefined();
      expect(missingError).toContain("groups");
      expect(missingError).toContain("tasks");
      expect(missingError).toContain("schemaVersion");
    });

    it("rejects an empty object", () => {
      const result = validateStore({});
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some((e) => e.includes("Missing required fields"))
      ).toBe(true);
    });
  });

  describe("invalid payloads - wrong types", () => {
    it("rejects when an array field has a non-array value", () => {
      const store = { ...makeValidStore(), groups: "not-an-array" };
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some(
          (e) => e.includes("groups") && e.includes("expected array")
        )
      ).toBe(true);
    });

    it("rejects when schemaVersion is not a number", () => {
      const store = { ...makeValidStore(), schemaVersion: "1" };
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some(
          (e) => e.includes("schemaVersion") && e.includes("expected number")
        )
      ).toBe(true);
    });

    it("rejects when updatedAt is not a number", () => {
      const store = { ...makeValidStore(), updatedAt: "not-a-number" };
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some(
          (e) => e.includes("updatedAt") && e.includes("expected number")
        )
      ).toBe(true);
    });

    it("reports multiple type errors", () => {
      const store = {
        ...makeValidStore(),
        groups: 123,
        tasks: "wrong",
        schemaVersion: [],
      };
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      const typeError = result.errors!.find((e) =>
        e.includes("Invalid field types")
      );
      expect(typeError).toBeDefined();
      expect(typeError).toContain("groups");
      expect(typeError).toContain("tasks");
      expect(typeError).toContain("schemaVersion");
    });
  });

  describe("payload size validation", () => {
    it("rejects payloads exceeding 5MB", () => {
      const store = makeValidStore();
      // Create a large array that will exceed 5MB when serialized
      (store as Record<string, unknown>).notes = [
        { content: "x".repeat(6_000_000) },
      ];
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some((e) => e.includes("Payload size exceeds"))
      ).toBe(true);
    });
  });

  describe("combined errors", () => {
    it("reports both missing fields and wrong types in the same result", () => {
      const store = {
        // Missing: groups, entries, todos, notes, habits, habitEntries, schemaVersion
        tasks: "not-an-array",
        updatedAt: "not-a-number",
      };
      const result = validateStore(store);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThanOrEqual(2);
      expect(
        result.errors!.some((e) => e.includes("Missing required fields"))
      ).toBe(true);
      expect(
        result.errors!.some((e) => e.includes("Invalid field types"))
      ).toBe(true);
    });
  });
});
