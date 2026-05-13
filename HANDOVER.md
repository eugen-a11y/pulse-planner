# Pulse Project Planner — Handover

Stand: **2026-05-13**, nach Build 20 / Version 0.1.19 auf TestFlight, live verifiziert auf iPhone.

## Wo wir stehen

**Phase 1 + 2 + 3 alle COMPLETE & live-verified.** Pulse läuft produktiv:
- Mobile auf iPhone via TestFlight (Build 20, 0.1.19)
- Desktop-Installer: `apps/desktop/release/Pulse-Setup-0.1.4.exe`
- Cloud-Supabase Frankfurt: `albbdekronmsiqiwnlpp.supabase.co`

Letzte Acceptance-Round-2 Fixes (Commits `acbe388` + `a3962d0`):
- Notification: stable identifier (kein 20×-Stapeln) + `sound: "default"`
- Reminder-Feature: 14 Presets (Aus → 1 Woche vorher), Mobile + Desktop Parität, neue Spalte `tasks.reminder_offset_minutes`
- DueDatePicker: Spinner bleibt offen bis Speichern, `locale="de-DE"`
- TagPicker + Kommentare: KeyboardAvoidingView / `automaticallyAdjustKeyboardInsets`
- Face-ID komplett raus (Auto-Login reicht)

## Repo-Stand

```
Branch: main
Last commits:
  a3962d0  feat(desktop): reminder offset parity with mobile
  acbe388  fix(mobile): TestFlight acceptance round 2 — notif dedup/sound + UX polish
  195d9f6  feat(mobile): per-task reminder offset + DueDatePicker UX + Face-ID rollback
```

Direkt-zu-main Commits (Eugen-Präferenz, keine Feature-Branches).

## Was als Nächstes — Entscheidung war

**Public App Store Submission + Android-Release parallel.** Reihenfolge:

1. **Konto-Löschen-Flow** (blockiert Apple Review seit 2022). In Settings: "Konto löschen" → Confirm-Dialog → ruft `supabase.auth.admin.deleteUser` oder eigenen RPC, löscht lokale SQLite, redirect zu Login. ~Halber Tag.
2. **Desktop Auto-Update fixen** — `PLACEHOLDER_GITHUB_OWNER` in `apps/desktop/electron-builder.yml` durch echten GitHub-Handle ersetzen + GitHub Release einrichten. ~1h.
3. **Android-Port** — `eas.json` Android-Profile, Google Play Console (25 $ einmalig), Notification-Permission ab Android 13, AAB-Build. Großteil läuft cross-platform schon. ~1 Tag Code + Acceptance.
4. **App-Store-Preflight** für beide Plattformen: Screenshots (iPhone 6.7" + 5.5", verschiedene Android-Größen), Beschreibung DE+EN, Privacy Policy URL (z.B. `pulsehamburg.de/privacy`), Support URL.
5. **Public Submit** auf beiden Stores parallel. Apple Review 1–3 Tage, Google ~24h.

## Wichtige Pfade & IDs

```
Repo                C:\Users\info\Claude Code Database 2\Project Management Tool
Memory              C:\Users\info\.claude\projects\C--Users-info-Claude-Code-Database-2-Project-Management-Tool\memory\

Apple Team-ID       67YNFPW8Q3 (Eugen Reinfeld, Individual)
EAS Org             deathrage94s-organization
EAS Project         bad410c4-bd22-49c4-86c8-bc027c7b876d
Bundle-ID           me.reinfeld.pulse
App Group           group.me.reinfeld.pulse
ASC App-ID          6768802840
Apple-ID            eugen@reinfeld.me

Cloud Supabase Ref  albbdekronmsiqiwnlpp  (Frankfurt)
Anon Key            sb_publishable_nTaAenxeN3AgjrqUxb3SLw_ERv_wD3u (öffentlich, embedded in deps.ts)

iPhone UDID         00008150-000C6C2102A1401C (für EAS registriert)
```

## Toolchain-Pfade (Windows, kein Mac)

```
pnpm        C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD
supabase    C:\Users\info\.local\bin\supabase.exe
node22      C:\Users\info\node22\node.exe   (Workaround für better-sqlite3 ABI; Tests brauchen das auf PATH)
Electron    33.4.11
Expo SDK    52.0.0
RN          0.76.9 (Old Architecture)
```

## Häufig gebrauchte Befehle (PowerShell)

```powershell
# Desktop dev
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/desktop dev

# Desktop Installer bauen → apps/desktop/release/Pulse-Setup-<version>.exe
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" --filter @pulse/desktop dist

# Mobile EAS Build + Auto-Submit zu TestFlight (~20-25 Min)
Set-Location apps\mobile
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" exec eas build --profile production --platform ios --non-interactive --auto-submit

# Letzten Mobile-Build prüfen
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" exec eas build:list --platform ios --limit 1 --non-interactive --json

# Mobile Tests (Node 22 muss auf PATH sein)
$env:PATH = "C:\Users\info\node22;" + $env:PATH
& "C:\Users\info\AppData\Local\pnpm\bin\pnpm.CMD" exec jest

# Supabase Cloud Migration pushen
& "C:\Users\info\.local\bin\supabase.exe" db push --linked --include-all
```

