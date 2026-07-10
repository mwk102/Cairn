import { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { deleteCairn, getCairn, setCairnFavorite } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { Cairn } from '@/types/cairn';
import { formatCoordinate, formatDate } from '@/utils/date';

export default function CairnDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cairn, setCairn] = useState<Cairn | null>(null);
  const [viewingPhotoUri, setViewingPhotoUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getCairn(id).then(setCairn);
    }, [id]),
  );

  function confirmDelete() {
    if (!id) return;
    Alert.alert('Delete this Cairn?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCairn(id);
          router.replace('/map');
        },
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {primaryPhoto ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="View hero photo"
          onPress={() => setViewingPhotoUri(primaryPhoto.localUri)}
        >
          <Image source={{ uri: primaryPhoto.localUri }} style={styles.hero} />
        </Pressable>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>A place worth returning to.</Text>
        </View>
      )}
      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{cairn.name}</Text>
          <Text style={styles.muted}>{cairn.placeType}</Text>
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
      <View style={styles.card}>
        <Text style={styles.label}>Coordinates</Text>
        <Text style={styles.body}>{formatCoordinate(cairn.latitude)}, {formatCoordinate(cairn.longitude)}</Text>
        <Text style={styles.label}>Date created</Text>
        <Text style={styles.body}>{formatDate(cairn.createdAt)}</Text>
        <Text style={styles.label}>Last visited</Text>
        <Text style={styles.body}>{formatDate(cairn.lastVisitedAt)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Notes</Text>
        <Text style={styles.body}>{cairn.notes || 'No notes yet.'}</Text>
      </View>
      {cairn.photos.length > 1 ? (
        <View style={styles.photoGrid}>
          {cairn.photos
            .filter((photo) => photo.id !== primaryPhoto?.id)
            .map((photo) => (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="View Cairn photo"
                key={photo.id}
                onPress={() => setViewingPhotoUri(photo.localUri)}
              >
                <Image source={{ uri: photo.localUri }} style={styles.thumb} />
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
      <Button label="Back to My Cairns" variant="secondary" onPress={() => router.replace('/map')} />
      <Modal
        animationType="fade"
        transparent
        visible={!!viewingPhotoUri}
        onRequestClose={() => setViewingPhotoUri(null)}
      >
        <View style={styles.photoViewer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setViewingPhotoUri(null)}
            style={styles.viewerClose}
          >
            <Feather name="x" size={26} color={colors.white} />
          </Pressable>
          {viewingPhotoUri ? (
            <Image source={{ uri: viewingPhotoUri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
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
  muted: {
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  body: {
    color: colors.ink,
    fontSize: type.body,
    lineHeight: 23,
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
