# Phase 1

## Scope

Phase 1 builds Cairn's first complete private place-journal loop for Android development through Expo Go.

Included:

- First-run welcome screen
- Contextual location and photo permissions
- Map home with Cairn markers
- Build a Cairn flow
- Cairn detail screen
- Edit and delete flows
- Local SQLite persistence
- Documentation for setup and handoff

Deferred:

- Backend services
- Authentication
- Cloud sync
- Public discovery
- Feeds, followers, likes, comments, or ratings
- Groups and sharing
- Separate Visit records

## User Flow

1. A first-time user opens Cairn and sees onboarding.
2. The user continues into My Cairns.
3. Cairn asks for location when the map needs position.
4. The user taps the plus button to build a Cairn.
5. The user chooses or adjusts a location, names the place, selects a place type, and optionally adds notes, photos, and importance.
6. Cairn saves locally and opens the new journal entry.
7. The Cairn appears on the map.
8. The user can reopen, edit, or delete the Cairn.
9. The Cairn remains available after closing and reopening the app.

## Technical Decisions

- React Native, Expo, TypeScript, and Expo Router provide the mobile app foundation.
- `react-native-maps` provides the map and marker experience.
- `expo-location` requests foreground location contextually.
- `expo-image-picker` requests photo access only when photos are added.
- `expo-sqlite` stores onboarding state, Cairns, and photos locally.
- Data access lives in `src/data/` so a future cloud layer can be added without rewriting screens.
- Visits are deferred, but `lastVisitedAt` exists on Cairns to leave room for a later Visit model.

## Data Model

`Cairn`

- `id`
- `name`
- `notes`
- `latitude`
- `longitude`
- `placeType`
- `isFavorite`
- `createdAt`
- `updatedAt`
- `lastVisitedAt`
- `photos`

`Photo`

- `id`
- `cairnId`
- `localUri`
- `createdAt`

## Acceptance Criteria

- The project installs without dependency errors.
- The app launches in Expo Go on Android.
- A first-time user sees onboarding.
- A returning user opens directly to the map.
- The map displays current location when allowed.
- Location denial does not block app usage.
- The user can build a Cairn.
- Required validation prevents invalid records.
- A newly built Cairn appears on the map.
- The user can open detail, edit, and delete after confirmation.
- Cairns persist after closing and reopening the app.
- Empty, loading, permission-denied, and error states are present.
- README instructions are sufficient for a non-engineer to run the app.
