import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export function useCurrentLocation() {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setPermissionDenied(true);
        return null;
      }
      setPermissionDenied(false);
      const position = await Location.getCurrentPositionAsync({});
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoordinate(next);
      return next;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coordinate, loading, permissionDenied, requestLocation };
}
