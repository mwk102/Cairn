import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { router, Stack } from 'expo-router';

import { Button } from '@/components/Button';
import { colors, spacing, type } from '@/theme';
import { PLACE_TYPE_ICONS } from '@/types/cairn';
import { formatCoordinates } from '@/utils/coordinates';
import { formatDate } from '@/utils/date';
import {
  DuplicateCandidate,
  duplicateCandidatesForSharedCairn,
  importSharedCairnPackage,
  parseSharedCairnPackage,
  SharedCairnPackage,
} from '@/utils/sharedCairn';

export default function ReceiveSharedCairn() {
  const [packageData, setPackageData] = useState<SharedCairnPackage | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const coverUri = useMemo(() => {
    if (!packageData?.coverPhoto) return null;
    return `data:${packageData.coverPhoto.mimeType};base64,${packageData.coverPhoto.base64}`;
  }, [packageData]);

  async function loadPackage(json: string) {
    const parsed = parseSharedCairnPackage(json);
    setPackageData(parsed);
    setDuplicates(await duplicateCandidatesForSharedCairn(parsed));
  }

  async function pastePackage() {
    setBusy(true);
    try {
      await loadPackage(await Clipboard.getStringAsync());
    } catch (error) {
      Alert.alert('Could not read Cairn', error instanceof Error ? error.message : 'The clipboard does not contain a Cairn share package.');
    } finally {
      setBusy(false);
    }
  }

  async function pickPackageFile() {
    setBusy(true);
    try {
      const picked = await File.pickFileAsync();
      const file = Array.isArray(picked) ? picked[0] : picked;
      await loadPackage(await file.text());
    } catch {
      Alert.alert('Could not open file', 'Choose a .cairn package that was shared from Cairn.');
    } finally {
      setBusy(false);
    }
  }

  async function addCairn() {
    if (!packageData || busy) return;

    setBusy(true);
    try {
      const id = await importSharedCairnPackage(packageData);
      router.replace(`/share/receive/success?id=${id}`);
    } catch {
      Alert.alert('Could not add Cairn', 'Cairn could not save this shared place.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Receive Cairn',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Cairn menu"
              onPress={() => router.replace('/map?menu=main')}
              style={styles.headerBackButton}
            >
              <Feather name="arrow-left" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />
      {!packageData ? (
        <View style={styles.emptyCard}>
          <View style={styles.fileIcon}>
            <Feather name="file-text" size={36} color={colors.moss} />
          </View>
          <Text style={styles.title}>Receive Cairn</Text>
          <Text style={styles.help}>Open a .cairn package someone shared with you.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose Cairn package file"
            onPress={pickPackageFile}
            style={({ pressed }) => [styles.primaryFileButton, pressed && styles.pressed]}
          >
            <Feather name="folder" size={18} color={colors.white} />
            <Text style={styles.primaryFileText}>Choose .cairn File</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste Cairn text backup from clipboard"
            onPress={pastePackage}
            disabled={busy}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Feather name="clipboard" size={18} color={colors.moss} />
            <Text style={styles.secondaryText}>{busy ? 'Reading...' : 'Paste Text Backup'}</Text>
          </Pressable>
          <Text style={styles.backupHelp}>Text Backup is only needed if someone could not send the .cairn file.</Text>
        </View>
      ) : (
        <>
          <View style={styles.previewCard}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.hero} />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Feather name="map-pin" size={30} color={colors.moss} />
              </View>
            )}
            <View style={styles.previewBody}>
              <Text style={styles.title}>{packageData.name}</Text>
              <Text style={styles.meta}>{PLACE_TYPE_ICONS[packageData.placeType]} {packageData.placeType}</Text>
              <Text style={styles.coordinates}>{formatCoordinates(packageData)}</Text>
              {packageData.tags.length > 0 ? (
                <View style={styles.tags}>
                  {packageData.tags.map((tag) => (
                    <Text key={tag} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {duplicates.length > 0 ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>Possible Duplicate Found</Text>
              <Text style={styles.help}>You already have a Cairn near this location.</Text>
              {duplicates.slice(0, 2).map((candidate) => (
                <Pressable
                  accessibilityRole="button"
                  key={candidate.id}
                  onPress={() => router.push(`/cairn/${candidate.id}`)}
                  style={({ pressed }) => [styles.duplicateRow, pressed && styles.pressed]}
                >
                  <View style={styles.duplicateText}>
                    <Text style={styles.duplicateName}>{candidate.name}</Text>
                    <Text style={styles.help}>{candidate.distanceKm.toFixed(1)} km away</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {packageData.referenceNotes ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Reference Notes</Text>
              <Text style={styles.notes}>{packageData.referenceNotes}</Text>
            </View>
          ) : null}

          <View style={styles.attributionCard}>
            <Feather name="user" size={18} color={colors.moss} />
            <View style={styles.attributionText}>
              <Text style={styles.attributionLabel}>Creator</Text>
              <Text style={styles.attributionTitle}>{packageData.createdBy.displayName}</Text>
              <Text style={styles.help}>Shared on {formatDate(packageData.sharedAt)}</Text>
            </View>
          </View>

          <Button label={busy ? 'Adding...' : 'Add to My Cairns'} onPress={addCairn} disabled={busy} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setPackageData(null)}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>Choose Another Package</Text>
          </Pressable>
        </>
      )}
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
    paddingBottom: 160,
    gap: spacing.md,
  },
  emptyCard: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },
  fileIcon: {
    width: 86,
    height: 86,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.45)',
  },
  title: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    lineHeight: 21,
  },
  secondaryButton: {
    minHeight: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  primaryFileButton: {
    minHeight: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.moss,
  },
  primaryFileText: {
    color: colors.white,
    fontWeight: '900',
  },
  secondaryText: {
    color: colors.moss,
    fontWeight: '900',
  },
  backupHelp: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 18,
    textAlign: 'center',
  },
  previewCard: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  hero: {
    height: 190,
    width: '100%',
  },
  heroPlaceholder: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sage,
  },
  previewBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  meta: {
    color: colors.moss,
    fontWeight: '900',
  },
  coordinates: {
    color: colors.muted,
    fontSize: type.small,
    fontWeight: '700',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.42)',
    color: colors.ink,
    fontSize: type.small,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  notes: {
    color: colors.ink,
    lineHeight: 24,
  },
  warningCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(178, 120, 75, 0.35)',
    backgroundColor: 'rgba(203, 216, 198, 0.25)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  duplicateRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.paper,
    padding: spacing.sm,
  },
  duplicateText: {
    flex: 1,
    minWidth: 0,
  },
  duplicateName: {
    color: colors.ink,
    fontWeight: '900',
  },
  attributionCard: {
    minHeight: 68,
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
  attributionLabel: {
    color: colors.moss,
    fontSize: type.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cancelButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.moss,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
