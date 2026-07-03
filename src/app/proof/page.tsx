'use client';

import { useState, useEffect, useRef } from 'react';
import typeset from '@/lib/typeset';

/**
 * The Proof — live before/after on real text.
 *
 * The journal's open question #4: "if we have to keep using fake examples
 * doesn't that mean our tool doesn't work?" This page answers it. Paste any
 * text, pick a real column width (mobile first), and compare the browser's
 * greedy line breaking against the typeset.ts engine — same text, same font,
 * same width, both actually rendered. Metrics are measured from the rendered
 * lines, never precomputed.
 */

const DEFAULT_TEXT =
  'The problem I have lived with across this career is simple to state and difficult to solve: the web does not know how to break lines. The browser sets text using a greedy algorithm — fill the line until the next word won\'t fit, then break. This is fast. At wide measures it works well enough. At narrow measures, it produces bad breaks: prepositions stranded at line ends, articles orphaned, sentences split mid-thought.';

const WIDTH_PRESETS = [
  { label: '320', px: 320 },
  { label: '375', px: 375 },
  { label: '414', px: 414 },
  { label: '540', px: 540 },
  { label: '650', px: 650 },
];

const FONTS = [
  { label: 'Georgia', css: 'Georgia, serif' },
  { label: 'Source Sans', css: "var(--font-source-sans), 'Source Sans 3', sans-serif" },
  { label: 'Playfair', css: "var(--font-playfair), 'Playfair Display', serif" },
];

// Mirrors the engine's WEAK_END_WORDS + LINKING_END_WORDS so the audit judges
// both panels by the same standard the engine optimizes for.
const WEAK_ENDERS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'or',
  'but', 'nor', 'so', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'being', 'has', 'have', 'had',
]);

// "…split mid-thought. At" — a line that crosses a sentence boundary and ends
// on the opening word of the next sentence.
const STRANDED_OPENER = /[.!?]["'”’)\]]*\s+["'“‘(\[]*[A-Z][A-Za-z’']*$/;

interface LineInfo {
  text: string;
  right: number; // px from the column's content left edge to the line's rightmost ink
}

interface PanelMetrics {
  lines: number;
  orphan: boolean;
  weakEnders: number;
  strandedOpeners: number;
  ragRangePct: number; // max fill − min fill across non-last lines, in points
  stairsteps: number;  // adjacent non-last lines differing by more than 10% fill
  composed: boolean;   // after-panel only: did the V2 compositor produce frozen lines?
}

const lastWordOf = (line: string): string => {
  const words = line.trim().split(/\s+/);
  return (words[words.length - 1] || '')
    .replace(/[^A-Za-z0-9’']+$/g, '')
    .replace(/^[^A-Za-z0-9]+/g, '')
    .toLowerCase();
};

const lexicalCount = (line: string): number =>
  line.trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** Replace a plain-text paragraph's content with per-word spans so rendered lines can be detected. */
function wrapWords(p: HTMLElement): void {
  const text = p.textContent || '';
  p.textContent = '';
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.setAttribute('data-w', '');
    span.textContent = w;
    p.appendChild(span);
    if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
  });
}

/** Measure the actually-rendered lines of a panel. Works for frozen .ts-line output and plain wrapped text. */
function measureLines(p: HTMLElement): LineInfo[] {
  const cs = getComputedStyle(p);
  const contentLeft = p.getBoundingClientRect().left + parseFloat(cs.paddingLeft);

  const frozen = Array.from(p.querySelectorAll<HTMLElement>('.ts-line'));
  if (frozen.length) {
    return frozen.map((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const r = range.getBoundingClientRect();
      return { text: span.textContent || '', right: r.right - contentLeft };
    });
  }

  // Plain text (browser panel, or engine fallback path): wrap words, group by row.
  if (!p.querySelector('span[data-w]')) wrapWords(p);
  const lines: { words: string[]; right: number; top: number }[] = [];
  for (const span of Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'))) {
    const r = span.getBoundingClientRect();
    const current = lines[lines.length - 1];
    if (!current || Math.abs(r.top - current.top) > 4) {
      lines.push({ words: [span.textContent || ''], right: r.right - contentLeft, top: r.top });
    } else {
      current.words.push(span.textContent || '');
      current.right = Math.max(current.right, r.right - contentLeft);
    }
  }
  return lines.map((l) => ({ text: l.words.join(' '), right: l.right }));
}

