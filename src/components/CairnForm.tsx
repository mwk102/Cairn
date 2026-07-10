import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { PhotoStrip } from '@/components/PhotoStrip';
import { PlaceTypePicker } from '@/components/PlaceTypePicker';
import { Coordinate, useCurrentLocation } from '@/hooks/useCurrentLocation';
import { colors, spacing, type } from '@/theme';
import { Cairn, CairnInput, PlaceType } from '@/types/cairn';
import {
  CoordinateParseResult,
  formatCoordinates,
  formatCoordinateValue,
  parseCoordinateInput,
  validateCoordinates,
} from '@/utils/coordinates';
import { formatDateInput, parseDateInput } from '@/utils/date';

const FALLBACK_COORDINATE = { latitude: 47.6205, longitude: -122.3493 };
const CAIRN_MARKER_IMAGE = require('../../assets/markers/cairn-badge.png');

type Props = {
  initial?: Cairn;
  submitLabel: string;
  onSubmit: (input: CairnInput) => Promise<void>;
};

export function CairnForm({ initial, submitLabel, onSubmit }: Props) {
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const nameTopRef = useRef(0);
  const storyTopRef = useRef(0);
  const notesTopRef = useRef(0);
  const { requestLocation, permissionDenied } = useCurrentLocation();
  const [coordinate, setCoordinate] = useState<Coordinate>(
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : FALLBACK_COORDINATE,
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [story, setStory] = useState(initial?.story ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [placeType, setPlaceType] = useState<PlaceType>(initial?.placeType ?? 'Campsite');
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [photos, setPhotos] = useState<string[]>(initial?.photos.map((photo) => photo.localUri) ?? []);
  const initialPrimaryPhoto = initial?.photos.find((photo) => photo.id === initial.primaryPhotoId) ?? initial?.photos[0];
  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(initialPrimaryPhoto?.localUri ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVisitedText, setLastVisitedText] = useState(initial ? formatDateInput(initial.lastVisitedAt) : '');
  const [lastVisitedError, setLastVisitedError] = useState<string | null>(null);
  const [latitudeText, setLatitudeText] = useState(formatCoordinateValue(coordinate.latitude));
  const [longitudeText, setLongitudeText] = useState(formatCoordinateValue(coordinate.longitude));
  const [coordinateInput, setCoordinateInput] = useState(formatCoordinates(coordinate));
  const [coordinateInputDirty, setCoordinateInputDirty] = useState(false);
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [swapSuggestion, setSwapSuggestion] = useState<Coordinate | null>(null);
  const [locating, setLocating] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinate>(coordinate);

  function updateCoordinate(next: Coordinate) {
    setCoordinate(next);
    setLatitudeText(formatCoordinateValue(next.latitude));
    setLongitudeText(formatCoordinateValue(next.longitude));
    setCoordinateInput(formatCoordinates(next));
    setCoordinateInputDirty(false);
    setCoordinateError(null);
    setSwapSuggestion(null);
  }

  const region = useMemo(
    () => ({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [coordinate],
  );

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 350);
  }, [region]);

  const draftRegion = useMemo(
    () => ({
      latitude: draftCoordinate.latitude,
      longitude: draftCoordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }),
    [draftCoordinate],
  );

  function clearCoordinateFeedback() {
    setCoordinateError(null);
    setSwapSuggestion(null);
  }

  function applyCoordinateResult(result: CoordinateParseResult, visibleText?: string) {
    if (result.status === 'valid') {
      updateCoordinate(result.coordinate);
      return result.coordinate;
    }

    if (result.status === 'potentially-reversed') {
      setCoordinateError(result.message);
      setSwapSuggestion(result.swapped);
      setLatitudeText(formatCoordinateValue(result.coordinate.latitude));
      setLongitudeText(formatCoordinateValue(result.coordinate.longitude));
      setCoordinateInput(visibleText ?? result.normalized);
      return null;
    }

    setCoordinateError(result.message);
    setSwapSuggestion(null);
    return null;
  }

  function applyCombinedCoordinate() {
    const input = coordinateInput.trim();
    const result = parseCoordinateInput(input);

    return applyCoordinateResult(result, input);
  }

  function applyManualCoordinate() {
    const latitudeValue = latitudeText.trim();
    const longitudeValue = longitudeText.trim();

    if (!latitudeValue || !longitudeValue) {
      setCoordinateError('Enter both latitude and longitude.');
      setSwapSuggestion(null);
      return false;
    }

    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setCoordinateError('We couldn\'t recognize those coordinates.');
      setSwapSuggestion(null);
      return false;
    }

    return applyCoordinateResult(validateCoordinates(latitude, longitude));
  }

  async function pasteCoordinates() {
    const text = await Clipboard.getStringAsync();

    setCoordinateInput(text);
    setCoordinateInputDirty(true);
    applyCoordinateResult(parseCoordinateInput(text), text);
  }

  async function useDeviceLocation() {
    setLocating(true);
    clearCoordinateFeedback();
    try {
      const current = await requestLocation();

      if (current) {
        updateCoordinate(current);
        return;
      }

      setCoordinateError('We couldn\'t access your current location. You can still paste coordinates or choose the place on the map.');
    } finally {
      setLocating(false);
    }
  }

  function openChooser() {
    Keyboard.dismiss();
    setDraftCoordinate(coordinate);
    setChooserOpen(true);
  }

  function confirmChosenLocation() {
    updateCoordinate(draftCoordinate);
    setChooserOpen(false);
  }

  async function save() {
    if (!name.trim()) {
      setError('Name this place before saving.');
      return;
    }
    let lastVisitedAt: string | undefined;

    if (initial) {
      const parsedLastVisitedAt = parseDateInput(lastVisitedText);

      if (!parsedLastVisitedAt) {
        setLastVisitedError('Use YYYY-MM-DD, like 2024-07-09.');
        return;
      }

      lastVisitedAt = parsedLastVisitedAt;
    }
    const coordinateToSave = coordinateInputDirty ? applyCombinedCoordinate() : applyManualCoordinate();

    if (!coordinateToSave) {
      return;
    }
    if (!Number.isFinite(coordinateToSave.latitude) || !Number.isFinite(coordinateToSave.longitude)) {
      setError('Choose a valid Cairn location.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        story,
        notes,
        latitude: coordinateToSave.latitude,
        longitude: coordinateToSave.longitude,
        placeType,
        isFavorite,
        lastVisitedAt,
        primaryPhotoId: initial?.primaryPhotoId ?? null,
        primaryPhotoUri,
        photos,
      });
    } finally {
      setSaving(false);
    }
  }

  function scrollNotesIntoView() {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(notesTopRef.current - 96, 0),
        animated: true,
      });
    }, 250);
  }

  function scrollStoryIntoView() {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(storyTopRef.current - 96, 0),
        animated: true,
      });
    }, 250);
  }

  function scrollNameIntoView() {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(nameTopRef.current - 96, 0),
        animated: true,
      });
    }, 250);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={styles.screen}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.prompt}>What did you discover today?</Text>
        <View style={styles.coordinateBox}>
          <Text style={styles.coordinateLabel}>Cairn Location</Text>
          <Text style={styles.coordinate}>
            {formatCoordinates(coordinate)}
          </Text>
          <View style={styles.locationActions}>
            <Button
              label={locating ? 'Locating...' : 'Use Current Location'}
              onPress={useDeviceLocation}
              disabled={locating}
              style={styles.locationAction}
              accessibilityLabel="Use Current Location"
            />
            <Button
              label="Choose on Map"
              onPress={openChooser}
              variant="secondary"
              style={styles.locationAction}
              accessibilityLabel="Choose on Map"
            />
          </View>
          {locating ? (
            <View style={styles.locatingRow}>
              <ActivityIndicator color={colors.moss} />
              <Text style={styles.help}>Finding your current location...</Text>
            </View>
          ) : null}
          <View style={styles.pasteRow}>
            <Field
              label="Paste coordinates"
              value={coordinateInput}
              onBlur={applyCombinedCoordinate}
              onChangeText={(value) => {
                setCoordinateInput(value);
                setCoordinateInputDirty(true);
                clearCoordinateFeedback();
              }}
              placeholder="47.90081, -119.17627"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.pasteField}
              accessibilityLabel="Paste coordinates"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Paste coordinates from clipboard"
              onPress={pasteCoordinates}
              style={({ pressed }) => [styles.pasteButton, pressed && styles.pressed]}
            >
              <Text style={styles.pasteButtonText}>Paste</Text>
            </Pressable>
          </View>
          <Text style={styles.help}>Paste coordinates from Google Maps or another map app.</Text>
          <View style={styles.coordinateFields}>
            <Field
              label="Latitude"
              value={latitudeText}
              onBlur={applyManualCoordinate}
              onChangeText={(value) => {
                setLatitudeText(value);
                setCoordinateInputDirty(false);
                clearCoordinateFeedback();
              }}
              placeholder="47.62050"
              keyboardType="numbers-and-punctuation"
              inputMode="decimal"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.coordinateField}
              style={styles.coordinateInput}
            />
            <Field
              label="Longitude"
              value={longitudeText}
              onBlur={applyManualCoordinate}
              onChangeText={(value) => {
                setLongitudeText(value);
                setCoordinateInputDirty(false);
                clearCoordinateFeedback();
              }}
              placeholder="-122.34930"
              keyboardType="numbers-and-punctuation"
              inputMode="decimal"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.coordinateField}
              style={styles.coordinateInput}
            />
          </View>
          {coordinateError ? <Text style={styles.errorText}>{coordinateError}</Text> : null}
          {swapSuggestion ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Swap latitude and longitude"
              onPress={() => updateCoordinate(swapSuggestion)}
              style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
            >
              <Feather name="repeat" size={16} color={colors.moss} />
              <Text style={styles.swapText}>Swap them</Text>
            </Pressable>
          ) : null}
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              pitchEnabled={false}
              rotateEnabled={false}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                anchor={{ x: 0.5, y: 0.5 }}
                coordinate={coordinate}
                image={CAIRN_MARKER_IMAGE}
              />
            </MapView>
          </View>
        </View>
        {permissionDenied ? (
          <Text style={styles.help}>Location permission is off. You can still paste coordinates or choose the place on the map.</Text>
        ) : null}
        <View onLayout={(event) => {
          nameTopRef.current = event.nativeEvent.layout.y;
        }}>
          <Field
            label="Name this place"
            value={name}
            onChangeText={setName}
            onFocus={scrollNameIntoView}
            placeholder="e.g. Riverside Camp"
            error={error ?? undefined}
          />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Place type</Text>
          <PlaceTypePicker value={placeType} onChange={setPlaceType} />
        </View>
        {initial ? (
          <Field
            label="Last visited"
            value={lastVisitedText}
            onChangeText={(value) => {
              setLastVisitedText(value);
              setLastVisitedError(null);
            }}
            placeholder="2024-07-09"
            keyboardType="numbers-and-punctuation"
            inputMode="numeric"
            autoCapitalize="none"
            autoCorrect={false}
            error={lastVisitedError ?? undefined}
          />
        ) : null}
        <View onLayout={(event) => {
          storyTopRef.current = event.nativeEvent.layout.y;
        }}>
          <Field
            label="Story"
            value={story}
            onChangeText={setStory}
            onFocus={scrollStoryIntoView}
            placeholder="Why did this place matter?"
            multiline
            maxLength={800}
            style={styles.story}
          />
        </View>
        <View onLayout={(event) => {
          notesTopRef.current = event.nativeEvent.layout.y;
        }}>
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            onFocus={scrollNotesIntoView}
            placeholder="Road conditions, cell service, toilets, fire rings..."
            multiline
            maxLength={500}
            style={styles.notes}
          />
        </View>
        <PhotoStrip photos={photos} onChange={setPhotos} />
        {initial && photos.length > 0 ? (
          <View style={styles.group}>
            <Text style={styles.label}>Hero photo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroOptions}>
              {photos
                .map((localUri) => {
                  const selected = localUri === (primaryPhotoUri ?? photos[0]);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel="Choose hero photo"
                      key={localUri}
                      onPress={() => setPrimaryPhotoUri(localUri)}
                      style={[styles.heroOption, selected && styles.heroOptionSelected]}
                    >
                      <Image source={{ uri: localUri }} style={styles.heroOptionImage} />
                      {selected ? (
                        <View style={styles.heroSelectedBadge}>
                          <Feather name="check" size={16} color={colors.white} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
            </ScrollView>
            <Text style={styles.help}>Choose which uploaded photo appears at the top of this Cairn.</Text>
          </View>
        ) : null}
        <View style={styles.favoriteRow}>
          <View>
            <Text style={styles.label}>Favorite</Text>
            <Text style={styles.help}>Keep this place easy to find again.</Text>
          </View>
          <Switch value={isFavorite} onValueChange={setIsFavorite} trackColor={{ true: colors.fern }} />
        </View>
        <Button label={submitLabel} onPress={save} disabled={saving} />
      </ScrollView>
      <Modal visible={chooserOpen} animationType="slide" onRequestClose={() => setChooserOpen(false)}>
        <View style={styles.chooserScreen}>
          <View style={styles.chooserHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel choosing location"
              onPress={() => setChooserOpen(false)}
              style={({ pressed }) => [styles.chooserHeaderButton, pressed && styles.pressed]}
            >
              <Text style={styles.chooserHeaderText}>Cancel</Text>
            </Pressable>
            <Text style={styles.chooserTitle}>Choose Location</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm chosen location"
              onPress={confirmChosenLocation}
              style={({ pressed }) => [styles.chooserHeaderButton, pressed && styles.pressed]}
            >
              <Text style={styles.chooserHeaderText}>Use</Text>
            </Pressable>
          </View>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.chooserMap}
            initialRegion={draftRegion}
            onPress={(event) => setDraftCoordinate(event.nativeEvent.coordinate)}
          >
            <Marker
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={draftCoordinate}
              draggable
              image={CAIRN_MARKER_IMAGE}
              onDragEnd={(event) => setDraftCoordinate(event.nativeEvent.coordinate)}
            />
          </MapView>
          <View style={styles.chooserFooter}>
            <Text style={styles.coordinateLabel}>Selected location</Text>
            <Text style={styles.coordinate}>{formatCoordinates(draftCoordinate)}</Text>
            <Text style={styles.help}>Tap the map or drag the marker to adjust this Cairn.</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 180,
    gap: spacing.md,
  },
  prompt: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '800',
  },
  mapWrap: {
    height: 230,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  coordinateBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.xs,
  },
  coordinateLabel: {
    color: colors.ink,
    fontWeight: '800',
  },
  coordinate: {
    color: colors.muted,
  },
  locationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  locationAction: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  locatingRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  pasteField: {
    flex: 1,
    minWidth: 0,
  },
  pasteButton: {
    minWidth: 72,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  pasteButtonText: {
    color: colors.ink,
    fontWeight: '800',
  },
  coordinateFields: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coordinateField: {
    flex: 1,
    minWidth: 0,
  },
  coordinateInput: {
    minWidth: 0,
  },
  errorText: {
    color: colors.danger,
    fontSize: type.small,
  },
  swapButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  swapText: {
    color: colors.moss,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  group: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontWeight: '800',
  },
  notes: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  story: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  heroOptions: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroOption: {
    width: 92,
    height: 92,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.line,
  },
  heroOptionSelected: {
    borderColor: colors.moss,
  },
  heroOptionImage: {
    width: '100%',
    height: '100%',
  },
  heroSelectedBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moss,
  },
  favoriteRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  help: {
    color: colors.muted,
    flexShrink: 1,
  },
  chooserScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chooserHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chooserHeaderButton: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  chooserHeaderText: {
    color: colors.moss,
    fontWeight: '800',
  },
  chooserTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  chooserMap: {
    flex: 1,
  },
  chooserFooter: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
