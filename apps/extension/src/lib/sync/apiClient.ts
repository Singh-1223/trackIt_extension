/**
 * ApiClient — HTTP client for communicating with the TrackIt API server.
 *
 * Attaches Bearer token to all requests. Aborts immediately if no token
 * is available (requirement 6.5).
 */

import type { TrackItStore } from "../../types";
import { getToken } from "../auth/tokenManager";

/**
 * Shape of every API response returned by the client.
 */
export interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
}

/**
 * The base URL for the API server.
 * Configured via the VITE_API_URL environment variable at build time.
 */
const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Fetch the authenticated user's store from the API server.
 *
 * GET /api/store with Authorization: Bearer <token>
 *
 * Returns { status, data?, error? }
 */
export async function getStore(): Promise<ApiResponse<TrackItStore>> {
  const token = await getToken();

  if (!token) {
    return { status: 0, error: "No auth token available" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/store`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return { status: response.status, error: body || response.statusText };
    }

    const data = (await response.json()) as TrackItStore;
    return { status: response.status, data };
  } catch (err) {
    return {
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Upload the user's store to the API server.
 *
 * PUT /api/store with Authorization: Bearer <token> and JSON body
 *
 * Returns { status, error? }
 */
export async function putStore(store: TrackItStore): Promise<ApiResponse<void>> {
  const token = await getToken();

  if (!token) {
    return { status: 0, error: "No auth token available" };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/store`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(store),
    });

    if (!response.ok) {
      const body = await response.text();
      return { status: response.status, error: body || response.statusText };
    }

    return { status: response.status };
  } catch (err) {
    return {
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
