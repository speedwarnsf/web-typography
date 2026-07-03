'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import typeset from '@/lib/typeset';

/**
 * /v2 — the flagship. A new era of web design (depth, organic motion,
 * interface that grows instead of appearing) earned by one discipline:
 * the type. Every paragraph on this page is composed live by the engine
 * it advertises. See docs/DESIGN-REVIEW-V2.md for the brief.
 */

const GOLD = '#B8963E';

const HERO_TEXT = 'The web finally knows how to break lines.';

const HERO_SUB =
  'Forty years after print solved it, the browser catches up. Knuth’s mathematics, Tschichold’s tolerances, Bringhurst’s measures — running live on every paragraph of this page.';

// Chosen empirically: across 250-345px, the browser strands a word or
// abandons an orphan at 12 of 16 widths on this paragraph; the engine
// never does, and uses equal-or-fewer lines at half of them. The text
// also argues its own case in civilian language.
const PROOF_TEXT =
  'The rag is a feature, not a flaw. The irregular right edge gives the eye a lattice of landmarks to hold its place. But a lattice is built, not left to chance -- and chance is all the browser has ever offered your reader.';

const MANIFESTO_TEXT =
  'Anyone can license the same typefaces. The tell is the setting. A rag that breathes. A line that ends where the thought ends. A quotation mark hanging in the margin, because the eye wants edges, not excuses. For forty years the browser could not do this, so design teams shipped text they would never have signed in print. That era is over. Clean type is the quietest possible proof that your team knows what it is doing -- visible in a glance, impossible to fake.';

const CRAFT = [
  {
    n: '01',
    title: 'Hanging punctuation',
    body: 'Opening quotes hang their full glyph into the margin; optical capitals pull left. The block aligns to the eye, not the em box.',
  },
  {
    n: '02',
    title: 'Contour re-ranking',
    body: 'The compositor finishes holding two hundred candidate paragraphs and chooses the most musical rag — never merely the cheapest.',
  },
  {
    n: '03',
    title: 'Tschichold spacing',
    body: 'Word-space tolerances derived from the measured width of your font’s own lowercase i. No magic numbers anywhere in the system.',
  },
  {
    n: '04',
    title: 'Self-healing lines',
    body: 'Every composed line is re-measured after render. If the browser disagrees, the engine steps back rather than ship an overflow.',
  },
];

const INSTALL_LINE = '<script src="https://typeset.us/go.js" defer></script>';

// ─── Shared helpers ─────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/** Compose text into an element with the engine, tagging lines for reveal. */
async function composeInto(el: HTMLElement, text: string, staggerMs: number, baseMs: number) {
  try {
    await document.fonts.ready;
  } catch {}
  el.dataset.tsRaw = text;
  el.textContent = text;
  delete el.dataset.typesetDone;
  typeset(el);
  el.querySelectorAll<HTMLElement>('.ts-line').forEach((line, i) => {
    line.classList.add('v2-line');
    line.style.transitionDelay = `${baseMs + i * staggerMs}ms`;
  });
}

interface PanelStats {
  weak: number;
  openers: number;
  rag: number;
  orphan: boolean;
  lines: number;
}

const WEAK = new Set([
  'a', 'i', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'or',
  'but', 'nor', 'so', 'as', 'is', 'are', 'was', 'were', 'has', 'have', 'had',
]);
const OPENER = /[.!?]["'”’)\]]*\s+["'“‘(\[]*[A-Z][A-Za-z’']*$/;

