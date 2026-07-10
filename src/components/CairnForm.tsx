import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { PhotoStrip } from '@/components/PhotoStrip';
import { PlaceTypePicker } from '@/components/PlaceTypePicker';
import { Coordinate, useCurrentLocation } from '@/hooks/useCurrentLocation';
import { colors, spacing, type } from '@/theme';
import { Cairn, CairnInput, PlaceType } from '@/types/cairn';
import { formatCoordinate } from '@/utils/date';

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
  const notesTopRef = useRef(0);
  const { requestLocation, permissionDenied } = useCurrentLocation();
  const [coordinate, setCoordinate] = useState<Coordinate>(
    initial ? { latitude: initial.latitude, longitude: initial.longitude } : FALLBACK_COORDINATE,
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [placeType, setPlaceType] = useState<PlaceType>(initial?.placeType ?? 'Campsite');
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [photos, setPhotos] = useState<string[]>(initial?.photos.map((photo) => photo.localUri) ?? []);
  const initialPrimaryPhoto = initial?.photos.find((photo) => photo.id === initial.primaryPhotoId) ?? initial?.photos[0];
  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(initialPrimaryPhoto?.localUri ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latitudeText, setLatitudeText] = useState(formatCoordinate(coordinate.latitude));
  const [longitudeText, setLongitudeText] = useState(formatCoordinate(coordinate.longitude));
  const [coordinateError, setCoordinateError] = useState<string | null>(null);

  function updateCoordinate(next: Coordinate) {
    setCoordinate(next);
    setLatitudeText(formatCoordinate(next.latitude));
    setLongitudeText(formatCoordinate(next.longitude));
    setCoordinateError(null);
  }

  useEffect(() => {
    if (initial) return;
    requestLocation().then((current) => {
      if (current) updateCoordinate(current);
    });
  }, [initial, requestLocation]);

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

  function applyManualCoordinate() {
    const latitude = Number(latitudeText.trim());
    const longitude = Number(longitudeText.trim());

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setCoordinateError('Latitude must be between -90 and 90.');
      return false;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setCoordinateError('Longitude must be between -180 and 180.');
      return false;
    }

    updateCoordinate({ latitude, longitude });
    return true;
  }

  async function save() {
    if (!name.trim()) {
      setError('Name this place before saving.');
      return;
    }
    if (!applyManualCoordinate()) {
      return;
    }
    if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
      setError('Choose a valid Cairn location.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name,
        notes,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        placeType,
        isFavorite,
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
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            onPress={(event) => updateCoordinate(event.nativeEvent.coordinate)}
          >
            <Marker
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={coordinate}
              draggable
              image={CAIRN_MARKER_IMAGE}
              onDragEnd={(event) => updateCoordinate(event.nativeEvent.coordinate)}
            />
          </MapView>
        </View>
        <View style={styles.coordinateBox}>
          <Text style={styles.coordinateLabel}>Cairn Location</Text>
          <Text style={styles.coordinate}>
            {formatCoordinate(coordinate.latitude)}, {formatCoordinate(coordinate.longitude)}
          </Text>
          <View style={styles.coordinateFields}>
            <Field
              label="Latitude"
              value={latitudeText}
              onBlur={applyManualCoordinate}
              onChangeText={(value) => {
                setLatitudeText(value);
                setCoordinateError(null);
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
                setCoordinateError(null);
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
          <Pressable accessibilityRole="button" onPress={() => requestLocation().then((current) => current && updateCoordinate(current))}>
            <Text style={styles.useCurrent}>Use current</Text>
          </Pressable>
        </View>
        {permissionDenied ? (
          <Text style={styles.help}>Location permission is off. You can still place this Cairn manually on the map.</Text>
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
        <View onLayout={(event) => {
          notesTopRef.current = event.nativeEvent.layout.y;
        }}>
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            onFocus={scrollNotesIntoView}
            placeholder="Add notes about this place..."
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
            <Text style={styles.label}>Remember as important</Text>
            <Text style={styles.help}>Marks this Cairn for your own return list.</Text>
          </View>
          <Switch value={isFavorite} onValueChange={setIsFavorite} trackColor={{ true: colors.fern }} />
        </View>
        <Button label={submitLabel} onPress={save} disabled={saving} />
      </ScrollView>
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
  useCurrent: {
    color: colors.moss,
    fontWeight: '800',
    paddingVertical: spacing.sm,
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
});
