'use client';

import { useState, useEffect, useRef } from 'react';
import typeset, { typesetText, measureCh, measureLayout } from '@/lib/typeset-site';
import CodeBlock from '@/components/CodeBlock';

const DEFAULT_TEXT = "She worked in a studio on the edge of the city. It was small but it had good light and a view of the park across the road. The tools of her trade filled every surface \u2014 ink, paper, type specimens, a loupe she kept on a brass chain. Everything had its place and every place had a purpose. She believed good work came from good order, and two decades of practice had proven her right.";

interface ToggleOption {
  id: string;
  label: string;
  description: string;
  cssRule?: string;
  jsRequired?: boolean;
  /** Canvas properties (measure, leading) apply to BOTH panels — the
   *  comparison is only honest when the column is identical and the sole
   *  difference is the setting. */
  shared?: boolean;
}

/** Weak words for the live tally — same vocabulary as the grader. */
const WEAK = new Set([
  'a', 'an', 'the', 'of', 'in', 'at', 'by', 'to', 'for', 'with', 'from', 'on',
  'into', 'upon', 'about', 'between', 'through', 'without', 'during', 'before',
  'after', 'against', 'among', 'within', 'beyond', 'toward', 'towards',
  'across', 'along', 'behind', 'beneath', 'beside', 'despite', 'except',
  'inside', 'outside', 'until', 'unlike', 'and', 'or', 'but', 'nor', 'yet',
  'so', 'is', 'are', 'was', 'were', 'be', 'been', 'as', 'if', 'than', 'that',
]);

type PanelTally = { lines: number; weak: number; orphan: boolean };

/** Measure a panel's ACTUAL rendering: rows from word-span rects, or the
 *  engine's own frozen lines when composition is on. */