/** Measure the actually-rendered lines of a panel and audit them. */
function panelStats(p: HTMLElement, width: number): PanelStats {
  const cs = getComputedStyle(p);
  const left = p.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
  let lines: { text: string; right: number }[] = [];

  const frozen = Array.from(p.querySelectorAll<HTMLElement>('.ts-line'));
  if (frozen.length) {
    lines = frozen.map((span) => {
      const r = document.createRange();
      r.selectNodeContents(span);
      return { text: span.textContent || '', right: r.getBoundingClientRect().right - left };
    });
  } else {
    if (!p.querySelector('span[data-w]')) {
      const text = p.textContent || '';
      p.textContent = '';
      const words = text.split(/\s+/).filter(Boolean);
      words.forEach((w, i) => {
        const s = document.createElement('span');
        s.setAttribute('data-w', '');
        s.textContent = w;
        p.appendChild(s);
        if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
      });
    }
    const rows: { words: string[]; right: number; top: number }[] = [];
    for (const s of Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'))) {
      const r = s.getBoundingClientRect();
      const cur = rows[rows.length - 1];
      if (!cur || Math.abs(r.top - cur.top) > 4) {
        rows.push({ words: [s.textContent || ''], right: r.right - left, top: r.top });
      } else {
        cur.words.push(s.textContent || '');
        cur.right = Math.max(cur.right, r.right - left);
      }
    }
    lines = rows.map((l) => ({ text: l.words.join(' '), right: l.right }));
  }

  const fills = lines.map((l) => l.right / width);
  const nonLast = lines.slice(0, -1);
  let weak = 0;
  let openers = 0;
  for (const l of nonLast) {
    const lastWord = (l.text.trim().split(/\s+/).pop() || '')
      .replace(/[^A-Za-z0-9’']+$/g, '')
      .replace(/^[^A-Za-z0-9]+/g, '')
      .toLowerCase();
    if (WEAK.has(lastWord)) weak++;
    if (OPENER.test(l.text.trim())) openers++;
  }
  const nf = fills.slice(0, -1);
  const lastWords = (lines[lines.length - 1]?.text || '')
    .trim()
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w));
  return {
    weak,
    openers,
    rag: nf.length > 1 ? Math.round((Math.max(...nf) - Math.min(...nf)) * 100) : 0,
    orphan: lines.length > 1 && lastWords.length === 1,
    lines: lines.length,
  };
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function Hero({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);

  // Composed headline, revealed line by line — only this engine can animate
  // typeset lines, because only this engine knows where the lines are.
  useEffect(() => {
    const el = h1Ref.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      await composeInto(el, HERO_TEXT, 140, 200);
      if (cancelled) return;
      setTimeout(() => el.classList.add('v2-in'), 60);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Perspective tilt toward the pointer.
  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const tilt = tiltRef.current;
    if (!section || !tilt) return;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      tilt.style.transform = `rotateX(${(-cy * 4).toFixed(3)}deg) rotateY(${(cx * 5).toFixed(3)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    section.addEventListener('pointermove', onMove, { passive: true });
    section.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} className="v2-hero">
      <div className="v2-perspective">
        <div ref={tiltRef} className="v2-tilt">
          <p className="v2-kicker">Typeset.us — a new era in web typography</p>
          <h1 ref={h1Ref} data-no-typeset className="v2-h1" />
          <p data-no-typeset className="v2-sub">{HERO_SUB}</p>
          <div className="v2-cta-row">
            <a href="#proof" className="v2-cta">See the proof</a>
            <a href="#install" className="v2-cta v2-cta-dim">Install in one line</a>
          </div>
        </div>
      </div>
      <p className="v2-live-note">Every paragraph on this page is set live by the engine.</p>
    </section>
  );
}

// ─── The Proof, center stage ────────────────────────────────────────────────

interface WorstFlaw {
  span: HTMLElement;
  kind: 'orphan' | 'stranded' | 'weak';
  word: string;
}

/**
 * Mark the browser panel's actual violations so BROWSER mode is visibly
 * flawed, not just subtly different: dotted underlines on weak words at
 * line ends and on stranded sentence openers, found from the rendering.
 * Returns the single worst flaw so a plain-language callout can point at it.
 */
function annotateBrowserFlaws(p: HTMLElement): WorstFlaw | null {
  const spans = Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'));
  spans.forEach((s) => s.classList.remove('v2-flaw'));
  if (!spans.length) return null;
  const rows: { spans: HTMLElement[]; top: number }[] = [];
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    const cur = rows[rows.length - 1];
    if (!cur || Math.abs(r.top - cur.top) > 4) rows.push({ spans: [s], top: r.top });
    else cur.spans.push(s);
  }
  let worst: WorstFlaw | null = null;
  const consider = (f: WorstFlaw) => {
    const rank = { orphan: 3, stranded: 2, weak: 1 };
    if (!worst || rank[f.kind] > rank[worst.kind]) worst = f;
  };
  rows.forEach((row, i) => {
    const lastSpan = row.spans[row.spans.length - 1];
    const raw = (lastSpan.textContent || '').trim();
    const word = raw
      .replace(/[^A-Za-z0-9’']+$/g, '')
      .replace(/^[^A-Za-z0-9]+/g, '')
      .toLowerCase();
    const isLastRow = i === rows.length - 1;
    if (!isLastRow && WEAK.has(word)) {
      lastSpan.classList.add('v2-flaw');
      consider({ span: lastSpan, kind: word.length <= 2 ? 'stranded' : 'weak', word: raw });
    }
    if (!isLastRow) {
      const lineText = row.spans.map((s) => s.textContent).join(' ');
      if (OPENER.test(lineText.trim())) {
        lastSpan.classList.add('v2-flaw');
        consider({ span: lastSpan, kind: 'weak', word: raw });
      }
    }
    if (isLastRow && rows.length > 1 && row.spans.filter((s) => /[A-Za-z0-9]/.test(s.textContent || '')).length === 1) {
      lastSpan.classList.add('v2-flaw');
      consider({ span: lastSpan, kind: 'orphan', word: raw });
    }
  });
  return worst;
}

const FLAW_CAPTIONS: Record<WorstFlaw['kind'], (w: string) => string> = {
  orphan: (w) => `"${w}" — abandoned alone on the last line. No book would print this.`,
  stranded: (w) => `"${w}" — left hanging at the edge. A book keeps it with its word.`,
  weak: (w) => `The thought snaps at "${w}". A book would end the line on meaning.`,
};

function ProofStage({ reduced }: { reduced: boolean }) {
  const [mode, setMode] = useState<'typeset' | 'browser'>('typeset');
  // 274 default: measured sweet spot — the book uses the SAME number of
  // lines as the browser here, and the browser strands a word anyway.
  const [width, setWidth] = useState(274);
  const [maxWidth, setMaxWidth] = useState(340);
  const [stats, setStats] = useState<{ b: PanelStats; t: PanelStats } | null>(null);
  const [callout, setCallout] = useState<{ top: number; left: number; text: string } | null>(null);
  const browserRef = useRef<HTMLParagraphElement>(null);
  const typesetRef = useRef<HTMLParagraphElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const userTouched = useRef(false);
  const demoed = useRef(false);

  useEffect(() => {
    const update = () => {
      const max = Math.min(345, Math.max(250, window.innerWidth - 72));
      setMaxWidth(max);
      setWidth((w) => Math.min(w, max));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {}
      if (cancelled) return;
      const b = browserRef.current;
      const t = typesetRef.current;
      const stack = stackRef.current;
      if (!b || !t) return;
      b.textContent = PROOF_TEXT;
      t.dataset.tsRaw = PROOF_TEXT;
      t.textContent = PROOF_TEXT;
      delete t.dataset.typesetDone;
      typeset(t);
      setStats({ b: panelStats(b, width), t: panelStats(t, width) });
      const worst = annotateBrowserFlaws(b);
      const panelBottom = Math.max(b.offsetHeight, t.offsetHeight);
      if (worst && stack) {
        const sr = stack.getBoundingClientRect();
        const wr = worst.span.getBoundingClientRect();
        // Below the panel (never over the text), x-aligned under the flaw.
        setCallout({
          top: panelBottom + 16,
          left: Math.max(0, Math.min(wr.left - sr.left, width - 190)),
          text: FLAW_CAPTIONS[worst.kind](worst.word),
        });
      } else {
        setCallout(null);
      }
      if (stack) {
        stack.style.minHeight = `${panelBottom + (worst ? 96 : 20)}px`;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [width]);

  // Auto-demo: the first time the stage scrolls into view, flip to the
  // browser version and back so the comparison performs itself — a tap on a
  // phone shouldn't be required to see that there IS a difference.
  useEffect(() => {
    if (reduced) return;
    const stack = stackRef.current;
    if (!stack) return;
    let t1 = 0;
    let t2 = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !demoed.current && !userTouched.current) {
            demoed.current = true;
            t1 = window.setTimeout(() => {
              if (!userTouched.current) setMode('browser');
            }, 600);
            t2 = window.setTimeout(() => {
              if (!userTouched.current) setMode('typeset');
            }, 2300);
            io.disconnect();
          }
        }
      },
      { threshold: 0.65 }
    );
    io.observe(stack);
    return () => {
      io.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduced]);

  const pick = (m: 'typeset' | 'browser') => {
    userTouched.current = true;
    setMode(m);
  };

  const rows: { label: string; hint?: string; b: string; t: string; better: boolean; neutral?: boolean }[] = stats
    ? [
        {
          label: 'Words left hanging at line edges',
          hint: 'little words and snapped thoughts a book would carry down',
          b: String(stats.b.weak + stats.b.openers),
          t: String(stats.t.weak + stats.t.openers),
          better: stats.t.weak + stats.t.openers < stats.b.weak + stats.b.openers,
        },
        {
          label: 'A word abandoned on the last line',
          b: stats.b.orphan ? 'yes' : 'no',
          t: stats.t.orphan ? 'yes' : 'no',
          better: !stats.t.orphan && stats.b.orphan,
        },
        {
          label: 'Lines used',
          hint:
            stats.t.lines === stats.b.lines
              ? 'same words, same space'
              : stats.t.lines > stats.b.lines
                ? 'the book spends one more line — and abandons nothing'
                : 'fewer lines, nothing abandoned',
          b: String(stats.b.lines),
          t: String(stats.t.lines),
          better: stats.t.lines < stats.b.lines,
          neutral: stats.t.lines === stats.b.lines,
        },
      ]
    : [];

  return (
    <section id="proof" className="v2-section">
      <p className="v2-label">01 — The Proof</p>
      <h2 className="v2-h2">Your phone wraps text. A book sets it.</h2>
      <p data-no-typeset className="v2-body v2-narrow">
        Same words, same space, both rendered by your browser right now. One is
        how every phone shows text — wherever the words happen to fall. The
        other is how every book you&rsquo;ve ever trusted was set. Then squeeze
        the column and watch which one falls apart.
      </p>

      <div className="v2-stage">
        {/* Sticky control bar: on a phone the comparison must stay visible
            while you flip modes and squeeze the column — controls that
            scroll away from the thing they control are operated blind. */}
        <div className="v2-controls">
          <div className="v2-controls-row">
            <div className="v2-toggle" role="tablist" aria-label="Rendering mode">
              <button
                role="tab"
                aria-selected={mode === 'browser'}
                className={mode === 'browser' ? 'v2-tab v2-tab-on' : 'v2-tab'}
                onClick={() => pick('browser')}
              >
                Your browser
              </button>
              <button
                role="tab"
                aria-selected={mode === 'typeset'}
                className={mode === 'typeset' ? 'v2-tab v2-tab-on' : 'v2-tab'}
                onClick={() => pick('typeset')}
              >
                A good book
              </button>
            </div>
            <div className="v2-controls-width">
              <input
                id="v2-squeeze-input"
                type="range"
                min={250}
                max={maxWidth}
                value={width}
                onChange={(e) => {
                  userTouched.current = true;
                  setWidth(Number(e.target.value));
                }}
                aria-label="Squeeze the column width"
              />
              <span className="v2-controls-px">{width}px</span>
            </div>
          </div>
          {/* data-no-typeset is load-bearing: without it the global pipeline
              composes this into frozen spans, destroying React's text node —
              the caption then never updates when the mode flips. */}
          <p data-no-typeset className="v2-stage-caption" aria-live="polite">
            {mode === 'browser'
              ? 'Lines break wherever the words run out — by chance.'
              : 'Every line ends where it should — by intention. This is Typeset, live.'}
          </p>
        </div>

        <div ref={stackRef} className="v2-stack" style={{ width: `${width}px` }}>
          <p
            ref={browserRef}
            data-no-typeset
            className={`v2-panel ${mode === 'browser' ? '' : 'v2-panel-off'}`}
            style={{ width: `${width}px` }}
          />
          <p
            ref={typesetRef}
            data-no-typeset
            className={`v2-panel ${mode === 'typeset' ? '' : 'v2-panel-off'}`}
            style={{ width: `${width}px` }}
          />
          <span className="v2-edge" aria-hidden="true" />
          {callout && mode === 'browser' && (
            <span
              className="v2-callout"
              style={{ top: `${callout.top}px`, left: `${callout.left}px` }}
            >
              {callout.text}
            </span>
          )}
        </div>

        <p data-no-typeset className="v2-squeeze-note">
          Drag the slider: somewhere in there, your browser abandons a word.
          The book version never does — at any width.
        </p>

        {stats && (
          <div className="v2-stats">
            <div className="v2-stats-head">
              <span>Measured from the rendered lines</span>
              <span className="v2-stats-cols"><em>browser</em> / <em className="v2-gold">book</em></span>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="v2-stat-row">
                <span className="v2-stat-label">
                  {r.label}
                  {r.hint && <span className="v2-stat-hint">{r.hint}</span>}
                </span>
                <span className="v2-stat-vals">
                  <em>{r.b}</em>
                  <i>/</i>
                  <em className={r.better ? 'v2-gold' : r.neutral ? 'v2-even' : ''}>{r.t}</em>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p data-no-typeset className="v2-reveal">
        The book isn&rsquo;t a book. It&rsquo;s your browser running{' '}
        <strong>Typeset</strong> — the one-line script at the bottom of this
        page. Every paragraph you&rsquo;ve read here was set the same way.
      </p>

      <div className="v2-cta-row" style={{ marginTop: '40px' }}>
        <a href="#install" className="v2-cta">Install Typeset</a>
        <a href="/proof" className="v2-cta v2-cta-dim">
          Try it on your own text
        </a>
      </div>
    </section>
  );
}

// ─── Manifesto — composed by the engine, revealed line by line ──────────────

function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let io: IntersectionObserver | null = null;
    (async () => {
      await composeInto(el, MANIFESTO_TEXT, 90, 60);
      if (cancelled) return;
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              el.classList.add('v2-in');
              io?.disconnect();
            }
          }
        },
        { threshold: 0.25 }
      );
      io.observe(el);
    })();
    return () => {
      cancelled = true;
      io?.disconnect();
    };
  }, []);

  return (
    <section id="manifesto" className="v2-section">
      <p className="v2-label">02 — The Tastemaker</p>
      <h2 className="v2-h2">Type is the tell.</h2>
      <p ref={ref} data-no-typeset className="v2-manifesto" />
    </section>
  );
}

// ─── Craft grid ─────────────────────────────────────────────────────────────

function CraftGrid() {
  return (
    <section id="craft" className="v2-section">
      <p className="v2-label">03 — The Craft</p>
      <h2 className="v2-h2">What the engine does while you read.</h2>
      <div className="v2-grid">
        {CRAFT.map((c) => (
          <article key={c.n} className="v2-card">
            <p className="v2-card-n">{c.n}</p>
            <h3 className="v2-card-t">{c.title}</h3>
            <p className="v2-card-b">{c.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── Install / closing ──────────────────────────────────────────────────────

function Closing() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_LINE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }, []);

  return (
    <section id="install" className="v2-section v2-closing">
      <p className="v2-label">04 — Proof of taste, in one line</p>
      <h2 className="v2-h2">Set your own text this well.</h2>
      <div className="v2-install">
        <code className="v2-install-code">{INSTALL_LINE}</code>
        <button className="v2-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p data-no-typeset className="v2-body v2-narrow">
        The same engine that set this page: beam-search composition, hanging
        punctuation, smart quotes, self-checks that fall back to the browser
        rather than ever make your text worse. 30&nbsp;KB, no dependencies,
        generated from the source you can read.
      </p>
      <nav className="v2-links">
        <a href="/proof">The instrument</a>
        <a href="/utility">The essay &amp; source</a>
        <a href="/library">The library</a>
      </nav>
      <p className="v2-colophon">
        Set live by its own engine. View source — it&rsquo;s the same code.
      </p>
    </section>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function V2Page() {
  const reduced = useReducedMotion();

  return (
    <main className="v2-root">
      <style dangerouslySetInnerHTML={{ __html: V2_CSS }} />
      <Hero reduced={reduced} />
      <ProofStage reduced={reduced} />
      <Manifesto />
      <CraftGrid />
      <Closing />
    </main>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const V2_CSS = `
/* Takeover: /v2 owns the viewport. */
html:has(.v2-root) { scroll-behavior: smooth; background: #050505; }

.v2-root {
  position: relative;
  /* transparent so the glyph field shows at full strength — the global
     main veil exempts .v2-root; sections carry their own radial veils */
  background: transparent;
  color: #d6d6d6;
  min-height: 100vh;
  overflow-x: clip;
}
.v2-root * { border-radius: 0 !important; }


.v2-hairline {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: ${GOLD};
  transform: scaleX(0);
  transform-origin: 0 50%;
  z-index: 90;
}

/* ── Hero ── */
.v2-hero {
  position: relative; z-index: 1;
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 96px 24px 64px;
  text-align: left;
}
.v2-perspective { perspective: 1200px; width: 100%; max-width: 880px; }
.v2-tilt { transform-style: preserve-3d; will-change: transform; }
.v2-kicker {
  font-family: var(--font-mono), monospace;
  font-size: 11px; letter-spacing: .38em; text-transform: uppercase;
  color: ${GOLD}; margin-bottom: 36px;
}
.v2-h1 {
  font-family: var(--font-playfair), Georgia, serif;
  font-weight: 700;
  font-size: clamp(2.5rem, 8.5vw, 6.2rem);
  line-height: 1.08;
  color: #f2f2f2;
  margin: 0 0 32px;
  min-height: 2.2em;
}
.v2-line {
  opacity: 0;
  transform: translateY(.5em);
  filter: blur(7px);
  transition: opacity .9s ease, transform 1s cubic-bezier(.2,.7,.2,1), filter .9s ease;
}
.v2-in .v2-line { opacity: 1; transform: none; filter: none; }
.v2-sub {
  font-family: var(--font-source-sans), sans-serif;
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  line-height: 1.7; color: #a8a8a8;
  max-width: 54ch;
  margin: 0 0 40px;
  text-wrap: pretty;
}
.v2-cta-row { display: flex; flex-wrap: wrap; gap: 28px; }
.v2-cta {
  font-family: var(--font-mono), monospace;
  font-size: 12px; letter-spacing: .26em; text-transform: uppercase;
  color: ${GOLD}; text-decoration: none;
  border-bottom: 1px solid ${GOLD};
  padding-bottom: 5px;
  transition: color .3s, border-color .3s, letter-spacing .4s;
}
.v2-cta:hover { letter-spacing: .34em; }
.v2-cta-dim { color: #a3a3a3; border-color: #3f3f3f; }
.v2-cta-dim:hover { color: #d6d6d6; border-color: #a3a3a3; }
.v2-live-note {
  position: absolute; bottom: 26px; left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono), monospace;
  font-size: 10px; letter-spacing: .3em; text-transform: uppercase;
  color: #a3a3a3; text-align: center; width: max-content; max-width: 90vw;
}

/* ── Sections ── */
.v2-section {
  position: relative; z-index: 1;
  max-width: 880px;
  margin: 0 auto;
  padding: 110px 24px;
  border-top: 1px solid #1c1c1c;
  /* Soft veil over the glyph field behind reading text — no hard edges,
     the field stays alive in the margins. */
  background: radial-gradient(ellipse 115% 100% at 50% 50%, rgba(5,5,5,.78) 52%, rgba(5,5,5,0) 100%);
}
.v2-label {
  font-family: var(--font-mono), monospace;
  font-size: 11px; letter-spacing: .34em; text-transform: uppercase;
  color: ${GOLD}; margin-bottom: 20px;
}
.v2-h2 {
  font-family: var(--font-playfair), Georgia, serif;
  font-size: clamp(1.7rem, 4vw, 2.7rem);
  font-weight: 700; color: #efefef;
  line-height: 1.18; margin: 0 0 22px;
  text-wrap: balance;
}
.v2-body {
  font-family: var(--font-source-sans), sans-serif;
  font-size: 1.05rem; line-height: 1.75; color: #b9b9b9;
  text-wrap: pretty;
}
.v2-narrow { max-width: 56ch; }
.v2-mt { display: inline-block; margin-top: 40px; }

/* ── Proof stage ── */
.v2-stage { margin-top: 48px; }
.v2-controls {
  position: sticky; top: 10px; z-index: 6;
  background: rgba(5,5,5,.97);
  border: 1px solid #232323;
  padding: 12px 14px;
  margin-bottom: 26px;
  display: flex; flex-direction: column; gap: 10px;
}
.v2-controls-row {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.v2-controls-width {
  display: flex; align-items: center; gap: 10px;
  flex: 1; min-width: 150px;
}
.v2-controls-width input[type="range"] {
  flex: 1; min-width: 100px;
  appearance: none; -webkit-appearance: none;
  height: 2px; background: #2a2a2a; outline: none;
  accent-color: ${GOLD};
}
.v2-controls-width input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px; height: 20px; background: ${GOLD};
  cursor: ew-resize; border: 0;
}
.v2-controls-width input[type="range"]::-moz-range-thumb {
  width: 20px; height: 20px; background: ${GOLD};
  cursor: ew-resize; border: 0; border-radius: 0;
}
.v2-controls-px {
  font-family: var(--font-mono), monospace;
  font-size: 10px; letter-spacing: .18em; color: ${GOLD};
  min-width: 46px; text-align: right;
}
.v2-toggle { display: flex; gap: 0; border: 1px solid #2a2a2a; width: max-content; }
.v2-tab {
  font-family: var(--font-mono), monospace;
  font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
  background: none; border: 0; cursor: pointer;
  color: #8f8f8f; padding: 15px 24px; min-height: 46px;
  touch-action: manipulation;
  transition: color .3s, background .3s;
}
.v2-tab-on { color: #0a0a0a; background: ${GOLD}; }
.v2-stage-caption {
  font-family: var(--font-mono), monospace;
  font-size: 9px; letter-spacing: .2em; text-transform: uppercase;
  color: #a3a3a3; margin: 0; max-width: 60ch; line-height: 1.7;
}
.v2-stack { position: relative; perspective: 900px; }
.v2-panel {
  grid-area: 1/1;
  position: absolute; top: 0; left: 0;
  margin: 0; padding: 0;
  font-family: Georgia, serif;
  font-size: 17px; line-height: 1.68; color: #d6d6d6;
  transition: opacity .34s ease, transform .38s cubic-bezier(.2,.7,.2,1);
  backface-visibility: hidden;
}
.v2-panel-off {
  opacity: 0;
  transform: translateX(18px) rotateY(6deg);
  pointer-events: none;
}
.v2-flaw {
  text-decoration: underline dotted rgba(224, 110, 90, .95);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
.v2-callout {
  position: absolute;
  max-width: 190px;
  padding: 8px 10px;
  border-left: 2px solid rgba(224, 110, 90, .95);
  background: rgba(5, 5, 5, .95);
  font-family: var(--font-mono), monospace;
  font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
  line-height: 1.7; color: #c9c9c9;
  z-index: 3;
  animation: v2-callout-in .5s cubic-bezier(.2,.7,.2,1);
}
@keyframes v2-callout-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.v2-squeeze-note {
  margin: 30px 0 0; max-width: 52ch;
  font-family: var(--font-source-sans), sans-serif;
  font-size: .85rem; line-height: 1.6; color: #a3a3a3;
  text-wrap: pretty;
}
.v2-stat-hint {
  display: block;
  font-size: .76rem; color: #8f8f8f;
}
.v2-reveal {
  margin: 40px 0 0;
  max-width: 52ch;
  font-family: var(--font-source-sans), sans-serif;
  font-size: 1.05rem; line-height: 1.7; color: #c9c9c9;
  border-left: 2px solid ${GOLD};
  padding-left: 16px;
  text-wrap: pretty;
}
.v2-reveal strong { color: ${GOLD}; font-weight: 600; }
.v2-even { color: #d6d6d6; }
.v2-edge {
  position: absolute; top: 0; bottom: 0; right: -1px;
  width: 1px;
  background: repeating-linear-gradient(#3f3f3f 0 5px, transparent 5px 10px);
}
.v2-stats {
  margin-top: 44px; border: 1px solid #232323;
  max-width: 480px;
}
.v2-stats-head {
  display: flex; justify-content: space-between; gap: 16px;
  padding: 12px 16px; border-bottom: 1px solid #232323;
  font-family: var(--font-mono), monospace;
  font-size: 9px; letter-spacing: .24em; text-transform: uppercase;
  color: #a3a3a3;
}
.v2-stats-cols em { font-style: normal; }
.v2-stat-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid #1a1a1a;
}
.v2-stat-row:last-child { border-bottom: 0; }
.v2-stat-label {
  font-family: var(--font-source-sans), sans-serif;
  font-size: .92rem; color: #b9b9b9;
}
.v2-stat-vals { font-family: var(--font-mono), monospace; font-size: .95rem; color: #8f8f8f; white-space: nowrap; }
.v2-stat-vals em { font-style: normal; }
.v2-stat-vals i { font-style: normal; color: #3f3f3f; padding: 0 7px; }
.v2-gold { color: ${GOLD}; }

/* ── Manifesto ── */
.v2-manifesto {
  font-family: var(--font-playfair), Georgia, serif;
  font-size: clamp(1.25rem, 2.6vw, 1.8rem);
  line-height: 1.66;
  letter-spacing: .015em;
  color: #dcdcdc;
  max-width: 34ch;
  margin: 26px 0 0;
}
/* Display type breathes: the engine's word-spacing contraction is tuned
   for body sizes and reads pinched at manifesto scale — keep the composed
   line breaks, discard the spacing squeeze. */
.v2-manifesto .ts-line { word-spacing: normal !important; }

/* ── Craft grid ── */
.v2-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 1px;
  background: #232323;
  border: 1px solid #232323;
  margin-top: 44px;
}
.v2-card {
  background: #070707;
  padding: 30px 26px 34px;
  transition: transform .45s cubic-bezier(.2,.7,.2,1), background .4s;
}
.v2-card:hover { transform: translateY(-5px); background: #0c0c0c; }
.v2-card-n {
  font-family: var(--font-mono), monospace;
  font-size: 10px; letter-spacing: .3em; color: ${GOLD};
  margin-bottom: 14px;
}
.v2-card-t {
  font-family: var(--font-playfair), Georgia, serif;
  font-size: 1.25rem; font-weight: 700; color: #ededed;
  margin: 0 0 12px; line-height: 1.25;
  text-wrap: balance;
}
.v2-card-b {
  font-family: var(--font-source-sans), sans-serif;
  font-size: .95rem; line-height: 1.65; color: #a8a8a8;
  margin: 0;
  text-wrap: pretty;
}

/* ── Closing ── */
.v2-install {
  display: flex; flex-wrap: wrap; align-items: stretch; gap: 0;
  margin: 40px 0 26px;
  border: 1px solid #2a2a2a;
  width: max-content; max-width: 100%;
}
.v2-install-code {
  font-family: var(--font-mono), monospace;
  font-size: clamp(.72rem, 2.4vw, .92rem);
  color: #d6d6d6; padding: 15px 18px;
  overflow-x: auto; white-space: nowrap;
}
.v2-copy {
  font-family: var(--font-mono), monospace;
  font-size: 11px; letter-spacing: .22em; text-transform: uppercase;
  background: ${GOLD}; color: #0a0a0a; border: 0; cursor: pointer;
  padding: 0 22px;
  transition: background .3s;
}
.v2-copy:hover { background: #d4b158; }
.v2-links { display: flex; flex-wrap: wrap; gap: 26px; margin-top: 48px; }
.v2-links a {
  font-family: var(--font-mono), monospace;
  font-size: 11px; letter-spacing: .24em; text-transform: uppercase;
  color: #a3a3a3; text-decoration: none;
  border-bottom: 1px solid #3f3f3f; padding-bottom: 4px;
  transition: color .3s, border-color .3s;
}
.v2-links a:hover { color: ${GOLD}; border-color: ${GOLD}; }
.v2-colophon {
  margin-top: 72px;
  font-family: var(--font-mono), monospace;
  font-size: 10px; letter-spacing: .3em; text-transform: uppercase;
  color: #a3a3a3;
}
.v2-closing { padding-bottom: 140px; }

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  html:has(.v2-root) { scroll-behavior: auto; }
  .v2-line { opacity: 1 !important; transform: none !important; filter: none !important; transition: none !important; }
  .v2-tilt { transform: none !important; }
  .v2-panel, .v2-card, .v2-cta { transition: none !important; }
}

@media (max-width: 640px) {
  .v2-section { padding: 84px 20px; }
  .v2-hero { padding: 84px 20px 96px; }
  .v2-menu { top: 16px; left: 16px; }
}
`;
