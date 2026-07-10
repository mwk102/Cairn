import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CairnMarker } from '@/components/CairnMarker';
import { setOnboardingComplete } from '@/data/settings';
import { colors, spacing, type } from '@/theme';

export default function Welcome() {
  async function continueToMap() {
    await setOnboardingComplete();
    router.replace('/map');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <CairnMarker />
        <Text style={styles.title}>CAIRN</Text>
        <Text style={styles.tagline}>Your place journal.</Text>
      </View>
      <Button label="Continue" onPress={continueToMap} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: 42,
    letterSpacing: 0,
    fontWeight: '800',
  },
  tagline: {
    color: colors.ink,
    fontSize: type.heading,
  },
});
