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
import { Cairn } from '@/types/cairn';
import { formatDate } from '@/utils/date';

const FALLBACK_REGION = {
  latitude: 47.6205,
  longitude: -122.3493,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};
const CAIRN_MARKER_IMAGE = require('../assets/markers/cairn-badge.png');

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
            accessibilityLabel="Open My Cairns"
            disabled={loading}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Feather name="menu" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>My Cairns</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open My Cairns search"
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
            <Button label="Build a Cairn" onPress={() => router.push('/cairn/build')} style={styles.emptyButton} />
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
              {heroPhotoFor(selectedCairn)?.localUri ? (
                <Image source={{ uri: heroPhotoFor(selectedCairn)?.localUri }} style={styles.previewPhoto} />
              ) : (
                <View style={styles.previewPhotoPlaceholder}>
                  <CairnMarker />
                </View>
              )}
              <View style={styles.previewText}>
                <Text numberOfLines={1} style={styles.previewName}>
                  {selectedCairn.name}
                </Text>
                <Text numberOfLines={1} style={styles.previewMeta}>
                  Built {formatDate(selectedCairn.createdAt)}
                </Text>
                <Text numberOfLines={1} style={styles.previewMeta}>
                  {selectedCairn.placeType}
                </Text>
              </View>
              <MaterialIcons
                name={selectedCairn.isFavorite ? 'star' : 'star-border'}
                size={20}
                color={selectedCairn.isFavorite ? colors.clay : colors.muted}
              />
            </View>
          </Pressable>
        ) : permissionDenied ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Location is off. Your Cairns still work.</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build a Cairn"
        onPress={() => router.push('/cairn/build')}
        style={styles.fab}
      >
        <Feather name="plus" size={28} color={colors.white} />
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
            <Text style={styles.menuTitle}>My Cairns</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close My Cairns"
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
                      {item.placeType} - Built {formatDate(item.createdAt)}
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
    minHeight: 48,
    backgroundColor: colors.paper,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
    fontSize: 15,
    fontWeight: '800',
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
  emptyButton: {
    minWidth: 180,
    marginTop: spacing.sm,
  },
  previewCard: {
    borderRadius: 8,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
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
    gap: spacing.sm,
  },
  previewPhoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  previewPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  previewText: {
    flex: 1,
    minWidth: 0,
  },
  previewName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  previewMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
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
