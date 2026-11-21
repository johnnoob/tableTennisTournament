import { useEffect, useState } from 'react';

export function useScrollHide(pathname: string, enabled = true): boolean {
  const [hideState, setHideState] = useState<{ hidden: boolean; path: string }>({
    hidden: false,
    path: pathname,
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let lastY = window.scrollY;
    let downAccum = 0;
    let upAccum = 0;
    let ticking = false;
    let rafId = 0;

    const update = () => {
      ticking = false;
      if (window.innerWidth >= 768) {
        return;
      }

      const currentY = window.scrollY;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

      // Ignore iOS / Safari overscroll rubber-banding at top or bottom
      if (currentY < 0 || currentY > maxScroll + 2) {
        return;
      }

      if (currentY <= 48 || maxScroll <= 64 || maxScroll - currentY <= 32) {
        downAccum = 0;
        upAccum = 0;
        setHideState((prev) =>
          !prev.hidden && prev.path === pathname
            ? prev
            : { hidden: false, path: pathname }
        );
        lastY = currentY;
        return;
      }

      const delta = currentY - lastY;
      lastY = currentY;

      if (delta > 0) {
        downAccum += delta;
        upAccum = 0;
        if (downAccum >= 18) {
          setHideState((prev) =>
            prev.hidden && prev.path === pathname
              ? prev
              : { hidden: true, path: pathname }
          );
        }
      } else if (delta < 0) {
        upAccum += -delta;
        downAccum = 0;
        if (upAccum >= 12) {
          setHideState((prev) =>
            !prev.hidden && prev.path === pathname
              ? prev
              : { hidden: false, path: pathname }
          );
        }
      }
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [pathname, enabled]);

  return enabled && hideState.hidden && hideState.path === pathname;
}
