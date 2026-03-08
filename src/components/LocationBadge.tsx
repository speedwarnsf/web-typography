'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { sections, metaPages, getPageInfo, type SiteSection, type PageInfo } from '@/lib/sitemap';

export default function LocationBadge() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const badgeRef = useRef<HTMLDivElement>(null);
  const pageInfo = getPageInfo(pathname);

  // Reset all sections to expanded when menu opens
  useEffect(() => {
    if (isOpen) {
      setCollapsedSections(new Set());
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Determine what to display
  const isMetaPage = metaPages.some((p) => p.slug === pathname);
  const sectionName = pageInfo?.section.name ?? (isMetaPage ? 'Typeset' : 'Typeset');
  const sectionFont = pageInfo?.section.font ?? "'Playfair Display', serif";
  const pageName = pageInfo?.name ?? metaPages.find((p) => p.slug === pathname)?.name ?? 'Home';

  return (
    <div ref={badgeRef} className="fixed top-0 left-0 z-50">
      {/* The badge itself */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex flex-col items-start px-5 py-4 cursor-pointer select-none"
        aria-expanded={isOpen}
        aria-label="Site navigation"
      >
        <span
          className="text-[10px] uppercase tracking-[0.3em] text-[#B8963E] transition-opacity group-hover:opacity-100 opacity-70"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {sectionName}
        </span>
        <span
          className="text-[15px] text-neutral-300 mt-0.5 transition-colors group-hover:text-white"
          style={{ fontFamily: sectionFont }}
        >
          {pageName}
        </span>
      </button>

      {/* Expanded dropdown */}
      <div
        className={`absolute top-full left-0 w-[calc(100vw-2rem)] sm:w-[320px] max-h-[calc(100vh-80px)] overflow-y-auto bg-[#0a0a0a] border border-neutral-800 shadow-2xl shadow-black/50 transition-all duration-200 origin-top-left ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="p-4">
          {/* Sections */}
          {sections.map((section) => (
            <SectionGroup
              key={section.id}
              section={section}
              currentSlug={pathname}
              isExpanded={!collapsedSections.has(section.id)}
              onToggle={() => {
                setCollapsedSections((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.id)) next.delete(section.id);
                  else next.add(section.id);
                  return next;
                });
              }}
            />
          ))}

          {/* Meta pages */}
          <div className="mt-4 pt-4 border-t border-neutral-800/50">
            {metaPages.map((page) => (
              <Link
                key={page.slug}
                href={page.slug}
                className={`block px-3 py-2 text-sm transition-colors ${
                  pathname === page.slug
                    ? 'text-[#B8963E]'
                    : 'text-neutral-500 hover:text-neutral-200'
                }`}
                style={{ fontFamily: "'Source Sans 3', sans-serif" }}
              >
                {page.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionGroup({
  section,
  currentSlug,
  isExpanded,
  onToggle,
}: {
  section: SiteSection;
  currentSlug: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isCurrentSection = section.pages.some((p) => p.slug === currentSlug);

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-3 min-h-[44px] cursor-pointer group`}
      >
        <span
          className={`text-xs uppercase tracking-[0.25em] transition-colors ${
            isCurrentSection ? 'text-[#B8963E]' : 'text-neutral-500 group-hover:text-neutral-300'
          }`}
          style={{ fontFamily: section.font }}
        >
          {section.name}
        </span>
        <svg
          className={`w-4 h-4 text-neutral-600 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {section.pages.map((page) => {
          const isCurrent = page.slug === currentSlug;
          return (
            <Link
              key={page.slug}
              href={page.slug}
              className={`block px-3 py-2 ml-2 border-l transition-colors ${
                isCurrent
                  ? 'border-[#B8963E] text-white'
                  : 'border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
              }`}
            >
              <span
                className="text-sm block"
                style={{ fontFamily: section.font }}
              >
                {page.name}
              </span>
              <span
                className="text-[11px] text-neutral-600 block mt-0.5"
                style={{ fontFamily: "'Source Sans 3', sans-serif" }}
              >
                {page.description}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
