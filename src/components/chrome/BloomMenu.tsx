'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { sections, metaPages } from '@/lib/sitemap';

/**
 * Site navigation that grows from a single gold point. Two levels: the root
 * bloom shows the three sections plus meta destinations; choosing a section
 * re-blooms with its pages. Sitemap-driven, so it never goes stale.
 *
 * Hit-testing discipline (learned the hard way): the closed nav must be
 * pointer-events: none — an invisible container with default pointer-events
 * silently eats every real tap in its box.
 */
export default function BloomMenu() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<string>('root');
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reset to root shortly after closing (after the fade)
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setLevel('root'), 250);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const openSearch = () => {
    setOpen(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  const section = sections.find((s) => s.id === level);

  type Row =
    | { kind: 'section'; id: string; label: string; n: string }
    | { kind: 'link'; href: string; label: string; n: string }
    | { kind: 'back'; label: string; n: string }
    | { kind: 'search'; label: string; n: string };

  const rows: Row[] = section
    ? [
        { kind: 'back', label: section.name, n: '←' },
        ...section.pages.map((p, i) => ({
          kind: 'link' as const,
          href: p.slug,
          label: p.name,
          n: String(i + 1).padStart(2, '0'),
        })),
      ]
    : [
        ...sections.map((s, i) => ({
          kind: 'section' as const,
          id: s.id,
          label: s.name,
          n: String(i + 1).padStart(2, '0'),
        })),
        { kind: 'link' as const, href: '/v2', label: 'The New Era', n: '04' },
        ...metaPages.map((p, i) => ({
          kind: 'link' as const,
          href: p.slug,
          label: p.name,
          n: String(i + 5).padStart(2, '0'),
        })),
        { kind: 'search' as const, label: 'Search', n: '⌘K' },
      ];

  return (
    <div ref={rootRef} className={`site-menu ${open ? 'site-menu-open' : ''}`}>
      <button
        className="site-menu-seed"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen(!open)}
      >
        <span className="site-menu-dot" />
        <span className="site-menu-word">{open ? 'CLOSE' : 'MENU'}</span>
      </button>
      <nav className="site-menu-bloom" aria-hidden={!open}>
        <span className="site-menu-stem" />
        <div key={level} className="site-menu-items">
          {rows.map((row, i) => {
            const delay = { ['--d' as string]: `${60 + i * 40}ms` } as React.CSSProperties;
            if (row.kind === 'link') {
              const current = pathname === row.href;
              return (
                <Link
                  key={row.href}
                  href={row.href}
                  tabIndex={open ? 0 : -1}
                  className={`site-menu-item ${current ? 'site-menu-current' : ''}`}
                  style={delay}
                  onClick={() => setOpen(false)}
                >
                  <span className="site-menu-n">{row.n}</span>
                  {row.label}
                </Link>
              );
            }
            const onClick =
              row.kind === 'section'
                ? () => setLevel(row.id)
                : row.kind === 'back'
                  ? () => setLevel('root')
                  : openSearch;
            return (
              <button
                key={row.kind + row.label}
                tabIndex={open ? 0 : -1}
                className={`site-menu-item ${row.kind === 'section' ? 'site-menu-more' : ''}`}
                style={delay}
                onClick={onClick}
              >
                <span className="site-menu-n">{row.n}</span>
                {row.label}
                {row.kind === 'section' && <span className="site-menu-arrow">→</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
