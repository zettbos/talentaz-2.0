"use client";

import { useCallback, useEffect, useState } from "react";
import { CACHE_STALE_MS, useDataCache } from "@/components/DataCacheContext";

/**
 * Queries and caches JSON API responses with instant cache hydration
 * and background SWR revalidation once cached entries become stale.
 */
export function useCachedQuery<T>(
  cacheKey: string,
  url: string,
  fallbackError: string
) {
  const { getCacheEntry, fetchWithDedupe, cacheVersion } = useDataCache();
  const [data, setData] = useState<T | null>(
    () => getCacheEntry<T>(cacheKey)?.data ?? null
  );
  const [loading, setLoading] = useState<boolean>(
    () => !getCacheEntry<T>(cacheKey)
  );
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await fetchWithDedupe<T>(cacheKey, url, fallbackError);
      setData(result);
      return result;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : fallbackError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fallbackError, fetchWithDedupe, url]);

  useEffect(() => {
    let cancelled = false;
    const entry = getCacheEntry<T>(cacheKey);

    if (entry !== undefined) {
      queueMicrotask(() => {
        if (!cancelled) {
          setData(entry.data);
          setLoading(false);
          setErrorMsg("");
        }
      });

      // Stale-while-revalidate silently without blocking the active view.
      if (Date.now() - entry.updatedAt > CACHE_STALE_MS) {
        fetchWithDedupe<T>(cacheKey, url, fallbackError)
          .then((fresh) => {
            if (!cancelled) {
              setData(fresh);
            }
          })
          .catch(() => {});
      }

      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setErrorMsg("");
      }
    });

    fetchWithDedupe<T>(cacheKey, url, fallbackError)
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setErrorMsg("");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : fallbackError);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, cacheVersion, fallbackError, fetchWithDedupe, getCacheEntry, url]);

  return { data, loading, errorMsg, refetch: fetchNow };
}
