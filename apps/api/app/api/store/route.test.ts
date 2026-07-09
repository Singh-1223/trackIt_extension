import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock @clerk/nextjs/server
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock MongoDB
vi.mock("@/lib/mongodb", () => ({
  getUserStoresCollection: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { getUserStoresCollection } from "@/lib/mongodb";

const mockAuth = vi.mocked(auth);
const mockGetUserStoresCollection = vi.mocked(getUserStoresCollection);

describe("GET /api/store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when userId is not present", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 404 when no document exists for the user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetUserStoresCollection.mockResolvedValue({
      findOne: vi.fn().mockResolvedValue(null),
    } as never);

    const response = await GET();

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("No store exists");
  });

  it("returns 200 with store data when document exists", async () => {
    const mockStore = {
      groups: [],
      tasks: [],
      entries: [],
      todos: [],
      notes: [],
      habits: [],
      habitEntries: [],
      schemaVersion: 1,
      updatedAt: 1700000000000,
    };

    mockAuth.mockResolvedValue({ userId: "user_123" } as never);
    mockGetUserStoresCollection.mockResolvedValue({
      findOne: vi.fn().mockResolvedValue({
        _id: "some-object-id",
        userId: "user_123",
        store: mockStore,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockStore);
  });

  it("queries the collection with the correct userId", async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    mockAuth.mockResolvedValue({ userId: "user_abc" } as never);
    mockGetUserStoresCollection.mockResolvedValue({
      findOne: mockFindOne,
    } as never);

    await GET();

    expect(mockFindOne).toHaveBeenCalledWith({ userId: "user_abc" });
  });
});
