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
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { canUseNativeMap } from '@/utils/mapAvailability';

const FALLBACK_COORDINATE = { latitude: 47.6205, longitude: -122.3493 };
const CAIRN_MARKER_IMAGE = require('../../assets/markers/cairn-badge.png');

type Props = {
  initial?: Cairn;
  submitLabel: string;
  onSubmit: (input: CairnInput) => Promise<void>;
};

function MiniCairnGlyph() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.miniCairn}>
      <View style={styles.miniStone0} />
      <View style={styles.miniStone1} />
      <View style={styles.miniStone2} />
    </View>
  );
}

export function CairnForm({ initial, submitLabel, onSubmit }: Props) {
  const mapRef = useRef<MapView>(null);
  const chooserMapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const nameTopRef = useRef(0);
  const storyTopRef = useRef(0);
  const notesTopRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { requestLocation, permissionDenied } = useCurrentLocation();
  const mapAvailable = canUseNativeMap();
  const [coordinate, setCoordinate] = useState<Coordinate>(
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : FALLBACK_COORDINATE,
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [story, setStory] = useState(initial?.story ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
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
  const [coordinateInput, setCoordinateInput] = useState('');
  const [coordinateInputDirty, setCoordinateInputDirty] = useState(false);
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [swapSuggestion, setSwapSuggestion] = useState<Coordinate | null>(null);
  const [locationChanged, setLocationChanged] = useState(!initial);
  const [locating, setLocating] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserLocating, setChooserLocating] = useState(false);
  const [manualCoordinatesOpen, setManualCoordinatesOpen] = useState(false);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinate>(coordinate);
  const [draftMoving, setDraftMoving] = useState(false);

  function updateCoordinate(next: Coordinate, changed = true) {
    setCoordinate(next);
    setLocationChanged(changed);
    setLatitudeText(formatCoordinateValue(next.latitude));
    setLongitudeText(formatCoordinateValue(next.longitude));
    setCoordinateInput('');
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
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
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

  function updateDraftLocation(next: Coordinate, animate = false) {
    setDraftCoordinate(next);
    setDraftMoving(false);

    if (animate) {
      chooserMapRef.current?.animateToRegion(
        {
          latitude: next.latitude,
          longitude: next.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        360,
      );
    }
  }

  function updateDraftFromRegion(region: Region) {
    setDraftMoving(false);
    setDraftCoordinate({
      latitude: region.latitude,
      longitude: region.longitude,
    });
  }

  async function useCurrentLocationInChooser() {
    setChooserLocating(true);
    try {
      const current = await requestLocation();

      if (current) {
        updateDraftLocation(current, true);
      }
    } finally {
      setChooserLocating(false);
    }
  }

  function confirmChosenLocation() {
    updateCoordinate(draftCoordinate);
    setChooserOpen(false);
  }

  function savedCoordinate() {
    if (!initial || locationChanged) {
      return coordinateInputDirty ? applyCombinedCoordinate() : applyManualCoordinate();
    }

    return {
      latitude: initial.latitude,
      longitude: initial.longitude,
    };
  }

  function addTagsFromInput() {
    const nextTags = tagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (nextTags.length === 0) return;

    setTags((current) => Array.from(new Set([...current, ...nextTags])));
    setTagInput('');
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
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
    const coordinateToSave = savedCoordinate();

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
        tags,
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
          <View style={styles.locationHeader}>
            <View>
              <Text style={styles.coordinateLabel}>Cairn Location</Text>
              <Text style={styles.coordinate}>
                {formatCoordinates(coordinate)}
              </Text>
            </View>
            <View style={styles.locationBadge}>
              <Feather name="map-pin" size={14} color={colors.moss} />
              <Text style={styles.locationBadgeText}>Set</Text>
            </View>
          </View>
          <View style={styles.locationActions}>
            <Button
              label={locating ? 'Locating...' : 'Use Current'}
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: manualCoordinatesOpen }}
            accessibilityLabel="Enter coordinates manually"
            onPress={() => setManualCoordinatesOpen((open) => !open)}
            style={({ pressed }) => [styles.manualToggle, pressed && styles.pressed]}
          >
            <View style={styles.manualToggleText}>
              <Text style={styles.manualToggleTitle}>Enter coordinates manually</Text>
              <Text style={styles.manualToggleHelp}>Paste from Google Maps or type latitude and longitude.</Text>
            </View>
            <Feather
              name={manualCoordinatesOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.muted}
            />
          </Pressable>
          {manualCoordinatesOpen ? (
            <View style={styles.manualPanel}>
              <View style={styles.pasteRow}>
                <Field
                  label="Paste coordinates"
                  value={coordinateInput}
                  onBlur={applyCombinedCoordinate}
                  onChangeText={(value) => {
                    setCoordinateInput(value);
                    setCoordinateInputDirty(true);
                    setLocationChanged(true);
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
              <View style={styles.coordinateFields}>
                <Field
                  label="Latitude"
                  value={latitudeText}
                  onBlur={applyManualCoordinate}
                  onChangeText={(value) => {
                    setLatitudeText(value);
                    setCoordinateInputDirty(false);
                    setLocationChanged(true);
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
                    setLocationChanged(true);
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
            </View>
          ) : coordinateError ? (
            <Text style={styles.errorText}>{coordinateError}</Text>
          ) : null}
          <View style={styles.mapWrap}>
            {mapAvailable ? (
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
            ) : (
              <View style={styles.mapUnavailableInline}>
                <Text style={styles.mapUnavailableTitle}>Map key needed</Text>
                <Text style={styles.mapUnavailableText}>Manual coordinates still work in this build.</Text>
              </View>
            )}
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
            placeholder={'- Road conditions\n- Cell service\n- Toilets, fire rings...'}
            multiline
            maxLength={500}
            style={styles.notes}
          />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Tags</Text>
          {tags.length > 0 ? (
            <View style={styles.tagList}>
              {tags.map((tag) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tag} tag`}
                  key={tag}
                  onPress={() => removeTag(tag)}
                  style={({ pressed }) => [styles.tagChip, pressed && styles.pressed]}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                  <Feather name="x" size={14} color={colors.moss} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.help}>Add practical details you will want to scan later.</Text>
          )}
          <View style={styles.tagInputRow}>
            <Field
              label="Add tag"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTagsFromInput}
              onBlur={addTagsFromInput}
              placeholder="4x4 access, toilets, Cell Service"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.tagField}
              returnKeyType="done"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add tag"
              onPress={addTagsFromInput}
              style={({ pressed }) => [styles.tagAddButton, pressed && styles.pressed]}
            >
              <Feather name="plus" size={18} color={colors.white} />
            </Pressable>
          </View>
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
          <View style={[styles.chooserHeader, { paddingTop: insets.top + spacing.xs }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel choosing location"
              onPress={() => setChooserOpen(false)}
              style={({ pressed }) => [styles.chooserHeaderButton, pressed && styles.pressed]}
            >
              <Text style={styles.chooserHeaderText}>Cancel</Text>
            </Pressable>
            <View style={styles.chooserTitleLockup}>
              <MiniCairnGlyph />
              <Text style={styles.chooserTitle}>Choose Location</Text>
            </View>
            <View style={styles.chooserHeaderButton} />
          </View>
          <View style={styles.chooserMapFrame}>
            {mapAvailable ? (
              <MapView
                ref={chooserMapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={draftRegion}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                onPanDrag={() => setDraftMoving(true)}
                onPress={(event) => updateDraftLocation(event.nativeEvent.coordinate, true)}
                onRegionChangeComplete={updateDraftFromRegion}
              />
            ) : (
              <View style={styles.mapUnavailableInline}>
                <Text style={styles.mapUnavailableTitle}>Map key needed</Text>
                <Text style={styles.mapUnavailableText}>Paste or type coordinates to place this Cairn.</Text>
              </View>
            )}
            <View pointerEvents="box-none" style={styles.chooserMapOverlay}>
              <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use current location on map"
              disabled={chooserLocating}
              onPress={useCurrentLocationInChooser}
              style={({ pressed }) => [styles.chooserLocateButton, pressed && styles.pressed]}
            >
              {chooserLocating ? (
                <ActivityIndicator color={colors.moss} />
              ) : (
                <Feather name="navigation" size={18} color={colors.ink} />
              )}
            </Pressable>
              <View style={styles.chooserHint}>
                <MiniCairnGlyph />
                <Text style={styles.chooserHintText}>Move the map to place your Cairn</Text>
              </View>
            </View>
            {mapAvailable ? (
              <View pointerEvents="none" style={styles.chooserCenterMarker}>
                <Image
                  source={CAIRN_MARKER_IMAGE}
                  style={[styles.chooserCenterMarkerImage, draftMoving && styles.chooserCenterMarkerMoving]}
                />
                <View style={styles.chooserCenterShadow} />
              </View>
            ) : null}
          </View>
          <View style={[styles.chooserFooter, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.lg) }]}>
            <View style={styles.chooserHandle} />
            <View style={styles.chooserFooterHeader}>
              <View>
                <Text style={styles.chooserFooterTitle}>Drop your Cairn here</Text>
                <Text style={styles.chooserCoordinate}>{formatCoordinates(draftCoordinate)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm chosen location"
                onPress={confirmChosenLocation}
                style={({ pressed }) => [styles.chooserUsePill, pressed && styles.pressed]}
              >
                <Text style={styles.chooserUsePillText}>Use</Text>
              </Pressable>
            </View>
            <Text style={styles.chooserFooterHelp}>Fine tune the location by moving the map beneath the Cairn marker, or tap a spot to jump there.</Text>
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
  mapUnavailableInline: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.sage,
  },
  mapUnavailableTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  mapUnavailableText: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 21,
  },
  coordinateBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  coordinateLabel: {
    color: colors.ink,
    fontWeight: '800',
  },
  coordinate: {
    color: colors.muted,
    marginTop: 4,
  },
  locationBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(203, 216, 198, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    paddingHorizontal: spacing.sm,
  },
  locationBadgeText: {
    color: colors.moss,
    fontSize: type.small,
    fontWeight: '900',
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
  manualToggle: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  manualToggleText: {
    flex: 1,
    minWidth: 0,
  },
  manualToggleTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  manualToggleHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    marginTop: 2,
  },
  manualPanel: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(250, 248, 243, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    padding: spacing.sm,
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
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    backgroundColor: 'rgba(203, 216, 198, 0.5)',
    paddingHorizontal: spacing.sm,
  },
  tagText: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  tagField: {
    flex: 1,
    minWidth: 0,
  },
  tagAddButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moss,
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
  miniCairn: {
    width: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  miniStone0: {
    width: 7,
    height: 5,
    borderRadius: 6,
    backgroundColor: colors.ink,
    marginBottom: 2,
    transform: [{ rotate: '-7deg' }, { translateX: 1 }],
  },
  miniStone1: {
    width: 15,
    height: 5,
    borderRadius: 8,
    backgroundColor: colors.ink,
    marginBottom: 2,
    transform: [{ rotate: '5deg' }, { translateX: -1 }],
  },
  miniStone2: {
    width: 23,
    height: 6,
    borderRadius: 10,
    backgroundColor: colors.ink,
    transform: [{ rotate: '-2deg' }],
  },
  chooserScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chooserHeader: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.sage,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(49, 86, 66, 0.18)',
  },
  chooserHeaderButton: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  chooserHeaderText: {
    color: colors.moss,
    fontWeight: '900',
  },
  chooserTitleLockup: {
    position: 'absolute',
    left: 104,
    right: 104,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  chooserTitle: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: type.body,
  },
  chooserMapFrame: {
    flex: 1,
  },
  chooserMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.md,
    zIndex: 3,
    elevation: 3,
  },
  chooserLocateButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    zIndex: 4,
    elevation: 3,
  },
  chooserHint: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(250, 248, 243, 0.92)',
    paddingHorizontal: spacing.sm,
  },
  chooserHintText: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
  },
  chooserCenterMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 54,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginLeft: -27,
    marginTop: -36,
    zIndex: 2,
  },
  chooserCenterMarkerImage: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  chooserCenterMarkerMoving: {
    transform: [{ translateY: -6 }, { scale: 1.04 }],
  },
  chooserCenterShadow: {
    width: 18,
    height: 5,
    borderRadius: 9,
    marginTop: 3,
    backgroundColor: 'rgba(25, 53, 38, 0.22)',
  },
  chooserFooter: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderColor: 'rgba(49, 86, 66, 0.16)',
  },
  chooserHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.line,
    marginBottom: spacing.xs,
  },
  chooserFooterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chooserFooterTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '900',
  },
  chooserCoordinate: {
    color: colors.muted,
    fontSize: type.small,
    marginTop: 3,
  },
  chooserUsePill: {
    minWidth: 76,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.moss,
    paddingHorizontal: spacing.md,
  },
  chooserUsePillText: {
    color: colors.white,
    fontWeight: '900',
  },
  chooserFooterHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 19,
  },
});
