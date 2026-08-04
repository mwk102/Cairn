import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { colors, spacing, type } from '@/theme';

export default function ShareSuccess() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Cairn Shared' }} />
      <View style={styles.checkCircle}>
        <Feather name="check" size={54} color={colors.white} />
      </View>
      <Text style={styles.title}>Cairn Shared</Text>
      <Text style={styles.text}>The place has been shared. Its story and visit history stayed on this device.</Text>
      <Button label="Done" onPress={() => router.replace(`/cairn/${id}`)} style={styles.button} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/map')}
        style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
      >
        <Text style={styles.textButtonLabel}>Back to Map</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cream,
  },
  checkCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fern,
  },
  title: {
    color: colors.ink,
    fontSize: type.title,
    fontWeight: '900',
    marginTop: spacing.lg,
  },
  text: {
    maxWidth: 300,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
  textButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  textButtonLabel: {
    color: colors.moss,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
