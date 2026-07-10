# Phase 1

## Scope

Phase 1 builds Cairn's first complete private place-journal loop for Android development through Expo Go.

Included:

- First-run welcome screen
- Contextual location and photo permissions
- Map home with Cairn markers
- Build Cairn flow with current-location, pasted-coordinate, individual-coordinate, and map-selection location entry
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
2. The user continues into Cairn.
3. Cairn asks for location when the map needs position.
4. The user taps the plus button to build a Cairn.
5. The user chooses a location by using current device location, pasting copied coordinates, editing latitude and longitude, or selecting a point on the map.
6. The user names the place, selects a place type, and optionally adds notes, photos, and importance.
7. Cairn saves locally and opens the new journal entry.
8. The Cairn appears on the map.
9. The user can reopen, edit, or delete the Cairn.
10. The Cairn remains available after closing and reopening the app.

## Technical Decisions

- React Native, Expo, TypeScript, and Expo Router provide the mobile app foundation.
- `react-native-maps` provides the map and marker experience.
- `expo-location` requests foreground location contextually.
- `expo-clipboard` reads copied coordinates only after the user taps Paste; clipboard contents are never read automatically, saved, or transmitted.
- `expo-image-picker` requests photo access only when photos are added.
- `expo-sqlite` stores onboarding state, Cairns, and photos locally.
- Data access lives in `src/data/` so a future cloud layer can be added without rewriting screens.
- Visits are deferred, but `lastVisitedAt` exists on Cairns to leave room for a later Visit model.

## Location Entry

The Build Cairn form supports four synchronized location-entry methods:

- Use Current Location: requests foreground location at the moment the user taps the action, then fills every coordinate field and updates the map preview.
- Paste coordinates: reads the device clipboard only after the user taps Paste, then attempts to parse the copied text.
- Latitude and Longitude: keeps individual numeric-friendly fields visible for precise manual entry.
- Choose on Map: opens a map picker where the user can tap or drag the Cairn marker, confirm the new point, or cancel without changing the previous valid location.

Accepted pasted formats include decimal pairs from Google Maps, comma-separated pairs, space-separated pairs, parenthesized pairs, labeled latitude/longitude text, and degree-direction text such as `47.90081° N, 119.17627° W`.

Coordinate validation enforces latitude between `-90` and `90` and longitude between `-180` and `180`. Invalid or incomplete values show inline errors and do not clear the user's text. Coordinates that look reversed are not swapped automatically; the form offers a one-tap Swap action.

## Sprint 2 Polish

Sprint 2 keeps the Phase 1 feature set intact while improving how Cairn reads as a place journal:

- Story and Notes are separate fields. Story is the emotional memory; Notes are practical return-visit details.
- Cairn detail pages prioritize photo, place name, place type, favorite state, Quick Details, Story, then Notes.
- Quick Details compress location, built date, and last visited date; coordinates remain visible but visually secondary.
- Place type choices use outdoor icon chips for faster scanning.
- Map selection sheets emphasize place name, place type, and last visited date instead of creation date.
- The build success moment now includes vibration feedback, stone stacking, and a Cairn marker reveal.
- The photo viewer supports horizontal swiping across all photos for a Cairn.

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
- The user can enter location through current location, pasted coordinates, individual latitude/longitude fields, or map selection.
- Required validation prevents invalid records.
- A newly built Cairn appears on the map.
- The user can open detail, edit, and delete after confirmation.
- Cairns persist after closing and reopening the app.
- Empty, loading, permission-denied, and error states are present.
- README instructions are sufficient for a non-engineer to run the app.
