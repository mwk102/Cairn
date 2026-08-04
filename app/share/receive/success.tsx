import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { colors, spacing, type } from '@/theme';

export default function ReceiveSuccess() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Cairn Added' }} />
      <View style={styles.checkCircle}>
        <Feather name="check" size={54} color={colors.white} />
      </View>
      <Text style={styles.title}>Cairn Added</Text>
      <Text style={styles.text}>This shared place has been added to your Cairns. Your story starts from here.</Text>
      <Button label="View Cairn" onPress={() => router.replace(`/cairn/${id}`)} style={styles.button} />
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
});
