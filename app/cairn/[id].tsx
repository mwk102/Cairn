import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { deleteCairn, getCairn, setCairnFavorite } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { Cairn, PLACE_TYPE_ICONS } from '@/types/cairn';
import { formatCoordinates } from '@/utils/coordinates';
import { formatDate } from '@/utils/date';

export default function CairnDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [cairn, setCairn] = useState<Cairn | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const clearStoneStyles = [styles.clearStone0, styles.clearStone1, styles.clearStone2, styles.clearStone3];
  const clearStoneTransforms = [
    { rotate: '2deg', translateX: 0 },
    { rotate: '-3deg', translateX: 3 },
    { rotate: '5deg', translateX: -2 },
    { rotate: '-7deg', translateX: 2 },
  ];
  const clearStoneAnimations = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(1),
    })),
  ).current;
  const clearDustAnimations = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.7),
    })),
  ).current;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getCairn(id).then(setCairn);
    }, [id]),
  );

  useEffect(() => {
    if (!clearing || !id) return;

    Vibration.vibrate(22);
    clearStoneAnimations.forEach((animation) => {
      animation.opacity.setValue(1);
      animation.translateY.setValue(0);
      animation.scale.setValue(1);
    });
    clearDustAnimations.forEach((animation) => {
      animation.opacity.setValue(0);
      animation.translateX.setValue(0);
      animation.translateY.setValue(0);
      animation.scale.setValue(0.7);
    });

    const liftStone = (index: number) =>
      Animated.parallel([
        Animated.timing(clearStoneAnimations[index].opacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(clearStoneAnimations[index].translateY, {
          toValue: -24,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(clearStoneAnimations[index].scale, {
          toValue: 0.88,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    const dustDrift = [
      { x: -26, y: -5 },
      { x: -10, y: -12 },
      { x: 14, y: -10 },
      { x: 28, y: -4 },
    ];
    const dustSettle = Animated.stagger(
      20,
      clearDustAnimations.map((animation, index) =>
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animation.opacity, {
              toValue: 0.34,
              duration: 90,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(animation.opacity, {
              toValue: 0,
              duration: 330,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animation.translateX, {
            toValue: dustDrift[index].x,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animation.translateY, {
            toValue: dustDrift[index].y,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animation.scale, {
            toValue: 1.05,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    Animated.sequence([
      liftStone(3),
      liftStone(2),
      liftStone(1),
      Animated.parallel([liftStone(0), dustSettle]),
    ]).start();

    const timeout = window.setTimeout(async () => {
      await deleteCairn(id);
      router.replace('/map');
    }, 1750);

    return () => window.clearTimeout(timeout);
  }, [clearDustAnimations, clearStoneAnimations, clearing, id]);

  function confirmDelete() {
    if (!id) return;
    Alert.alert('Delete this Cairn?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setClearing(true),
      },
    ]);
  }

  async function toggleFavorite() {
    if (!cairn) return;
    const next = !cairn.isFavorite;
    setCairn({ ...cairn, isFavorite: next });
    await setCairnFavorite(cairn.id, next);
  }

  if (!cairn) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading Cairn...</Text>
      </View>
    );
  }

  const primaryPhoto = cairn.photos.find((photo) => photo.id === cairn.primaryPhotoId) ?? cairn.photos[0];
  const primaryPhotoIndex = primaryPhoto
    ? Math.max(cairn.photos.findIndex((photo) => photo.id === primaryPhoto.id), 0)
    : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: cairn.name }} />
      {primaryPhoto ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="View hero photo"
          onPress={() => setViewingPhotoIndex(primaryPhotoIndex)}
        >
          <Image source={{ uri: primaryPhoto.localUri }} resizeMode="cover" style={styles.hero} />
        </Pressable>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>A place worth returning to.</Text>
        </View>
      )}
      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{cairn.name}</Text>
          <Text style={styles.placeType}>{PLACE_TYPE_ICONS[cairn.placeType]} {cairn.placeType}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cairn.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onPress={toggleFavorite}
          style={styles.favoriteButton}
        >
          <MaterialIcons
            name={cairn.isFavorite ? 'star' : 'star-border'}
            size={30}
            color={cairn.isFavorite ? colors.clay : colors.muted}
          />
        </Pressable>
      </View>
      <View style={styles.quickDetails}>
        <Text style={styles.sectionTitle}>Quick Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>Saved coordinates</Text>
            <Text style={styles.coordinateText}>{formatCoordinates(cairn)}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>🗓</Text>
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Built</Text>
            <Text style={styles.detailValue}>{formatDate(cairn.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>🧭</Text>
          <View style={styles.detailText}>
            <Text style={styles.detailLabel}>Last Visited</Text>
            <Text style={styles.detailValue}>{formatDate(cairn.lastVisitedAt)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.storyBlock}>
        <Text style={styles.sectionTitle}>Story</Text>
        <Text style={styles.storyText}>{cairn.story || 'No story yet.'}</Text>
      </View>
      <View style={styles.notesBlock}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <Text style={styles.notesText}>{cairn.notes || 'No notes yet.'}</Text>
      </View>
      {cairn.photos.length > 1 ? (
        <View style={styles.photoGrid}>
          {cairn.photos
            .map((photo, index) => ({ photo, index }))
            .filter(({ photo }) => photo.id !== primaryPhoto?.id)
            .map(({ photo, index }) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="View Cairn photo"
                key={photo.id}
                onPress={() => setViewingPhotoIndex(index)}
              >
                <Image source={{ uri: photo.localUri }} resizeMode="cover" style={styles.thumb} />
              </Pressable>
            ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/cairn/${id}/edit`)} style={styles.iconButton}>
          <Feather name="edit-3" size={20} color={colors.ink} />
          <Text style={styles.actionLabel}>Edit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.iconButton}>
          <Feather name="trash-2" size={20} color={colors.danger} />
          <Text style={[styles.actionLabel, styles.deleteLabel]}>Delete</Text>
        </Pressable>
      </View>
      <Button label="Back to Cairn" variant="secondary" onPress={() => router.replace('/map')} />
      <Modal
        animationType="fade"
        transparent
        visible={viewingPhotoIndex !== null}
        onRequestClose={() => setViewingPhotoIndex(null)}
      >
        <View style={styles.photoViewer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setViewingPhotoIndex(null)}
            style={styles.viewerClose}
          >
            <Feather name="x" size={26} color={colors.white} />
          </Pressable>
          {viewingPhotoIndex !== null ? (
            <FlatList
              data={cairn.photos}
              horizontal
              pagingEnabled
              initialScrollIndex={viewingPhotoIndex}
              keyExtractor={(photo) => photo.id}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[styles.viewerPage, { width }]}>
                  <Image source={{ uri: item.localUri }} style={styles.viewerImage} resizeMode="contain" />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
      <Modal transparent visible={clearing} animationType="fade">
        <View style={styles.clearOverlay}>
          <View style={styles.clearWrap} accessibilityLiveRegion="polite">
            <View style={styles.clearStack}>
              {clearDustAnimations.map((animation, index) => (
                <Animated.View
                  key={`clear-dust-${index}`}
                  style={[
                    styles.clearDust,
                    {
                      opacity: animation.opacity,
                      transform: [
                        { translateX: animation.translateX },
                        { translateY: animation.translateY },
                        { scale: animation.scale },
                      ],
                    },
                  ]}
                />
              ))}
              {clearStoneAnimations.map((animation, index) => (
                <Animated.View
                  key={`clear-stone-${index}`}
                  style={[
                    styles.clearStone,
                    clearStoneStyles[index],
                    {
                      opacity: animation.opacity,
                      transform: [
                        { translateY: animation.translateY },
                        { translateX: clearStoneTransforms[index].translateX },
                        { rotate: clearStoneTransforms[index].rotate },
                        { scale: animation.scale },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.clearTitle}>Your Cairn has been cleared.</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  hero: {
    height: 230,
    borderRadius: 8,
    backgroundColor: colors.line,
  },
  placeholder: {
    height: 230,
    borderRadius: 8,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  placeholderText: {
    color: colors.white,
    fontSize: type.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: type.title,
    fontWeight: '900',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeType: {
    color: colors.moss,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  muted: {
    color: colors.muted,
  },
  quickDetails: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailIcon: {
    width: 24,
    fontSize: 17,
  },
  detailText: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.ink,
    marginTop: 2,
  },
  coordinateText: {
    color: colors.muted,
    fontSize: type.small,
    marginTop: 2,
  },
  storyBlock: {
    gap: spacing.sm,
  },
  storyText: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '500',
  },
  notesBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.sm,
  },
  notesText: {
    color: colors.ink,
    fontSize: type.body,
    lineHeight: 24,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: 104,
    height: 104,
    borderRadius: 8,
  },
  photoViewer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32, 40, 34, 0.96)',
  },
  viewerClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    zIndex: 1,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '82%',
  },
  viewerPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(250, 248, 242, 0.95)',
  },
  clearWrap: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  clearStack: {
    width: 132,
    height: 112,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  clearStone: {
    position: 'absolute',
    backgroundColor: colors.pine,
  },
  clearStone0: {
    bottom: 0,
    width: 96,
    height: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 24,
  },
  clearStone1: {
    bottom: 24,
    width: 68,
    height: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 18,
    backgroundColor: colors.moss,
  },
  clearStone2: {
    bottom: 51,
    width: 42,
    height: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 21,
    backgroundColor: colors.ink,
  },
  clearStone3: {
    bottom: 76,
    width: 25,
    height: 18,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 12,
    backgroundColor: colors.pine,
  },
  clearDust: {
    position: 'absolute',
    left: 62,
    bottom: 2,
    width: 6,
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.stone,
  },
  clearTitle: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionLabel: {
    color: colors.ink,
    fontWeight: '800',
  },
  deleteLabel: {
    color: colors.danger,
  },
});
