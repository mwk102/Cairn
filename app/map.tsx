import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { CairnMarker } from '@/components/CairnMarker';
import { useCairns } from '@/hooks/useCairns';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { colors, spacing, type } from '@/theme';
import { Cairn, PLACE_TYPE_ICONS } from '@/types/cairn';
import { formatDate } from '@/utils/date';

const FALLBACK_REGION = {
  latitude: 47.6205,
  longitude: -122.3493,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};
const CAIRN_MARKER_IMAGE = require('../assets/markers/cairn-badge.png');
const CAIRN_MARKER_FAVORITE_IMAGE = require('../assets/markers/cairn-badge-favorite.png');
const CAIRN_MARKER_SELECTED_IMAGE = require('../assets/markers/cairn-badge-selected.png');

function CairnBrandMark() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.brandMark}>
      <View style={styles.brandStack}>
        <View style={styles.brandStone0} />
        <View style={styles.brandStone1} />
        <View style={styles.brandStone2} />
        <View style={styles.brandStone3} />
      </View>
    </View>
  );
}

function BuildCairnGlyph() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.buildGlyph}>
      <View style={styles.buildGlyphStack}>
        <View style={styles.buildStone0} />
        <View style={styles.buildStone1} />
        <View style={styles.buildStone2} />
        <View style={styles.buildStone3} />
      </View>
      <View style={styles.buildPlusBadge}>
        <Feather name="plus" size={13} color={colors.pine} />
      </View>
    </View>
  );
}

