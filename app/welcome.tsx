import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { setOnboardingComplete } from '@/data/settings';
import { colors, spacing, type } from '@/theme';

function WelcomeLogo() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logo}>
      <View style={styles.logoStone0} />
      <View style={styles.logoStone1} />
      <View style={styles.logoStone2} />
      <View style={styles.logoStone3} />
    </View>
  );
}

function WelcomeLandscape() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.landscape}>
      <View style={[styles.mountain, styles.mountainBackLeft]} />
      <View style={[styles.mountain, styles.mountainBackRight]} />
      <View style={[styles.mountain, styles.mountainFrontLeft]} />
      <View style={[styles.mountain, styles.mountainFrontRight]} />
      <View style={styles.river} />
      <View style={[styles.tree, styles.treeLeft0]} />
      <View style={[styles.tree, styles.treeLeft1]} />
      <View style={[styles.tree, styles.treeRight0]} />
      <View style={[styles.tree, styles.treeRight1]} />
    </View>
  );
}

export default function Welcome() {
  async function continueToMap() {
    await setOnboardingComplete();
    router.replace('/map');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <WelcomeLogo />
          <Text style={styles.title}>CAIRN</Text>
          <Text style={styles.tagline}>Your place journal.</Text>
        </View>
        <WelcomeLandscape />
      </View>
      <Button label="Continue as Guest" onPress={continueToMap} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 84,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 96,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  logoStone0: {
    width: 19,
    height: 13,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 9,
    backgroundColor: colors.ink,
    marginBottom: 5,
    transform: [{ rotate: '-7deg' }, { translateX: 3 }],
  },
  logoStone1: {
    width: 39,
    height: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 18,
    backgroundColor: colors.ink,
    marginBottom: 6,
    transform: [{ rotate: '5deg' }, { translateX: -2 }],
  },
  logoStone2: {
    width: 66,
    height: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 20,
    backgroundColor: colors.ink,
    marginBottom: 5,
    transform: [{ rotate: '-3deg' }, { translateX: 2 }],
  },
  logoStone3: {
    width: 92,
    height: 21,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 32,
    backgroundColor: colors.ink,
    transform: [{ rotate: '2deg' }],
  },
  title: {
    color: colors.ink,
    fontSize: 36,
    letterSpacing: 0,
    fontWeight: '900',
  },
  tagline: {
    color: colors.ink,
    fontSize: type.body,
  },
  landscape: {
    width: '100%',
    height: 210,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  mountain: {
    position: 'absolute',
    bottom: 34,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.stone,
  },
  mountainBackLeft: {
    left: -30,
    borderLeftWidth: 118,
    borderRightWidth: 118,
    borderBottomWidth: 98,
    opacity: 0.42,
  },
  mountainBackRight: {
    right: -42,
    borderLeftWidth: 126,
    borderRightWidth: 126,
    borderBottomWidth: 110,
    opacity: 0.42,
  },
  mountainFrontLeft: {
    left: 32,
    bottom: 24,
    borderLeftWidth: 118,
    borderRightWidth: 118,
    borderBottomWidth: 116,
    opacity: 0.58,
  },
  mountainFrontRight: {
    right: 36,
    bottom: 20,
    borderLeftWidth: 106,
    borderRightWidth: 106,
    borderBottomWidth: 104,
    opacity: 0.56,
  },
  river: {
    position: 'absolute',
    bottom: -54,
    left: '38%',
    width: 66,
    height: 190,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 253, 250, 0.78)',
    transform: [{ rotate: '21deg' }],
  },
  tree: {
    position: 'absolute',
    bottom: 22,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 54,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.muted,
    opacity: 0.62,
  },
  treeLeft0: {
    left: 18,
  },
  treeLeft1: {
    left: 48,
    bottom: 30,
    transform: [{ scale: 0.78 }],
  },
  treeRight0: {
    right: 24,
  },
  treeRight1: {
    right: 58,
    bottom: 31,
    transform: [{ scale: 0.82 }],
  },
});
