# Pulse Project Planner — iOS App (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Expo SDK 52 Managed iOS app (`@pulse/mobile`) that consumes `@pulse/core` 1:1, ships via EAS Build to TestFlight, syncs cross-machine with the existing Windows desktop client, surfaces a 5-tab UI with local notifications and a Today widget.

**Architecture:** Single-process React Native app. `@pulse/core` runs unchanged. New platform adapters: `ExpoSqliteStore` (LocalStore), `SecureStoreTokenStorage` (TokenStorage), `ExpoNotifications` (banner actions + reconciler), `WidgetData` (App-Group snapshot writer), `BackgroundFetch` (iOS-managed ~30 min pull). Zustand stores mirror desktop. Expo Router (file-based) drives navigation.

**Tech Stack:** Expo SDK 52, React Native, TypeScript, Expo Router, Zustand 4, NativeWind 4 (Tailwind for RN), `expo-sqlite`, `expo-secure-store`, `expo-notifications`, `expo-local-authentication`, `expo-background-fetch`, `@bacons/apple-targets` (Today widget), `react-native-mmkv`, `react-native-markdown-display`, `rrule`, `chrono-node` (de), `date-fns`, Jest + jest-expo, `@testing-library/react-native`. EAS Build → TestFlight.

**Spec:** `docs/superpowers/specs/2026-05-11-pulse-planner-ios-design.md`

---

## File Map

```
apps/
└── mobile/
    ├── package.json                                # @pulse/mobile
    ├── tsconfig.json
    ├── babel.config.js
    ├── metro.config.js
    ├── app.config.ts                               # Expo plugins + apple-targets + URL scheme
    ├── eas.json                                    # development / preview / production profiles
    ├── tailwind.config.js                          # NativeWind / Pulse theme
    ├── global.css                                  # NativeWind directives
    ├── nativewind-env.d.ts
    ├── index.ts                                    # Expo entry → registers root component
    ├── app/                                        # Expo Router file-tree
    │   ├── _layout.tsx                             # root layout, Splash + deps boot
    │   ├── (tabs)/
    │   │   ├── _layout.tsx                         # Bottom tabs
    │   │   ├── today.tsx
    │   │   ├── upcoming.tsx
    │   │   ├── inbox.tsx
    │   │   ├── projects.tsx
    │   │   └── settings.tsx
    │   ├── project/[id].tsx
    │   ├── task/[id].tsx
    │   ├── tags/index.tsx
    │   ├── search.tsx
    │   └── auth/
    │       ├── login.tsx
    │       └── signup.tsx
    ├── src/
    │   ├── wiring/
    │   │   └── deps.ts                             # builds DI container
    │   ├── platform/
    │   │   ├── ExpoSqliteStore.ts                  # LocalStore impl
    │   │   ├── SecureStoreTokenStorage.ts          # TokenStorage impl
    │   │   ├── ExpoNotifications.ts                # schedule + categories + reconciler
    │   │   ├── WidgetData.ts                       # App-Group snapshot writer
    │   │   └── BackgroundFetch.ts                  # registers iOS task
    │   ├── stores/
    │   │   ├── auth.ts
    │   │   ├── tasks.ts
    │   │   ├── projects.ts
    │   │   ├── tags.ts
    │   │   ├── ui.ts
    │   │   └── sync.ts
    │   ├── screens/
    │   │   ├── today/TodayScreen.tsx
    │   │   ├── today/UpcomingScreen.tsx
    │   │   ├── inbox/InboxScreen.tsx
    │   │   ├── projects/ProjectsScreen.tsx
    │   │   ├── projects/ProjectDetailScreen.tsx
    │   │   ├── tasks/TaskDetailScreen.tsx
    │   │   ├── tags/TagsScreen.tsx
    │   │   ├── search/SearchScreen.tsx
    │   │   ├── settings/SettingsScreen.tsx
    │   │   └── auth/{LoginScreen,SignupScreen}.tsx
    │   ├── components/
    │   │   ├── TaskRow.tsx
    │   │   ├── ProjectRow.tsx
    │   │   ├── TagPicker.tsx
    │   │   ├── ColorSwatchPopover.tsx
    │   │   ├── DueDatePicker.tsx
    │   │   ├── RRulePicker.tsx
    │   │   ├── MarkdownView.tsx
    │   │   ├── QuickAddSheet.tsx
    │   │   ├── SyncStatusPill.tsx
    │   │   ├── EmptyState.tsx
    │   │   └── theme.ts                            # Pulse palette + spacing tokens
    │   ├── lib/
    │   │   ├── deepLink.ts                         # pulse://task/<id>, pulse://today
    │   │   ├── format.ts                           # date/time (de locale)
    │   │   └── prefs.ts                            # MMKV wrapper
    │   └── notifications/
    │       └── reconciler.ts                       # 60-task reconciler logic (pure)
    ├── targets/
    │   └── TodayWidget/
    │       ├── TodayWidget.swift
    │       ├── TodayWidgetBundle.swift
    │       ├── Provider.swift
    │       └── Info.plist
    ├── assets/
    │   ├── icon.png
    │   ├── splash.png
    │   └── adaptive-icon.png
    └── test/
        ├── unit/
        │   ├── ExpoSqliteStore.test.ts
        │   ├── SecureStoreTokenStorage.test.ts
        │   ├── WidgetData.test.ts
        │   ├── notification-reconciler.test.ts
        │   └── quick-add-parser.test.ts            # re-uses moved parser
        └── integration/
            └── deps-wiring.test.ts

packages/core/
├── src/
│   ├── sql/
│   │   ├── ddl.ts                                  # NEW: exported DDL string for both stores
│   │   └── ddl.test.ts
│   └── quickAdd/
│       ├── parser.ts                               # MOVED from apps/desktop
│       └── parser.test.ts
```

