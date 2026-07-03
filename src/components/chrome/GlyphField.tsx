'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * The site's texture: loose type tumbling in 3D depth. Wherever the pointer
 * goes — and wherever the autonomous composition wave passes — glyphs stop
 * tumbling, settle upright onto invisible baselines, and brighten like set
 * ink; leave, and they decay back into drift. Chaos resolving into order,
 * continuously: the site's whole argument, running as background.
 *
 * Global chrome (rendered from the root layout on every page). Static under
 * prefers-reduced-motion; paused in hidden tabs.
 */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export default function GlyphField() {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CHARS = ['a', 'e', 'g', 'k', 'x', 'R', 'Q', 'W', '&', 'fi', 'ff', '.', ',', ';', ':', '?', '!', '“', '”', '’', '—', '¶', '§', '*'];
    const LINE = 38;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let px = 0.5;
    let py = 0.5;
    let curX = -9999;
    let curY = -9999;

    interface Glyph {
      x: number; y: number; z: number;
      size: number; char: string;
      rot: number; vrot: number;
      vx: number; vy: number;
      gold: boolean; serif: boolean;
      order: number;
    }
    let glyphs: Glyph[] = [];

    const seed = () => {
      const count = Math.min(110, Math.max(42, Math.floor(w / 13)));
      glyphs = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        size: 22 + Math.random() * 96,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        rot: (Math.random() - 0.5) * 1.7,
        vrot: (Math.random() - 0.5) * 0.004,
        vx: (Math.random() - 0.5) * 0.14,
        vy: -(0.05 + Math.random() * 0.22),
        gold: Math.random() < 0.16,
        serif: Math.random() < 0.72,
        order: 0,
      }));
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      if (!glyphs.length) seed();
    };

    const waveAt = (t: number) => {
      const k = (t % 17000) / 17000;
      return {
        x: w * (0.5 + 0.38 * Math.sin(k * Math.PI * 2)),
        y: h * (0.5 + 0.34 * Math.sin(k * Math.PI * 4 + 1.3)),
        r: Math.min(w, h) * 0.36,
        s: 0.85,
      };
    };

    const draw = (t: number) => {
      ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
      ctx.fillRect(0, 0, w, h);
      const wave = reduced ? null : waveAt(t);

      for (const g of glyphs) {
        const depth = 1 - g.z;
        const scale = 0.45 + depth * 0.95;
        const ox = (px - 0.5) * depth * 72;
        const oy = (py - 0.5) * depth * 42;
        const sx = g.x + ox;
        const sy = g.y + oy;

        let inf = 0;
        const dCur = Math.hypot(sx - curX, sy - curY);
        const rCur = 230 + depth * 130;
        if (dCur < rCur) inf = 1 - dCur / rCur;
        if (wave) {
          const dW = Math.hypot(sx - wave.x, sy - wave.y);
          if (dW < wave.r) inf = Math.max(inf, (1 - dW / wave.r) * wave.s);
        }
        const target = inf * inf;
        g.order += (target - g.order) * (target > g.order ? 0.16 : 0.022);

        if (!reduced) {
          const free = 1 - g.order;
          g.x += g.vx * free;
          g.y += g.vy * depth * free;
          g.rot += g.vrot * free;
          if (g.y < -160) { g.y = h + 130; g.x = Math.random() * w; }
          if (g.x < -160) g.x = w + 130;
          else if (g.x > w + 160) g.x = -130;
        }

        const baseline = Math.round(sy / LINE) * LINE;
        const drawY = sy + (baseline - sy) * g.order;
        const rot = g.rot * (1 - g.order);
        const size = g.size * scale * (1 - g.order * 0.22);
        const alpha = Math.min(0.34, (0.05 + depth * 0.095) * (1 + g.order * 2.6));

        if (g.gold) {
          ctx.fillStyle = `rgba(184, 150, 62, ${alpha})`;
        } else {
          const tone = Math.round(200 + g.order * 46);
          ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone - Math.round(g.order * 26)}, ${alpha})`;
        }
        ctx.save();
        ctx.translate(sx, drawY);
        ctx.rotate(rot);
        ctx.font = `${g.serif ? 'italic ' : ''}${size.toFixed(1)}px Georgia, serif`;
        ctx.fillText(g.char, 0, 0);
        ctx.restore();
      }
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      px = e.clientX / Math.max(1, w);
      py = e.clientY / Math.max(1, h);
      curX = e.clientX;
      curY = e.clientY;
    };
    const onLeave = () => {
      curX = -9999;
      curY = -9999;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="site-field" aria-hidden="true" />;
}
