'use client';

import { useEffect } from 'react';

/**
 * Subtle parallax on the fixed hero background image.
 * The image shifts vertically at 30% of scroll speed, creating depth.
 * Also adds a gentle scale pulse on load.
 * Uses requestAnimationFrame for smooth 60fps performance.
 */
export default function HeroParallax() {
  useEffect(() => {
    const img = document.getElementById('hero-bg') as HTMLImageElement | null;
    if (!img) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        // Parallax: image moves at 8% of scroll speed (very slow, stays visible on long pages)
        // Scale: starts at 1.1, slowly settles to 1.0 as you scroll
        const translateY = scrollY * 0.08;
        const scale = 1.1 - Math.min(scrollY / 10000, 0.1);
        img.style.transform = `translateY(${translateY}px) scale(${scale})`;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    // Initial subtle scale
    img.style.transform = 'translateY(0) scale(1.1)';
    img.style.transition = 'transform 0.1s ease-out';

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
