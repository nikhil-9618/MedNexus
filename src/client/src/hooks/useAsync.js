import { useCallback, useEffect, useRef, useState } from 'react';
import { apiError } from '../services/api.js';

/**
 * useAsync — tiny data hook.
 *   const { data, loading, error, refetch } = useAsync(() => api.get('/x'), []);
 */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fnRef.current(...args);
      setData(res?.data !== undefined ? res.data : res);
      return res;
    } catch (err) {
      setError(apiError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run, setData };
}

export default useAsync;