function measurePanel(p: HTMLElement): PanelTally {
  const frozen = Array.from(p.querySelectorAll<HTMLElement>(':scope > .ts-line'));
  const rows: string[] = p.dataset.tsOutcome ? measureLayout(p).lines.map(line => line.text) : [];
  if (rows.length) {
    // V4 line markers are already measured without modifying the source.
  } else if (frozen.length) {
    for (const line of frozen) rows.push((line.textContent || '').trim());
  } else {
    const spans = Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'));
    let lastTop: number | null = null;
    for (const s of spans) {
      const top = s.getBoundingClientRect().top;
      if (lastTop === null || Math.abs(top - lastTop) > 4) {
        rows.push((s.textContent || '').trim());
        lastTop = top;
      } else {
        rows[rows.length - 1] += ' ' + (s.textContent || '').trim();
      }
    }
  }
  let weak = 0;
  rows.forEach((row, i) => {
    if (i === rows.length - 1) return;
    const last = (row.split(/[\s ]+/).pop() || '').replace(/[^A-Za-z0-9’']+$/g, '').toLowerCase();
    if (WEAK.has(last)) weak++;
  });
  const lastWords = (rows[rows.length - 1] || '').split(/[\s ]+/).filter((w) => /[A-Za-z0-9]/.test(w) || w === '&');
  return { lines: rows.length, weak, orphan: rows.length > 1 && lastWords.length === 1 };
}

const TOGGLE_OPTIONS: ToggleOption[] = [
  {
    id: 'orphan',
    label: 'Orphan prevention',
    description: 'Last line must have at least 2 words',
    jsRequired: true,
  },
  {
    id: 'shortWord',
    label: 'Short word binding',
    description: 'Bind articles & prepositions (a, the, to, in, of, etc.)',
    jsRequired: true,
  },
  {
    id: 'sentenceStart',
    label: 'Sentence-start protection',
    description: 'Prevent single sentence-starting word at line end',
    jsRequired: true,
  },
  {
    id: 'sentenceEnd',
    label: 'Sentence-end protection',
    description: 'Bring a companion word with short sentence endings',
    jsRequired: true,
  },
  {
    id: 'ragSmoothing',
    label: 'Full composition (V2)',
    description: 'Beam-search line breaking with contour re-ranking and self-checked lines',
    jsRequired: true,
  },
  {
    id: 'lineHeight',
    label: 'Optimal line height',
    description: 'line-height: 1.6 for comfortable reading — applied to both panels',
    cssRule: 'line-height: 1.6;',
    shared: true,
  },
  {
    id: 'measure',
    label: 'Proper measure',
    description: 'max-width: 51ch — optimal line length, applied to both panels',
    cssRule: 'max-width: 51ch;',
    shared: true,
  },
  {
    id: 'hangingPunct',
    label: 'Hanging punctuation',
    description: 'Optical margin alignment for quotes',
    cssRule: 'hanging-punctuation: first last;',
  },
  {
    id: 'fontFeatures',
    label: 'OpenType features',
    description: 'Ligatures, oldstyle numerals, contextual alternates',
    cssRule: 'font-feature-settings: "liga" 1, "onum" 1, "calt" 1;',
  },
  {
    id: 'textWrap',
    label: 'text-wrap: pretty',
    description: 'Browser-native typographic improvement',
    cssRule: 'text-wrap: pretty;',
  },
];

export default function PerfectParagraph() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [activePanel, setActivePanel] = useState<'default' | 'typeset'>('typeset');
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    orphan: true,
    shortWord: true,
    sentenceStart: true,
    sentenceEnd: true,
    ragSmoothing: true,
    lineHeight: true,
    measure: true,
    hangingPunct: true,
    fontFeatures: true,
    textWrap: true,
  });

  const typesetRef = useRef<HTMLParagraphElement>(null);
  const defaultRef = useRef<HTMLParagraphElement>(null);
  const [tally, setTally] = useState<{ d: PanelTally; t: PanelTally } | null>(null);

  // Calculate refinement score
  const enabledCount = Object.values(toggles).filter(Boolean).length;
  const totalCount = Object.keys(toggles).length;
  const score = Math.round((enabledCount / totalCount) * 100);

  // Apply typesetting to the right panel, then measure BOTH panels — the
  // tallies under the panels are read from the actual rendering, so the
  // line economy is a fact on the page, not an impression.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await document.fonts.ready.catch(() => {});
      if (cancelled || !typesetRef.current) return;

      const el = typesetRef.current;
      const spanWrap = (s: string) =>
        s.split(' ').map((w) => `<span data-w>${w}</span>`).join(' ');

      delete el.dataset.typesetDone;

      const needsTypesetting = toggles.orphan || toggles.shortWord || toggles.sentenceStart || toggles.sentenceEnd;

      if (toggles.ragSmoothing) {
        // Full V2 compositor — composition, spacing, overflow self-check.
        el.innerHTML = text;
        el.dataset.tsRaw = text;
        typeset(el);
      } else if (needsTypesetting) {
        // Bindings only — real measure so rules scale to the column. Words
        // are span-wrapped for measurement; NBSP-bound groups stay inside
        // one span, which is exactly how the eye reads them.
        const measure = measureCh(el);
        el.innerHTML = spanWrap(
          typesetText(text, { measure }).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        );
      } else {
        el.innerHTML = spanWrap(text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
      }

      if (defaultRef.current) {
        setTally({ d: measurePanel(defaultRef.current), t: measurePanel(el) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, toggles]);

  const handleToggle = (id: string) => {
    setToggles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEnableAll = () => {
    const allEnabled = Object.keys(toggles).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setToggles(allEnabled);
  };

  const handleDisableAll = () => {
    const allDisabled = Object.keys(toggles).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setToggles(allDisabled);
  };

  // Generate CSS code
  const generateCSS = () => {
    const cssRules = TOGGLE_OPTIONS
      .filter(opt => toggles[opt.id] && opt.cssRule)
      .map(opt => `  ${opt.cssRule}`)
      .join('\n');

    if (!cssRules) return '';

    return `.typeset-paragraph {\n${cssRules}\n}`;
  };

  // Generate JS code
  const generateJS = () => {
    const jsToggles = TOGGLE_OPTIONS
      .filter(opt => toggles[opt.id] && opt.jsRequired)
      .map(opt => opt.id);

    if (jsToggles.length === 0) return '';

    const hasRagSmoothing = toggles.ragSmoothing;
    const hasTypesetting = jsToggles.some(id => id !== 'ragSmoothing');

    let code = `import typeset${hasTypesetting && !hasRagSmoothing ? ', { typesetText }' : ''} from '@/lib/typeset-site';\n\n`;
    code += `const element = document.querySelector('.typeset-paragraph');\n`;

    if (hasRagSmoothing) {
      code += `typeset(element); // full pipeline: composition + spacing + self-checks\n`;
    } else if (hasTypesetting) {
      code += `const text = element.textContent;\n`;
      code += `element.innerHTML = typesetText(text);\n`;
    }

    return code;
  };

  const cssCode = generateCSS();
  const jsCode = generateJS();

  return (
    <div className="min-h-screen bg-[#0a0a0a]/85 text-neutral-200 px-4 py-6 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto min-w-0 overflow-hidden">
        {/* Header */}
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            05 -- The Perfect Paragraph
          </p>
          <h1 className="text-3xl sm:text-5xl font-serif mb-4" style={{ fontFamily: 'var(--font-playfair)' }}>
            The Perfect Paragraph
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg max-w-3xl" style={{ textWrap: "pretty" }}>
            The gap between default browser text and well-set type is vast — but
            made of small, precise choices. Toggle each layer below to see how
            they add up to something exceptional. Both panels share the same
            column — the counts underneath are measured from the rendering, so
            the difference you see is the setting, not the&nbsp;layout.
          </p>
        </div>

        {/* Refinement Score */}
        <div className="mb-8 border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              Refinement Score
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnableAll}
                className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-[#B8963E] transition-colors"
              >
                Enable All
              </button>
              <span className="text-neutral-700">|</span>
              <button
                onClick={handleDisableAll}
                className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 hover:text-[#B8963E] transition-colors"
              >
                Disable All
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-neutral-900 relative overflow-hidden">
              <div
                className="h-full bg-[#B8963E] transition-all duration-500 ease-out"
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="text-3xl font-bold text-[#B8963E] font-mono w-20 text-right">
              {score}%
            </div>
          </div>
        </div>

        {/* Mobile: toggle between panels. Desktop: side-by-side. */}
        <div className="md:hidden flex mb-4 border border-neutral-800 bg-neutral-950/50">
          <button
            onClick={() => setActivePanel('default')}
            className={`flex-1 py-3 font-mono text-xs uppercase tracking-[0.3em] transition-colors ${
              activePanel === 'default'
                ? 'text-neutral-200 bg-neutral-800/50'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Default
          </button>
          <button
            onClick={() => setActivePanel('typeset')}
            className={`flex-1 py-3 font-mono text-xs uppercase tracking-[0.3em] transition-colors ${
              activePanel === 'typeset'
                ? 'text-[#B8963E] bg-neutral-800/50'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Typeset
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Left: Browser Default — hidden on mobile when Typeset panel active */}
          <div className={`border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden ${
            activePanel !== 'default' ? 'hidden md:block' : ''
          }`}>
            <p className="hidden md:block font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 mb-6">
              Browser Default
            </p>
            {/* The default panel is the CONTROL for the SETTING — but it
                shares the CANVAS (measure, leading). A comparison across two
                different columns is rigged in the browser's favor: the
                typeset side read as a space-eater purely because it was
                narrower and taller-leaded. Same column, same leading; the
                only difference the eye sees is the setting itself. */}
            <p
              ref={defaultRef}
              className="text-neutral-400 text-base sm:text-lg break-words"
              data-no-typeset
              data-no-smooth
              style={{
                maxWidth: toggles.measure ? 'min(51ch, 100%)' : undefined,
                lineHeight: toggles.lineHeight ? '1.6' : undefined,
              }}
            >
              {text.split(' ').map((w, i, arr) => (
                <span data-w key={i}>{w}{i < arr.length - 1 ? ' ' : ''}</span>
              ))}
            </p>
            {tally && (
              <p className="mt-6 font-mono text-xs text-neutral-500" data-no-typeset>
                {tally.d.lines} lines · {tally.d.weak} weak line-end{tally.d.weak === 1 ? '' : 's'} ·{' '}
                {tally.d.orphan ? 'a word abandoned on the last line' : 'no abandoned last word'}
              </p>
            )}
          </div>

          {/* Right: Typeset — hidden on mobile when Default panel active */}
          <div className={`border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden ${
            activePanel !== 'typeset' ? 'hidden md:block' : ''
          }`}>
            <p className="hidden md:block font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
              Typeset
            </p>
            <p
              ref={typesetRef}
              data-no-typeset
              data-no-smooth
              className="text-neutral-200 text-base sm:text-lg break-words"
              style={{
                lineHeight: toggles.lineHeight ? '1.6' : undefined,
                maxWidth: toggles.measure ? 'min(51ch, 100%)' : undefined,
                hangingPunctuation: toggles.hangingPunct ? 'first last' : undefined,
                fontFeatureSettings: toggles.fontFeatures ? '"liga" 1, "onum" 1, "calt" 1' : undefined,
                textWrap: toggles.textWrap ? 'pretty' : undefined,
              }}
            >
              {text}
            </p>
            {tally && (
              <p className="mt-6 font-mono text-xs text-neutral-500" data-no-typeset>
                <span className="text-[#B8963E]">{tally.t.lines} lines</span> · {tally.t.weak} weak line-end{tally.t.weak === 1 ? '' : 's'} ·{' '}
                {tally.t.orphan ? 'a word abandoned on the last line' : 'no abandoned last word'}
              </p>
            )}
          </div>
        </div>

        {/* Edit text */}
        <div className="mb-12 border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            Edit Text
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 p-4 text-neutral-200 font-sans min-h-[120px] focus:outline-none focus:border-[#B8963E] transition-colors"
            placeholder="Enter your paragraph here..."
          />
        </div>

        {/* Toggle controls */}
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-2">
            The Column — applied to both panels
          </p>
          <p className="text-sm text-neutral-500 mb-6 max-w-2xl" data-no-typeset>
            Width and leading are layout decisions, so they change both sides
            equally — a comparison across two different columns would be
            rigged. The panels differ only in the setting.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mb-10">
            {TOGGLE_OPTIONS.filter((o) => o.shared).map((option) => (
              <div
                key={option.id}
                className="border border-neutral-800 bg-neutral-950/50 p-3 sm:p-4 hover:border-neutral-700 transition-colors"
              >
                <label className="flex items-start gap-4 cursor-pointer">
                  <div className="relative flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={toggles[option.id]}
                      onChange={() => handleToggle(option.id)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 border transition-all ${
                        toggles[option.id]
                          ? 'bg-[#B8963E] border-[#B8963E]'
                          : 'border-neutral-700 bg-neutral-900'
                      }`}
                    >
                      {toggles[option.id] && (
                        <svg className="w-full h-full text-black" viewBox="0 0 20 20" fill="none">
                          <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-200 mb-1">
                      {option.label}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {option.description}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            The Setting — typeset panel only
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {TOGGLE_OPTIONS.filter((o) => !o.shared).map((option) => (
              <div
                key={option.id}
                className="border border-neutral-800 bg-neutral-950/50 p-3 sm:p-4 hover:border-neutral-700 transition-colors"
              >
                <label className="flex items-start gap-4 cursor-pointer">
                  <div className="relative flex-shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={toggles[option.id]}
                      onChange={() => handleToggle(option.id)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 border transition-all ${
                        toggles[option.id]
                          ? 'bg-[#B8963E] border-[#B8963E]'
                          : 'border-neutral-700 bg-neutral-900'
                      }`}
                    >
                      {toggles[option.id] && (
                        <svg
                          className="w-full h-full text-black"
                          viewBox="0 0 20 20"
                          fill="none"
                        >
                          <path
                            d="M4 10l4 4 8-8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="square"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-200 mb-1">
                      {option.label}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {option.description}
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Copy the code */}
        {(cssCode || jsCode) && (
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
              Copy the Code
            </p>
            {cssCode && <CodeBlock code={cssCode} title="CSS" />}
            {jsCode && <CodeBlock code={jsCode} title="JavaScript" />}
          </div>
        )}
      </div>
    </div>
  );
}
