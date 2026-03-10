'use client';

import { useState, useEffect, useRef } from 'react';
import { typesetText, smoothRag, measureCh, postRenderFix } from '@/lib/typeset';

const DEFAULT_TEXT = "She worked in a studio on the edge of the city. It was small but it had good light and a view of the park. On clear days she could see all the way to the bridge. The tools of her trade filled every surface \u2014 ink, paper, type specimens, a loupe she kept on a chain. Everything in its place. She believed good work came from good order, and she was right about that.";

interface ToggleOption {
  id: string;
  label: string;
  description: string;
  cssRule?: string;
  jsRequired?: boolean;
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
    label: 'Rag smoothing',
    description: 'Knuth-Plass optimal line breaking for even right edge',
    jsRequired: true,
  },
  {
    id: 'lineHeight',
    label: 'Optimal line height',
    description: 'line-height: 1.6 for comfortable reading',
    cssRule: 'line-height: 1.6;',
  },
  {
    id: 'measure',
    label: 'Proper measure',
    description: 'max-width: 51ch — optimal line length',
    cssRule: 'max-width: 51ch;',
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
  const smoothRagCleanupRef = useRef<(() => void) | null>(null);

  // Calculate refinement score
  const enabledCount = Object.values(toggles).filter(Boolean).length;
  const totalCount = Object.keys(toggles).length;
  const score = Math.round((enabledCount / totalCount) * 100);

  // Apply typesetting to the right panel
  useEffect(() => {
    if (!typesetRef.current) return;

    // Reset
    typesetRef.current.innerHTML = text;
    if (smoothRagCleanupRef.current) {
      smoothRagCleanupRef.current();
      smoothRagCleanupRef.current = null;
    }

    // Apply typesetText if any of the text-processing toggles are enabled
    // CRITICAL: pass actual container measure so bindings scale correctly
    // for the viewport width. Without this, defaults to 65ch and fires
    // all bindings even on a 30ch mobile screen.
    const needsTypesetting = toggles.orphan || toggles.shortWord || toggles.sentenceStart || toggles.sentenceEnd;
    if (needsTypesetting) {
      const measure = measureCh(typesetRef.current);
      typesetRef.current.innerHTML = typesetText(text, { measure });
    }

    // Apply smoothRag if enabled (legacy full Knuth-Plass)
    if (toggles.ragSmoothing) {
      smoothRagCleanupRef.current = smoothRag(typesetRef.current);
    }

    // Post-render analysis: detect and fix actual rendered problems.
    // This runs AFTER the browser has laid out the text, so it can
    // measure real line widths and fix real orphans.
    if (needsTypesetting && !toggles.ragSmoothing) {
      // Only run post-render fix when smoothRag isn't handling it
      // (smoothRag already does its own line analysis)
      requestAnimationFrame(() => {
        if (typesetRef.current) {
          const cleanup = postRenderFix(typesetRef.current);
          if (cleanup) smoothRagCleanupRef.current = cleanup;
        }
      });
    }
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

    let code = `import { ${hasTypesetting ? 'typesetText' : ''}${hasTypesetting && hasRagSmoothing ? ', ' : ''}${hasRagSmoothing ? 'smoothRag' : ''} } from '@/lib/typeset';\n\n`;
    code += `const element = document.querySelector('.typeset-paragraph');\n`;

    if (hasTypesetting) {
      code += `const text = element.textContent;\n`;
      code += `element.innerHTML = typesetText(text);\n`;
    }

    if (hasRagSmoothing) {
      code += `${hasTypesetting ? '' : '\n'}smoothRag(element);\n`;
    }

    return code;
  };

  const cssCode = generateCSS();
  const jsCode = generateJS();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 px-4 py-6 sm:p-6 lg:p-8">
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
            they add up to something&nbsp;exceptional.
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
                className="font-mono text-xs uppercase tracking-wider text-neutral-400 hover:text-[#B8963E] transition-colors"
              >
                Enable All
              </button>
              <span className="text-neutral-700">|</span>
              <button
                onClick={handleDisableAll}
                className="font-mono text-xs uppercase tracking-wider text-neutral-400 hover:text-[#B8963E] transition-colors"
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
            <p
              className="text-neutral-400 text-base sm:text-lg break-words"
              data-no-typeset
              data-no-smooth
              style={{
                maxWidth: toggles.measure ? 'min(51ch, 100%)' : undefined,
              }}
            >
              {text}
            </p>
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
              className="text-neutral-200 text-base sm:text-lg leading-relaxed break-words"
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
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
            Typographic Refinements
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {TOGGLE_OPTIONS.map((option) => (
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
          <div className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 min-w-0 overflow-hidden">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
              Copy the Code
            </p>

            {cssCode && (
              <div className="mb-6">
                <p className="text-neutral-400 text-sm mb-2 font-mono">CSS</p>
                <pre className="bg-neutral-900 border border-neutral-800 p-4 overflow-x-auto text-sm text-neutral-300 font-mono">
                  {cssCode}
                </pre>
              </div>
            )}

            {jsCode && (
              <div>
                <p className="text-neutral-400 text-sm mb-2 font-mono">JavaScript</p>
                <pre className="bg-neutral-900 border border-neutral-800 p-4 overflow-x-auto text-sm text-neutral-300 font-mono">
                  {jsCode}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
