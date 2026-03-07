'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getPageInfo } from '@/lib/sitemap';

/**
 * Thin prev/next navigation strip between adjacent tools in the same section.
 */
export default function PrevNextStrip() {
  const pathname = usePathname();
  const pageInfo = getPageInfo(pathname);

  if (!pageInfo) return null;

  const { prev, next, section } = pageInfo;

  if (!prev && !next) return null;

  return (
    <div className="border-t border-neutral-800">
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        {prev ? (
          <Link
            href={prev.slug}
            className="group flex items-center gap-3 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span
              className="text-sm"
              style={{ fontFamily: section.font }}
            >
              {prev.shortName ?? prev.name}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={next.slug}
            className="group flex items-center gap-3 text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            <span
              className="text-sm"
              style={{ fontFamily: section.font }}
            >
              {next.shortName ?? next.name}
            </span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
