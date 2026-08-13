import type { TrackItStore } from "../types/index";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export async function fetchStore(token: string): Promise<TrackItStore | null> {
  console.log("[api] fetchStore → GET", API_URL + "/api/store");
  const res = await fetch(`${API_URL}/api/store`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("[api] fetchStore ← status:", res.status);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/store failed: ${res.status}`);
  const data = await res.json() as TrackItStore;
  console.log("[api] fetchStore ← updatedAt:", data?.updatedAt);
  return data;
}

export async function pushStore(token: string, store: TrackItStore): Promise<void> {
  console.log("[api] pushStore → PUT", API_URL + "/api/store", "updatedAt:", store.updatedAt);
  const res = await fetch(`${API_URL}/api/store`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(store),
  });
  console.log("[api] pushStore ← status:", res.status);
  if (!res.ok) throw new Error(`PUT /api/store failed: ${res.status}`);
}