function computeMetrics(lines: LineInfo[], width: number, composed: boolean): PanelMetrics {
  const fills = lines.map((l) => l.right / width);
  const nonLastFills = fills.slice(0, -1);
  const nonLastLines = lines.slice(0, -1);

  let weakEnders = 0;
  let strandedOpeners = 0;
  for (const l of nonLastLines) {
    if (WEAK_ENDERS.has(lastWordOf(l.text))) weakEnders++;
    if (STRANDED_OPENER.test(l.text.trim())) strandedOpeners++;
  }

  let stairsteps = 0;
  for (let i = 0; i < nonLastFills.length - 1; i++) {
    if (Math.abs(nonLastFills[i] - nonLastFills[i + 1]) > 0.10) stairsteps++;
  }

  return {
    lines: lines.length,
    orphan: lines.length > 1 && lexicalCount(lines[lines.length - 1].text) === 1,
    weakEnders,
    strandedOpeners,
    ragRangePct: nonLastFills.length > 1
      ? Math.round((Math.max(...nonLastFills) - Math.min(...nonLastFills)) * 100)
      : 0,
    stairsteps,
    composed,
  };
}

export default function ProofPage() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [width, setWidth] = useState(375);
  const [fontCss, setFontCss] = useState(FONTS[0].css);
  const [pretty, setPretty] = useState(false);
  const [mobileView, setMobileView] = useState<'browser' | 'typeset'>('typeset');
  const [before, setBefore] = useState<PanelMetrics | null>(null);
  const [after, setAfter] = useState<PanelMetrics | null>(null);

  const beforeRef = useRef<HTMLParagraphElement>(null);
  const afterRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Measure with the real webfonts, not their fallbacks.
      try {
        await document.fonts.ready;
      } catch {}
      if (cancelled) return;

      const beforeEl = beforeRef.current;
      const afterEl = afterRef.current;
      if (!beforeEl || !afterEl) return;

      beforeEl.textContent = text;
      // data-ts-raw is the engine's canonical-text override — it makes re-runs
      // with edited text deterministic (the WeakMap cache would return stale text).
      afterEl.dataset.tsRaw = text;
      afterEl.textContent = text;
      delete afterEl.dataset.typesetDone;

      // Everything below reads layout, which forces a synchronous reflow —
      // no need to wait for a paint (and rAF never fires in hidden tabs).
      typeset(afterEl);
      const composed = !!afterEl.querySelector('.ts-line');
      setBefore(computeMetrics(measureLines(beforeEl), width, false));
      setAfter(computeMetrics(measureLines(afterEl), width, composed));
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [text, width, fontCss, pretty]);

  const paragraphStyle: React.CSSProperties = {
    fontFamily: fontCss,
    fontSize: '18px',
    lineHeight: 1.65,
    margin: 0,
    padding: 0,
    color: '#d4d4d4',
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a]/85 text-neutral-200 overflow-x-clip">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12 border-b border-neutral-800">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
          The Proof
        </p>
        <h1
          className="text-3xl sm:text-4xl sm:text-5xl font-bold tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-playfair)', textWrap: 'balance' }}
        >
          Your Text. Real Rendering.
        </h1>
        <p
          data-no-typeset
          className="max-w-2xl text-base sm:text-lg text-neutral-400 leading-relaxed"
          style={{ fontFamily: 'var(--font-source-sans)', textWrap: 'pretty' }}
        >
          No fabricated examples. Paste any paragraph, pick a real column width,
          and compare the browser&rsquo;s greedy line breaking against the
          typeset engine — same text, same font, same width, both actually
          rendered in your browser. Every number below is measured from the
          lines you are looking at.
        </p>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Text input */}
        <label className="block font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-2">
          Your paragraph
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full bg-neutral-950/60 border border-neutral-800 focus:border-[#B8963E] outline-none p-4 text-sm text-neutral-300 leading-relaxed resize-y"
          style={{ fontFamily: 'var(--font-source-sans)', borderRadius: 0 }}
        />

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-2">
              Column width — {width}px
            </p>
            <div className="flex items-center gap-2">
              {WIDTH_PRESETS.map((w) => (
                <button
                  key={w.px}
                  onClick={() => setWidth(w.px)}
                  className={`font-mono text-xs px-3 py-2 border transition-colors ${
                    width === w.px
                      ? 'border-[#B8963E] text-[#B8963E]'
                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {w.label}
                </button>
              ))}
              <input
                type="range"
                min={280}
                max={720}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-32 accent-[#B8963E]"
                aria-label="Custom column width"
              />
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500 mb-2">
              Typeface
            </p>
            <div className="flex items-center gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setFontCss(f.css)}
                  className={`font-mono text-xs px-3 py-2 border transition-colors ${
                    fontCss === f.css
                      ? 'border-[#B8963E] text-[#B8963E]'
                      : 'border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={pretty}
              onChange={(e) => setPretty(e.target.checked)}
              className="accent-[#B8963E]"
            />
            <span className="font-mono text-xs text-neutral-400">
              Give the browser text-wrap: pretty
            </span>
          </label>
        </div>

        {/* Mobile view toggle — stacked panels two screens apart are not a
            comparison. Below lg, one panel shows at a time behind a sticky
            switch; at lg+ both panels sit side by side and the switch hides. */}
        <div className="lg:hidden sticky top-2 z-10 mt-10 flex border border-neutral-700 bg-[#050505]/95 w-max" style={{ borderRadius: 0 }}>
          <button
            onClick={() => setMobileView('browser')}
            className={`font-mono text-[11px] uppercase tracking-[0.2em] px-5 py-3 min-h-[44px] transition-colors ${
              mobileView === 'browser' ? 'bg-[#B8963E] text-[#0a0a0a]' : 'text-neutral-400'
            }`}
            style={{ borderRadius: 0, touchAction: 'manipulation' }}
          >
            Browser
          </button>
          <button
            onClick={() => setMobileView('typeset')}
            className={`font-mono text-[11px] uppercase tracking-[0.2em] px-5 py-3 min-h-[44px] transition-colors ${
              mobileView === 'typeset' ? 'bg-[#B8963E] text-[#0a0a0a]' : 'text-neutral-400'
            }`}
            style={{ borderRadius: 0, touchAction: 'manipulation' }}
          >
            Typeset
          </button>
        </div>

        {/* Panels */}
        <div className="mt-4 lg:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Browser */}
          <div
            className={`border border-neutral-800 bg-neutral-950/40 ${
              mobileView === 'browser' ? 'block' : 'hidden'
            } lg:block`}
            style={{ borderRadius: 0 }}
          >
            <div className="px-4 py-3 border-b border-neutral-800 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                Browser{pretty ? ' + text-wrap: pretty' : ' default'}
              </span>
              <span className="font-mono text-[10px] text-neutral-600">{width}px</span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div style={{ width: `${width}px`, borderRight: '1px dashed #3f3f3f' }}>
                <p
                  ref={beforeRef}
                  data-no-typeset
                  style={{ ...paragraphStyle, textWrap: pretty ? 'pretty' : 'initial' }}
                />
              </div>
            </div>
          </div>

          {/* Typeset */}
          <div
            className={`border border-[#B8963E]/40 bg-neutral-950/40 ${
              mobileView === 'typeset' ? 'block' : 'hidden'
            } lg:block`}
            style={{ borderRadius: 0 }}
          >
            <div className="px-4 py-3 border-b border-neutral-800 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#B8963E]">
                Typeset engine
                {after && !after.composed ? ' — binding fallback' : ''}
              </span>
              <span className="font-mono text-[10px] text-neutral-600">{width}px</span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div style={{ width: `${width}px`, borderRight: '1px dashed #3f3f3f' }}>
                <p ref={afterRef} data-no-typeset style={paragraphStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Measured audit */}
        {before && after && (
          <div className="mt-8 border border-neutral-800 bg-neutral-950/40" style={{ borderRadius: 0 }}>
            <div className="px-4 py-3 border-b border-neutral-800">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                Measured from the rendered lines above
              </span>
            </div>
            <table className="w-full text-sm" style={{ fontFamily: 'var(--font-source-sans)' }}>
              <thead>
                <tr className="border-b border-neutral-800 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  <th className="text-left font-normal px-4 py-3">Metric</th>
                  <th className="text-right font-normal px-4 py-3">Browser</th>
                  <th className="text-right font-normal px-4 py-3 text-[#B8963E]">Typeset</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                <AuditRow
                  label="Weak words stranded at line ends"
                  hint="articles, prepositions, conjunctions, linking verbs"
                  a={before.weakEnders}
                  b={after.weakEnders}
                />
                <AuditRow
                  label="Sentence openers stranded at line ends"
                  hint="a new sentence's first word left dangling"
                  a={before.strandedOpeners}
                  b={after.strandedOpeners}
                />
                <AuditRow
                  label="Orphan on the last line"
                  a={before.orphan ? 1 : 0}
                  b={after.orphan ? 1 : 0}
                  format={(v) => (v ? 'yes' : 'no')}
                />
                <AuditRow
                  label="Rag range"
                  hint="spread between the longest and shortest line, last line excluded"
                  a={before.ragRangePct}
                  b={after.ragRangePct}
                  format={(v) => `${v}%`}
                />
                <AuditRow
                  label="Stairsteps"
                  hint="adjacent lines differing by more than 10% fill"
                  a={before.stairsteps}
                  b={after.stairsteps}
                />
                <AuditRow label="Lines" a={before.lines} b={after.lines} neutral />
              </tbody>
            </table>
          </div>
        )}

        <p
          data-no-typeset
          className="mt-6 max-w-2xl text-sm text-neutral-500 leading-relaxed"
          style={{ fontFamily: 'var(--font-source-sans)', textWrap: 'pretty' }}
        >
          The dashed line marks the column edge — the shape of each right rag
          against it is the real comparison. Zero is not always achievable:
          at narrow measures some text physically cannot avoid every
          compromise without hyphenation, and the engine will choose the least
          damaging one.
        </p>

        {/* Links */}
        <nav className="mt-16 flex flex-wrap gap-6">
          <a
            href="/utility"
            className="font-mono text-sm uppercase tracking-[0.25em] text-[#B8963E] hover:text-[#d4b158] transition-colors border-b border-[#B8963E] hover:border-[#d4b158] pb-1"
            style={{ borderRadius: 0 }}
          >
            Get the Utility
          </a>
          <a
            href="/"
            className="font-mono text-sm uppercase tracking-[0.25em] text-neutral-400 hover:text-neutral-200 transition-colors border-b border-neutral-700 hover:border-neutral-400 pb-1"
            style={{ borderRadius: 0 }}
          >
            Back to Tools
          </a>
        </nav>
      </section>
    </main>
  );
}

function AuditRow({
  label,
  hint,
  a,
  b,
  format = (v: number) => String(v),
  neutral = false,
}: {
  label: string;
  hint?: string;
  a: number;
  b: number;
  format?: (v: number) => string;
  neutral?: boolean;
}) {
  const improved = !neutral && b < a;
  const worse = !neutral && b > a;
  return (
    <tr className="border-b border-neutral-800/60 last:border-b-0">
      <td className="px-4 py-3">
        {label}
        {hint && (
          <span className="block text-xs text-neutral-600" style={{ textWrap: 'pretty' }}>
            {hint}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-neutral-400">{format(a)}</td>
      <td
        className={`px-4 py-3 text-right font-mono ${
          improved ? 'text-[#B8963E]' : worse ? 'text-red-400' : 'text-neutral-300'
        }`}
      >
        {format(b)}
      </td>
    </tr>
  );
}
