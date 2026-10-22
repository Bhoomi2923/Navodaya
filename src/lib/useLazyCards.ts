import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

/** Distance in px around the viewport where animations stay running. */
const ACTIVE_BAND = 100;

function sameBooleans(a: boolean[], b: boolean[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Lazy-mounts the heavy art inside a column of scrollable cards.
 *
 * Each card reports its Y position and height via `registerLayout` (from its
 * wrapper's onLayout — the column is the first non-absolute child of the page,
 * so that Y is effectively relative to the scroll content).
 *
 * - `mounted[i]` latches true the first time the card intersects
 *   [scrollY - buffer, scrollY + viewport + buffer] and never goes back, so
 *   scrolling back up never unmounts or reloads the art.
 * - `active[i]` tracks the tighter [scrollY - 100, scrollY + viewport + 100]
 *   band and is used to pause/resume animations.
 *
 * State only updates when a value actually changes, so scrolling does not
 * re-render the page every frame.
 */
export function useLazyCards(count: number, buffer?: number) {
  const { height: viewport } = useWindowDimensions();
  const buf = buffer ?? viewport;
  const layouts = useRef<({ y: number; height: number } | undefined)[]>([]);
  const scrollY = useRef(0);
  const [state, setState] = useState(() => ({
    mounted: Array<boolean>(count).fill(false),
    active: Array<boolean>(count).fill(false),
  }));

  const evaluate = useCallback(() => {
    const mountTop = scrollY.current - buf;
    const mountBottom = scrollY.current + viewport + buf;
    const activeTop = scrollY.current - ACTIVE_BAND;
    const activeBottom = scrollY.current + viewport + ACTIVE_BAND;
    setState((prev) => {
      const mounted = prev.mounted.slice();
      const active = prev.active.slice();
      for (let i = 0; i < count; i++) {
        const l = layouts.current[i];
        if (!l) continue;
        if (l.y < mountBottom && l.y + l.height > mountTop) mounted[i] = true;
        active[i] = l.y < activeBottom && l.y + l.height > activeTop;
      }
      if (sameBooleans(mounted, prev.mounted) && sameBooleans(active, prev.active)) {
        return prev;
      }
      return { mounted, active };
    });
  }, [count, buf, viewport]);

  const registerLayout = useCallback(
    (index: number, y: number, height: number) => {
      const prev = layouts.current[index];
      if (prev && prev.y === y && prev.height === height) return;
      layouts.current[index] = { y, height };
      evaluate();
    },
    [evaluate]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      evaluate();
    },
    [evaluate]
  );

  // First check once layouts/viewport are known, and again if they change.
  useEffect(() => {
    evaluate();
  }, [evaluate]);

  return {
    mounted: state.mounted,
    active: state.active,
    onScroll,
    registerLayout,
  };
}
