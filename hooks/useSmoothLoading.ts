"use client";

import { useEffect, useRef, useState } from "react";

interface SmoothLoadingOptions {
  /** Wait this long before showing anything — fast responses never flicker. */
  delay?: number;
  /** Once shown, stay for at least this long — no jarring flash. */
  minDuration?: number;
}

/**
 * Wrap any boolean loading flag so every indicator in the app appears and
 * disappears with the same rhythm.
 *
 *   const showLoader = useSmoothLoading(isFetching);
 *   {showLoader ? <SectionLoader /> : <List />}
 */
export function useSmoothLoading(
  loading: boolean,
  { delay = 120, minDuration = 350 }: SmoothLoadingOptions = {}
) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    if (loading) {
      showTimer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (shownAtRef.current !== null) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, minDuration - elapsed);

      hideTimer = window.setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, remaining);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [loading, delay, minDuration]);

  return visible;
}

export default useSmoothLoading;