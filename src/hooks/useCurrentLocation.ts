import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

import { getStoredLastKnownCoordinate, setStoredLastKnownCoordinate } from '@/data/settings';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

type LocationSource = 'fresh' | 'device-last-known' | 'stored-last-known' | null;

export function useCurrentLocation() {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        setLocationUnavailable(false);
        setLocationSource(null);
        return null;
      }
      setPermissionDenied(false);
      let position: Location.LocationObject | null = null;
      let source: LocationSource = 'fresh';
      try {
        position = await Location.getCurrentPositionAsync({});
      } catch {
        position = await Location.getLastKnownPositionAsync();
        source = 'device-last-known';
      }

      if (position) {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinate(next);
        setLocationSource(source);
        setLocationUnavailable(source !== 'fresh');
        await setStoredLastKnownCoordinate(next);
        return next;
      }

      const stored = await getStoredLastKnownCoordinate();

      if (!stored) {
        setLocationUnavailable(true);
        setLocationSource(null);
        return null;
      }

      setCoordinate(stored);
      setLocationSource('stored-last-known');
      setLocationUnavailable(true);
      return stored;
    } catch {
      setLocationUnavailable(true);
      setLocationSource(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    coordinate,
    loading,
    permissionDenied,
    locationUnavailable,
    locationSource,
    requestLocation,
  };
}
