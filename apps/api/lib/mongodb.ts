import { MongoClient, type Collection, type Db } from "mongodb";
import type { UserStoreDocument } from "@/types/store";

if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI environment variable is not defined. Please add it to .env.local"
  );
}

const uri = process.env.MONGODB_URI;

const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  // In development behind corporate proxies (GlobalProtect, Zscaler), TLS
  // inspection breaks MongoDB's certificate validation. This flag bypasses it.
  // Production servers (Vercel, Railway, etc.) connect directly and don't need this.
  ...(process.env.NODE_ENV === "development" && { tls: true, tlsInsecure: true }),
};

// In development, use a global variable to preserve the MongoClient across
// hot-reloads. In production, create a single instance per cold start.
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

// --- Database and collection helpers ---

const DB_NAME = "trackit";
const USER_STORES_COLLECTION = "user_stores";

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export async function getUserStoresCollection(): Promise<
  Collection<UserStoreDocument>
> {
  const db = await getDatabase();
  return db.collection<UserStoreDocument>(USER_STORES_COLLECTION);
}

/**
 * Ensures the required indexes exist on the user_stores collection.
 * Call this once during app initialization (e.g., in a Next.js instrumentation hook).
 */
export async function ensureIndexes(): Promise<void> {
  const collection = await getUserStoresCollection();
  await collection.createIndex({ userId: 1 }, { unique: true });
}