---

## Task 1: Workspace bootstrap for `@pulse/mobile`

**Files:**
- Modify: none (`apps/*` is already in workspace from Phase 2)
- Create: `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `apps/mobile/.gitignore`, `apps/mobile/babel.config.js`, `apps/mobile/metro.config.js`

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@pulse/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "build:dev": "eas build --profile development --platform ios",
    "build:preview": "eas build --profile preview --platform ios",
    "build:prod": "eas build --profile production --platform ios",
    "submit": "eas submit --platform ios --profile production",
    "test": "jest",
    "lint": "eslint src app test"
  },
  "dependencies": {
    "@pulse/core": "workspace:*",
    "@bacons/apple-targets": "^0.2.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@supabase/supabase-js": "^2.45.0",
    "chrono-node": "^2.7.7",
    "date-fns": "^3.6.0",
    "expo": "~52.0.0",
    "expo-application": "~6.0.0",
    "expo-background-fetch": "~13.0.0",
    "expo-build-properties": "~0.13.0",
    "expo-constants": "~17.0.0",
    "expo-file-system": "~18.0.0",
    "expo-linear-gradient": "~14.0.0",
    "expo-linking": "~7.0.0",
    "expo-local-authentication": "~15.0.0",
    "expo-notifications": "~0.29.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-sharing": "~13.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-sqlite": "~15.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-task-manager": "~12.0.0",
    "nativewind": "^4.1.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-native": "0.76.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-markdown-display": "^7.0.2",
    "react-native-mmkv": "^3.1.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0",
    "rrule": "^2.8.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@testing-library/react-native": "^12.7.0",
    "@types/jest": "^29.5.13",
    "@types/react": "~18.3.12",
    "babel-preset-expo": "~12.0.0",
    "eas-cli": "^13.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "~5.5.0"
  }
}
```

- [ ] **Step 2: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", "nativewind-env.d.ts", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Create `apps/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ],
    plugins: ["react-native-reanimated/plugin"]
  };
};
```

- [ ] **Step 4: Create `apps/mobile/metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/core")];
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 5: Create `apps/mobile/.gitignore`**

```
.expo/
node_modules/
ios/
android/
*.log
*.tsbuildinfo
.eas/
dist/
```

- [ ] **Step 6: Install dependencies**

Run: `& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" install`
Expected: `apps/mobile` linked, no resolution errors. Lockfile updated.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json apps/mobile/tsconfig.json apps/mobile/babel.config.js apps/mobile/metro.config.js apps/mobile/.gitignore pnpm-lock.yaml
git commit -m "chore(mobile): workspace bootstrap for @pulse/mobile"
```

---

## Task 2: Expo + EAS init, app.config.ts, eas.json

**Files:** Create `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `apps/mobile/assets/{icon,splash,adaptive-icon}.png` (placeholders), `apps/mobile/expo-env.d.ts`, `apps/mobile/nativewind-env.d.ts`, `apps/mobile/global.css`, `apps/mobile/tailwind.config.js`, `apps/mobile/index.ts`.

- [ ] **Step 1: Create `apps/mobile/app.config.ts`**

```ts
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Pulse",
  slug: "pulse-planner",
  scheme: "pulse",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#FFFFFF" },
  ios: {
    bundleIdentifier: "me.reinfeld.pulse",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ["fetch", "processing"],
      NSFaceIDUsageDescription: "Pulse nutzt Face ID zum schnellen Entsperren.",
      ITSAppUsesNonExemptEncryption: false
    },
    entitlements: {
      "com.apple.security.application-groups": ["group.me.reinfeld.pulse"]
    }
  },
  experiments: { typedRoutes: true },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-notifications", { color: "#2563EB" }],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    [
      "@bacons/apple-targets",
      {
        appleTeamId: "PLACEHOLDER_APPLE_TEAM_ID",
        targets: ["./targets/TodayWidget"]
      }
    ]
  ],
  extra: {
    eas: { projectId: "PLACEHOLDER_EAS_PROJECT_ID" },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
});
```

- [ ] **Step 2: Create `apps/mobile/eas.json`**

```json
{
  "cli": { "version": ">= 13.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "ios": { "autoIncrement": "buildNumber" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "PLACEHOLDER_APPLE_ID_EMAIL",
        "ascAppId": "PLACEHOLDER_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "PLACEHOLDER_APPLE_TEAM_ID"
      }
    }
  }
}
```

- [ ] **Step 3: Create `apps/mobile/tailwind.config.js`**

```js
const { hairlineWidth } = require("nativewind/theme");

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pulse: { DEFAULT: "#2563EB", 50: "#EFF6FF", 600: "#2563EB", 700: "#1D4ED8" },
        ink: { DEFAULT: "#0F172A", muted: "#475569" }
      },
      borderWidth: { hairline: hairlineWidth() }
    }
  }
};
```

- [ ] **Step 4: Create `apps/mobile/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Create `apps/mobile/nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 6: Create `apps/mobile/expo-env.d.ts`**

```ts
/// <reference types="expo-router/types" />
```

- [ ] **Step 7: Create `apps/mobile/index.ts`**

```ts
import "expo-router/entry";
```

- [ ] **Step 8: Drop placeholder icon/splash assets**

