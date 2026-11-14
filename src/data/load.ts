// Runtime data loading with an in-memory cache. Snapshots are static JSON files served next to the app.
import { useEffect, useState } from "react";
import { DATASET_FILES, type DatasetMap } from "./types";

type Key = keyof DatasetMap;
const cache = new Map<Key, Promise<unknown>>();

export function loadDataset<K extends Key>(key: K): Promise<DatasetMap[K]> {
  if (!cache.has(key)) {
    const url = `${import.meta.env.BASE_URL}data/${DATASET_FILES[key]}`;
    const p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${DATASET_FILES[key]} (HTTP ${res.status})`);
      return res.json();
    });
    p.catch(() => cache.delete(key)); // allow a retry after a failure
    cache.set(key, p);
  }
  return cache.get(key) as Promise<DatasetMap[K]>;
}

export interface DatasetState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** Load one dataset. Re-renders once when it arrives. */
export function useDataset<K extends Key>(key: K): DatasetState<DatasetMap[K]> {
  const [state, setState] = useState<DatasetState<DatasetMap[K]>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    loadDataset(key).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error: Error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}

/** Load several datasets at once; `data` is null until all have arrived. */
export function useDatasets<K extends Key>(keys: K[]): DatasetState<{ [P in K]: DatasetMap[P] }> {
  const id = keys.join(",");
  const [state, setState] = useState<DatasetState<{ [P in K]: DatasetMap[P] }>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    Promise.all(keys.map((k) => loadDataset(k))).then(
      (values) => {
        if (!alive) return;
        const data = Object.fromEntries(keys.map((k, i) => [k, values[i]])) as unknown as { [P in K]: DatasetMap[P] };
        setState({ data, error: null, loading: false });
      },
      (error: Error) => alive && setState({ data: null, error, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return state;
}
