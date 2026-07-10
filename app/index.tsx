import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { isOnboardingComplete } from '@/data/settings';
import { colors } from '@/theme';

export default function Index() {
  useEffect(() => {
    async function route() {
      const complete = await isOnboardingComplete();
      router.replace(complete ? '/map' : '/welcome');
    }
    route();
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.moss} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
});