`apps/mobile/assets/icon.png`, `splash.png`, `adaptive-icon.png` — 1024×1024 PNG with Pulse logo. Use any placeholder (`apps/desktop/assets/logo.png` upscaled is fine for now).

- [ ] **Step 9: Verify Expo config parses**

Run: `& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/mobile exec expo config --type public`
Expected: prints a valid JSON config; no plugin errors.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/eas.json apps/mobile/tailwind.config.js apps/mobile/global.css apps/mobile/nativewind-env.d.ts apps/mobile/expo-env.d.ts apps/mobile/index.ts apps/mobile/assets/
git commit -m "chore(mobile): expo + nativewind + eas configuration"
```

---

## Task 3: Refactor `@pulse/core` — export SQL DDL strings (TDD)

**Files:**
- Create: `packages/core/src/sql/ddl.ts`, `packages/core/src/sql/ddl.test.ts`
- Modify: `packages/core/src/index.ts`, `apps/desktop/src/main/store/better-sqlite-store.ts` (consume the shared DDL)

- [ ] **Step 1: Write failing test `packages/core/src/sql/ddl.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { TABLE_DDL, SYNC_STATE_DDL, ALL_DDL } from "./ddl";

describe("DDL exports", () => {
  it("exports CREATE TABLE statements for every domain entity", () => {
    expect(TABLE_DDL.tasks).toMatch(/CREATE TABLE IF NOT EXISTS tasks/);
    expect(TABLE_DDL.projects).toMatch(/CREATE TABLE IF NOT EXISTS projects/);
    expect(TABLE_DDL.tags).toMatch(/CREATE TABLE IF NOT EXISTS tags/);
    expect(TABLE_DDL.task_tags).toMatch(/CREATE TABLE IF NOT EXISTS task_tags/);
    expect(TABLE_DDL.comments).toMatch(/CREATE TABLE IF NOT EXISTS comments/);
    expect(TABLE_DDL.subtasks).toMatch(/CREATE TABLE IF NOT EXISTS subtasks/);
    expect(TABLE_DDL.notes).toMatch(/CREATE TABLE IF NOT EXISTS notes/);
    expect(TABLE_DDL.time_entries).toMatch(/CREATE TABLE IF NOT EXISTS time_entries/);
    expect(TABLE_DDL.attachments).toMatch(/CREATE TABLE IF NOT EXISTS attachments/);
  });

  it("includes sync_state table", () => {
    expect(SYNC_STATE_DDL).toMatch(/CREATE TABLE IF NOT EXISTS sync_state/);
  });

  it("ALL_DDL concatenates all statements in dependency order", () => {
    const i = (s: string) => ALL_DDL.indexOf(s);
    expect(i("CREATE TABLE IF NOT EXISTS projects")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS tasks"));
    expect(i("CREATE TABLE IF NOT EXISTS tasks")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS task_tags"));
    expect(i("CREATE TABLE IF NOT EXISTS tags")).toBeLessThan(i("CREATE TABLE IF NOT EXISTS task_tags"));
  });
});
```

- [ ] **Step 2: Implement `packages/core/src/sql/ddl.ts`**

Extract the exact DDL from `apps/desktop/src/main/store/migrations/001_init.sql` (and any later migrations applied locally) into a typed module. Each statement becomes a key on `TABLE_DDL`; concatenate in correct dependency order for `ALL_DDL`. Re-export from `packages/core/src/index.ts`.

- [ ] **Step 3: Modify `apps/desktop/src/main/store/better-sqlite-store.ts`**

Replace the inline migration loader with `ALL_DDL` import from `@pulse/core/sql/ddl`. Keep file-based migrations as a no-op for backward compatibility (or delete if the DDL fully supersedes).

- [ ] **Step 4: Verify both test suites green**

```bash
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/core test
& "C:\Users\info\node22\node.exe" "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/desktop test
```

Expected: `@pulse/core` 69 + 3 new tests green. Desktop 27 tests still green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/sql/ packages/core/src/index.ts apps/desktop/src/main/store/better-sqlite-store.ts
git commit -m "refactor(core): export shared DDL strings for desktop + mobile"
```

---

## Task 4: Hoist `quick-add-parser` to `@pulse/core` (TDD)

**Files:**
- Create: `packages/core/src/quickAdd/parser.ts`, `packages/core/src/quickAdd/parser.test.ts`
- Modify: `packages/core/src/index.ts`
- Delete: `apps/desktop/src/renderer/lib/quick-add-parser.ts` (and update imports in `apps/desktop/src/renderer/quick-add/QuickAdd.tsx`)

- [ ] **Step 1: Copy existing desktop parser + tests verbatim into `@pulse/core/quickAdd/`**

Copy `apps/desktop/src/renderer/lib/quick-add-parser.ts` → `packages/core/src/quickAdd/parser.ts`. Copy any related tests. Adjust internal imports if any (date-fns, chrono-node already available transitively).

- [ ] **Step 2: Re-export from `packages/core/src/index.ts`**

```ts
export { parseQuickAdd } from "./quickAdd/parser";
```

- [ ] **Step 3: Update desktop import**

`apps/desktop/src/renderer/quick-add/QuickAdd.tsx`:
```ts
import { parseQuickAdd } from "@pulse/core";
```
Delete `apps/desktop/src/renderer/lib/quick-add-parser.ts`.

- [ ] **Step 4: Verify desktop tests green**

```bash
& "C:\Users\info\node22\node.exe" "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/desktop test
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/quickAdd/ packages/core/src/index.ts apps/desktop/src/renderer/quick-add/QuickAdd.tsx
git rm apps/desktop/src/renderer/lib/quick-add-parser.ts
git commit -m "refactor(core): hoist quick-add parser from desktop to @pulse/core"
```

---

## Task 5: `ExpoSqliteStore` (TDD against `@pulse/core` LocalStore contract)

**Files:**
- Create: `apps/mobile/src/platform/ExpoSqliteStore.ts`, `apps/mobile/test/unit/ExpoSqliteStore.test.ts`

- [ ] **Step 1: Write failing test using jest-expo**

Mirror the `BetterSqliteStore`-contract tests. Use `expo-sqlite/next` async API; for tests use the in-memory mode (`:memory:`). Cover: `upsertProject`, `upsertTask`, `softDelete`, `getCursor` / `setCursor`, conflict-safe ON CONFLICT, `listInbox`, task_tags composite-PK insert/delete.

- [ ] **Step 2: Implement `ExpoSqliteStore`**

Constructor takes a `SQLiteDatabase` from `expo-sqlite`. Boot routine executes `ALL_DDL` from `@pulse/core/sql/ddl`. All CRUD uses parameterized statements via `db.runAsync` / `db.getAllAsync`. Reuse case-mapping helper from `@pulse/core`.

Key invariants from Phase-1/2 lessons:
- `task_tags` ON CONFLICT (task_id, tag_id) DO UPDATE (composite key, no `updated_at`).
- `set_updated_at` is **NOT** triggered locally; the server is authoritative for that — store raw `updated_at` from upsert payload.
- Soft delete sets `deleted_at`, never removes row.

- [ ] **Step 3: Run jest**

```bash
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/mobile test ExpoSqliteStore
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/platform/ExpoSqliteStore.ts apps/mobile/test/unit/ExpoSqliteStore.test.ts
git commit -m "feat(mobile): ExpoSqliteStore implementation of LocalStore"
```

---

## Task 6: `SecureStoreTokenStorage` (TDD)

**Files:** Create `apps/mobile/src/platform/SecureStoreTokenStorage.ts`, `apps/mobile/test/unit/SecureStoreTokenStorage.test.ts`.

- [ ] **Step 1: Write failing test**

Mock `expo-secure-store`'s `setItemAsync` / `getItemAsync` / `deleteItemAsync`. Verify `TokenStorage` interface: `load()`, `save(tokens)`, `clear()`. Single key under the hood storing JSON `{ accessToken, refreshToken, userId, userEmail }`. Null-safe `load()` when nothing stored.

- [ ] **Step 2: Implement**

```ts
import * as SecureStore from "expo-secure-store";
import { TokenStorage, Tokens } from "@pulse/core";

const KEY = "pulse.tokens";

export class SecureStoreTokenStorage implements TokenStorage {
  async load(): Promise<Tokens | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) as Tokens : null;
  }
  async save(t: Tokens): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(t), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  }
  async clear(): Promise<void> { await SecureStore.deleteItemAsync(KEY); }
}
```

- [ ] **Step 3: Test + commit**

```bash
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/mobile test SecureStoreTokenStorage
git add apps/mobile/src/platform/SecureStoreTokenStorage.ts apps/mobile/test/unit/SecureStoreTokenStorage.test.ts
git commit -m "feat(mobile): SecureStoreTokenStorage impl of TokenStorage"
```

---

## Task 7: DI container `deps.ts` + Splash boot

**Files:** Create `apps/mobile/src/wiring/deps.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/test/integration/deps-wiring.test.ts`, `apps/mobile/src/lib/prefs.ts`.

- [ ] **Step 1: Implement `prefs.ts` (MMKV wrapper)**

```ts
import { MMKV } from "react-native-mmkv";
export const prefs = new MMKV({ id: "pulse.prefs" });

export const getRememberMe = () => prefs.getBoolean("rememberMe") ?? false;
export const setRememberMe = (v: boolean) => prefs.set("rememberMe", v);
export const getFaceIdEnabled = () => prefs.getBoolean("faceIdEnabled") ?? false;
export const setFaceIdEnabled = (v: boolean) => prefs.set("faceIdEnabled", v);
```

- [ ] **Step 2: Implement `deps.ts`**

Mirror desktop pattern. Opens SQLite via `openDatabaseAsync("pulse.db")`, runs `ALL_DDL`, constructs `ExpoSqliteStore`, `SecureStoreTokenStorage`, Supabase JS client (use `extra.supabaseUrl` + `extra.supabaseAnonKey`), `AuthService`, `SyncEngine`, `Outbox`, `MergeEngine`. Returns `{ engine, auth, store, outbox }`.

- [ ] **Step 3: Implement `app/_layout.tsx`**

```tsx
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { buildDeps, Deps } from "@/wiring/deps";
import { DepsProvider } from "@/wiring/depsContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [deps, setDeps] = useState<Deps | null>(null);
  useEffect(() => {
    (async () => {
      const d = await buildDeps();
      setDeps(d);
      await SplashScreen.hideAsync();
    })();
  }, []);
  if (!deps) return null;
  return (
    <DepsProvider value={deps}>
      <Stack screenOptions={{ headerShown: false }} />
    </DepsProvider>
  );
}
```

`depsContext.ts` is a trivial React-Context wrapper (`createContext<Deps | null>(null)` + hook `useDeps()`).

- [ ] **Step 4: Integration test `deps-wiring.test.ts`**

Smoke test that `buildDeps()` returns non-null services with a mocked Supabase client + in-memory SQLite. Verify `engine.pull()` runs without throwing on empty server.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/wiring/ apps/mobile/src/lib/prefs.ts apps/mobile/app/_layout.tsx apps/mobile/test/integration/deps-wiring.test.ts
git commit -m "feat(mobile): DI container + Splash boot"
```

---

## Task 8: Zustand stores + sync wiring (mirror desktop)

**Files:** Create `apps/mobile/src/stores/{auth,tasks,projects,tags,ui,sync}.ts` and a `refreshAll()` helper.

- [ ] **Step 1: Port desktop stores 1:1**

Each store has identical action surface to desktop (`tasksStore.add`, `update`, `markDone`, `markUndone`, `move`, `delete`, `setTagsForTask`, `refresh`). Calls `@pulse/core` services from `deps.ts`. UI subscribes via `useStore`.

- [ ] **Step 2: Hook into sync events**

`SyncEngine.subscribeRealtime()` fires `applied` events → debounce 500ms → `refreshAll()`. Same pattern as desktop commit `82b9f8f`.

- [ ] **Step 3: Outbox start/stop on app state**

`AppState` listener in `_layout.tsx`: on `active` → `outbox.resume()` + `engine.pull()` + `subscribeRealtime()`. On `background` → `outbox.pause()` + `unsubscribeRealtime()`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/stores/ apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): Zustand stores + sync lifecycle"
```

---

## Task 9: Auth screens (Login, Signup, Face-ID toggle)

**Files:** Create `apps/mobile/app/auth/{login,signup}.tsx`, `apps/mobile/src/screens/auth/{LoginScreen,SignupScreen}.tsx`.

- [ ] **Step 1: LoginScreen**

Email + password inputs, "Angemeldet bleiben" checkbox (writes to MMKV `rememberMe`), submit → `auth.signIn()`. On success → `router.replace("/(tabs)/today")`. Show Face-ID quick-unlock button if `faceIdEnabled && tokens exist in SecureStore`.

- [ ] **Step 2: Face-ID quick unlock**

```ts
import * as LocalAuthentication from "expo-local-authentication";
const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Pulse entsperren" });
if (r.success) { await auth.refreshSession(); router.replace("/(tabs)/today"); }
```

- [ ] **Step 3: SignupScreen** — email + password + confirm; calls `auth.signUp()`.

- [ ] **Step 4: Routing guard**

In `app/_layout.tsx`, if `!deps.auth.hasValidSession()` → redirect to `/auth/login`. Otherwise render `(tabs)`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/auth/ apps/mobile/src/screens/auth/
git commit -m "feat(mobile): auth screens with Face-ID quick unlock"
```

---

## Task 10: Tab navigation scaffolding

**Files:** Create `apps/mobile/app/(tabs)/_layout.tsx` + empty stubs for the 5 tab files.

- [ ] **Step 1: `(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { CalendarDays, Inbox, Folder, Settings, Sun } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563EB" }}>
      <Tabs.Screen name="today" options={{ title: "Heute", tabBarIcon: ({ color }) => <Sun color={color} /> }} />
      <Tabs.Screen name="upcoming" options={{ title: "Demnächst", tabBarIcon: ({ color }) => <CalendarDays color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox", tabBarIcon: ({ color }) => <Inbox color={color} /> }} />
      <Tabs.Screen name="projects" options={{ title: "Projekte", tabBarIcon: ({ color }) => <Folder color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <Settings color={color} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Each tab file renders its screen component (stubs returning EmptyState).**

- [ ] **Step 3: Add deep-link config** to `app.config.ts` (`scheme: "pulse"` already there) + `Linking.parseInitialURLAsync()` in `_layout.tsx` to handle `pulse://task/<id>` → `router.push(/task/<id>)`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/ apps/mobile/src/screens/
git commit -m "feat(mobile): tab navigation scaffolding"
```

---

## Task 11: TodayScreen + UpcomingScreen

**Files:** Implement `apps/mobile/src/screens/today/TodayScreen.tsx`, `UpcomingScreen.tsx`, plus `TaskRow.tsx`, `SyncStatusPill.tsx`.

- [ ] **Step 1: `TaskRow`**

Checkbox + title + due-pill + tag-dots. Swipe-left action ("Erledigt") via `react-native-gesture-handler` `Swipeable`. Long-press → ActionSheet via `ActionSheetIOS.showActionSheetWithOptions`.

- [ ] **Step 2: `TodayScreen`**

`useTasksStore` → memo-filtered: overdue + due-today. Two sections, FlatList. Header: title + Quick-Add `+` button (opens QuickAddSheet, Task 18) + `SyncStatusPill` + search icon.

- [ ] **Step 3: `UpcomingScreen`**

`useTasksStore` → memo-filtered: next 7 days, grouped by date. SectionList.

- [ ] **Step 4: Pull-to-refresh**

`<RefreshControl onRefresh={() => deps.engine.pull()} />` on each FlatList.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/today/ apps/mobile/src/components/TaskRow.tsx apps/mobile/src/components/SyncStatusPill.tsx
git commit -m "feat(mobile): Today + Upcoming screens"
```

---

## Task 12: InboxScreen

**Files:** Implement `apps/mobile/src/screens/inbox/InboxScreen.tsx`.

- [ ] **Step 1:** `useTasksStore` filter `projectId === null`. FlatList of `<TaskRow>`.
- [ ] **Step 2:** Long-press → ActionSheet "Verschieben in Projekt…" opens project picker bottom-sheet.
- [ ] **Step 3:** EmptyState when no inbox tasks.
- [ ] **Step 4:** Commit.

```bash
git add apps/mobile/src/screens/inbox/
git commit -m "feat(mobile): Inbox screen with project picker move action"
```

---

## Task 13: ProjectsScreen + ProjectDetailScreen

**Files:** `apps/mobile/src/screens/projects/{ProjectsScreen,ProjectDetailScreen}.tsx`, `apps/mobile/src/components/ProjectRow.tsx`, `apps/mobile/app/project/[id].tsx`.

- [ ] **Step 1: ProjectsScreen**

Active section (default expanded), Archive section (default collapsed). `<ProjectRow>` with color dot, name, progress bar (computed: `done / total`).

- [ ] **Step 2: ProjectDetailScreen**

Header: inline-edit name on tap, `<ColorSwatchPopover>` for color, `<DueDatePicker>` for due_date, multiline description (autosave on blur). Sub-tabs Tasks / Notizen via top tab-bar (`@react-navigation/material-top-tabs` or simple toggle). Tasks tab → FlatList of `<TaskRow>` filtered by `projectId`. Notizen tab → markdown text editor (display via `<MarkdownView>`, edit via `<TextInput multiline>`).

- [ ] **Step 3: Archive toggle** — long-press on project row → ActionSheet "Archivieren / Reaktivieren / Löschen".

- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/src/screens/projects/ apps/mobile/src/components/ProjectRow.tsx apps/mobile/app/project/
git commit -m "feat(mobile): Projects list + project detail with sub-tabs"
```

---

## Task 14: TaskDetailScreen

**Files:** `apps/mobile/src/screens/tasks/TaskDetailScreen.tsx`, `apps/mobile/app/task/[id].tsx`, `apps/mobile/src/components/{MarkdownView,RRulePicker,TagPicker,DueDatePicker}.tsx`.

- [ ] **Step 1: TaskDetailScreen**

Sections (scroll): Title (inline edit), Project chip (tap → picker), Due (tap → DueDatePicker), Recurrence (tap → RRulePicker), Tags row (tap → TagPicker bottom sheet), Description (Markdown display + tap to edit), Comments list, Subtasks list (checklist).

- [ ] **Step 2: MarkdownView**

`react-native-markdown-display` with custom rules: links open via `Linking.openURL`, headings styled with NativeWind classes.

- [ ] **Step 3: RRulePicker bottom sheet**

Presets (Aus / Täglich / Werktags / Wöchentlich+Day-Picker / Alle 2 Wochen / Monatlich / Jährlich / Custom). Custom shows freq + interval + byDay multi-select.

- [ ] **Step 4: TagPicker bottom sheet**

Existing tags with checkboxes, "+ Neu" creates inline (asks name + color via `<ColorSwatchPopover>`).

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/src/screens/tasks/ apps/mobile/src/components/{MarkdownView,RRulePicker,TagPicker,DueDatePicker}.tsx apps/mobile/app/task/
git commit -m "feat(mobile): task detail screen with markdown, RRULE, tags"
```

---

## Task 15: TagsScreen (cross-project filter)

**Files:** `apps/mobile/src/screens/tags/TagsScreen.tsx`, `apps/mobile/app/tags/index.tsx`.

- [ ] **Step 1:** List of all tags. Tap → opens filtered view: tasks across all projects with that tag.
- [ ] **Step 2:** Long-press tag → "Umbenennen / Farbe ändern / Löschen".
- [ ] **Step 3:** Commit.

```bash
git add apps/mobile/src/screens/tags/ apps/mobile/app/tags/
git commit -m "feat(mobile): cross-project tag filter view"
```

---

## Task 16: SearchScreen

**Files:** `apps/mobile/src/screens/search/SearchScreen.tsx`, `apps/mobile/app/search.tsx`, search icon in each tab header.

- [ ] **Step 1:** Search input at top, debounced 200ms. Match across tasks (title, description), projects (name), tags (name). Result rows are tappable → push detail.
- [ ] **Step 2:** Search icon button in tab headers → `router.push("/search")`.
- [ ] **Step 3:** Commit.

```bash
git add apps/mobile/src/screens/search/ apps/mobile/app/search.tsx
git commit -m "feat(mobile): global search screen"
```

---

## Task 17: QuickAddSheet

**Files:** `apps/mobile/src/components/QuickAddSheet.tsx`, integration in Today/Inbox/Projects headers.

- [ ] **Step 1:** Bottom-sheet (`@gorhom/bottom-sheet` or RN `Modal` with translucent backdrop) containing a `TextInput` and a `<Preview>` chip strip.
- [ ] **Step 2:** Live parse via `parseQuickAdd` from `@pulse/core` (hoisted in Task 4). Show chips for detected date, project, tags.
- [ ] **Step 3:** Submit → `tasks.add({...parsed})` → close sheet. If parsed `projectId == null` → task lands in Inbox.
- [ ] **Step 4:** Commit.

```bash
git add apps/mobile/src/components/QuickAddSheet.tsx apps/mobile/src/screens/
git commit -m "feat(mobile): Quick-Add bottom sheet with live token preview"
```

---

## Task 18: SettingsScreen + debug log export

**Files:** `apps/mobile/src/screens/settings/SettingsScreen.tsx`, `apps/mobile/app/(tabs)/settings.tsx`.

- [ ] **Step 1:** Sections — Account (email + Logout button), Sync (last sync timestamp, "Jetzt synchronisieren" button), Sicherheit (Face-ID toggle), Erinnerungen (master switch + "Öffne iOS-Einstellungen" if denied), Über (Version + Build-Number via `expo-application`), Debug ("Log exportieren" → `Sharing.shareAsync`).
- [ ] **Step 2:** Logout: confirm dialog → `auth.signOut()` → SecureStore clear → `engine.unsubscribeRealtime()` → cancel-all-notifications → `router.replace("/auth/login")`. Local SQLite kept (per spec default).
- [ ] **Step 3:** Commit.

```bash
git add apps/mobile/src/screens/settings/ apps/mobile/app/(tabs)/settings.tsx
git commit -m "feat(mobile): settings screen + logout + debug log export"
```

---

## Task 19: Local notifications + reconciler (TDD reconciler)

**Files:** `apps/mobile/src/platform/ExpoNotifications.ts`, `apps/mobile/src/notifications/reconciler.ts`, `apps/mobile/test/unit/notification-reconciler.test.ts`.

- [ ] **Step 1: Reconciler pure logic + tests**

Pure function `reconcile(allTasks, scheduledSet, now)` → returns `{ toCancel: string[], toSchedule: TaskNotificationSpec[] }`. Tests cover: skip past-due, cap at 60, idempotent updates on dueDate change, recurrence-next only.

- [ ] **Step 2: ExpoNotifications.ts**

- Register `TASK_DUE` category with Done + Snooze1h + SnoozeTomorrow actions.
- `requestPermissions()`, `schedule(spec)`, `cancel(taskId)`, `cancelAll()`.
- Handler for `addNotificationResponseReceivedListener`: dispatches `tasksStore.markDone` / reschedule.
- Queue replay from MMKV `pendingNotificationActions` after token refresh.

- [ ] **Step 3: Wire reconciler into sync lifecycle**

Call `reconcileNotifications()` after each `engine.pull()` success, after each `tasks.upsert` / `markDone` / `delete`, and on `AppState=active`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/platform/ExpoNotifications.ts apps/mobile/src/notifications/ apps/mobile/test/unit/notification-reconciler.test.ts
git commit -m "feat(mobile): local notifications with snooze/done + 60-cap reconciler"
```

---

## Task 20: Today widget (apple-targets) + WidgetData snapshot writer (TDD writer)

**Files:** `apps/mobile/src/platform/WidgetData.ts`, `apps/mobile/test/unit/WidgetData.test.ts`, `apps/mobile/targets/TodayWidget/{TodayWidget,TodayWidgetBundle,Provider}.swift`, `apps/mobile/targets/TodayWidget/Info.plist`.

- [ ] **Step 1: WidgetData.ts**

```ts
import * as FileSystem from "expo-file-system";
const APP_GROUP_PATH = `${FileSystem.documentDirectory}../AppGroup/group.me.reinfeld.pulse/`;
const SNAPSHOT = APP_GROUP_PATH + "today_snapshot.json";

export interface WidgetSnapshot { generatedAt: string; tasks: Array<{ id: string; title: string; due: string | null; projectColor: string | null }>; }

export async function writeSnapshot(snap: WidgetSnapshot): Promise<void> { /* ensureDir + writeAsStringAsync */ }
export async function readSnapshot(): Promise<WidgetSnapshot | null> { /* readAsStringAsync, parse */ }
```

- [ ] **Step 2: Reload widget via native module**

Use `expo-modules-core` `requireNativeModule` or a tiny config-plugin shim that calls `WidgetCenter.shared.reloadAllTimelines()`. (Alternative: invalidate via file-write — iOS will pick up on next timeline tick.)

- [ ] **Step 3: SwiftUI widget**

`Provider.swift` reads the JSON from App-Group container path, builds Timeline entries with current snapshot + a refresh `after(now + 30 min)` policy. `TodayWidget.swift` renders Small + Medium layouts with Pulse `#2563EB` accents.

- [ ] **Step 4: Trigger write on relevant events**

In `deps.ts` and `tasks` store: after `engine.pull()` succeeds, after `tasks.markDone`, after `tasks.upsert` with today's `due_date` → call `WidgetData.writeSnapshot(buildTodaySnapshot())`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/platform/WidgetData.ts apps/mobile/test/unit/WidgetData.test.ts apps/mobile/targets/
git commit -m "feat(mobile): Today widget + App-Group snapshot writer"
```

---

## Task 21: Background fetch

**Files:** `apps/mobile/src/platform/BackgroundFetch.ts`, registration in `app/_layout.tsx`.

- [ ] **Step 1: Define task** via `TaskManager.defineTask("pulse-bg-pull", async () => { await deps.engine.pull(); await WidgetData.writeSnapshot(...); return BackgroundFetchResult.NewData; })`.
- [ ] **Step 2: Register on boot** with `BackgroundFetch.registerTaskAsync` minimumInterval 30*60 (iOS treats it as a hint).
- [ ] **Step 3: Log result to debug log.**
- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/src/platform/BackgroundFetch.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): background fetch best-effort pull"
```

---

## Task 22: Sync status pill + error handling + DLQ view

**Files:** `apps/mobile/src/components/SyncStatusPill.tsx`, `apps/mobile/src/screens/settings/DLQScreen.tsx`, `apps/mobile/app/settings/dlq.tsx`.

- [ ] **Step 1: SyncStatusPill** — subscribes to `syncStore` (`status: idle | syncing | error | offline`), tap → manual pull.
- [ ] **Step 2: DLQ screen** under Settings → "Fehlgeschlagene Sync-Items". Each row shows: kind, entity-id, attempts, lastError. Actions: Retry, Delete.
- [ ] **Step 3: 401 handling** in `deps.ts` — on Supabase error code 401, attempt `auth.refreshSession()`; if that fails, clear SecureStore + navigate to `/auth/login` with toast.
- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/src/components/SyncStatusPill.tsx apps/mobile/src/screens/settings/DLQScreen.tsx apps/mobile/app/settings/
git commit -m "feat(mobile): sync status pill + DLQ + 401 recovery"
```

---

## Task 23: EAS Build dev + preview profile run

**Files:** uses `apps/mobile/eas.json` from Task 2.

- [ ] **Step 1:** Run `eas login` (Eugen does this in his terminal).
- [ ] **Step 2:** Run `eas init` from `apps/mobile/` — fills `extra.eas.projectId`. Commit the resulting `app.config.ts` change.
- [ ] **Step 3:** Run `eas build --profile development --platform ios`. This requires Apple Developer credentials (Team-ID, distribution cert). EAS prompts interactively first time and stores them on Expo's servers.
- [ ] **Step 4:** Install the resulting `.ipa` via TestFlight or direct download (development build = ad-hoc).
- [ ] **Step 5:** Smoke test on Eugen's iPhone: app boots, login works, syncs once.
- [ ] **Step 6:** Commit any config tweaks. (No artifact in repo — EAS hosts builds.)

```bash
git add apps/mobile/app.config.ts
git commit -m "build(mobile): EAS project initialized + first development build"
```

---

## Task 24: Jest test run + integration tests pass

**Files:** Create `apps/mobile/jest.config.js`, `apps/mobile/jest.setup.ts`.

- [ ] **Step 1: `jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEach: ["./jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@bacons/.*|nativewind))"
  ]
};
```

- [ ] **Step 2: Run full suite**

```bash
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/mobile test
```

Expected: ExpoSqliteStore tests + SecureStoreTokenStorage tests + WidgetData tests + notification-reconciler tests + quick-add-parser tests + deps-wiring integration all green.

- [ ] **Step 3:** Also verify `@pulse/core` (69 + 3 new DDL tests) and `@pulse/desktop` (27 + reused parser tests) green from earlier tasks.

- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/jest.config.js apps/mobile/jest.setup.ts
git commit -m "test(mobile): jest configuration + all unit/integration suites green"
```

---

## Task 25: TestFlight upload + manual checklist + acceptance

**Files:** Create `apps/mobile/README.md`, update `phase3` memory.

- [ ] **Step 1:** Run `eas build --profile production --platform ios`. Wait for EAS to build (~15 min).
- [ ] **Step 2:** Run `eas submit --platform ios --profile production`. Uploads to App Store Connect → TestFlight.
- [ ] **Step 3:** Wait for Apple processing (10–60 min). Eugen invites himself as internal tester in App Store Connect.
- [ ] **Step 4:** Install via TestFlight on Eugen's iPhone. Execute the §12.1 spec checklist verbatim.

```
[ ] Fresh install: Login mit Test-Account funktioniert
[ ] Bestehender Install: App startet ohne Re-Login
[ ] Face-ID-Toggle aktivieren → Restart → Face-ID-Prompt
[ ] Pull-to-refresh in jedem Tab triggert SyncStatusPill
[ ] Task anlegen → erscheint in Desktop nach <5s (Realtime)
[ ] Task in Desktop ändern → erscheint in Mobile nach <5s
[ ] Airplane an → Task anlegen → Airplane aus → Task syncs out
[ ] Quick-Add zeigt Token-Preview (Datum/Projekt/Tags)
[ ] Notification feuert bei Due-Date (+1min-Test)
[ ] Notification-Action „Erledigt" → Task done in DB
[ ] Snooze-Action verschiebt Notification korrekt
[ ] Today-Widget zeigt heutige Tasks, Tap öffnet App
[ ] Widget aktualisiert sich nach Task-Done in der App
[ ] App-Background >30min → Foreground triggert Pull
[ ] Logout löscht Token, App fordert Re-Login
```

- [ ] **Step 5:** Create `apps/mobile/README.md`:

```md
# @pulse/mobile

Pulse Project Planner — iOS companion. Expo SDK 52 Managed, EAS Build → TestFlight.

## Run locally (Expo Go limited; dev-client preferred)
1. `pnpm install`
2. `pnpm --filter @pulse/mobile start`
3. Scan QR with dev-client on iPhone (requires EAS dev build installed once).

## Build for TestFlight
1. `cd apps/mobile`
2. `eas build --profile production --platform ios`
3. `eas submit --platform ios --profile production`

## Env
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` must be set (via EAS Secrets in production, `.env` for dev).

## Tests
- `pnpm --filter @pulse/mobile test`
```

- [ ] **Step 6: Commit + close out**

```bash
git add apps/mobile/README.md
git commit -m "docs(mobile): README + phase 3 acceptance verified on TestFlight"
```

Update `project_pulse_planner.md` memory: Phase 3 COMPLETE, list known follow-ups (Apple Reminders bridge v1.1, Watch app, attachments on mobile, Dashboard on mobile).

---

## Open Questions (resolved during plan)

1. **Logout local-data behavior** — keep SQLite cached (spec default). Re-evaluate after first month of use.
2. **Quick-Add parser location** — hoist to `@pulse/core` (Task 4).
3. **EAS project handle** — `expo.dev/@<placeholder>` filled by `eas init` in Task 23.
4. **Apple Team-ID + signing** — entered interactively at first `eas build --platform ios`; cached on EAS servers.

## Cross-references

- Spec: `docs/superpowers/specs/2026-05-11-pulse-planner-ios-design.md`
- Reused: `@pulse/core` (Phase 1), `BetterSqliteStore` reference (Phase 2 `apps/desktop/src/main/store/`).
- Memory updates expected after Phase 3 completes: `project_pulse_planner.md` Phase-status block.
