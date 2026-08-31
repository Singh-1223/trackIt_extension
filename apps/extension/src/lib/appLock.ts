const APP_LOCK_KEY = "trackit.app_lock";
const HASH_ITERATIONS = 250_000;

interface AppLockRecord {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
}

function chromeGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function chromeSet(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function chromeRemove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function hashPassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  const passwordBuffer = passwordBytes.buffer.slice(
    passwordBytes.byteOffset,
    passwordBytes.byteOffset + passwordBytes.byteLength
  ) as ArrayBuffer;
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

function isValidRecord(value: unknown): value is AppLockRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AppLockRecord>;
  return record.version === 1
    && typeof record.salt === "string"
    && typeof record.hash === "string"
    && typeof record.iterations === "number";
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function hasAppLock(): Promise<boolean> {
  const result = await chromeGet(APP_LOCK_KEY);
  return isValidRecord(result[APP_LOCK_KEY]);
}

export async function setAppLock(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt, HASH_ITERATIONS);
  await chromeSet({
    [APP_LOCK_KEY]: {
      version: 1,
      salt: bytesToBase64(salt),
      hash: bytesToBase64(hash),
      iterations: HASH_ITERATIONS,
    } satisfies AppLockRecord,
  });
}

export async function verifyAppLock(password: string): Promise<boolean> {
  const result = await chromeGet(APP_LOCK_KEY);
  const record = result[APP_LOCK_KEY];
  if (!isValidRecord(record)) return false;

  const computed = await hashPassword(password, base64ToBytes(record.salt), record.iterations);
  return timingSafeEqual(computed, base64ToBytes(record.hash));
}

export async function removeAppLock(): Promise<void> {
  await chromeRemove(APP_LOCK_KEY);
}
