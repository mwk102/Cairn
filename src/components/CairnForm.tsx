import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { getTagSuggestions } from '@/data/settings';
import { Coordinate, useCurrentLocation } from '@/hooks/useCurrentLocation';
import { colors, spacing, type } from '@/theme';
import { Cairn, CairnInput, PlaceType } from '@/types/cairn';
import {
  CoordinateParseResult,
  formatCoordinates,
  formatCoordinateValue,
  parseCoordinateInput,
  parseCoordinateValue,
  validateCoordinates,
} from '@/utils/coordinates';
import { canUseNativeMap } from '@/utils/mapAvailability';
import { existingPhotoUris } from '@/utils/photoStorage';

const FALLBACK_COORDINATE = { latitude: 47.6205, longitude: -122.3493 };
const CAIRN_MARKER_IMAGE = require('../../assets/markers/cairn-badge.png');
const DEFAULT_TAG_SUGGESTIONS = ['4x4 access', 'toilets', 'Cell Service', 'short hike'];

type Props = {
  initial?: Cairn;
  initialFocus?: 'photos';
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

export function CairnForm({ initial, initialFocus, submitLabel, onSubmit }: Props) {
  const mapRef = useRef<MapView>(null);
  const chooserMapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const placeSectionTopRef = useRef(0);
  const journalSectionTopRef = useRef(0);
  const nameTopRef = useRef(0);
  const storyTopRef = useRef(0);
  const notesTopRef = useRef(0);
  const photosTopRef = useRef(0);
  const didInitialPhotoFocusRef = useRef(false);
  const didInitialLocationRef = useRef(false);
  const userChangedLocationRef = useRef(false);
  const insets = useSafeAreaInsets();
  const {
    requestLocation,
    permissionDenied,
    locationUnavailable,
    locationSource,
  } = useCurrentLocation();
  const mapAvailable = canUseNativeMap();
  const [coordinate, setCoordinate] = useState<Coordinate>(
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : FALLBACK_COORDINATE,
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [story, setStory] = useState(initial?.story ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>(DEFAULT_TAG_SUGGESTIONS);
  const [placeType, setPlaceType] = useState<PlaceType>(initial?.placeType ?? 'Campsite');
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [photos, setPhotos] = useState<string[]>(initial?.photos.map((photo) => photo.localUri) ?? []);
  const initialPrimaryPhoto = initial?.photos.find((photo) => photo.id === initial.primaryPhotoId) ?? initial?.photos[0];
  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(initialPrimaryPhoto?.localUri ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [chooserLocationError, setChooserLocationError] = useState<string | null>(null);
  const [manualCoordinatesOpen, setManualCoordinatesOpen] = useState(false);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinate>(coordinate);
  const [draftMoving, setDraftMoving] = useState(false);
  const formTitle = initial ? 'Refine this Cairn' : 'Build Cairn';
  const formPrompt = initial ? 'Update the details that help this place stay useful.' : 'Save the place, then let the story grow over time.';
  const locationNotice = permissionDenied
    ? 'Location permission is off. You can still paste coordinates or choose the place on the map.'
    : locationUnavailable
      ? locationSource === 'device-last-known' || locationSource === 'stored-last-known'
        ? 'Using last known location. Confirm the spot before saving if you are offline.'
        : 'Current location is unavailable. Paste coordinates or choose the place on the map.'
      : null;

  function updateCoordinate(next: Coordinate, changed = true) {
    if (changed) {
      userChangedLocationRef.current = true;
    }
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

  useEffect(() => {
    let active = true;

    getTagSuggestions().then((storedSuggestions) => {
      if (!active) return;
      const merged = Array.from(
        new Map(
          [...storedSuggestions, ...DEFAULT_TAG_SUGGESTIONS].map((tag) => [tag.toLowerCase(), tag] as const),
        ).values(),
      );
      setTagSuggestions(merged);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initial || didInitialLocationRef.current) return;

    didInitialLocationRef.current = true;
    requestLocation().then((current) => {
      if (current && !userChangedLocationRef.current) {
        updateCoordinate(current, false);
      }
    });
  }, [initial, requestLocation]);

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

    const latitude = parseCoordinateValue(latitudeValue);
    const longitude = parseCoordinateValue(longitudeValue);

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
    setChooserLocationError(null);
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
    setChooserLocationError(null);
    try {
      const current = await requestLocation();

      if (current) {
        updateDraftLocation(current, true);
        return;
      }

      setChooserLocationError('Couldn\'t refresh location. You can still move the map or paste coordinates.');
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

  function addSuggestedTag(tag: string) {
    setTags((current) => {
      if (current.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        return current;
      }

      return [...current, tag];
    });
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  }

  async function save() {
    if (saving) return;

    if (!name.trim()) {
      setError('Name this place before saving.');
      return;
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
      const savedPhotos = existingPhotoUris(photos);
      const savedPrimaryPhotoUri = primaryPhotoUri && savedPhotos.includes(primaryPhotoUri)
        ? primaryPhotoUri
        : savedPhotos[0] ?? null;

      await onSubmit({
        name,
        story,
        notes,
        latitude: coordinateToSave.latitude,
        longitude: coordinateToSave.longitude,
        placeType,
        tags,
        isFavorite,
        primaryPhotoId: initial?.primaryPhotoId ?? null,
        primaryPhotoUri: savedPrimaryPhotoUri,
        photos: savedPhotos,
      });
    } catch {
      const message = initial
        ? 'Cairn could not save your edits. Your changes are still on this screen.'
        : 'Cairn could not be built. Your notes are still on this screen.';
      setError(message);
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  function scrollFieldIntoView(top: number, delay = 260) {
    if (top <= 0) return;

    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(top - 120, 0),
        animated: true,
      });
    }, delay);
  }

  function scrollNotesIntoView() {
    scrollFieldIntoView(journalSectionTopRef.current + notesTopRef.current);
  }

  function scrollStoryIntoView() {
    scrollFieldIntoView(journalSectionTopRef.current + storyTopRef.current);
  }

  function scrollNameIntoView() {
    scrollFieldIntoView(placeSectionTopRef.current + nameTopRef.current);
  }

  function scrollPhotosIntoView() {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(photosTopRef.current - 96, 0),
        animated: true,
      });
    }, 300);
  }

  function maybeScrollToInitialPhotos() {
    if (initialFocus !== 'photos' || didInitialPhotoFocusRef.current) return;

    didInitialPhotoFocusRef.current = true;
    scrollPhotosIntoView();
  }

  const availableTagSuggestions = tagSuggestions.filter(
    (suggestion) => !tags.some((tag) => tag.toLowerCase() === suggestion.toLowerCase()),
  );

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
        <View style={styles.formIntro}>
          <MiniCairnGlyph />
          <View style={styles.formIntroText}>
            <Text style={styles.prompt}>{formTitle}</Text>
            <Text style={styles.promptHelp}>{formPrompt}</Text>
          </View>
        </View>
        <Text style={styles.sectionEyebrow}>Location</Text>
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
          {locationNotice ? (
            <View style={styles.locationNotice}>
              <Feather name="wifi-off" size={15} color={colors.moss} />
              <Text style={styles.locationNoticeText}>{locationNotice}</Text>
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
        <View
          onLayout={(event) => {
            placeSectionTopRef.current = event.nativeEvent.layout.y;
          }}
          style={styles.formSection}
        >
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIcon}>
              <Feather name="map-pin" size={16} color={colors.moss} />
            </View>
            <View style={styles.formSectionText}>
              <Text style={styles.formSectionTitle}>Place</Text>
              <Text style={styles.formSectionHelp}>Name it the way you would look for it later.</Text>
            </View>
          </View>
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
        </View>
        <View
          onLayout={(event) => {
            journalSectionTopRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.formSection, styles.journalSection]}
        >
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIcon}>
              <Feather name="book-open" size={16} color={colors.moss} />
            </View>
            <View style={styles.formSectionText}>
              <Text style={styles.formSectionTitle}>Journal</Text>
              <Text style={styles.formSectionHelp}>Separate the memory from the practical reminders.</Text>
            </View>
          </View>
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
            <Text style={styles.fieldHint}>The lasting memory: what happened here, who was there, why it stuck.</Text>
          </View>
          <View onLayout={(event) => {
            notesTopRef.current = event.nativeEvent.layout.y;
          }}>
            <Field
              label="Reference Notes"
              value={notes}
              onChangeText={setNotes}
              onFocus={scrollNotesIntoView}
              placeholder={'- Rough road\n- Cell Service\n- Toilets, fire rings...'}
              multiline
              maxLength={500}
              style={styles.notes}
            />
            <Text style={styles.fieldHint}>Stable details for next time. Bullets work well here.</Text>
          </View>
        </View>
        <View style={styles.formSection}>
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIcon}>
              <Feather name="tag" size={16} color={colors.moss} />
            </View>
            <View style={styles.formSectionText}>
              <Text style={styles.formSectionTitle}>Tags</Text>
              <Text style={styles.formSectionHelp}>Quick labels for filtering and scanning your places.</Text>
            </View>
          </View>
          <View style={styles.group}>
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
            ) : null}
            {availableTagSuggestions.length > 0 ? (
              <>
                <Text style={styles.quickTagLabel}>Quick add</Text>
                <View style={styles.suggestionList}>
                  {availableTagSuggestions.slice(0, 8).map((suggestion) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${suggestion} tag`}
                      key={suggestion}
                      onPress={() => addSuggestedTag(suggestion)}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
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
        </View>
        <View
          onLayout={(event) => {
            photosTopRef.current = event.nativeEvent.layout.y;
            maybeScrollToInitialPhotos();
          }}
          style={styles.formSection}
        >
          <View style={styles.formSectionHeader}>
            <View style={styles.formSectionIcon}>
              <Feather name="image" size={16} color={colors.moss} />
            </View>
            <View style={styles.formSectionText}>
              <Text style={styles.formSectionTitle}>Photos</Text>
              <Text style={styles.formSectionHelp}>Add the views, signs, setups, and small details you want to remember.</Text>
            </View>
          </View>
          <PhotoStrip photos={photos} onChange={setPhotos} />
          {initial && photos.length > 0 ? (
            <View style={styles.heroPhotoBlock}>
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
        </View>
        <View style={styles.favoriteRow}>
          <View>
            <Text style={styles.label}>Favorite</Text>
            <Text style={styles.help}>Keep this place easy to find again.</Text>
          </View>
          <Switch value={isFavorite} onValueChange={setIsFavorite} trackColor={{ true: colors.fern }} />
        </View>
        <View style={styles.saveBlock}>
          <Button label={saving ? 'Saving...' : submitLabel} onPress={save} disabled={saving} />
        </View>
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
            {chooserLocationError ? (
              <View style={styles.chooserLocationNotice}>
                <Feather name="wifi-off" size={15} color={colors.moss} />
                <Text style={styles.locationNoticeText}>{chooserLocationError}</Text>
              </View>
            ) : null}
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
    gap: spacing.sm,
  },
  formIntro: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.2)',
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  formIntroText: {
    flex: 1,
    minWidth: 0,
  },
  prompt: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  promptHelp: {
    color: colors.muted,
    lineHeight: 21,
    marginTop: 2,
  },
  sectionEyebrow: {
    color: colors.moss,
    fontSize: type.small,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: -spacing.xs,
  },
  formSection: {
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: colors.paper,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  journalSection: {
    backgroundColor: 'rgba(203, 216, 198, 0.18)',
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  formSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.58)',
  },
  formSectionText: {
    flex: 1,
    minWidth: 0,
  },
  formSectionTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '900',
  },
  formSectionHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 19,
    marginTop: 2,
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
  locationNotice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.24)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  locationNoticeText: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '700',
    lineHeight: 18,
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
  fieldHint: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickTagLabel: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  suggestionChip: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(255, 253, 250, 0.72)',
    paddingHorizontal: spacing.sm,
  },
  suggestionText: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '800',
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
  heroPhotoBlock: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(49, 86, 66, 0.1)',
    paddingTop: spacing.md,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  saveBlock: {
    marginTop: spacing.sm,
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
  chooserLocationNotice: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(203, 216, 198, 0.24)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
});
