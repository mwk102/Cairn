import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { CairnMarker } from '@/components/CairnMarker';
import { createCairnMigrationJson, importCairnsFromMigrationJson } from '@/data/cairns';
import { getLastSelectedCairnId, setLastSelectedCairnId } from '@/data/settings';
import { useCairns } from '@/hooks/useCairns';
import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { colors, spacing, type } from '@/theme';
import { Cairn, PLACE_TYPE_ICONS } from '@/types/cairn';
import { formatDate } from '@/utils/date';
import { canUseNativeMap } from '@/utils/mapAvailability';

const FALLBACK_REGION = {
  latitude: 47.6205,
  longitude: -122.3493,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};
const CAIRN_MARKER_IMAGE = require('../assets/markers/cairn-badge.png');
const CAIRN_MARKER_FAVORITE_IMAGE = require('../assets/markers/cairn-badge-favorite.png');
const CAIRN_MARKER_SELECTED_IMAGE = require('../assets/markers/cairn-badge-selected.png');
type MenuFilter = 'all' | 'recent' | 'favorites';

function regionForCairn(cairn: Cairn) {
  return {
    latitude: cairn.latitude,
    longitude: cairn.longitude,
    latitudeDelta: Math.min(FALLBACK_REGION.latitudeDelta, 0.08),
    longitudeDelta: Math.min(FALLBACK_REGION.longitudeDelta, 0.08),
  };
}

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
  const { menu, cairn: focusedCairnId } = useLocalSearchParams<{ menu?: string; cairn?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchFocusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionMotion = useRef(new Animated.Value(0)).current;
  const buildButtonScale = useRef(new Animated.Value(1)).current;
  const buildRipple = useRef(new Animated.Value(0)).current;
  const buildNavigating = useRef(false);
  const menuSlide = useRef(new Animated.Value(0)).current;
  const menuHandleGlow = useRef(new Animated.Value(0)).current;
  const filterMotion = useRef(new Animated.Value(0)).current;
  const searchGlow = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState<MenuFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCairnId, setSelectedCairnId] = useState<string | null>(focusedCairnId ?? null);
  const [lastSelectionLoaded, setLastSelectionLoaded] = useState(false);
  const [rippleRadius, setRippleRadius] = useState(0);
  const [rippleOpacity, setRippleOpacity] = useState(0);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [filterWidth, setFilterWidth] = useState(0);
  const [searchFocused, setSearchFocusedState] = useState(false);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const { cairns, loading, error, reload } = useCairns();
  const { coordinate, permissionDenied, requestLocation } = useCurrentLocation();
  const mapAvailable = canUseNativeMap();
  const normalMenuHeight = Math.round(windowHeight * 0.76);
  const searchMenuHeight = keyboardTop
    ? Math.max(430, Math.min(normalMenuHeight, keyboardTop - insets.top - spacing.sm))
    : normalMenuHeight;
  const menuDrawerHeight = searchFocused ? searchMenuHeight : normalMenuHeight;
  const selectedCairn = cairns.find((cairn) => cairn.id === selectedCairnId);
  const initialRegion = selectedCairn ? regionForCairn(selectedCairn) : FALLBACK_REGION;
  const mapReady = lastSelectionLoaded && (!selectedCairnId || !!selectedCairn || !loading);
  const favoriteCount = cairns.filter((cairn) => cairn.isFavorite).length;
  const latestVisitedCairn = cairns.reduce<Cairn | null>((latest, cairn) => {
    if (!latest) return cairn;
    return Date.parse(cairn.lastVisitedAt) > Date.parse(latest.lastVisitedAt) ? cairn : latest;
  }, null);
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleMenuCairns = (menuFilter === 'favorites'
    ? cairns.filter((cairn) => cairn.isFavorite)
    : menuFilter === 'recent'
      ? [...cairns].sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt))
      : cairns)
    .filter((cairn) => {
      if (!trimmedSearchQuery) return true;

      return [
        cairn.name,
        cairn.placeType,
        cairn.story,
        cairn.notes,
        ...cairn.tags,
      ].some((value) => value.toLowerCase().includes(trimmedSearchQuery));
    });

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardTop(null);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;

    getLastSelectedCairnId()
      .then((lastSelectedId) => {
        if (!active) return;
        if (!focusedCairnId && lastSelectedId) {
          setSelectedCairnId(lastSelectedId);
        }
      })
      .finally(() => {
        if (active) {
          setLastSelectionLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [focusedCairnId]);

  useFocusEffect(
    useCallback(() => {
      reload();
      if (menu === 'main') {
        setMenuOpen(false);
        setMainMenuOpen(true);
        router.setParams({ menu: undefined });
      }
    }, [menu, reload]),
  );

  const focusCairnOnMap = useCallback((cairn: Cairn, duration = 560) => {
    setSelectedCairnId(cairn.id);
    void setLastSelectedCairnId(cairn.id);
    mapRef.current?.animateToRegion(regionForCairn(cairn), duration);
  }, []);

  useEffect(() => {
    if (!focusedCairnId) return;

    const target = cairns.find((cairn) => cairn.id === focusedCairnId);
    if (!target) return;

    setSelectedCairnId(target.id);
    void setLastSelectedCairnId(target.id);
    router.setParams({ cairn: undefined });
  }, [cairns, focusedCairnId]);

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

  useEffect(() => {
    const index = menuFilter === 'all' ? 0 : menuFilter === 'recent' ? 1 : 2;
    Animated.spring(filterMotion, {
      toValue: index,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    }).start();
  }, [filterMotion, menuFilter]);

  function setSearchFocused(focused: boolean) {
    setSearchFocusedState(focused);
    Animated.timing(searchGlow, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

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
    setSelectedCairnId(cairn.id);
    void setLastSelectedCairnId(cairn.id);
    router.push(`/cairn/${cairn.id}`);
  }

  function openPlacesMenu(focusSearch = false) {
    if (searchFocusTimeout.current) {
      clearTimeout(searchFocusTimeout.current);
    }

    setMainMenuOpen(false);
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

  function closeMainMenu() {
    setMainMenuOpen(false);
  }

  function returnToMainMenu() {
    closePlacesMenu();
    setMainMenuOpen(true);
  }

  function openReceiveCairn() {
    closeMainMenu();
    closePlacesMenu();
    router.push('/share/receive');
  }

  function openSharingIdentity() {
    closeMainMenu();
    closePlacesMenu();
    router.push('/settings/sharing-identity');
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

  async function copyCairnExport() {
    if (migrationBusy) return;
    setMigrationBusy(true);
    try {
      await Clipboard.setStringAsync(createCairnMigrationJson(cairns));
      Alert.alert(
        'Cairns copied',
        `Copied ${cairns.length} ${cairns.length === 1 ? 'Cairn' : 'Cairns'} to the clipboard. Photos are not included.`,
      );
    } catch {
      Alert.alert('Export failed', 'Cairn could not copy the export to the clipboard.');
    } finally {
      setMigrationBusy(false);
    }
  }

  async function pasteCairnImport() {
    if (migrationBusy) return;
    setMigrationBusy(true);
    try {
      const text = await Clipboard.getStringAsync();
      const importedCount = await importCairnsFromMigrationJson(text);
      await reload();
      Alert.alert(
        'Cairns imported',
        `Imported ${importedCount} ${importedCount === 1 ? 'Cairn' : 'Cairns'}. Photos can be re-added from this app.`,
      );
    } catch (importError) {
      Alert.alert(
        'Import failed',
        importError instanceof Error ? importError.message : 'Cairn could not read a valid export from the clipboard.',
      );
    } finally {
      setMigrationBusy(false);
    }
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
      {mapAvailable && mapReady ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          showsUserLocation={!!coordinate}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onPress={() => setSelectedCairnId(null)}
          initialRegion={initialRegion}
        >
          {selectedCairn ? (
            <>
              <Circle
                center={{ latitude: selectedCairn.latitude, longitude: selectedCairn.longitude }}
                radius={112}
                fillColor="rgba(178, 120, 75, 0.10)"
                strokeColor="rgba(178, 120, 75, 0.94)"
                strokeWidth={3}
              />
              <Circle
                center={{ latitude: selectedCairn.latitude, longitude: selectedCairn.longitude }}
                radius={50}
                fillColor="rgba(255, 253, 250, 0.34)"
                strokeColor="rgba(255, 253, 250, 0.98)"
                strokeWidth={2}
              />
            </>
          ) : null}
          {selectedCairn && rippleOpacity > 0 ? (
            <Circle
              center={{ latitude: selectedCairn.latitude, longitude: selectedCairn.longitude }}
              radius={rippleRadius}
              fillColor={`rgba(203, 216, 198, ${rippleOpacity})`}
              strokeColor={`rgba(49, 86, 66, ${rippleOpacity * 0.75})`}
              strokeWidth={1}
            />
          ) : null}
          {cairns.map((cairn) => (
            <Marker
              key={cairn.id}
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={{ latitude: cairn.latitude, longitude: cairn.longitude }}
              image={markerImageFor(cairn)}
              zIndex={cairn.id === selectedCairnId ? 40 : cairn.isFavorite ? 12 : 8}
              onPress={(event) => {
                event.stopPropagation();
                focusCairnOnMap(cairn, 360);
              }}
            />
          ))}
        </MapView>
      ) : mapAvailable ? (
        <View style={styles.mapUnavailable}>
          <CairnBrandMark />
          <Text style={styles.mapUnavailableTitle}>Opening your last Cairn...</Text>
        </View>
      ) : (
        <View style={styles.mapUnavailable}>
          <CairnBrandMark />
          <Text style={styles.mapUnavailableTitle}>Map key needed</Text>
          <Text style={styles.mapUnavailableText}>Add a Google Maps Android API key and rebuild Cairn to use the map in an installed APK.</Text>
        </View>
      )}
      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Cairn menu"
            disabled={loading}
            onPress={() => setMainMenuOpen(true)}
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
            <Text style={styles.panelTitle}>No places saved yet.</Text>
            <Text style={styles.panelText}>Drop your first Cairn somewhere you want to remember.</Text>
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
              {selectedCairn.tags.length > 0 ? (
                <View style={styles.previewTagRow}>
                  {selectedCairn.tags.slice(0, 3).map((tag) => (
                    <Text numberOfLines={1} key={tag} style={styles.previewTagChip}>{tag}</Text>
                  ))}
                </View>
              ) : null}
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
        animationType="fade"
        transparent
        visible={mainMenuOpen}
        onRequestClose={closeMainMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMainMenu} />
        <View style={[styles.mainMenuSheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
          <View style={styles.menuHandle} />
          <View style={styles.menuHeader}>
            <View style={styles.menuTitleBlock}>
              <Text style={styles.menuTitle}>Cairn</Text>
              <Text style={styles.menuSubtitle}>Your place journal</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Cairn menu"
              onPress={closeMainMenu}
              style={styles.closeButton}
            >
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.mainMenuList}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open places"
              onPress={() => openPlacesMenu()}
              style={({ pressed }) => [styles.mainMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.mainMenuIcon}>
                <Feather name="map" size={18} color={colors.moss} />
              </View>
              <View style={styles.mainMenuText}>
                <Text style={styles.mainMenuTitle}>Places</Text>
                <Text style={styles.mainMenuHelp}>{cairns.length} {cairns.length === 1 ? 'place' : 'places'} saved</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Receive shared Cairn"
              onPress={openReceiveCairn}
              style={({ pressed }) => [styles.mainMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.mainMenuIcon}>
                <Feather name="share-2" size={18} color={colors.moss} />
              </View>
              <View style={styles.mainMenuText}>
                <Text style={styles.mainMenuTitle}>Receive Cairn</Text>
                <Text style={styles.mainMenuHelp}>Open a shared .cairn package</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open sharing identity"
              onPress={openSharingIdentity}
              style={({ pressed }) => [styles.mainMenuRow, pressed && styles.pressed]}
            >
              <View style={styles.mainMenuIcon}>
                <Feather name="user" size={18} color={colors.moss} />
              </View>
              <View style={styles.mainMenuText}>
                <Text style={styles.mainMenuTitle}>Sharing Identity</Text>
                <Text style={styles.mainMenuHelp}>Manage creator name and ID</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          </View>
          {__DEV__ ? (
          <View style={styles.migrationBox}>
            <View style={styles.migrationText}>
              <View style={styles.devToolHeader}>
                <Text style={styles.devToolBadge}>Dev Tool</Text>
                <Text style={styles.migrationTitle}>Move local Cairns</Text>
              </View>
              <Text style={styles.migrationHelp}>Copy in Expo Go, paste in the APK.</Text>
            </View>
            <View style={styles.migrationActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy Cairn export"
                disabled={migrationBusy || cairns.length === 0}
                onPress={copyCairnExport}
                style={({ pressed }) => [
                  styles.migrationButton,
                  (pressed || migrationBusy) && styles.pressed,
                  cairns.length === 0 && styles.disabledButton,
                ]}
              >
                <Feather name="copy" size={15} color={colors.moss} />
                <Text style={styles.migrationButtonText}>Copy</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paste Cairn import"
                disabled={migrationBusy}
                onPress={pasteCairnImport}
                style={({ pressed }) => [
                  styles.migrationButton,
                  styles.migrationButtonPrimary,
                  (pressed || migrationBusy) && styles.pressed,
                ]}
              >
                <Feather name="clipboard" size={15} color={colors.white} />
                <Text style={styles.migrationButtonPrimaryText}>Paste</Text>
              </Pressable>
            </View>
          </View>
          ) : null}
        </View>
      </Modal>
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
              height: menuDrawerHeight,
              maxHeight: menuDrawerHeight,
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
            <View style={styles.menuHeaderLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to Cairn menu"
                onPress={returnToMainMenu}
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={22} color={colors.ink} />
              </Pressable>
              <View style={styles.menuTitleBlock}>
                <Text style={styles.menuTitle}>Places</Text>
                <Text style={styles.menuSubtitle}>
                  {cairns.length} {cairns.length === 1 ? 'place' : 'places'} saved
                </Text>
              </View>
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
          <Animated.View
            style={[
              styles.searchBox,
              {
                borderColor: searchGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(49, 86, 66, 0.16)', 'rgba(49, 86, 66, 0.42)'],
                }),
                backgroundColor: searchGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.cream, 'rgba(203, 216, 198, 0.2)'],
                }),
              },
            ]}
          >
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
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
          </Animated.View>
          <View style={styles.placesSummary}>
            <View style={styles.placesSummaryItem}>
              <Text style={styles.placesSummaryValue}>{cairns.length}</Text>
              <Text style={styles.placesSummaryLabel}>Saved</Text>
            </View>
            <View style={styles.placesSummaryDivider} />
            <View style={styles.placesSummaryItem}>
              <Text style={styles.placesSummaryValue}>{favoriteCount}</Text>
              <Text style={styles.placesSummaryLabel}>Favorites</Text>
            </View>
            <View style={styles.placesSummaryDivider} />
            <View style={styles.placesSummaryLatest}>
              <Text style={styles.placesSummaryLabel}>Last Visited</Text>
              <Text numberOfLines={1} style={styles.placesSummaryLatestName}>
                {latestVisitedCairn?.name ?? 'None yet'}
              </Text>
            </View>
          </View>
          <View
            style={styles.filterRow}
            onLayout={(event) => setFilterWidth(event.nativeEvent.layout.width)}
          >
            {filterWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.filterIndicator,
                  {
                    width: (filterWidth - 6) / 3,
                    transform: [
                      {
                        translateX: filterMotion.interpolate({
                          inputRange: [0, 1, 2],
                          outputRange: [0, (filterWidth - 6) / 3, ((filterWidth - 6) / 3) * 2],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: menuFilter === 'all' }}
              accessibilityLabel="Show all places"
              onPress={() => setMenuFilter('all')}
              style={[styles.filterButton, menuFilter === 'all' && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterLabel, menuFilter === 'all' && styles.filterLabelSelected]}>
                All ({cairns.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: menuFilter === 'recent' }}
              accessibilityLabel="Show recently visited places"
              onPress={() => setMenuFilter('recent')}
              style={[styles.filterButton, menuFilter === 'recent' && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterLabel, menuFilter === 'recent' && styles.filterLabelSelected]}>
                Recent
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: menuFilter === 'favorites' }}
              accessibilityLabel="Show favorite places"
              onPress={() => setMenuFilter('favorites')}
              style={[styles.filterButton, menuFilter === 'favorites' && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterLabel, menuFilter === 'favorites' && styles.filterLabelSelected]}>
                Favorites
              </Text>
            </Pressable>
          </View>
          {cairns.length === 0 ? (
            <View style={styles.menuEmpty}>
              <View style={styles.menuEmptyIcon}>
                <CairnMarker />
              </View>
              <Text style={styles.panelTitle}>No places saved yet.</Text>
              <Text style={styles.panelText}>Start with a campsite, viewpoint, trailhead, or anywhere worth finding again.</Text>
              <Button label="Build Cairn" onPress={startBuildCairn} style={styles.menuEmptyButton} />
            </View>
          ) : visibleMenuCairns.length === 0 ? (
            <View style={styles.menuEmpty}>
              <View style={styles.menuEmptyIcon}>
                <Feather
                  name={trimmedSearchQuery ? 'search' : menuFilter === 'favorites' ? 'star' : 'clock'}
                  size={24}
                  color={colors.moss}
                />
              </View>
              <Text style={styles.panelTitle}>
                {trimmedSearchQuery
                  ? 'No places found.'
                  : menuFilter === 'favorites'
                    ? 'No favorites yet.'
                    : 'No recent visits yet.'}
              </Text>
              <Text style={styles.panelText}>
                {trimmedSearchQuery
                  ? 'Try a place name, tag, story, reference note, or place type.'
                  : menuFilter === 'favorites'
                    ? 'Star the places you want close at hand.'
                    : 'Log a visit when you return to a place and it will appear here.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={visibleMenuCairns}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.menuResultsList}
              contentContainerStyle={[
                styles.menuList,
                searchFocused && styles.menuListSearching,
              ]}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.name}`}
                  onPress={() => openCairn(item)}
                  style={({ pressed }) => [
                    styles.cairnRow,
                    item.id === selectedCairnId && styles.cairnRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  {heroPhotoFor(item)?.localUri ? (
                    <Image source={{ uri: heroPhotoFor(item)?.localUri }} style={styles.cairnPhoto} />
                  ) : (
                    <View style={styles.cairnPhotoPlaceholder}>
                      <CairnMarker />
                    </View>
                  )}
                  {item.id === selectedCairnId ? <View style={styles.cairnSelectedDot} /> : null}
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
                    {item.tags.length > 0 ? (
                      <Text numberOfLines={1} style={styles.cairnTags}>
                        {item.tags.slice(0, 3).join('  ·  ')}
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
  mapUnavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.sage,
  },
  mapUnavailableTitle: {
    marginTop: spacing.sm,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  mapUnavailableText: {
    marginTop: spacing.xs,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
    color: colors.muted,
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
    marginBottom: 1,
    transform: [{ rotate: '-7deg' }, { translateX: 1 }],
  },
  buildStone1: {
    width: 14,
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
    width: 23,
    height: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 1,
    transform: [{ rotate: '-3deg' }, { translateX: 1 }],
  },
  buildStone3: {
    width: 31,
    height: 7,
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
  previewTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  previewTagChip: {
    maxWidth: 118,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: colors.cream,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
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
  mainMenuSheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    paddingHorizontal: spacing.md,
  },
  mainMenuList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mainMenuRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: colors.white,
    padding: spacing.sm,
  },
  mainMenuIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.44)',
  },
  mainMenuText: {
    flex: 1,
    minWidth: 0,
  },
  mainMenuTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '900',
  },
  mainMenuHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    marginTop: 2,
  },
  menuSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  menuHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
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
  placesSummary: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: 'rgba(203, 216, 198, 0.22)',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  placesSummaryItem: {
    width: 74,
    alignItems: 'center',
  },
  placesSummaryValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  placesSummaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  placesSummaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(49, 86, 66, 0.12)',
  },
  placesSummaryLatest: {
    flex: 1,
    minWidth: 0,
    paddingLeft: spacing.sm,
  },
  placesSummaryLatestName: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '900',
    marginTop: 2,
  },
  filterRow: {
    position: 'relative',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    padding: 3,
  },
  filterIndicator: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
  },
  filterButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  filterButtonSelected: {
    backgroundColor: 'transparent',
  },
  filterLabel: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: type.small,
  },
  filterLabelSelected: {
    color: colors.ink,
  },
  migrationBox: {
    alignItems: 'stretch',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: 'rgba(203, 216, 198, 0.28)',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  migrationText: {
    flex: 1,
    minWidth: 0,
  },
  migrationTitle: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '900',
  },
  devToolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  devToolBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(178, 120, 75, 0.16)',
    color: colors.clay,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 2,
    textTransform: 'uppercase',
  },
  migrationHelp: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  migrationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  migrationButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.18)',
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
  },
  migrationButtonPrimary: {
    backgroundColor: colors.moss,
    borderColor: colors.moss,
  },
  migrationButtonText: {
    color: colors.moss,
    fontSize: type.small,
    fontWeight: '900',
  },
  migrationButtonPrimaryText: {
    color: colors.white,
    fontSize: type.small,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
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
  menuEmptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.28)',
  },
  menuEmptyButton: {
    minWidth: 170,
    marginTop: spacing.xs,
  },
  menuList: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  menuResultsList: {
    flex: 1,
  },
  menuListSearching: {
    paddingBottom: 120,
  },
  cairnRow: {
    position: 'relative',
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
  cairnRowSelected: {
    borderColor: 'rgba(178, 120, 75, 0.38)',
    backgroundColor: 'rgba(203, 216, 198, 0.22)',
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
  cairnSelectedDot: {
    position: 'absolute',
    left: spacing.sm + 46,
    top: spacing.sm + 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.clay,
    borderWidth: 2,
    borderColor: colors.paper,
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
  cairnTags: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
});