## Architektur-Kurzform

```
packages/core           @pulse/core  — Domain, Zod, SyncEngine, Outbox, AuthService (geteilt)
apps/desktop            @pulse/desktop  — Electron + Vite + React + better-sqlite3
apps/mobile             @pulse/mobile   — Expo + RN + expo-sqlite + zustand
supabase/migrations/    Postgres schema (8 Migrations, alle auf Cloud)
tools/cli               @pulse/cli      — Phase-1 Test-Harness
```

Sync-Modell: offline-first, per-field LWW, push-after-mutation (200ms debounce) + realtime subscribe + 60s backstop. `sync_upsert` RPC auf Postgres-Seite.

## Bei jeder Mobile-Änderung nicht vergessen

Beide Stellen bumpen (Feedback-Memory `feedback_version_bumps.md`):
- `apps/mobile/package.json` → `version`
- `apps/mobile/app.config.ts` → `version` **und** `ios.buildNumber`

Build-Nummer ist auf "local" (`eas.json` `appVersionSource: "local"`), kein Auto-Increment.

## Bekannte Gotchas (aus Phase 3 Sessions)

- **NativeWind in Modal-Subtrees unzuverlässig** → in Modal-Inhalten immer inline `style={{}}` benutzen, nicht `className`. Besonders TextInput braucht `style={{ color: "#0F172A" }}` und `placeholderTextColor="#94A3B8"`.
- **pnpm Symlinks überleben Package-Downgrades** → nach Native-Dep-Änderung: `pnpm install --ignore-scripts` (Mobile-Side; better-sqlite3 postinstall failed auf Node 24).
- **`expo-modules-core@55.0.25` darf nicht im pnpm-Store hängen** → nach Version-Pin checken: `find node_modules/.pnpm -maxdepth 1 -name "expo-modules-core@*"`. Wir laufen auf `~2.2.3` (SDK52-compat).
- **EAS Build nach jeder Native-Dep-Änderung** (MMKV, Picker, etc.) — JS-only ginge ohne, aber Pods müssen frisch sein.
- **`better-sqlite3` braucht Node 22** auf Eugens Maschine → keine Node 24 prebuilds. Tests scheitern sonst mit Binding-Error.
- **Notifications: identifier=taskId verwenden** (sonst stapeln sich Schedules durch SDK-52-Async-Lag). `sound: "default"` explizit setzen.

## Offene Phase-2 Follow-ups (nicht blockierend)

Dokumentiert in `memory/project_pulse_planner.md` "Phase 2 — open follow-ups":
- #1 Desktop-Test-Script hardcoded `node22` (dev-only)
- #3 Playwright-E2E nie gelaufen (dev-QA)
- #4 **`PLACEHOLDER_GITHUB_OWNER`** → blockiert Desktop-Auto-Update (Roadmap Punkt 2)
- #5 Tray-Icon Platzhalter-PNG (kosmetisch)
- #6 Quick-Add Tag-Parsing wendet Tags nicht an (v1.x)
- #9 `tags.UNIQUE(user_id, name)` vs Soft-Delete (Edge-Case)
- #10 Inline-Edit-Felder hängen gelegentlich — unreproduzierbar, untracked

## Memory-Files (für neuen Terminal autoloadable)

Alles in `C:\Users\info\.claude\projects\C--Users-info-Claude-Code-Database-2-Project-Management-Tool\memory\`:
- `MEMORY.md` — Index (immer im Kontext)
- `project_pulse_planner.md` — Hauptzustand
- `phase3_task23_live.md` — Pod-install / SDK52 / UX-Pattern Gotchas
- `cloud_supabase.md` — Cloud-Projekt-Setup
- `feedback_*` — User-Präferenzen
- `user_eugen.md` — User-Profil

In neuem Terminal: kein expliziter Read nötig, MEMORY.md wird automatisch geladen. Einfach loslegen mit z.B. "Konto-Löschen-Flow implementieren" oder "Android-Port starten".

## Erster Prompt im neuen Terminal (Vorschlag)

> Lies HANDOVER.md im Repo-Root. Wir machen jetzt mit Punkt 1 weiter: Konto-Löschen-Flow in den Mobile-Settings, danach Desktop-Parität.

oder

> Lies HANDOVER.md. Wir starten mit Punkt 3: Android-Port. Ich brauche keinen Konto-Löschen-Flow erstmal, nur die Plattform-Erweiterung.
