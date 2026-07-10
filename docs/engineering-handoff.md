# Engineering Handoff

## What Was Built

Phase 1 adds a complete local Expo app foundation for Cairn:

- Welcome screen with persisted onboarding completion
- Map home with location request, empty state, markers, and build action
- Build a Cairn form with map repositioning, required validation, place types, notes, photos, and importance
- Cairn detail screen with journal-style information
- Edit and delete flows
- SQLite-backed local persistence for settings, Cairns, and photos

## Files And Architecture Added

- `app/_layout.tsx` defines the Expo Router stack.
- `app/index.tsx` routes first-time and returning users.
- `app/welcome.tsx` contains onboarding.
- `app/map.tsx` contains the primary My Cairns map.
- `app/cairn/build.tsx`, `app/cairn/[id].tsx`, and `app/cairn/[id]/edit.tsx` implement the core Cairn flows.
- `src/data/db.ts`, `src/data/settings.ts`, and `src/data/cairns.ts` isolate persistence.
- `src/components/` contains buttons, fields, marker treatment, photo picker, place-type picker, and the shared Cairn form.
- `src/hooks/` contains data reload and location helpers.
- `src/types/cairn.ts` defines the typed model.
- `src/theme.ts` centralizes design tokens.

## Commands

Install dependencies:

```bash
npm.cmd install
```

Start Expo:

```bash
npm.cmd run start
```

Run checks:

```bash
npm.cmd run typecheck
npm.cmd run lint
```

## Tests Or Checks Performed

- `npm.cmd install`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run start -- --host lan`

Metro was confirmed responding at `http://localhost:8081`.

Manual Android Expo Go verification should cover onboarding, map permission denial, build, reopen persistence, edit, and delete.

## Known Issues

- Android Expo Go verification still needs to be performed on a device.
- Photo records store selected local URIs; a later production build may need file copying for long-term durability.
- The fallback map region is Seattle when location is unavailable.
- The custom Cairn marker is component-based and intentionally simple until final assets exist.

## Decisions Needing Product Review

- The app currently uses “Remember as important” in the form while retaining `isFavorite` internally. Product may want a final user-facing term.
- Place types are single-select for Phase 1.
- Photo handling is local URI based in Phase 1; product should decide whether the next milestone copies images into app-owned storage.

## Recommended Next Steps

1. Install dependencies and verify on Android through Expo Go.
2. Add lightweight automated tests around validation and persistence once the Expo test stack is selected.
3. Add photo removal and capture-from-camera controls.
4. Design the Visits model and first visit journal flow.
