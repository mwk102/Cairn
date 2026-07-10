import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export function CairnMarker() {
  return (
    <View collapsable={false} pointerEvents="none" style={styles.wrap}>
      <View collapsable={false} style={styles.badge}>
        <View collapsable={false} style={styles.stack}>
          <View style={styles.stone0} />
          <View style={styles.stone1} />
          <View style={styles.stone2} />
          <View style={styles.stone3} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pine,
    borderWidth: 2,
    borderColor: colors.white,
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stack: {
    width: 26,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stone0: {
    width: 7,
    height: 5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 4,
    backgroundColor: colors.white,
    marginBottom: 1,
    transform: [{ rotate: '-7deg' }, { translateX: 1 }],
  },
  stone1: {
    width: 13,
    height: 5,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 2,
    transform: [{ rotate: '5deg' }, { translateX: -1 }],
  },
  stone2: {
    width: 20,
    height: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 1,
    transform: [{ rotate: '-3deg' }, { translateX: 1 }],
  },
  stone3: {
    width: 25,
    height: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 13,
    backgroundColor: colors.white,
    transform: [{ rotate: '2deg' }],
  },
});
