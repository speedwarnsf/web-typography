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
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Solid bar */}
      <div className="relative flex items-center justify-between bg-[#0a0a0a]" style={{ height: 'var(--topbar-h, 52px)' }}>
        <LocationBadge />
        <SearchTrigger />
      </div>
      {/* Gradient fade — content dissolves as it scrolls under */}
      <div
        className="pointer-events-none"
        style={{
          height: '24px',
          background: 'linear-gradient(to bottom, #0a0a0a, transparent)',
        }}
      />
    </header>
  );
}
