"use client";

import { useState, useRef, useEffect } from "react";

export type FontOption = {
  label: string;
  value: string | number;
  fontFamily?: string; // CSS font-family to render the option in
};

interface FontSelectProps {
  options: FontOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  className?: string;
}

/**
 * Custom dropdown that renders each font option in its own typeface.
 * Replaces native <select> where typographic fidelity matters.
 */
export default function FontSelect({ options, value, onChange, className }: FontSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-sm px-3 py-2 text-left focus:border-[#B8963E] focus:outline-none flex items-center justify-between gap-2"
      >
        <span
          className="truncate"
          style={{ fontFamily: selected?.fontFamily || "inherit" }}
        >
          {selected?.label}
        </span>
        <svg
          className={`w-3 h-3 text-neutral-500 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M2 4l4 4 4-4H2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto bg-neutral-900 border border-neutral-700 shadow-xl">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-neutral-800 hover:text-[#B8963E] ${
                opt.value === value
                  ? "text-[#B8963E] bg-neutral-800/50"
                  : "text-neutral-300"
              }`}
              style={{ fontFamily: opt.fontFamily || "inherit" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
