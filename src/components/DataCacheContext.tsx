"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

interface CacheEntry {
  data: unknown;
  updatedAt: number;
}

interface DataCacheContextValue {
  getCached: <T>(key: string) => T | undefined;
  setCached: <T>(key: string, data: T) => void;
  invalidatePrefix: (prefix: string) => void;
  clearAllCache: () => void;
  cacheVersion: number;
}

const DataCacheContext = createContext<DataCacheContextValue>({
  getCached: () => undefined,
  setCached: () => {},
  invalidatePrefix: () => {},
  clearAllCache: () => {},
  cacheVersion: 0,
});

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<Map<string, CacheEntry>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);

  const getCached = useCallback(<T,>(key: string): T | undefined => {
    const entry = storeRef.current.get(key);
    return entry ? (entry.data as T) : undefined;
  }, []);

  const setCached = useCallback(<T,>(key: string, data: T) => {
    storeRef.current.set(key, { data, updatedAt: Date.now() });
  }, []);

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
    setCacheVersion((v) => v + 1);
  }, []);

  return (
    <DataCacheContext.Provider
      value={{ getCached, setCached, invalidatePrefix, clearAllCache, cacheVersion }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  return useContext(DataCacheContext);
}
