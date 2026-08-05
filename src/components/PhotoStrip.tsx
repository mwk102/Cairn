import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { persistPickedPhotos } from '@/utils/photoStorage';

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

export function PhotoStrip({ photos, onChange }: Props) {
  async function addPhoto() {
    if (photos.length >= 10) {
      Alert.alert('Photo limit reached', 'Each Cairn can keep up to 10 photos for now.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10 - photos.length,
    });

    if (!result.canceled) {
      const persistedPhotos = await persistPickedPhotos(result.assets.map((asset) => asset.uri));
      const savedPhotos = persistedPhotos
        .filter((photo) => photo.ok)
        .map((photo) => photo.uri);
      const failedCount = persistedPhotos.length - savedPhotos.length;

      if (savedPhotos.length > 0) {
        onChange([...photos, ...savedPhotos].slice(0, 10));
      }

      if (failedCount > 0) {
        Alert.alert(
          'Some photos could not be added',
          `${failedCount} ${failedCount === 1 ? 'photo was' : 'photos were'} not readable. The rest were saved to Cairn.`,
        );
      }
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
            <PhotoTile
              key={uri}
              uri={uri}
              onRemove={() => onChange(photos.filter((photo) => photo !== uri))}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function PhotoTile({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  const [missing, setMissing] = useState(false);
  const settle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    settle.setValue(0);
    Animated.spring(settle, {
      toValue: 1,
      speed: 18,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [settle, uri]);

  return (
    <Animated.View
      style={[
        styles.photoWrap,
        {
          opacity: settle,
          transform: [
            {
              scale: settle.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        },
      ]}
    >
      {missing ? (
        <View style={styles.missingPhoto}>
          <Feather name="image" size={18} color={colors.muted} />
          <Text style={styles.missingText}>Missing</Text>
        </View>
      ) : (
        <Image source={{ uri }} style={styles.photo} onError={() => setMissing(true)} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        onPress={onRemove}
        style={styles.remove}
      >
        <Feather name="x" size={16} color={colors.white} />
      </Pressable>
    </Animated.View>
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
  missingPhoto: {
    width: 82,
    height: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.cream,
  },
  missingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
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
