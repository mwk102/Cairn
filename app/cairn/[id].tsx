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
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { deleteCairn, getCairn, setCairnFavorite } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { Cairn, PLACE_TYPE_ICONS, VisitLog } from '@/types/cairn';
import { formatCoordinates } from '@/utils/coordinates';
import { formatDate } from '@/utils/date';

function formattedNoteLines(notes: string) {
  return notes
    .split(/\r?\n/)
    .map((line, index) => {
      const bulletMatch = line.match(/^\s*[-*\u2022]\s+(.+)$/);
      return {
        id: `${index}-${line}`,
        text: bulletMatch?.[1] ?? line.trim(),
        type: bulletMatch ? 'bullet' : line.trim() ? 'text' : 'space',
      };
    });
}

function previewText(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'No notes for this visit.';
  return trimmed.length > 150 ? `${trimmed.slice(0, 150)}...` : trimmed;
}

export default function CairnDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cairn, setCairn] = useState<Cairn | null>(null);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);
  const [showAllVisits, setShowAllVisits] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
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

  async function copyCoordinates() {
    if (!cairn) return;

    await Clipboard.setStringAsync(formatCoordinates(cairn));
    Alert.alert('Coordinates copied', formatCoordinates(cairn));
  }

  function confirmDelete() {
    if (!id) return;
    setActionMenuOpen(false);
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

  function openMenu() {
    setActionMenuOpen(true);
  }

  function renderVisit(visit: VisitLog, isLast: boolean) {
    const isLatest = cairn?.visitLogs[0]?.id === visit.id;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit visit from ${formatDate(visit.visitDate)}`}
        key={visit.id}
        onPress={() => router.push(`/cairn/${id}/visit/${visit.id}/edit`)}
        style={({ pressed }) => [styles.visitRow, isLatest && styles.latestVisitRow, pressed && styles.pressed]}
      >
        <View style={styles.timeline}>
          <View style={[styles.timelineDot, isLatest && styles.latestTimelineDot]} />
          {!isLast ? <View style={styles.timelineLine} /> : null}
        </View>
        <View style={styles.visitBody}>
          <View style={styles.visitHeaderRow}>
            <View style={styles.visitDateBlock}>
              {isLatest ? (
                <View style={styles.latestBadge}>
                  <Text style={styles.latestBadgeText}>Latest visit</Text>
                </View>
              ) : null}
              <Text style={styles.visitDate}>{formatDate(visit.visitDate)}</Text>
            </View>
            <View style={styles.visitEditHint}>
              <Feather name="edit-3" size={14} color={colors.moss} />
            </View>
          </View>
          <Text style={styles.visitNotes}>{previewText(visit.notes)}</Text>
          {visit.photos.length > 0 ? (
            <View style={styles.visitPhotos}>
              {visit.photos.slice(0, 3).map((photo) => {
                const photoIndex = cairn?.photos.findIndex((item) => item.id === photo.id) ?? -1;

                return (
                  <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View visit photo"
                    key={photo.id}
                    onPress={() => photoIndex >= 0 && setViewingPhotoIndex(photoIndex)}
                  >
                    <Image source={{ uri: photo.localUri }} style={styles.visitThumb} />
                  </Pressable>
                );
              })}
              {visit.photos.length > 3 ? (
                <View style={styles.visitMorePhotos}>
                  <Text style={styles.visitMorePhotosText}>+{visit.photos.length - 3}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
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
  const visibleVisits = showAllVisits ? cairn.visitLogs : cairn.visitLogs.slice(0, 3);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
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
          <View pointerEvents="box-none" style={[styles.heroControls, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
            >
              <Feather name="arrow-left" size={24} color={colors.ink} />
            </Pressable>
            <View style={styles.heroRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit photos"
                onPress={() => router.push(`/cairn/${id}/edit?section=photos`)}
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
              >
                <Feather name="image" size={21} color={colors.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More actions"
                onPress={openMenu}
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
              >
                <Feather name="more-horizontal" size={23} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{cairn.name}</Text>
              <Text style={styles.placeType}>{PLACE_TYPE_ICONS[cairn.placeType]} {cairn.placeType}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cairn.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              onPress={toggleFavorite}
              style={({ pressed }) => [styles.favoriteButton, pressed && styles.pressed]}
            >
              <MaterialIcons
                name={cairn.isFavorite ? 'star' : 'star-border'}
                size={30}
                color={cairn.isFavorite ? colors.clay : colors.muted}
              />
              <Text style={styles.favoriteText}>Favorite</Text>
            </Pressable>
          </View>

          <View style={styles.quickDetails}>
            <View style={styles.quickItem}>
              <Feather name="calendar" size={19} color={colors.moss} />
              <Text style={styles.detailLabel}>Built</Text>
              <Text style={styles.detailValue}>{formatDate(cairn.createdAt)}</Text>
            </View>
            <View style={styles.quickItem}>
              <Feather name="compass" size={19} color={colors.moss} />
              <Text style={styles.detailLabel}>Last Visited</Text>
              <Text style={styles.detailValue}>{formatDate(cairn.lastVisitedAt)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy saved coordinates"
              onPress={copyCoordinates}
              style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]}
            >
              <Feather name="map-pin" size={19} color={colors.moss} />
              <Text style={styles.detailLabel}>Coordinates</Text>
              <View style={styles.coordinateCopyRow}>
                <Text style={styles.coordinateText}>{formatCoordinates(cairn)}</Text>
                <Feather name="copy" size={13} color={colors.moss} />
              </View>
            </Pressable>
          </View>

          {cairn.tags.length > 0 ? (
            <View style={styles.tagsBlock}>
              {cairn.tags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {cairn.sharedByName ? (
            <View style={styles.attributionCard}>
              <Feather name="user" size={18} color={colors.moss} />
              <View style={styles.attributionText}>
                <Text style={styles.attributionTitle}>Creator: {cairn.sharedByName}</Text>
                <Text style={styles.attributionMeta}>
                  Shared with you{cairn.sharedAt ? ` on ${formatDate(cairn.sharedAt)}` : ''}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.storyCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Feather name="book-open" size={17} color={colors.moss} />
              </View>
              <Text style={styles.sectionTitle}>Story</Text>
            </View>
            <Text style={styles.storyText}>{cairn.story || 'No story yet.'}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Feather name="clock" size={17} color={colors.moss} />
                </View>
                <Text style={styles.sectionTitle}>Visit History</Text>
              </View>
              {cairn.visitLogs.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Log visit"
                  onPress={() => router.push(`/cairn/${id}/visit/new`)}
                  style={({ pressed }) => [styles.logVisitButton, pressed && styles.pressed]}
                >
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.logVisitText}>Log Visit</Text>
                </Pressable>
              ) : null}
            </View>
            {cairn.visitLogs.length > 0 ? (
              <View style={styles.visitList}>
                {visibleVisits.map((visit, index) => renderVisit(visit, index === visibleVisits.length - 1))}
                {cairn.visitLogs.length > 3 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllVisits((current) => !current)}
                    style={({ pressed }) => [styles.viewAllVisits, pressed && styles.pressed]}
                  >
                    <Text style={styles.viewAllVisitsText}>
                      {showAllVisits ? 'Show fewer visits' : 'View all visits'}
                    </Text>
                    <Feather name={showAllVisits ? 'chevron-up' : 'chevron-right'} size={18} color={colors.moss} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.emptyVisits}>
                <View style={styles.emptyVisitIcon}>
                  <Feather name="book-open" size={22} color={colors.moss} />
                </View>
                <Text style={styles.emptyTitle}>Start this place&apos;s history.</Text>
                <Text style={styles.emptyText}>Log what happened the next time you return, or add a past visit you want to remember.</Text>
                <Button label="Log Visit" onPress={() => router.push(`/cairn/${id}/visit/new`)} />
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Feather name="clipboard" size={17} color={colors.moss} />
              </View>
              <Text style={styles.sectionTitle}>Reference Notes</Text>
            </View>
            {cairn.notes ? (
              <View style={styles.notesFormatted}>
                {formattedNoteLines(cairn.notes).map((line) => {
                  if (line.type === 'space') {
                    return <View key={line.id} style={styles.noteSpacer} />;
                  }

                  if (line.type === 'bullet') {
                    return (
                      <View key={line.id} style={styles.noteBulletRow}>
                        <Text style={styles.noteBullet}>•</Text>
                        <Text style={styles.notesText}>{line.text}</Text>
                      </View>
                    );
                  }

                  return <Text key={line.id} style={styles.notesText}>{line.text}</Text>;
                })}
              </View>
            ) : (
              <Text style={styles.notesText}>No reference notes yet.</Text>
            )}
          </View>

          {cairn.photos.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Feather name="image" size={17} color={colors.moss} />
                  </View>
                  <Text style={styles.sectionTitle}>Photos</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View all photos"
                  onPress={() => setViewingPhotoIndex(0)}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
                >
                  <Text style={styles.textButtonLabel}>View All</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
                {cairn.photos.slice(0, 8).map((photo, index) => (
                  <Pressable
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View Cairn photo"
                    key={photo.id}
                    onPress={() => setViewingPhotoIndex(index)}
                  >
                    <Image source={{ uri: photo.localUri }} resizeMode="cover" style={styles.thumb} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Button label="Back to Cairn" variant="secondary" onPress={() => router.replace(`/map?cairn=${id}`)} />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={actionMenuOpen}
        onRequestClose={() => setActionMenuOpen(false)}
      >
        <Pressable style={styles.actionBackdrop} onPress={() => setActionMenuOpen(false)} />
        <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
          <View style={styles.actionHandle} />
          <View style={styles.actionHeader}>
            <View style={styles.actionTitleBlock}>
              <Text style={styles.actionTitle}>{cairn.name}</Text>
              <Text style={styles.actionSubtitle}>Cairn actions</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close actions"
              onPress={() => setActionMenuOpen(false)}
              style={styles.actionClose}
            >
              <Feather name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.actionList}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share Cairn"
              onPress={() => {
                setActionMenuOpen(false);
                router.push(`/cairn/${id}/share`);
              }}
              style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Feather name="share-2" size={18} color={colors.moss} />
              </View>
              <View style={styles.actionRowText}>
                <Text style={styles.actionRowTitle}>Share Cairn</Text>
                <Text style={styles.actionRowHelp}>Create a private .cairn package</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit Cairn"
              onPress={() => {
                setActionMenuOpen(false);
                router.push(`/cairn/${id}/edit`);
              }}
              style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            >
              <View style={styles.actionIcon}>
                <Feather name="edit-3" size={18} color={colors.moss} />
              </View>
              <View style={styles.actionRowText}>
                <Text style={styles.actionRowTitle}>Edit Cairn</Text>
                <Text style={styles.actionRowHelp}>Update details, photos, tags, and notes</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete Cairn"
              onPress={confirmDelete}
              style={({ pressed }) => [styles.actionRow, styles.actionRowDanger, pressed && styles.pressed]}
            >
              <View style={[styles.actionIcon, styles.actionIconDanger]}>
                <Feather name="trash-2" size={18} color={colors.danger} />
              </View>
              <View style={styles.actionRowText}>
                <Text style={[styles.actionRowTitle, styles.actionDangerText]}>Delete Cairn</Text>
                <Text style={styles.actionRowHelp}>Remove this place from your journal</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      </Modal>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  muted: {
    color: colors.muted,
  },
  pressed: {
    opacity: 0.72,
  },
  heroWrap: {
    height: 330,
    backgroundColor: colors.pine,
  },
  hero: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.line,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.pine,
  },
  placeholderText: {
    color: colors.white,
    fontSize: type.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroControls: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  heroRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 250, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: type.title,
    fontWeight: '900',
  },
  placeType: {
    color: colors.moss,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  favoriteButton: {
    minWidth: 72,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: -3,
  },
  quickDetails: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickItem: {
    flex: 1,
    minHeight: 92,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '700',
  },
  coordinateText: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  coordinateCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagsBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagChip: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.13)',
    backgroundColor: 'rgba(203, 216, 198, 0.38)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagChipText: {
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
    includeFontPadding: false,
  },
  attributionCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(178, 120, 75, 0.25)',
    backgroundColor: 'rgba(255, 253, 250, 0.86)',
    padding: spacing.md,
  },
  attributionText: {
    flex: 1,
    minWidth: 0,
  },
  attributionTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  attributionMeta: {
    color: colors.muted,
    fontSize: type.small,
    marginTop: 2,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.md,
  },
  storyCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.28)',
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.6)',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  storyText: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 29,
    fontWeight: '600',
  },
  logVisitButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.moss,
    paddingHorizontal: spacing.sm,
  },
  logVisitText: {
    color: colors.white,
    fontSize: type.small,
    fontWeight: '900',
  },
  visitList: {
    gap: spacing.sm,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    minHeight: 104,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  latestVisitRow: {
    backgroundColor: 'rgba(203, 216, 198, 0.22)',
  },
  timeline: {
    width: 16,
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: spacing.sm,
    backgroundColor: colors.moss,
  },
  latestTimelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.paper,
    backgroundColor: colors.clay,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    backgroundColor: 'rgba(49, 86, 66, 0.18)',
  },
  visitBody: {
    flex: 1,
    minWidth: 0,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(49, 86, 66, 0.1)',
  },
  visitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  visitDateBlock: {
    flex: 1,
    minWidth: 0,
  },
  latestBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(178, 120, 75, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  latestBadgeText: {
    color: colors.clay,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  visitDate: {
    color: colors.ink,
    fontWeight: '900',
  },
  visitEditHint: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.44)',
  },
  visitNotes: {
    color: colors.ink,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  visitPhotos: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  visitThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
  },
  visitMorePhotos: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.45)',
  },
  visitMorePhotosText: {
    color: colors.moss,
    fontWeight: '900',
  },
  viewAllVisits: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  viewAllVisitsText: {
    color: colors.moss,
    fontWeight: '900',
  },
  emptyVisits: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.12)',
    backgroundColor: 'rgba(203, 216, 198, 0.18)',
    padding: spacing.lg,
  },
  emptyVisitIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: 'center',
  },
  notesFormatted: {
    gap: 7,
  },
  noteBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteBullet: {
    width: 14,
    color: colors.moss,
    fontSize: type.body,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  noteSpacer: {
    height: spacing.xs,
  },
  notesText: {
    flex: 1,
    color: colors.ink,
    fontSize: type.body,
    lineHeight: 24,
  },
  textButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  textButtonLabel: {
    color: colors.moss,
    fontWeight: '900',
  },
  photoStrip: {
    gap: spacing.sm,
  },
  thumb: {
    width: 104,
    height: 104,
    borderRadius: 8,
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 40, 34, 0.28)',
  },
  actionSheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.16)',
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
  },
  actionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.line,
    marginTop: spacing.xs,
  },
  actionHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '700',
    marginTop: 2,
  },
  actionClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionList: {
    gap: spacing.sm,
  },
  actionRow: {
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
  actionRowDanger: {
    borderColor: 'rgba(158, 61, 50, 0.16)',
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.44)',
  },
  actionIconDanger: {
    backgroundColor: 'rgba(158, 61, 50, 0.1)',
  },
  actionRowText: {
    flex: 1,
    minWidth: 0,
  },
  actionRowTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '900',
  },
  actionRowHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    marginTop: 2,
  },
  actionDangerText: {
    color: colors.danger,
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
});
