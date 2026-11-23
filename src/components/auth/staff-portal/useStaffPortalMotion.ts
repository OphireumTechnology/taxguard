/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Staff Practice Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import { useEffect, useState, type RefObject } from 'react';

export type StaffMotionComplexity = 'full' | 'reduced' | 'minimal';

export interface StaffPortalMotionState {
  inView: boolean;
  isPageVisible: boolean;
  prefersReducedMotion: boolean;
  complexity: StaffMotionComplexity;
  shouldAnimate: boolean;
}

/**
 * Coordinates Staff Practice Portal ambient animation playback:
 * - Pauses when the document tab is hidden (visibilitychange)
 * - Pauses when scrolled out of the viewport (IntersectionObserver)
 * - Respects prefers-reduced-motion: reduce
 * - Scales decorative complexity down on tablet/mobile or low-power devices
 */
export function useStaffPortalMotion(
  ref: RefObject<HTMLElement | null>,
  rootMargin = '120px 0px'
): StaffPortalMotionState {
  const [inView, setInView] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [complexity, setComplexity] = useState<StaffMotionComplexity>('full');

  // 1. Respect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // 2. Pause animations whenever the browser tab is not visible
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // 3. Pause animations when scrolled out of viewport
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin, threshold: 0.02 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  // 4. Adapt visual complexity for mobile, tablet, Save-Data, or low-core devices
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mobileMq = window.matchMedia('(max-width: 767px)');
    const tabletMq = window.matchMedia('(max-width: 1023px)');

    const evaluateComplexity = () => {
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
      };
      const saveData = Boolean(nav.connection?.saveData);
      const lowPowerHardware =
        (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) ||
        (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4);

      if (mobileMq.matches || saveData || (tabletMq.matches && lowPowerHardware)) {
        setComplexity('minimal');
      } else if (tabletMq.matches || lowPowerHardware) {
        setComplexity('reduced');
      } else {
        setComplexity('full');
      }
    };

    evaluateComplexity();

    const listeners: Array<() => void> = [];
    for (const mq of [mobileMq, tabletMq]) {
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', evaluateComplexity);
        listeners.push(() => mq.removeEventListener('change', evaluateComplexity));
      } else {
        mq.addListener(evaluateComplexity);
        listeners.push(() => mq.removeListener(evaluateComplexity));
      }
    }

    return () => {
      listeners.forEach((cleanup) => cleanup());
    };
  }, []);

  const shouldAnimate =
    inView && isPageVisible && !prefersReducedMotion && complexity !== 'minimal';

  return {
    inView,
    isPageVisible,
    prefersReducedMotion,
    complexity,
    shouldAnimate
  };
}
