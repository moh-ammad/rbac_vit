"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";

/**
 * GET a path and keep the result in state. Pass null to skip.
 * While a new path/reload is loading, the previous data stays visible.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const key = path ? `${path}#${version}` : null;
  const [state, setState] = useState<{ key: string | null; data?: T; error: string | null }>({ key: null, error: null });

  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => { if (!cancelled) setState({ key, data, error: null }); })
      .catch((err) => { if (!cancelled) setState((s) => ({ key, data: s.data, error: errorMessage(err) })); });
    return () => { cancelled = true; };
  }, [key, path]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    reload,
  };
}

/** Debounced copy of a value (for search boxes). */
export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Page number that resets to 1 whenever `filterKey` changes. */
export function usePage(filterKey: string) {
  const [state, setState] = useState({ key: filterKey, page: 1 });
  const page = state.key === filterKey ? state.page : 1;
  const setPage = useCallback((next: number) => setState({ key: filterKey, page: next }), [filterKey]);
  return [page, setPage] as const;
}
