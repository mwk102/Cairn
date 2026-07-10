import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export function CairnMarker() {
  return (
    <View collapsable={false} pointerEvents="none" style={styles.wrap}>
      <View collapsable={false} style={styles.badge}>
        <View collapsable={false} style={styles.stack}>
          <View style={styles.stoneSmall} />
          <View style={styles.stoneMid} />
          <View style={styles.stoneLarge} />
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
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stoneSmall: {
    width: 8,
    height: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
    marginBottom: 2,
  },
  stoneMid: {
    width: 15,
    height: 5,
    borderRadius: 9,
    backgroundColor: colors.white,
    marginBottom: 2,
  },
  stoneLarge: {
    width: 21,
    height: 5,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
});
