import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/theme';
import { PLACE_TYPES, PlaceType } from '@/types/cairn';

type Props = {
  value: PlaceType;
  onChange: (value: PlaceType) => void;
};

export function PlaceTypePicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {PLACE_TYPES.map((placeType) => {
        const selected = placeType === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={placeType}
            onPress={() => onChange(placeType)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{placeType}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  selected: {
    backgroundColor: colors.moss,
    borderColor: colors.moss,
  },
  label: {
    color: colors.ink,
    fontWeight: '600',
  },
  selectedLabel: {
    color: colors.white,
  },
});
