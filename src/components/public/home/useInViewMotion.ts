import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks whether a section is inside the viewport and whether the user prefers reduced motion.
 * Pauses nonessential homepage animations whenever scrolled off-screen or when reduced motion is enabled.
 */
export function useInViewMotion(ref: RefObject<HTMLElement | null>, rootMargin = '120px 0px') {
  const [inView, setInView] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
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

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin, threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return {
    inView,
    prefersReducedMotion,
    shouldAnimate: inView && !prefersReducedMotion,
  };
}
