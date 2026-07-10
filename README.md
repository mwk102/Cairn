# Cairn

Cairn is a mobile-first personal place journal for saving meaningful outdoor locations. A Cairn is more than a coordinate on a map: it is a place tied to experiences, memories, and stories.

## Current Milestone

Phase 1 proves the first core loop:

1. Open the app.
2. View a map.
3. Build a Cairn.
4. See it appear on the map.
5. Reopen the app and find it again.

This milestone is local-only. There is no backend, account system, public discovery, feed, followers, likes, comments, or sharing surface.

## Prerequisites

- Node.js
- npm
- Expo Go installed on an Android phone

## Installation

```bash
npm install
```

If PowerShell blocks `npm`, use:

```bash
npm.cmd install
```

## Run With Expo

```bash
npm run start
```

Or, from PowerShell:

```bash
npm.cmd run start
```

Scan the QR code with Expo Go on Android. The phone and development machine should be on the same network.

## Project Structure

- `app/` - Expo Router screens and navigation
- `src/components/` - reusable UI and form components
- `src/data/` - SQLite setup, settings, and Cairn persistence
- `src/hooks/` - app data and location hooks
- `src/types/` - typed Cairn model
- `src/theme.ts` - shared colors, spacing, and type scale
- `docs/design/` - product notes and design references
- `docs/phase-1.md` - Phase 1 scope and acceptance criteria
- `docs/engineering-handoff.md` - implementation handoff notes

## Known Limitations

- Cairns are stored locally on the device only.
- Photos use local image URIs selected through Expo Image Picker.
- The map defaults to a fallback region if location is denied or unavailable.
- Visits are represented only by `lastVisitedAt`, initially equal to creation date.
- No authentication, sync, import, export, or sharing exists yet.

## Next Recommended Milestone

Add a focused Visits model and visit journal flow while keeping Cairn private-first and local-capable.
