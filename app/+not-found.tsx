import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export default function NotFound() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>This Cairn is out of view.</Text>
      <Link href="/map" style={styles.link}>Return to My Cairns</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.cream,
  },
  title: {
    color: colors.ink,
    fontWeight: '800',
  },
  link: {
    color: colors.moss,
    fontWeight: '800',
  },
});
