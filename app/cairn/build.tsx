import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, StyleSheet, Text, Vibration, View } from 'react-native';
import { router } from 'expo-router';

import { CairnForm } from '@/components/CairnForm';
import { createCairn } from '@/data/cairns';
import { colors, spacing, type } from '@/theme';
import { CairnInput } from '@/types/cairn';

const CAIRN_MARKER_IMAGE = require('../../assets/markers/cairn-badge.png');

export default function BuildCairn() {
  const [builtCairnId, setBuiltCairnId] = useState<string | null>(null);
  const stoneStyles = [styles.stone0, styles.stone1, styles.stone2, styles.stone3];
  const dustStyles = [styles.dust0, styles.dust1, styles.dust2, styles.dust3, styles.dust4];
  const stoneTransforms = [
    { rotate: '2deg', translateX: 0 },
    { rotate: '-3deg', translateX: 3 },
    { rotate: '5deg', translateX: -2 },
    { rotate: '-7deg', translateX: 2 },
  ];
  const stoneAnimations = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(18),
      scale: new Animated.Value(0.86),
    })),
  ).current;
  const markerOpacity = useRef(new Animated.Value(0)).current;
  const markerScale = useRef(new Animated.Value(0.72)).current;
  const dustAnimations = useRef(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.7),
    })),
  ).current;

  useEffect(() => {
    if (!builtCairnId) return;

    Vibration.vibrate(25);
    markerOpacity.setValue(0);
    markerScale.setValue(0.72);
    dustAnimations.forEach((animation) => {
      animation.opacity.setValue(0);
      animation.translateX.setValue(0);
      animation.translateY.setValue(0);
      animation.scale.setValue(0.7);
    });

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
    const dustDrift = [
      { x: -34, y: -7 },
      { x: -19, y: -15 },
      { x: 18, y: -13 },
      { x: 34, y: -5 },
      { x: 3, y: -20 },
    ];
    const dustPuff = Animated.stagger(
      18,
      dustAnimations.map((animation, index) =>
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animation.opacity, {
              toValue: 0.42,
              duration: 90,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(animation.opacity, {
              toValue: 0,
              duration: 310,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animation.translateX, {
            toValue: dustDrift[index].x,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animation.translateY, {
            toValue: dustDrift[index].y,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animation.scale, {
            toValue: 1.15,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    Animated.sequence([
      ...steps.slice(0, -1),
      Animated.parallel([steps[steps.length - 1], dustPuff]),
      Animated.parallel([
        Animated.timing(markerOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(markerScale, {
          toValue: 1,
          speed: 14,
          bounciness: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    const timeout = window.setTimeout(() => {
      router.replace(`/cairn/${builtCairnId}`);
    }, 3100);

    return () => window.clearTimeout(timeout);
  }, [builtCairnId, dustAnimations, markerOpacity, markerScale, stoneAnimations]);

  async function submit(input: CairnInput) {
    const id = await createCairn(input);
    setBuiltCairnId(id);
  }

  return (
    <View style={styles.screen}>
      <CairnForm submitLabel="Build Cairn" onSubmit={submit} />
      <Modal transparent visible={!!builtCairnId} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.animationWrap} accessibilityLiveRegion="polite">
            <View style={styles.stack}>
              {dustAnimations.map((animation, index) => (
                <Animated.View
                  key={`dust-${index}`}
                  style={[
                    styles.dust,
                    dustStyles[index],
                    {
                      opacity: animation.opacity,
                      transform: [
                        { translateX: animation.translateX },
                        { translateY: animation.translateY },
                        { scale: animation.scale },
                      ],
                    },
                  ]}
                />
              ))}
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
                        { translateX: stoneTransforms[index].translateX },
                        { rotate: stoneTransforms[index].rotate },
                        { scale: animation.scale },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
            <Animated.View
              style={[
                styles.markerMoment,
                {
                  opacity: markerOpacity,
                  transform: [{ scale: markerScale }],
                },
              ]}
            >
              <Image source={CAIRN_MARKER_IMAGE} style={styles.markerImage} />
            </Animated.View>
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
  markerMoment: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  markerImage: {
    width: 60,
    height: 60,
  },
  dust: {
    position: 'absolute',
    bottom: 75,
    borderRadius: 99,
    backgroundColor: colors.stone,
  },
  dust0: {
    left: 47,
    width: 7,
    height: 5,
  },
  dust1: {
    left: 57,
    width: 5,
    height: 5,
    backgroundColor: colors.line,
  },
  dust2: {
    left: 68,
    width: 6,
    height: 4,
  },
  dust3: {
    left: 77,
    width: 5,
    height: 5,
    backgroundColor: colors.line,
  },
  dust4: {
    left: 62,
    width: 4,
    height: 4,
    backgroundColor: colors.clay,
  },
  stone: {
    position: 'absolute',
    backgroundColor: colors.pine,
  },
  stone0: {
    bottom: 0,
    width: 96,
    height: 18,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 24,
  },
  stone1: {
    bottom: 24,
    width: 68,
    height: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 18,
    backgroundColor: colors.moss,
  },
  stone2: {
    bottom: 51,
    width: 42,
    height: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 21,
    backgroundColor: colors.ink,
  },
  stone3: {
    bottom: 76,
    width: 25,
    height: 18,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 12,
    backgroundColor: colors.pine,
  },
  title: {
    color: colors.ink,
    fontSize: type.heading,
    fontWeight: '900',
    textAlign: 'center',
  },
});
