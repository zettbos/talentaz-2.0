"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export interface CacheEntry<T = unknown> {
  data: T;
  updatedAt: number;
}

export const CACHE_STALE_MS = 15_000;

interface DataCacheContextValue {
  getCached: <T>(key: string) => T | undefined;
  getCacheEntry: <T>(key: string) => CacheEntry<T> | undefined;
  setCached: <T>(key: string, data: T) => void;
  fetchWithDedupe: <T>(
    key: string,
    url: string,
    fallbackError: string,
    transform?: (raw: unknown) => T | undefined
  ) => Promise<T>;
  prefetchQuery: <T>(
    key: string,
    url: string,
    transform?: (raw: unknown) => T | undefined
  ) => void;
  invalidatePrefix: (prefix: string) => void;
  clearAllCache: () => void;
  cacheVersion: number;
}

const DataCacheContext = createContext<DataCacheContextValue>({
  getCached: () => undefined,
  getCacheEntry: () => undefined,
  setCached: () => {},
  fetchWithDedupe: async () => {
    throw new Error("DataCacheProvider belum terpasang");
  },
  prefetchQuery: () => {},
  invalidatePrefix: () => {},
  clearAllCache: () => {},
  cacheVersion: 0,
});

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const getCached = useCallback(<T,>(key: string): T | undefined => {
    const entry = storeRef.current.get(key);
    return entry ? (entry.data as T) : undefined;
  }, []);

  const getCacheEntry = useCallback(<T,>(key: string): CacheEntry<T> | undefined => {
    const entry = storeRef.current.get(key);
    return entry ? (entry as CacheEntry<T>) : undefined;
  }, []);

  const setCached = useCallback(<T,>(key: string, data: T) => {
    storeRef.current.set(key, { data, updatedAt: Date.now() });
  }, []);

  const fetchWithDedupe = useCallback(
    <T,>(
      key: string,
      url: string,
      fallbackError: string,
      transform?: (raw: unknown) => T | undefined
    ): Promise<T> => {
      const existing = inFlightRef.current.get(key);
      if (existing) {
        return existing as Promise<T>;
      }

      const promise = (async () => {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            (json && typeof json.error === "string" && json.error) || fallbackError
          );
        }
        const value = transform ? transform(json) : (json as T);
        if (value !== undefined) {
          storeRef.current.set(key, { data: value, updatedAt: Date.now() });
        }
        return value as T;
      })().finally(() => {
        inFlightRef.current.delete(key);
      });

      inFlightRef.current.set(key, promise);
      return promise;
    },
    []
  );

  const prefetchQuery = useCallback(
    <T,>(
      key: string,
      url: string,
      transform?: (raw: unknown) => T | undefined
    ) => {
      const entry = storeRef.current.get(key);
      if (entry && Date.now() - entry.updatedAt < CACHE_STALE_MS) {
        return;
      }
      void fetchWithDedupe(key, url, "Gagal memuat pratinjau data.", transform).catch(
        () => {}
      );
    },
    [fetchWithDedupe]
  );

  const invalidatePrefix = useCallback((prefix: string) => {
    for (const key of Array.from(storeRef.current.keys())) {
      if (key.startsWith(prefix)) {
        storeRef.current.delete(key);
      }
    }
    setCacheVersion((v) => v + 1);
  }, []);

  const clearAllCache = useCallback(() => {
    storeRef.current.clear();
    inFlightRef.current.clear();
    setCacheVersion((v) => v + 1);
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        getCached,
        getCacheEntry,
        setCached,
        fetchWithDedupe,
        prefetchQuery,
        invalidatePrefix,
        clearAllCache,
        cacheVersion,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  return useContext(DataCacheContext);
}
