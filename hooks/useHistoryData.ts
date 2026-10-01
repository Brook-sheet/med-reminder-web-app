"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FRESH_MS = 15_000;
const SWITCH_DELAY_MS = 120;
const MAX_ENTRIES = 12;

type Snapshot<T> = {
  key: string | null;
  data: T | null;
  loading: boolean;
  error: string;
};

type RequestEntry<T> = {
  controller: AbortController;
  promise: Promise<T>;
};

/** Page-local cache: never shared between users or persisted in the browser. */
export function useHistoryData<T>(url: string | null) {
  const cache = useRef(new Map<string, { data: T; expiresAt: number }>());
  const requests = useRef(new Map<string, RequestEntry<T>>());
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    key: null,
    data: null,
    loading: true,
    error: "",
  });

  const refresh = useCallback(() => {
    cache.current.clear();

    for (const request of requests.current.values()) {
      request.controller.abort();
    }

    requests.current.clear();
    setSnapshot({
      key: null,
      data: null,
      loading: true,
      error: "",
    });
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const pageCache = cache.current;
    const pageRequests = requests.current;

    const onFocus = () => refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);

      for (const request of pageRequests.values()) {
        request.controller.abort();
      }

      pageRequests.clear();
      pageCache.clear();
    };
  }, [refresh]);

  useEffect(() => {
    if (!url) return;

    let active = true;

    function publish(data: T) {
      if (!active) return;

      setSnapshot({
        key: url,
        data,
        loading: false,
        error: "",
      });
    }

    const cached = cache.current.get(url);

    if (cached && cached.expiresAt > Date.now()) {
      publish(cached.data);

      return () => {
        active = false;
      };
    }

    setSnapshot({
      key: url,
      data: null,
      loading: true,
      error: "",
    });

    // Coalesce rapid clicks and partial custom-date edits before doing API work.
    const switchTimer = setTimeout(async () => {
      let request = requests.current.get(url);

      if (!request) {
        const controller = new AbortController();
        const startedAt = Date.now();

        const promise = (async () => {
          const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
          });

          const json = await response.json();

          if (!response.ok || !json.success) {
            throw new Error(json.error || "Failed to load history.");
          }

          if (controller.signal.aborted) {
            throw new DOMException("Request aborted", "AbortError");
          }

          const data = json.data as T;

          // Measure freshness from request start so a slow response does not
          // receive another full cache period when its range is selected again.
          cache.current.delete(url);
          cache.current.set(url, {
            data,
            expiresAt: startedAt + FRESH_MS,
          });

          while (cache.current.size > MAX_ENTRIES) {
            const oldest = cache.current.keys().next().value;

            if (oldest === undefined) break;

            cache.current.delete(oldest);
          }

          return data;
        })();

        request = { controller, promise };
        requests.current.set(url, request);
      }

      try {
        const data = await request.promise;
        publish(data);
      } catch (error) {
        if (active && !request.controller.signal.aborted) {
          setSnapshot({
            key: url,
            data: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load history.",
          });
        }
      } finally {
        if (requests.current.get(url) === request) {
          requests.current.delete(url);
        }
      }
    }, SWITCH_DELAY_MS);

    return () => {
      active = false;
      clearTimeout(switchTimer);

      // Keep an in-progress request reusable when switching A → B → A.
      // Its result can populate the cache, but cannot update an inactive view.
    };
  }, [url, revision]);

  const matches = url !== null && snapshot.key === url;

  return {
    data: matches ? snapshot.data : null,
    loading: url !== null && (!matches || snapshot.loading),
    error: matches ? snapshot.error : "",
    refresh,
  };
}