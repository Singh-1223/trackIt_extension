# TrackIt

A daily accountability system — Chrome extension, Android app, and cloud sync API.

---

## Architecture Overview

```
trackIt/                         ← monorepo root
├── apps/
│   ├── extension/               ← Chrome extension (with Clerk auth + cloud sync)
│   ├── api/                     ← Next.js API, deployed on Vercel
│   └── mobile/                  ← Expo React Native app (Android)
├── manifest.json                ← Chrome extension manifest v3 (root copy)
└── package.json                 ← workspace root (workspaces: extension, api)
```

### How the three pieces connect

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│     Chrome Extension         │        │       Android App             │
│                              │        │                               │
│  chrome.storage.local        │        │  AsyncStorage (local)         │
│  + SyncEngine (5s debounce)  │        │  + useStore hook              │
│  + OfflineQueue (retry)      │        │                               │
│  + @clerk/chrome-extension   │        │  @clerk/clerk-expo            │
└──────────┬───────────────────┘        └──────────┬────────────────────┘
           │                                        │
           │  PUT /api/store (Bearer token)         │  GET + PUT /api/store
           │  GET /api/store                        │  (Bearer token)
           ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Next.js API  (Vercel)                                │
│                  https://track-it-extension-api.vercel.app            │
│                                                                      │
│   Clerk middleware → auth() → getUserStoresCollection()              │
│   MongoDB Atlas — db: trackit — collection: user_stores              │
└──────────────────────────────────────────────────────────────────────┘
```

**Extension** uses `chrome.storage.local` as its primary store. A `SyncEngine` debounces writes (3s window) and pushes to the API. An `OfflineQueue` retries failed pushes on reconnect. Auth is handled by `@clerk/chrome-extension`. The popup uses a "Daily Grind" parent accordion that wraps all task group accordions, keeping the main view compact.

**Mobile app** loads from `AsyncStorage` instantly on open, then fetches from the API in the background. API wins the merge if it has more content or a newer `updatedAt`. Every mutation writes to `AsyncStorage` immediately and pushes to the API after a 5s debounce window (rapid changes like typing a comment collapse into one call). Task groups are also wrapped in a "Daily Grind" parent accordion with each group collapsed by default.

**API** is the single source of truth for cloud data. It upserts the full `TrackItStore` document keyed by `userId` (from Clerk).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Extension | React 18, TypeScript, esbuild, Chrome MV3, `@clerk/chrome-extension` |
| API | Next.js 16, `@clerk/nextjs`, MongoDB, Vercel |
| Mobile | Expo SDK 51, React Native, Expo Router v3, `@clerk/clerk-expo` |
| Auth | Clerk (shared across all three layers) |
| Database | MongoDB Atlas — db: `trackit`, collection: `user_stores` |

---

## Branch Structure

| Branch | Purpose |
|---|---|
| `app` | Older standalone extension (no auth, local-only) — reference only |
| `app-support` | **Active working branch** — extension with auth/sync, API, and mobile |
| `main` | Stable releases |

> Always work on `app-support`.

---

## Folder Structure

### Extension (`apps/extension/`)

```
apps/extension/
├── src/
│   ├── components/
│   │   ├── GroupSection.tsx          task group accordion (collapsed by default)
│   │   ├── TaskCard.tsx              checkbox + per-day comment
│   │   ├── TodoList.tsx              todos with subtasks, priorities, due dates
│   │   ├── HabitView.tsx             Build-Up streak grid
│   │   ├── HistoryView.tsx           history analytics (7/30/all days)
│   │   ├── NotesList.tsx             notes CRUD
│   │   ├── LibraryView.tsx           reading list (books with status + notes)
│   │   ├── TaskManager.tsx           manage groups and tasks
│   │   ├── AuthButton.tsx            Clerk sign-in/out UI in popup
│   │   └── SyncStatusIndicator.tsx   shows idle/pushing/error sync status
│   │
│   ├── lib/
│   │   ├── store.ts                  chrome.storage.local read/write + store logic
│   │   ├── utils.ts                  date helpers, generateId, pruneOldEntries
│   │   │
│   │   ├── auth/
│   │   │   ├── AuthProvider.tsx      ClerkProvider wrapper + useAuthContext hook
│   │   │   └── tokenManager.ts       get/store/refresh/validate Clerk JWT tokens
│   │   │
│   │   └── sync/
│   │       ├── syncEngine.ts         push/pull with 5s debounce + status tracking
│   │       ├── syncEngineInstance.ts singleton instance shared across extension
│   │       ├── apiClient.ts          fetch wrappers for GET/PUT /api/store
│   │       ├── offlineQueue.ts       persists failed pushes, retries on reconnect
│   │       ├── startupSync.ts        pulls from API on extension open
│   │       ├── migration.ts          schema migration helpers
│   │       └── retry.ts              exponential backoff utility
│   │
│   ├── popup/
│   │   ├── main.tsx                  popup entry point
│   │   └── App.tsx                   today view — "Daily Grind" accordion wraps task groups, plus accordions for todos/notes/habits/library/past-7
│   │
│   ├── options/
│   │   ├── main.tsx                  options page entry point
│   │   └── App.tsx                   tabs: History, Build-Up, To-Dos, Notes, Library, Manage
│   │
│   ├── styles/
│   │   └── app.css                   full design system (CSS variables + all components)
│   │
│   └── types/
│       ├── index.ts                  TrackItStore + all entity interfaces
│       ├── assets.d.ts               static asset imports
│       ├── chrome-extension.d.ts     Chrome API type extensions
│       └── env.d.ts                  import.meta.env types
│
├── public/
│   ├── popup.html                    popup shell HTML
│   └── options.html                  options page shell HTML
│
├── scripts/
│   └── build.mjs                     esbuild config (entry: popup + options)
│
├── dist/                             ← compiled output (load this folder in Chrome)
├── manifest.json
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

