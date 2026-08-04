import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { getCairn } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { Cairn, PLACE_TYPE_ICONS } from '@/types/cairn';
import { createSharedCairnFile, createSharedCairnPackage, sharedCairnFilename } from '@/utils/sharedCairn';

export default function ShareCairn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cairn, setCairn] = useState<Cairn | null>(null);
  const [includeReferenceNotes, setIncludeReferenceNotes] = useState(true);
  const [includeCoverPhoto, setIncludeCoverPhoto] = useState(true);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getCairn(id).then(setCairn);
    }, [id]),
  );

  async function packageJson(includePhoto = includeCoverPhoto) {
    if (!cairn) return null;

    return createSharedCairnPackage(cairn, {
      includeReferenceNotes,
      includeCoverPhoto: includePhoto,
      creatorName: 'Matt',
    });
  }

  async function copyPackage() {
    const json = await packageJson(false);
    if (!json || !cairn) return;

    try {
      await Clipboard.setStringAsync(json);
      Alert.alert('Cairn copied', `${cairn.name} was copied without the cover photo. Use the .cairn file to include photos.`);
    } catch {
      Alert.alert('Copy failed', 'Cairn could not copy the fallback package.');
    }
  }

  async function openShareSheet() {
    if (!cairn || sharing) return;

    setSharing(true);
    try {
      const file = await createSharedCairnFile(cairn, {
        includeReferenceNotes,
        includeCoverPhoto,
        creatorName: 'Matt',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: `Share ${sharedCairnFilename(cairn.name)}`,
          UTI: 'public.json',
        });
      } else {
        await Share.share(
          {
            title: sharedCairnFilename(cairn.name),
            message: await packageJson(false) ?? '',
          },
          {
            dialogTitle: `Share ${cairn.name}`,
            subject: sharedCairnFilename(cairn.name),
          },
        );
      }
      router.replace(`/cairn/${id}/share/success`);
    } catch {
      Alert.alert('Share failed', 'Cairn could not open the share sheet.');
    } finally {
      setSharing(false);
    }
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
      <Stack.Screen options={{ title: 'Share Cairn' }} />
      <View style={styles.headerCard}>
        {primaryPhoto ? (
          <Image source={{ uri: primaryPhoto.localUri }} style={styles.hero} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Feather name="map-pin" size={28} color={colors.moss} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Share the place</Text>
          <Text style={styles.title}>{cairn.name}</Text>
          <Text style={styles.meta}>{PLACE_TYPE_ICONS[cairn.placeType]} {cairn.placeType}</Text>
        </View>
      </View>

      <Text style={styles.philosophy}>A Cairn can be shared, but a story cannot. The receiver gets the place and builds their own journey.</Text>
      <View style={styles.packageNote}>
        <Feather name="file-text" size={18} color={colors.moss} />
        <Text style={styles.packageNoteText}>Cairn shares a small .cairn package that can be opened by another Cairn app.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Included</Text>
        <ChecklistItem label="Name and location" checked />
        <ChecklistItem label="Place type" checked />
        <ChecklistItem label="Tags" checked />
        <ChecklistItem label="Created by Matt" checked />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Optional</Text>
        <ToggleRow
          label="Reference Notes"
          description="Share practical information about the place."
          value={includeReferenceNotes}
          onValueChange={setIncludeReferenceNotes}
        />
        <ToggleRow
          label="Cover Photo"
          description="Share only the hero image, not the full gallery."
          value={includeCoverPhoto}
          disabled={!primaryPhoto}
          onValueChange={setIncludeCoverPhoto}
        />
      </View>

      <View style={styles.excludedCard}>
        <Text style={styles.sectionTitle}>Not shared</Text>
        <ExcludedItem label="Story" />
        <ExcludedItem label="Visit History" />
        <ExcludedItem label="All other photos" />
      </View>

      <View style={styles.actions}>
        <Button label={sharing ? 'Sharing...' : 'Share .cairn File'} onPress={openShareSheet} disabled={sharing} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy Cairn fallback package"
          onPress={copyPackage}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Feather name="copy" size={18} color={colors.moss} />
          <Text style={styles.copyText}>Copy Fallback</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Feather name={checked ? 'check-square' : 'square'} size={18} color={colors.moss} />
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

function ExcludedItem({ label }: { label: string }) {
  return (
    <View style={styles.checkRow}>
      <Feather name="x" size={18} color={colors.danger} />
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.disabled]}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{disabled ? 'No cover photo available.' : description}</Text>
      </View>
      <Switch disabled={disabled} value={!disabled && value} onValueChange={onValueChange} trackColor={{ true: colors.fern }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 160,
    gap: spacing.md,
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
  headerCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.sm,
  },
  hero: {
    width: 108,
    height: 108,
    borderRadius: 8,
  },
  heroPlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sage,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  eyebrow: {
    color: colors.moss,
    fontSize: type.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  meta: {
    color: colors.muted,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  philosophy: {
    color: colors.ink,
    fontSize: type.body,
    lineHeight: 24,
    fontWeight: '600',
  },
  packageNote: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.28)',
    padding: spacing.sm,
  },
  packageNoteText: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: type.small,
    lineHeight: 19,
    fontWeight: '700',
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.sm,
  },
  excludedCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(158, 61, 50, 0.18)',
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: type.body,
    fontWeight: '900',
  },
  checkRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkText: {
    color: colors.ink,
    fontWeight: '700',
  },
  toggleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    color: colors.ink,
    fontWeight: '900',
  },
  toggleDescription: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 19,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.5,
  },
  actions: {
    gap: spacing.sm,
  },
  copyButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  copyText: {
    color: colors.moss,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
