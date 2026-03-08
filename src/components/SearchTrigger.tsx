'use client';

/**
 * Search trigger — sits inside TopBar.
 * Dispatches ⌘K to open CommandPalette.
 * Larger icon and 44px minimum hit area for mobile.
 */
export default function SearchTrigger() {
  return (
    <button
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            bubbles: true,
          })
        );
      }}
      className="flex items-center justify-center gap-2 px-4 sm:px-5 min-h-[44px] h-[var(--topbar-h,52px)] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
      aria-label="Search (⌘K)"
    >
      <svg
        className="w-5 h-5 sm:w-4 sm:h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <kbd
        className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono border border-neutral-800 px-1.5 py-0.5 text-neutral-600"
      >
        ⌘K
      </kbd>
    </button>
  );
}