### API (`apps/api/`)

```
apps/api/
├── app/
│   └── api/
│       └── store/
│           ├── route.ts              GET + PUT /api/store (Clerk-authed)
│           └── route.test.ts         vitest integration tests
│
├── lib/
│   ├── mongodb.ts                    MongoDB client + collection helpers
│   │                                 (getDatabase, getUserStoresCollection, ensureIndexes)
│   ├── validateStore.ts              payload validation before DB write
│   └── validateStore.test.ts
│
├── types/
│   └── store.ts                      TrackItStore, UserStoreDocument, SyncMetadata
│                                     (mirrors extension types — keep in sync)
│
├── middleware.ts                      Clerk auth middleware (protects /api/store/*)
├── next.config.js
├── tsconfig.json
├── vitest.config.ts
├── .env.local                         secrets (never commit)
├── .env.local.example                 template for new devs
└── package.json
```

### Mobile (`apps/mobile/`)

```
apps/mobile/
├── app/
│   ├── _layout.tsx                   ClerkProvider + AuthGate (redirects if not signed in)
│   ├── (auth)/
│   │   ├── _layout.tsx               stack navigator for auth screens
│   │   ├── sign-in.tsx               email/password + forgot password OTP reset flow
│   │   └── sign-up.tsx               sign up + email verification code
│   └── (tabs)/
│       ├── _layout.tsx               bottom tab bar (Home + Today; feature screens are opened from Home)
│       ├── index.tsx                 Home — landing hub with shortcuts to every feature
│       ├── today.tsx                 Today — compact daily view with Daily Grind, todos, notes, habits, library, and past-7
│       ├── todos.tsx                 To-Dos full view
│       ├── habits.tsx                Build-Up habit streaks
│       ├── notes.tsx                 Notes CRUD
│       ├── library.tsx               Library — reading list (books with status + notes)
│       ├── history.tsx               History analytics
│       └── manage.tsx                Manage task groups and tasks
│
├── components/                       All 8 components — same logic as extension, RN StyleSheet
│   ├── GroupSection.tsx              task group accordion (collapsed by default)
│   ├── TaskCard.tsx
│   ├── TodoList.tsx
│   ├── HabitView.tsx
│   ├── HistoryView.tsx
│   ├── NotesList.tsx
│   ├── LibraryView.tsx              reading list (books with status + notes)
│   └── TaskManager.tsx
│
├── hooks/
│   ├── useStore.ts                   load AsyncStorage → background API sync → debounced save
│   └── StoreContext.tsx              shared store context — one instance across all tabs
│
├── lib/
│   ├── store.ts                      AsyncStorage helpers, store logic, mergeStores
│   ├── api.ts                        fetchStore / pushStore (GET/PUT /api/store)
│   └── utils.ts                      date helpers (mirrors extension utils)
│
├── types/
│   └── index.ts                      TrackItStore + updatedAt field (mirrors extension types)
│
├── theme/
│   └── index.ts                      extension CSS variables → RN StyleSheet tokens
│
├── metro.config.js                   redirects @clerk/clerk-js to headless build (required)
├── eas.json                          EAS build profiles: preview=APK, production=AAB
├── app.json                          Expo config (projectId: 95b69a77-...)
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## Data Model

```typescript
TrackItStore {
  groups:        TaskGroup[]    // task group definitions
  tasks:         Task[]         // tasks (each belongs to a group, has order)
  entries:       DayEntry[]     // daily checkbox + comment per task (pruned to 90 days)
  todos:         Todo[]         // todos with priority (P1–P5), due date, subtasks
  notes:         Note[]         // freeform heading + description notes
  habits:        Habit[]        // habit definitions with optional targetCount
  habitEntries:  HabitEntry[]   // daily habit completion records
  books:         Book[]         // reading list with status (reading/toread/completed) + notes
  schemaVersion: number         // for migrations
  updatedAt:     number         // unix ms — used for cloud merge (last-write-wins)
}
```

The **same type** is defined in three places — keep them in sync:
- `apps/extension/src/types/index.ts`
- `apps/api/types/store.ts`
- `apps/mobile/types/index.ts`

---

## Environment Variables

### `apps/api/.env.local`

```env
MONGODB_URI=<MongoDB Atlas connection string>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
CLERK_SECRET_KEY=<Clerk secret key>
CLERK_WEBHOOK_SECRET=<Clerk webhook secret>
```

### `apps/mobile/.env`

```env
EXPO_PUBLIC_API_URL=https://track-it-extension-api.vercel.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<same Clerk publishable key>
```

### Extension (`apps/extension/.env.local`)

```env
VITE_CLERK_PUBLISHABLE_KEY=<same Clerk publishable key>
VITE_API_URL=https://track-it-extension-api.vercel.app
```

---

## Dev Commands

### Extension

```bash
cd apps/extension

