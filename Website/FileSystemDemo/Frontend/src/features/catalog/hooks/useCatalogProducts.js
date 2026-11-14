import { useCallback, useEffect, useRef, useState } from 'react';
import { getCatalogProducts } from '../api/catalogApi.js';
import useRefreshEvents from '../../../shared/hooks/useRefreshEvents.js';

// onReadFeedback clears competing mutation feedback at read start/failure, matching
// the page's existing single alert. Successful reads leave newer write errors alone.
export default function useCatalogProducts({ q, tagIds, match, sort }, onReadFeedback) {
  const key = JSON.stringify({ q, tagIds, match, sort });
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [generation, setGeneration] = useState(0);
  const sequence = useRef(0),
    request = useRef(null),
    reading = useRef(false);
  const refresh = useCallback(() => setGeneration((value) => value + 1), []);
  const clearError = useCallback(() => setState((previous) => ({ ...previous, error: null })), []);
  useRefreshEvents(refresh, reading);

  useEffect(() => {
    const controller = new AbortController(),
      version = ++sequence.current;
    const ownsRead = () => !controller.signal.aborted && version === sequence.current;
    request.current?.abort();
    request.current = controller;
    reading.current = true;
    setState((previous) => ({ ...previous, key, generation, loading: true, error: null }));
    onReadFeedback?.();
    const timer = setTimeout(() => {
      getCatalogProducts(JSON.parse(key), controller.signal)
        .then((data) => {
          if (ownsRead()) setState((previous) => ({ ...previous, data }));
        })
        .catch((error) => {
          if (ownsRead()) {
            setState((previous) => ({ ...previous, error }));
            onReadFeedback?.();
          }
        })
        .finally(() => {
          if (ownsRead()) {
            setState((previous) => ({ ...previous, loading: false }));
            reading.current = false;
          }
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, generation, onReadFeedback]);
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );

  const current = state.key === key && state.generation === generation;
  const loading = !current || state.loading;
  async function loadMore() {
    if (loading || reading.current || !state.data?.nextCursor) return;
    const version = sequence.current,
      controller = new AbortController();
    const ownsRead = () => !controller.signal.aborted && version === sequence.current;
    request.current?.abort();
    request.current = controller;
    reading.current = true;
    setState((previous) => ({ ...previous, loading: true }));
    try {
      const next = await getCatalogProducts(
        { ...JSON.parse(key), cursor: state.data.nextCursor },
        controller.signal,
      );
      if (ownsRead())
        setState((previous) => ({
          ...previous,
          data: {
            ...next,
            items: [
              ...previous.data.items,
              ...next.items.filter(
                (item) => !previous.data.items.some((old) => old.sku === item.sku),
              ),
            ],
          },
        }));
    } catch (error) {
      if (ownsRead()) {
        setState((previous) => ({ ...previous, error }));
        onReadFeedback?.();
      }
    } finally {
      if (ownsRead()) {
        setState((previous) => ({ ...previous, loading: false }));
        reading.current = false;
      }
    }
  }
  return {
    data: state.data,
    loading,
    error: current ? state.error : null,
    refresh,
    loadMore,
    clearError,
  };
}
