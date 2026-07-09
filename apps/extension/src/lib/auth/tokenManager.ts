/**
 * TokenManager — manages auth token storage in chrome.storage.session.
 *
 * chrome.storage.session is encrypted at rest and auto-evicts when the
 * browser session ends, making it suitable for sensitive credentials.
 */

const TOKEN_KEY = "trackit.auth_token";

/** Delay helper — resolves after `ms` milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decode the payload section of a JWT without verifying the signature.
 * Returns null if the token is not a valid JWT structure.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url → Base64 → decoded string
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- chrome.storage.session helpers ---

function sessionGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.get([key], (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(result);
    });
  });
}

function sessionSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

function sessionRemove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.remove(key, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

// --- Token refresh callback (set by AuthProvider at runtime) ---

let _refreshCallback: (() => Promise<string | null>) | null = null;

/**
 * Register a callback that performs the actual token refresh via Clerk.
 * This is called once during AuthProvider initialization so the TokenManager
 * can trigger refresh without directly depending on the Clerk SDK.
 */
export function setRefreshCallback(cb: () => Promise<string | null>): void {
  _refreshCallback = cb;
}

// --- Public TokenManager API ---

/**
 * Store a token in chrome.storage.session.
 */
export async function storeToken(token: string): Promise<void> {
  await sessionSet({ [TOKEN_KEY]: token });
}

/**
 * Retrieve the stored token. Returns null if no token is present.
 */
export async function getToken(): Promise<string | null> {
  const result = await sessionGet(TOKEN_KEY);
  const value = result[TOKEN_KEY];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
}

/**
 * Remove the token from chrome.storage.session.
 */
export async function clearToken(): Promise<void> {
  await sessionRemove(TOKEN_KEY);
}

/**
 * Validate that a token is present and appears valid.
 * - Checks token is a non-empty string
 * - If the token is a JWT, checks it has not expired
 */
export async function validateToken(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload) {
    // Not a JWT — as long as it's a non-empty string, consider it valid
    return true;
  }

  // Check expiration if present
  if (typeof payload.exp === "number") {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      return false;
    }
  }

  return true;
}

/**
 * Attempt to refresh the auth token using Clerk's silent refresh.
 * Retries up to `retries` times with a 2-second delay between attempts.
 * Returns the new token on success, or null if all attempts fail.
 */
export async function refreshToken(retries: number = 3): Promise<string | null> {
  if (!_refreshCallback) {
    return null;
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const newToken = await _refreshCallback();
      if (newToken) {
        await storeToken(newToken);
        return newToken;
      }
    } catch {
      // Refresh attempt failed — continue to retry
    }

    // Wait 2 seconds before the next attempt (skip delay after last attempt)
    if (attempt < retries - 1) {
      await delay(2000);
    }
  }

  return null;
}