npm install              # first time
npm run dev              # watch mode — rebuilds on every save into dist/
npm run build            # production build into dist/
npm run typecheck        # TypeScript check
npx vitest               # run tests in watch mode
npx vitest --run         # run tests once
```

**Reload in Chrome after every build:**
1. Go to `chrome://extensions`
2. Find **TrackIt**
3. Click the **↺ reload** button (or toggle off/on)
4. Re-open the popup to see changes

### API

```bash
cd apps/api

npm install              # first time
npm run dev              # Next.js dev server → http://localhost:3000
npm run typecheck        # TypeScript check
npm run test             # run vitest tests
npm run build            # production build (Vercel runs this automatically on deploy)
```

### Mobile

```bash
cd apps/mobile

npm install              # first time
npx expo start           # Metro dev server + QR code (scan with Expo Go)
npx expo start --clear   # clear Metro cache (required after metro.config.js changes)

# Build APK for direct install (EAS cloud build, ~10 min)
eas build -p android --profile preview

# Build AAB for Play Store
eas build -p android --profile production
```

#### Expo Go connection and cache troubleshooting

Use `--clear` when Metro may be serving stale JavaScript or configuration. It clears Metro's local cache before starting the server:

```bash
npx expo start --clear
```

By default, Expo serves the app over the local network (LAN). This is fastest, but the device or emulator must be able to reach the Mac's IP address and port `8081`.

If Expo Go stays on a loading screen or reports a timeout connecting to an address such as `192.168.x.x:8081`, use a tunnel instead:

```bash
npx expo start --tunnel --clear
```

`--tunnel` routes the Expo connection through the internet rather than directly over the LAN. It is useful when a firewall, VPN, guest Wi-Fi, or Android emulator network prevents the device from reaching Metro. It can be slower than LAN, but is usually more reliable in those situations.

For Android-emulator errors, confirm the emulator is detected and inspect native logs:

```bash
adb devices
adb logcat -c
adb logcat | grep -Ei 'expo|reactnative|androidruntime|fatal|error'
```

The log stream will show whether the problem is a Metro connection timeout, an Expo Go version mismatch, or an application crash.

---

## Deploying the API to Vercel

Vercel auto-deploys on every push to the connected branch. To trigger manually:

```bash
cd apps/api
vercel --prod
```

**Required environment variables** (set in Vercel dashboard under Project → Settings → Environment Variables):

| Key | Value |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook secret |

**Verify the deployment is healthy:**

```bash
curl -I https://track-it-extension-api.vercel.app/api/store
# Expected: HTTP 401 Unauthorized  ← means the endpoint is live and auth is working
```

---

## How to Implement a New Feature

> **Extension ↔ App parity rule — always applies.**
> Every feature, bug fix, UI change, or behaviour tweak done in the extension **must be mirrored in the mobile app**, and vice versa. The two share the same data model, the same API, and the same user — they must stay in sync. Before closing any task, check both sides:
> - New component in extension → equivalent component in `apps/mobile/components/`
> - Logic change in `apps/extension/src/lib/store.ts` → same change in `apps/mobile/lib/store.ts`
> - Sync/debounce behaviour change → update both `apps/extension/src/lib/sync/syncEngine.ts` and `apps/mobile/hooks/useStore.ts`
> - UI tweak (layout, colours, interactions) → apply to both extension CSS and mobile RN StyleSheet
> - Type change → update all three: extension types, API types, mobile types (see Step 1 below)
>
> If a platform genuinely can't support a feature (e.g. Chrome-only APIs), document the gap explicitly rather than silently skipping it.

