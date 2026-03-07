'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sections, metaPages, getAllPages, type SitePage } from '@/lib/sitemap';

type SearchResult = SitePage & {
  sectionName?: string;
  sectionFont?: string;
};

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Build search index
  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];
    for (const section of sections) {
      for (const page of section.pages) {
        results.push({
          ...page,
          sectionName: section.name,
          sectionFont: section.font,
        });
      }
    }
    for (const page of metaPages) {
      results.push({ ...page });
    }
    return results;
  }, []);

  // Filter results
  const filtered = useMemo(() => {
    if (!query.trim()) return allResults;
    const q = query.toLowerCase();
    return allResults.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.shortName && r.shortName.toLowerCase().includes(q)) ||
        (r.sectionName && r.sectionName.toLowerCase().includes(q))
    );
  }, [query, allResults]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  // Open/close with ⌘K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to let the DOM render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Navigate with keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        router.push(filtered[selectedIndex].slug);
        setIsOpen(false);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [filtered, selectedIndex, router]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-[#111] border border-neutral-800 shadow-2xl shadow-black/80 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-neutral-800 px-4">
          <svg
            className="w-4 h-4 text-neutral-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a tool..."
            className="w-full px-3 py-4 bg-transparent text-neutral-200 text-sm outline-none placeholder:text-neutral-600"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
          <kbd className="hidden sm:inline-block text-[10px] text-neutral-600 border border-neutral-700 px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-sm text-neutral-600 text-center" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
              No tools found
            </p>
          )}
          {filtered.map((result, index) => (
            <button
              key={result.slug}
              onClick={() => {
                router.push(result.slug);
                setIsOpen(false);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-neutral-800/50'
                  : 'hover:bg-neutral-800/30'
              }`}
            >
              <div>
                <span
                  className={`text-sm block ${
                    index === selectedIndex ? 'text-white' : 'text-neutral-300'
                  }`}
                  style={{
                    fontFamily: result.sectionFont ?? "'Source Sans 3', sans-serif",
                  }}
                >
                  {result.name}
                </span>
                <span className="text-[11px] text-neutral-600 block mt-0.5">
                  {result.description}
                </span>
              </div>
              {result.sectionName && (
                <span
                  className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 shrink-0 ml-4"
                  style={{ fontFamily: result.sectionFont }}
                >
                  {result.sectionName}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
