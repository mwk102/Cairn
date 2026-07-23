import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { persistPickedPhoto } from '@/utils/photoStorage';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

export function PhotoStrip({ photos, onChange }: Props) {
  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10 - photos.length,
    });
    if (!result.canceled) {
      const persistedPhotos = await Promise.all(
        result.assets.map((asset) => persistPickedPhoto(asset.uri)),
      );
      onChange([...photos, ...persistedPhotos].slice(0, 10));
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={addPhoto} style={styles.add}>
        <Feather name="camera" size={24} color={colors.moss} />
        <Text style={styles.addText}>Add Photos</Text>
        <Text style={styles.count}>{photos.length} / 10</Text>
      </Pressable>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((uri) => (
            <View key={uri} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => onChange(photos.filter((photo) => photo !== uri))}
                style={styles.remove}
              >
                <Feather name="x" size={16} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  add: {
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.white,
  },
  addText: {
    color: colors.ink,
    fontWeight: '700',
  },
  count: {
    color: colors.muted,
  },
  photos: {
    gap: spacing.sm,
  },
  photo: {
    width: 82,
    height: 82,
    borderRadius: 8,
  },
  photoWrap: {
    width: 82,
    height: 82,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pine,
  },
});