Every feature typically touches all three layers. Follow these steps in order.

---

### Step 1 — Plan the data change

If the feature needs a new field or entity, identify it before writing any code.
Add it to the type in **all three locations** before touching any logic:

| File | Action |
|---|---|
| `apps/extension/src/types/index.ts` | Add field to the interface |
| `apps/api/types/store.ts` | Mirror the same change |
| `apps/mobile/types/index.ts` | Mirror the same change |

If adding a **new array field**, also add a migration so existing users don't get `undefined`:

| File | What to add |
|---|---|
| `apps/extension/src/lib/store.ts` | Add a `if (!Array.isArray(stored.newField))` block in `getStore()` |
| `apps/mobile/lib/store.ts` | Add the same guard in the `migrate()` function |
| `apps/api/lib/validateStore.ts` | Add the field to `fieldTypes` if it should be validated |

---

### Step 2 — Extension

```bash
cd apps/extension
```

1. Edit or create a component in `src/components/`
2. Wire it up in `src/popup/App.tsx` (for the popup) or `src/options/App.tsx` (for the options page)
3. Add styles in `src/styles/app.css` — use existing CSS variables (`--accent`, `--ink`, etc.), don't hardcode colours
4. Build and reload:

```bash
npm run build
```

5. In Chrome → `chrome://extensions` → click **↺ reload** on TrackIt
6. Open the extension popup and test the feature

---

### Step 3 — API (if data model or endpoint logic changed)

```bash
cd apps/api
```

1. Update `types/store.ts` if store shape changed
2. Update `lib/validateStore.ts` if new required fields were added
3. Edit `app/api/store/route.ts` if endpoint behaviour changed
4. Test locally:

```bash
npm run dev         # start on localhost:3000
npm run test        # run vitest tests
npm run typecheck   # no TypeScript errors
```

5. Commit and push — Vercel deploys automatically:

```bash
git add apps/api
git commit -m "feat: <description>"
git push
```

6. Watch the deployment at [vercel.com/dashboard](https://vercel.com/dashboard) — takes ~1–2 min
7. Verify the live endpoint:

```bash
curl -I https://track-it-extension-api.vercel.app/api/store
# Expected: 401 Unauthorized
```

---

### Step 4 — Mobile app

```bash
cd apps/mobile
```

1. Update `types/index.ts` to match the extension types
2. Update `lib/store.ts` if store logic or migrations changed
3. Edit or create components in `components/`
4. Edit the relevant screen in `app/(tabs)/`
5. **Test with Expo Go first** — no build needed for JS-only changes:

```bash
npx expo start
# Scan the QR code with Expo Go on your Android phone
# Metro hot-reloads on every save — no rescan needed
```

6. Once the feature looks good, build a new APK:

```bash
eas build -p android --profile preview
```

7. Wait ~10 min — EAS prints a download link when done (also visible at [expo.dev/builds](https://expo.dev/builds))
8. On your Android phone:
   - Open the download link in Chrome
   - Tap the `.apk` file → Install
   - If blocked: Settings → Apps → Special app access → Install unknown apps → Chrome → Allow

---

### Step 5 — Commit and push everything

```bash
git add apps/
git commit -m "feat: <description>"
git push
```

---

## Feature Checklist

Copy this into your PR or notes when shipping any feature:

```
[ ] Types updated in extension, API, and mobile (all three files)
[ ] Migration added for any new array/object fields
[ ] Extension built (npm run build in apps/extension) and reloaded in Chrome
[ ] Extension tested manually in popup and options page
[ ] API changes tested locally (npm run test + npm run typecheck)
[ ] API deployed to Vercel and verified live (curl → 401)
[ ] Mobile types and store logic updated
[ ] Mobile feature tested with Expo Go (hot reload)
[ ] New APK built via EAS (eas build -p android --profile preview)
[ ] APK downloaded and installed on phone
[ ] End-to-end: change on extension syncs to app (and vice versa)
```

---

## Key URLs

| Resource | URL |
|---|---|
| API (production) | https://track-it-extension-api.vercel.app |
| API health check | `curl -I .../api/store` → 401 = healthy |
| Vercel dashboard | https://vercel.com/dashboard |
| EAS builds | https://expo.dev/builds |
| Expo project | https://expo.dev/accounts/singh22/projects/trackit |
| Clerk dashboard | https://dashboard.clerk.com |
| MongoDB Atlas | https://cloud.mongodb.com |
