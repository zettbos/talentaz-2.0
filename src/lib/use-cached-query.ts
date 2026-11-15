"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataCache } from "@/components/DataCacheContext";

export function useCachedQuery<T>(
  cacheKey: string,
  url: string,
  fallbackError: string
) {
  const { getCached, setCached, cacheVersion } = useDataCache();
  const [data, setData] = useState<T | null>(() => getCached<T>(cacheKey) ?? null);
  const [loading, setLoading] = useState<boolean>(() => !getCached<T>(cacheKey));
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchNow = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || fallbackError);
      }
      setCached(cacheKey, json as T);
      setData(json as T);
      return json as T;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : fallbackError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, fallbackError, setCached, url]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCached<T>(cacheKey);

    if (cached !== undefined) {
      queueMicrotask(() => {
        if (!cancelled) {
          setData(cached);
          setLoading(false);
          setErrorMsg("");
        }
      });
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

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || fallbackError);
        }
        if (cancelled) return;
        setCached(cacheKey, json as T);
        setData(json as T);
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
  }, [cacheKey, cacheVersion, fallbackError, getCached, setCached, url]);

  return { data, loading, errorMsg, refetch: fetchNow };
}
