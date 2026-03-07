'use client';

/**
 * A subtle ⌘K trigger in the top-right corner.
 * Clicking it dispatches the same keyboard shortcut the CommandPalette listens for.
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
      className="fixed top-4 right-5 z-50 flex items-center gap-2 text-neutral-600 hover:text-neutral-400 transition-colors cursor-pointer"
      aria-label="Search (⌘K)"
    >
      <svg
        className="w-3.5 h-3.5"
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
