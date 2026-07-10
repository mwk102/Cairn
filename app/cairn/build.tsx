import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { CairnForm } from '@/components/CairnForm';
import { createCairn } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { CairnInput } from '@/types/cairn';

export default function BuildCairn() {
  const [builtCairnId, setBuiltCairnId] = useState<string | null>(null);
  const stoneStyles = [styles.stone0, styles.stone1, styles.stone2, styles.stone3];
  const stoneAnimations = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(18),
      scale: new Animated.Value(0.86),
    })),
  ).current;

  useEffect(() => {
    if (!builtCairnId) return;

    const steps = stoneAnimations.map((animation) =>
      Animated.parallel([
        Animated.timing(animation.opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(animation.translateY, {
          toValue: 0,
          speed: 16,
          bounciness: 8,
          useNativeDriver: true,
        }),
        Animated.spring(animation.scale, {
          toValue: 1,
          speed: 16,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.sequence(steps).start();
    const timeout = window.setTimeout(() => {
      router.replace(`/cairn/${builtCairnId}`);
    }, 1900);

    return () => window.clearTimeout(timeout);
  }, [builtCairnId, stoneAnimations]);

  async function submit(input: CairnInput) {
    const id = await createCairn(input);
    setBuiltCairnId(id);
  }

  return (
    <View style={styles.screen}>
      <CairnForm submitLabel="Build a Cairn" onSubmit={submit} />
      <Modal transparent visible={!!builtCairnId} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.animationWrap} accessibilityLiveRegion="polite">
            <View style={styles.stack}>
              {stoneAnimations.map((animation, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.stone,
                    stoneStyles[index],
                    {
                      opacity: animation.opacity,
                      transform: [
                        { translateY: animation.translateY },
                        { scale: animation.scale },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.title}>Your Cairn has been built.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(250, 248, 242, 0.94)',
  },
  animationWrap: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  stack: {
    height: 112,
    width: 132,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stone: {
    position: 'absolute',
    backgroundColor: colors.pine,
  },
  stone0: {
    bottom: 0,
    width: 92,
    height: 18,
    borderRadius: 9,
  },
  stone1: {
    bottom: 24,
    width: 64,
    height: 20,
    borderRadius: 12,
    backgroundColor: colors.moss,
  },
  stone2: {
    bottom: 51,
    width: 44,
    height: 18,
    borderRadius: 10,
    backgroundColor: colors.ink,
  },
  stone3: {
    bottom: 76,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.pine,
  },
  title: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
});
