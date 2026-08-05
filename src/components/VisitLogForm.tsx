import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { PhotoStrip } from '@/components/PhotoStrip';
import { colors, spacing, type } from '@/theme';
import { VisitLog, VisitLogInput } from '@/types/cairn';
import { formatDateInput, parseDateInput } from '@/utils/date';
import { existingPhotoUris } from '@/utils/photoStorage';

type Props = {
  initial?: VisitLog;
  submitLabel: string;
  onSubmit: (input: VisitLogInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function VisitLogForm({ initial, submitLabel, onSubmit, onDelete }: Props) {
  const [visitDateText, setVisitDateText] = useState(formatDateInput(initial?.visitDate ?? new Date().toISOString()));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [photos, setPhotos] = useState(initial?.photos.map((photo) => photo.localUri) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const visitDate = parseDateInput(visitDateText);

    if (!visitDate) {
      setError('Use YYYY-MM-DD, like 2026-07-10.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ visitDate, notes, photos: existingPhotoUris(photos) });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!onDelete) return;

    Alert.alert('Delete this visit?', 'This journal entry will be removed from the Cairn.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={styles.iconCircle}>
            <Feather name="book-open" size={22} color={colors.moss} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.title}>Log Visit</Text>
            <Text style={styles.help}>Add another page to this place&apos;s history.</Text>
          </View>
        </View>
        <Field
          label="Visit date"
          value={visitDateText}
          onChangeText={(value) => {
            setVisitDateText(value);
            setError(null);
          }}
          placeholder="2026-07-10"
          keyboardType="numbers-and-punctuation"
          inputMode="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          error={error ?? undefined}
        />
        <Field
          label="What happened?"
          value={notes}
          onChangeText={setNotes}
          placeholder="Beautiful weather. Found more berries than last year."
          multiline
          maxLength={800}
          style={styles.notes}
        />
        <PhotoStrip photos={photos} onChange={setPhotos} />
        <Button label={submitLabel} onPress={save} disabled={saving} />
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete visit"
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={20} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Visit</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 180,
    gap: spacing.md,
  },
  intro: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(49, 86, 66, 0.14)',
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
    marginTop: 2,
  },
  notes: {
    minHeight: 170,
    textAlignVertical: 'top',
  },
  deleteButton: {
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
  deleteText: {
    color: colors.danger,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
