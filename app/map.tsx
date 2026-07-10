import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuFilter, setMenuFilter] = useState<'all' | 'favorites'>('all');
  const [selectedCairnId, setSelectedCairnId] = useState<string | null>(null);
  const { cairns, loading, error, reload } = useCairns();
  const { coordinate, permissionDenied, requestLocation } = useCurrentLocation();
  const selectedCairn = cairns.find((cairn) => cairn.id === selectedCairnId);
  const visibleMenuCairns = menuFilter === 'favorites'
    ? cairns.filter((cairn) => cairn.isFavorite)
    : cairns;

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

  function openCairn(cairn: Cairn) {
    setMenuOpen(false);
    router.push(`/cairn/${cairn.id}`);
  }

  function heroPhotoFor(cairn: Cairn) {
    return cairn.photos.find((photo) => photo.id === cairn.primaryPhotoId) ?? cairn.photos[0];
  }

  function previewMemoryFor(cairn: Cairn) {
    return (cairn.story || cairn.notes).trim();
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

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        showsUserLocation={!!coordinate}
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
            image={CAIRN_MARKER_IMAGE}
            onPress={(event) => {
              event.stopPropagation();
              setSelectedCairnId(cairn.id);
            }}
          />
        ))}
      </MapView>
      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Cairn menu"
            disabled={loading}
            onPress={() => setMenuOpen(true)}
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
            onPress={() => setMenuOpen(true)}
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
          </Pressable>
        ) : permissionDenied ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Location is off. Your Cairns still work.</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build Cairn"
        onPress={() => router.push('/cairn/build')}
        style={[styles.fab, selectedCairn && styles.fabRaised]}
      >
        <BuildCairnGlyph />
      </Pressable>
      <Modal
        animationType="slide"
        transparent
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <View style={styles.menuHandle} />
          <View style={styles.menuHeader}>
            <View style={styles.menuBrand}>
              <CairnBrandMark />
              <Text style={styles.menuTitle}>Cairn</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Cairn menu"
              onPress={() => setMenuOpen(false)}
              style={styles.closeButton}
            >
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
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
              <Text style={styles.panelTitle}>No favorites yet.</Text>
              <Text style={styles.panelText}>Tap the star on a Cairn to remember it here.</Text>
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
                    <Text numberOfLines={1} style={styles.cairnMeta}>
                      {PLACE_TYPE_ICONS[item.placeType]} {item.placeType} - Last visited {formatDate(item.lastVisitedAt)}
                    </Text>
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
        </View>
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
    marginBottom: -spacing.md,
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
    marginBottom: spacing.lg,
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
  previewCard: {
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.22)',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 40, 34, 0.28)',
  },
  menuSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuBrand: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterButtonSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterLabel: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: type.small,
  },
  filterLabelSelected: {
    color: colors.white,
  },
  menuTitle: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
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
    minHeight: 76,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
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
  cairnMeta: {
    color: colors.muted,
    fontSize: type.small,
    marginTop: spacing.xs,
  },
});