export default function MapHome() {
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchFocusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionMotion = useRef(new Animated.Value(0)).current;
  const buildButtonScale = useRef(new Animated.Value(1)).current;
  const buildRipple = useRef(new Animated.Value(0)).current;
  const buildNavigating = useRef(false);
  const menuSlide = useRef(new Animated.Value(0)).current;
  const menuHandleGlow = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState<'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCairnId, setSelectedCairnId] = useState<string | null>(null);
  const [rippleRadius, setRippleRadius] = useState(0);
  const [rippleOpacity, setRippleOpacity] = useState(0);
  const { cairns, loading, error, reload } = useCairns();
  const { coordinate, permissionDenied, requestLocation } = useCurrentLocation();
  const selectedCairn = cairns.find((cairn) => cairn.id === selectedCairnId);
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleMenuCairns = (menuFilter === 'favorites'
    ? cairns.filter((cairn) => cairn.isFavorite)
    : cairns)
    .filter((cairn) => {
      if (!trimmedSearchQuery) return true;

      return [
        cairn.name,
        cairn.placeType,
        cairn.story,
        cairn.notes,
      ].some((value) => value.toLowerCase().includes(trimmedSearchQuery));
    });

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!coordinate) return;
    mapRef.current?.animateToRegion(
      {
        ...FALLBACK_REGION,
        ...coordinate,
      },
      600,
    );
  }, [coordinate]);

  useEffect(() => {
    if (selectedCairnId && !cairns.some((cairn) => cairn.id === selectedCairnId)) {
      setSelectedCairnId(null);
    }
  }, [cairns, selectedCairnId]);

  useEffect(() => {
    if (!menuOpen) {
      menuSlide.setValue(0);
      menuHandleGlow.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.spring(menuSlide, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(menuHandleGlow, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(menuHandleGlow, {
          toValue: 0,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [menuHandleGlow, menuOpen, menuSlide]);

  useEffect(() => () => {
    buildNavigating.current = false;
    if (searchFocusTimeout.current) {
      clearTimeout(searchFocusTimeout.current);
    }
  }, []);

  useEffect(() => {
    const listener = selectionMotion.addListener(({ value }) => {
      setRippleRadius(35 + value * 210);
      setRippleOpacity(Math.max(0, 0.22 * (1 - value)));
    });

    return () => selectionMotion.removeListener(listener);
  }, [selectionMotion]);

  useEffect(() => {
    if (!selectedCairnId) {
      setRippleOpacity(0);
      return;
    }

    selectionMotion.setValue(0);
    Animated.timing(selectionMotion, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [selectedCairnId, selectionMotion]);

  function openCairn(cairn: Cairn) {
    closePlacesMenu();
    router.push(`/cairn/${cairn.id}`);
  }

  function openPlacesMenu(focusSearch = false) {
    if (searchFocusTimeout.current) {
      clearTimeout(searchFocusTimeout.current);
    }

    setMenuOpen(true);

    if (focusSearch) {
      searchFocusTimeout.current = setTimeout(() => {
        searchInputRef.current?.focus();
        searchFocusTimeout.current = null;
      }, 430);
    }
  }

  function closePlacesMenu() {
    if (searchFocusTimeout.current) {
      clearTimeout(searchFocusTimeout.current);
      searchFocusTimeout.current = null;
    }

    searchInputRef.current?.blur();
    setMenuOpen(false);
  }

  function heroPhotoFor(cairn: Cairn) {
    return cairn.photos.find((photo) => photo.id === cairn.primaryPhotoId) ?? cairn.photos[0];
  }

  function previewMemoryFor(cairn: Cairn) {
    return (cairn.story || cairn.notes).trim();
  }

  function markerImageFor(cairn: Cairn) {
    if (cairn.id === selectedCairnId) return CAIRN_MARKER_SELECTED_IMAGE;
    if (cairn.isFavorite) return CAIRN_MARKER_FAVORITE_IMAGE;
    return CAIRN_MARKER_IMAGE;
  }

  async function recenterMap() {
    const current = await requestLocation();
    const target = current ?? coordinate;

    if (!target) return;

    mapRef.current?.animateToRegion(
      {
        ...FALLBACK_REGION,
        ...target,
      },
      500,
    );
  }

  function googleMapsPlaceUrl(cairn: Cairn) {
    return `https://www.google.com/maps/search/?api=1&query=${cairn.latitude},${cairn.longitude}`;
  }

  function googleMapsDirectionsUrl(cairn: Cairn) {
    return `https://www.google.com/maps/dir/?api=1&destination=${cairn.latitude},${cairn.longitude}`;
  }

  async function openExternalMap(cairn: Cairn) {
    await Linking.openURL(googleMapsPlaceUrl(cairn));
  }

  async function navigateToCairn(cairn: Cairn) {
    await Linking.openURL(googleMapsDirectionsUrl(cairn));
  }

  function startBuildCairn() {
    if (buildNavigating.current) return;
    buildNavigating.current = true;
    buildRipple.setValue(0);
    buildButtonScale.setValue(1);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(buildButtonScale, {
          toValue: 0.88,
          duration: 70,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(buildButtonScale, {
          toValue: 1,
          speed: 22,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buildRipple, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    window.setTimeout(() => {
      router.push('/cairn/build');
      buildNavigating.current = false;
    }, 130);
  }

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        showsUserLocation={!!coordinate}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={() => setSelectedCairnId(null)}
        initialRegion={{
          ...FALLBACK_REGION,
          ...(coordinate ?? {}),
        }}
      >
        {cairns.map((cairn) => (
          <Marker
            key={cairn.id}
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: cairn.latitude, longitude: cairn.longitude }}
            image={markerImageFor(cairn)}
            onPress={(event) => {
              event.stopPropagation();
              setSelectedCairnId(cairn.id);
            }}
          />
        ))}
        {selectedCairn && rippleOpacity > 0 ? (
          <Circle
            center={{ latitude: selectedCairn.latitude, longitude: selectedCairn.longitude }}
            radius={rippleRadius}
            fillColor={`rgba(203, 216, 198, ${rippleOpacity})`}
            strokeColor={`rgba(49, 86, 66, ${rippleOpacity * 0.75})`}
            strokeWidth={1}
          />
        ) : null}
      </MapView>
      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Cairn menu"
            disabled={loading}
            onPress={() => openPlacesMenu()}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Feather name="menu" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.brand}>
            <CairnBrandMark />
            <Text style={styles.headerTitle}>Cairn</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Cairn search"
            disabled={loading}
            onPress={() => openPlacesMenu(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Feather name="search" size={20} color={colors.ink} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter map on current location"
          onPress={recenterMap}
          style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}
        >
          <Feather name="navigation" size={18} color={colors.ink} />
        </Pressable>
        <View style={styles.spacer} />
        {loading ? (
          <View style={styles.panel}>
            <ActivityIndicator color={colors.moss} />
          </View>
        ) : error ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{error}</Text>
          </View>
        ) : cairns.length === 0 ? (
          <View style={styles.panel}>
            <View style={styles.menuHandle} />
            <Text style={styles.panelTitle}>No Cairns yet.</Text>
            <Text style={styles.panelText}>Build your first Cairn to get started.</Text>
            <Button label="Build Cairn" onPress={() => router.push('/cairn/build')} style={styles.emptyButton} />
          </View>
        ) : selectedCairn ? (
          <Animated.View
            style={[
              styles.previewSpring,
              {
                opacity: selectionMotion,
                transform: [
                  {
                    translateY: selectionMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [34, 0],
                    }),
                  },
                  {
                    scale: selectionMotion.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${selectedCairn.name}`}
              onPress={() => openCairn(selectedCairn)}
              style={({ pressed }) => [styles.previewCard, pressed && styles.pressed]}
            >
              <View style={styles.menuHandle} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear selected Cairn"
                onPress={() => setSelectedCairnId(null)}
                style={styles.previewClose}
              >
                <Feather name="x" size={18} color={colors.muted} />
              </Pressable>
              <View style={styles.previewContent}>
                <View style={styles.previewPhotoWrap}>
                  {heroPhotoFor(selectedCairn)?.localUri ? (
                    <Image source={{ uri: heroPhotoFor(selectedCairn)?.localUri }} style={styles.previewPhoto} />
                  ) : (
                    <View style={styles.previewPhotoPlaceholder}>
                      <CairnMarker />
                    </View>
                  )}
                  {selectedCairn.isFavorite ? (
                    <View style={styles.previewFavoriteBadge}>
                      <MaterialIcons name="star" size={14} color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.previewText}>
                  <Text numberOfLines={1} style={styles.previewName}>
                    {selectedCairn.name}
                  </Text>
                  <View style={styles.previewMetaRow}>
                    <View style={styles.previewTypeChip}>
                      <Text style={styles.previewTypeText}>
                        {PLACE_TYPE_ICONS[selectedCairn.placeType]} {selectedCairn.placeType}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.previewVisited}>
                      Visited {formatDate(selectedCairn.lastVisitedAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.previewActionColumn}>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </View>
              </View>
              {previewMemoryFor(selectedCairn) ? (
                <View style={styles.previewMemoryBand}>
                  <Text numberOfLines={2} style={styles.previewMemory}>
                    {previewMemoryFor(selectedCairn)}
                  </Text>
                </View>
                ) : (
                <View style={styles.previewMemoryBand}>
                  <Text numberOfLines={1} style={styles.previewMemoryMuted}>
                    Add a story to remember why this place mattered.
                  </Text>
                </View>
              )}
              <View style={styles.previewUtilityRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${selectedCairn.name}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    navigateToCairn(selectedCairn);
                  }}
                  style={({ pressed }) => [styles.previewUtilityButton, pressed && styles.pressed]}
                >
                  <View style={styles.previewUtilityGlyph}>
                    <View style={styles.utilityStoneSmall} />
                    <View style={styles.utilityStoneLarge} />
                  </View>
                  <Text style={styles.previewUtilityText}>Navigate</Text>
                  <Feather name="navigation" size={14} color={colors.moss} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${selectedCairn.name} in Google Maps`}
                  onPress={(event) => {
                    event.stopPropagation();
                    openExternalMap(selectedCairn);
                  }}
                  style={({ pressed }) => [styles.previewUtilityButton, pressed && styles.pressed]}
                >
                  <View style={styles.previewUtilityGlyph}>
                    <View style={styles.utilityStoneSmall} />
                    <View style={styles.utilityStoneLarge} />
                  </View>
                  <Text style={styles.previewUtilityText}>Open Map</Text>
                  <Feather name="external-link" size={14} color={colors.moss} />
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        ) : permissionDenied ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Location is off. Your Cairns still work.</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build Cairn"
        onPress={startBuildCairn}
        style={[styles.fab, selectedCairn && styles.fabRaised]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fabRipple,
            {
              opacity: buildRipple.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0, 0.26, 0],
              }),
              transform: [
                {
                  scale: buildRipple.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 2.25],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: buildButtonScale }] }}>
          <BuildCairnGlyph />
        </Animated.View>
      </Pressable>
      <Modal
        animationType="none"
        transparent
        visible={menuOpen}
        onRequestClose={closePlacesMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePlacesMenu} />
        <Animated.View
          style={[
            styles.menuSheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              opacity: menuSlide,
              transform: [
                {
                  translateY: menuSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.menuHandle,
              {
                backgroundColor: menuHandleGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.line, colors.sage],
                }),
                transform: [
                  {
                    scaleX: menuHandleGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.28],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.menuHeader}>
            <View style={styles.menuTitleBlock}>
              <Text style={styles.menuTitle}>Places</Text>
              <Text style={styles.menuSubtitle}>
                {cairns.length} {cairns.length === 1 ? 'place' : 'places'} saved
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Cairn menu"
              onPress={closePlacesMenu}
              style={styles.closeButton}
            >
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Feather name="search" size={17} color={colors.muted} />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search places"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearchQuery('')}
                style={styles.searchClear}
              >
                <Feather name="x" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: menuFilter === 'all' }}
              onPress={() => setMenuFilter('all')}
              style={[styles.filterButton, menuFilter === 'all' && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterLabel, menuFilter === 'all' && styles.filterLabelSelected]}>All</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: menuFilter === 'favorites' }}
              onPress={() => setMenuFilter('favorites')}
              style={[styles.filterButton, menuFilter === 'favorites' && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterLabel, menuFilter === 'favorites' && styles.filterLabelSelected]}>Favorites</Text>
            </Pressable>
          </View>
          {cairns.length === 0 ? (
            <View style={styles.menuEmpty}>
              <Text style={styles.panelTitle}>No Cairns yet.</Text>
              <Text style={styles.panelText}>Build your first Cairn to get started.</Text>
            </View>
          ) : visibleMenuCairns.length === 0 ? (
            <View style={styles.menuEmpty}>
              <Text style={styles.panelTitle}>
                {trimmedSearchQuery ? 'No matching places.' : 'No favorite places yet.'}
              </Text>
              <Text style={styles.panelText}>
                {trimmedSearchQuery
                  ? 'Try a place name, story, note, or place type.'
                  : 'Star the places you always want close at hand.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={visibleMenuCairns}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.menuList}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.name}`}
                  onPress={() => openCairn(item)}
                  style={({ pressed }) => [styles.cairnRow, pressed && styles.pressed]}
                >
                  {heroPhotoFor(item)?.localUri ? (
                    <Image source={{ uri: heroPhotoFor(item)?.localUri }} style={styles.cairnPhoto} />
                  ) : (
                    <View style={styles.cairnPhotoPlaceholder}>
                      <CairnMarker />
                    </View>
                  )}
                  <View style={styles.cairnRowText}>
                    <Text numberOfLines={1} style={styles.cairnName}>
                      {item.name}
                    </Text>
                    <View style={styles.cairnMetaRow}>
                      <Text numberOfLines={1} style={styles.cairnType}>
                        {PLACE_TYPE_ICONS[item.placeType]} {item.placeType}
                      </Text>
                      <Text numberOfLines={1} style={styles.cairnVisited}>
                        Visited {formatDate(item.lastVisitedAt)}
                      </Text>
                    </View>
                    {previewMemoryFor(item) ? (
                      <Text numberOfLines={1} style={styles.cairnMemory}>
                        {previewMemoryFor(item)}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons
                    name={item.isFavorite ? 'star' : 'star-border'}
                    size={22}
                    color={item.isFavorite ? colors.clay : colors.muted}
                  />
                </Pressable>
              )}
            />
          )}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  header: {
    minHeight: 56,
    backgroundColor: colors.sage,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(49, 86, 66, 0.18)',
  },
  headerButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  brand: {
    position: 'absolute',
    left: 86,
    right: 86,
    bottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  brandStack: {
    alignItems: 'center',
  },
  brandStone0: {
    width: 8,
    height: 5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 4,
    backgroundColor: colors.ink,
    marginBottom: 1,
    transform: [{ rotate: '-7deg' }, { translateX: 1 }],
  },
  brandStone1: {
    width: 14,
    height: 5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 8,
    backgroundColor: colors.ink,
    marginBottom: 2,
    transform: [{ rotate: '5deg' }, { translateX: -1 }],
  },
  brandStone2: {
    width: 23,
    height: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 8,
    backgroundColor: colors.ink,
    marginBottom: 1,
    transform: [{ rotate: '-3deg' }, { translateX: 1 }],
  },
  brandStone3: {
    width: 31,
    height: 7,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 13,
    backgroundColor: colors.ink,
    transform: [{ rotate: '2deg' }],
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  spacer: {
    flex: 1,
  },
  panel: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: -spacing.md,
    marginBottom: spacing.lg,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '800',
  },
  panelText: {
    color: colors.muted,
    textAlign: 'center',
  },
  notice: {
    alignSelf: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xl,
  },
  noticeText: {
    color: colors.muted,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 142,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moss,
    elevation: 5,
  },
  fabRipple: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.sage,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
  },
  buildGlyph: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildGlyphStack: {
    alignItems: 'center',
  },
  buildStone0: {
    width: 8,
    height: 5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 4,
    backgroundColor: colors.white,
    marginBottom: 2,
    transform: [{ rotate: '-7deg' }, { translateX: 1 }],
  },
  buildStone1: {
    width: 16,
    height: 5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 2,
    transform: [{ rotate: '5deg' }, { translateX: -1 }],
  },
  buildStone2: {
    width: 25,
    height: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 2,
    transform: [{ rotate: '-3deg' }, { translateX: 1 }],
  },
  buildStone3: {
    width: 34,
    height: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 13,
    backgroundColor: colors.white,
    transform: [{ rotate: '2deg' }],
  },
  buildPlusBadge: {
    position: 'absolute',
    right: -2,
    top: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(25, 53, 38, 0.22)',
  },
  fabRaised: {
    bottom: 304,
  },
  emptyButton: {
    minWidth: 180,
    marginTop: spacing.sm,
  },
  previewSpring: {
    marginBottom: spacing.xl,
  },
  previewCard: {
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.22)',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  previewClose: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  previewPhotoWrap: {
    width: 64,
    height: 64,
  },
  previewPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  previewPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  previewFavoriteBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.clay,
    borderWidth: 2,
    borderColor: colors.paper,
  },
  previewText: {
    flex: 1,
    minWidth: 0,
  },
  previewName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  previewMetaRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  previewTypeChip: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
    backgroundColor: colors.sage,
    paddingHorizontal: spacing.sm,
  },
  previewTypeText: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
  },
  previewVisited: {
    color: colors.muted,
    fontSize: 13,
    flexShrink: 1,
  },
  previewActionColumn: {
    width: 24,
    alignItems: 'center',
  },
  previewMemory: {
    color: colors.ink,
    fontSize: type.small,
    lineHeight: 19,
  },
  previewMemoryMuted: {
    color: colors.muted,
    fontSize: type.small,
    fontStyle: 'italic',
  },
  previewMemoryBand: {
    borderRadius: 8,
    backgroundColor: 'rgba(203, 216, 198, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  previewUtilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  previewUtilityButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
  },
  previewUtilityGlyph: {
    width: 16,
    height: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  utilityStoneSmall: {
    width: 7,
    height: 4,
    borderRadius: 6,
    backgroundColor: colors.moss,
    marginBottom: 2,
    transform: [{ rotate: '-6deg' }],
  },
  utilityStoneLarge: {
    width: 14,
    height: 5,
    borderRadius: 8,
    backgroundColor: colors.pine,
    transform: [{ rotate: '3deg' }],
  },
  previewUtilityText: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '76%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  menuHeader: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuTitleBlock: {
    gap: 2,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '700',
    paddingVertical: 0,
  },
  searchClear: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    padding: 3,
  },
  filterButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  filterButtonSelected: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
  },
  filterLabel: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: type.small,
  },
  filterLabelSelected: {
    color: colors.ink,
  },
  menuTitle: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  menuSubtitle: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '700',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuEmpty: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuList: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  cairnRow: {
    minHeight: 88,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cairnPhoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  cairnPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  cairnRowText: {
    flex: 1,
    minWidth: 0,
  },
  cairnName: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '800',
  },
  cairnMetaRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cairnType: {
    maxWidth: 132,
    overflow: 'hidden',
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    backgroundColor: 'rgba(203, 216, 198, 0.46)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  cairnVisited: {
    color: colors.muted,
    fontSize: type.small,
    flexShrink: 1,
  },
  cairnMemory: {
    color: colors.muted,
    fontSize: type.small,
    marginTop: 2,
  },
});
