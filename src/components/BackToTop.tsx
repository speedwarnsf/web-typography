"use client";
import { useEffect, useState, useRef } from "react";

export default function BackToTop() {
  const [show, setShow] = useState(false);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Clamp to keep button fully visible (20px = half button width)
      const x = Math.max(20, Math.min(e.clientX, window.innerWidth - 20));
      setMouseX(x);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  if (!show) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    bottom: 32,
    zIndex: 50,
    // If mouse tracked, center on mouse X; otherwise default to right side
    ...(mouseX !== null
      ? { left: mouseX, transform: "translateX(-50%)" }
      : { right: 32 }),
    transition: "left 0.15s ease-out, opacity 0.2s",
  };

  return (
    <button
      ref={btnRef}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Return to top"
      style={style}
      className="w-10 h-10 flex items-center justify-center border border-neutral-700 bg-neutral-900/90 backdrop-blur text-neutral-400 hover:text-[#B8963E] hover:border-[#B8963E] transition-colors font-mono text-xs uppercase tracking-widest"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 12V2M2 6l5-4 5 4" />
      </svg>
    </button>
  );
}
