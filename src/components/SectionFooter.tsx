'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getPageInfo } from '@/lib/sitemap';

/**
 * Shows sibling tools from the same section at the bottom of every page.
 * "Also in [section]" — natural flow to related tools.
 */
export default function SectionFooter() {
  const pathname = usePathname();
  const pageInfo = getPageInfo(pathname);

  if (!pageInfo) return null;

  const { section } = pageInfo;
  const siblings = section.pages.filter((p) => p.slug !== pathname);

  if (siblings.length === 0) return null;

  return (
    <section className="border-t border-neutral-800">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-neutral-600 mb-8"
          style={{ fontFamily: section.font }}
        >
          Also in {section.name}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {siblings.map((page) => (
            <Link
              key={page.slug}
              href={page.slug}
              className="group border border-neutral-800 bg-neutral-950/50 p-5 transition-colors hover:border-neutral-700 hover:bg-neutral-900/50"
            >
              <span
                className="text-base text-neutral-300 group-hover:text-white transition-colors block"
                style={{ fontFamily: section.font }}
              >
                {page.name}
              </span>
              <span
                className="text-[12px] text-neutral-600 mt-1 block"
                style={{ fontFamily: "'Source Sans 3', sans-serif" }}
              >
                {page.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
