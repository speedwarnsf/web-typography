'use client';

import LocationBadge from './LocationBadge';
import SearchTrigger from './SearchTrigger';

/**
 * Fixed top bar — provides breathing room for the nav badge and search icon
 * with proper hit areas on mobile. Black background to separate from content.
 */
export default function TopBar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-neutral-800/50"
      style={{ height: 'var(--topbar-h, 52px)' }}
    >
      <div className="relative h-full flex items-center justify-between">
        {/* Left: Navigation badge (LocationBadge handles its own content) */}
        <LocationBadge />

        {/* Right: Search trigger */}
        <SearchTrigger />
      </div>
    </header>
  );
}
