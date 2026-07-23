import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function canUseNativeMap() {
  if (Platform.OS !== 'android') return true;
  if (Constants.appOwnership === 'expo') return true;

  return Constants.expoConfig?.extra?.hasGoogleMapsApiKey === true;
}
