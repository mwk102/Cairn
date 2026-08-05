import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useFocusEffect } from 'expo-router';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { getSharingIdentity, SharingIdentity, updateSharingDisplayName } from '@/data/settings';
import { colors, spacing, type } from '@/theme';

export default function SharingIdentityScreen() {
  const [identity, setIdentity] = useState<SharingIdentity | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSharingIdentity().then((nextIdentity) => {
        setIdentity(nextIdentity);
        setDisplayName(nextIdentity.displayName);
      });
    }, []),
  );

  async function save() {
    setSaving(true);
    try {
      const nextIdentity = await updateSharingDisplayName(displayName);
      setIdentity(nextIdentity);
      setDisplayName(nextIdentity.displayName);
      Alert.alert('Sharing identity saved', 'Future shared Cairns will use this creator name.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCreatorId() {
    if (!identity) return;
    await Clipboard.setStringAsync(identity.creatorId);
    Alert.alert('Creator ID copied');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Sharing Identity',
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
      <View style={styles.introCard}>
        <View style={styles.iconCircle}>
          <Feather name="user" size={22} color={colors.moss} />
        </View>
        <View style={styles.introText}>
          <Text style={styles.title}>Sharing Identity</Text>
          <Text style={styles.help}>This is only used for attribution when you share a Cairn.</Text>
        </View>
      </View>

      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Cairn User"
        autoCapitalize="words"
        autoCorrect={false}
      />

      <View style={styles.idCard}>
        <View style={styles.idText}>
          <Text style={styles.idLabel}>Creator ID</Text>
          <Text selectable style={styles.creatorId}>{identity?.creatorId ?? 'Loading...'}</Text>
          <Text style={styles.help}>This stays on your device and helps identify the creator of shared Cairns.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy creator ID"
          onPress={copyCreatorId}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Feather name="copy" size={18} color={colors.moss} />
        </Pressable>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>No account required</Text>
        <Text style={styles.noteText}>Your display name and creator ID are local to this installation of Cairn.</Text>
      </View>

      <Button label={saving ? 'Saving...' : 'Save Identity'} onPress={save} disabled={saving} />
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
  introCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(203, 216, 198, 0.5)',
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
  },
  help: {
    color: colors.muted,
    fontSize: type.small,
    lineHeight: 19,
    marginTop: 2,
  },
  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  idText: {
    flex: 1,
    minWidth: 0,
  },
  idLabel: {
    color: colors.ink,
    fontWeight: '900',
  },
  creatorId: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  copyButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  noteCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
    backgroundColor: 'rgba(203, 216, 198, 0.28)',
    padding: spacing.md,
  },
  noteTitle: {
    color: colors.ink,
    fontWeight: '900',
  },
  noteText: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: spacing.xs,
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
