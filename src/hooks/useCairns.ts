import { useCallback, useState } from 'react';

import { listCairns } from '@/data/cairns';
import { Cairn } from '@/types/cairn';

export function useCairns() {
  const [cairns, setCairns] = useState<Cairn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setCairns(await listCairns());
    } catch {
      setError('Cairns could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { cairns, loading, error, reload };
}
