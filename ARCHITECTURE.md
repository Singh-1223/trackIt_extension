# TrackIt Architecture Reference

## Current architecture

TrackIt is currently an offline-first application with a **single per-user cloud snapshot**.

```text
Mobile app / Extension
  ├─ Local store first
  │   ├─ AsyncStorage (mobile)
  │   └─ chrome.storage.local (extension)
  └─ Cloud sync after local save
        └─ GET /api/store and PUT /api/store
              └─ MongoDB: trackit.user_stores
```

The API authenticates each request using Clerk. A user has one MongoDB document, identified by a unique `userId` index.

```ts
interface UserStoreDocument {
  userId: string;
  store: TrackItStore;
  createdAt: Date;
  updatedAt: Date;
}
```

The `store` is a single object containing the user's complete workspace:

```text
TrackItStore
├─ groups, tasks, entries, snapshots
├─ todos
├─ notes, noteGroups
├─ books
├─ habits, habitEntries
├─ reflections, reflectionCategories
├─ schemaVersion
└─ updatedAt
```

The source definitions are in `apps/api/types/store.ts`, `apps/mobile/types/index.ts`, and `apps/extension/src/types/index.ts`.

## How data currently flows

1. The user changes something in the app or extension.
2. The client saves the complete updated `TrackItStore` locally immediately.
3. The client updates the store-level `updatedAt` timestamp.
4. A debounced sync sends the complete store with `PUT /api/store`.
5. The API validates the top-level payload and upserts the user's MongoDB document.
6. On startup, a client fetches the remote store with `GET /api/store` and decides whether local or remote data wins.

This gives fast offline UX and simple recovery on a new device: one fetch restores the entire workspace.

## Why this is a good current choice

For an early personal productivity product, the snapshot model is useful:

- It is straightforward to understand and change.
- Mobile and extension use the same data contract.
- New features can be added by adding a field and a migration.
- Offline behavior is simple: write locally, retry cloud sync later.
- A complete backup/restore is one object.

This design is suitable while content is modest and users are not actively editing the same data from multiple devices at once.

## Current limitations

### Whole-store writes

Editing one reflection uploads all data: tasks, notes, books, habits, and other reflections. This becomes inefficient as long-form content grows.

### Snapshot-level conflicts

Sync is effectively last-writer-wins at the whole-store level. If mobile edits a reflection while extension edits a todo, the later snapshot can overwrite the other device's unrelated change.

### Document and payload growth

The API currently rejects payloads above 5 MB. MongoDB has a hard 16 MB document limit. Long notes, reflections, book notes, and future attachments can eventually make one document unsuitable.

### Limited server-side querying

Because content is stored inside one blob, MongoDB cannot efficiently query only reflections with a tag, a category, or a date range. Clients must download everything and filter locally.

### Timestamp trust

The logical store timestamp originates from the client. A device with an incorrect clock can incorrectly win a conflict.

## When to evolve the architecture

Keep the current model until at least one of these becomes real:

- Typical sync payload exceeds about 500 KB to 1 MB.
- Users have hundreds or thousands of long notes/reflections.
- Multi-device concurrent edits become common.
- Search, sharing, collaboration, attachments, or server-side filtering are required.
- Sync is noticeably slow or costly on mobile data.

Do not split APIs merely because more feature types exist. Split when data size, query needs, or conflict behavior demands it.

## Recommended future MongoDB structure

Extract the fastest-growing text features first: Notes and Reflections.

```text
user_profiles
  userId, settings, schemaVersion

notes
  userId, id, groupId, heading, description, createdAt, updatedAt, deletedAt?

note_groups
  userId, id, name, order, updatedAt, deletedAt?

reflections
  userId, id, categoryId, title, content, tags,
  datePrecision, year?, month?, day?, timelineSort,
  createdAt, updatedAt, deletedAt?

reflection_categories
  userId, id, name, icon, color, order, updatedAt, deletedAt?

todos
habits
habit_entries
books
daily_entries
```

Collections can remain document-oriented. This is not a requirement to turn everything into relational SQL tables; it is primarily about splitting independently growing and independently synced entities.

### Reflection date model

Keep flexible dates without inventing a false exact day:

```ts
{
  datePrecision: "day" | "month" | "year" | "unknown";
  year?: number;
  month?: number;
  day?: number;
  timelineSort?: number;
}
```

`timelineSort` supports chronological sorting while preserving the original date precision.

## Recommended indexes after extraction

```text
reflections: { userId: 1, updatedAt: -1 }
reflections: { userId: 1, categoryId: 1, timelineSort: -1 }
reflections: { userId: 1, tags: 1, updatedAt: -1 }

notes:       { userId: 1, groupId: 1, updatedAt: -1 }
todos:       { userId: 1, updatedAt: -1 }
```

Every user-owned record must include `userId`; every query must filter by it.

## Recommended API evolution

Introduce feature-level APIs gradually. Do not rewrite all features at once.

```text
GET    /api/reflections?updatedSince=<cursor>
POST   /api/reflections
PATCH  /api/reflections/:id
DELETE /api/reflections/:id

GET    /api/reflection-categories?updatedSince=<cursor>
POST   /api/reflection-categories
PATCH  /api/reflection-categories/:id
DELETE /api/reflection-categories/:id
```

Then repeat this pattern for Notes, To-Dos, Books, and Habits as needed.

## Safer sync design for the future

Replace whole-store replacement with record-level synchronization:

1. Give every record its own `updatedAt` and server revision/version.
2. Store local changes as an operation queue: create, update, move, delete.
3. Push only those operations.
4. Pull only records changed since the last sync cursor.
5. Use optimistic concurrency (`version` or ETag) to detect genuine conflicts.
6. Use `deletedAt` tombstones so an offline device cannot recreate a deleted record.
7. Let the server generate authoritative revisions/timestamps.

This makes edits to different records merge safely across mobile and extension.

## Suggested migration plan

1. Keep the snapshot API now.
2. Add observability: record payload size, sync timing, failures, and conflicts.
3. Add deeper request validation for nested record shapes.
4. Add a server-side version/revision to the existing store endpoint.
5. Extract Reflections and Notes first.
6. Migrate existing embedded data once, using an idempotent migration.
7. Move remaining features only when their usage warrants it.

## Privacy note

The extension password lock protects access on an open laptop. It is not end-to-end encryption of cloud data. If reflections are especially sensitive, client-side encryption is possible, but introduces key recovery, multi-device key sharing, and search tradeoffs.

## Key principle

Use the simplest architecture that safely fits current product usage. The snapshot store is appropriate today; record-level APIs are the planned next stage when real data volume and sync concurrency justify their complexity.
