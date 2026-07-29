'use client';

/**
 * /fix — The Grader. Paste a URL, see your own opening paragraph the way
 * your readers get it (browser-wrapped) beside the way it could read
 * (typeset), with a measured, plain-language tally.
 *
 * Tone rules (non-negotiable, from the strategy panel):
 *   - All fault aims at the browser; all credit goes to the writer.
 *     "You wrote an A. Your browser sets it like a C."
 *   - Never guess. Pages we can't grade return a reason, not a score.
 *   - Civilian words only. No "violations", no "rag", no "beam search".
 */

import { useEffect, useRef, useState } from 'react';
import typeset from '@/lib/typeset';
import { PLATFORMS, SNIPPET, detectPlatform, type Platform } from '@/lib/platforms';

const WEAK = new Set([
  'a', 'an', 'the', 'of', 'in', 'at', 'by', 'to', 'for', 'with', 'from', 'on',
  'into', 'upon', 'about', 'between', 'through', 'without', 'during', 'before',
  'after', 'against', 'among', 'within', 'beyond', 'toward', 'towards',
  'across', 'along', 'behind', 'beneath', 'beside', 'despite', 'except',
  'inside', 'outside', 'until', 'unlike', 'and', 'or', 'but', 'nor', 'yet',
  'so', 'is', 'are', 'was', 'were', 'be', 'been', 'as', 'if', 'than', 'that',
]);

type Graded = {
  paragraph: string;
  title: string;
  platform: Platform;
  /** The fetched HTML carries a typeset script tag — the page runs the engine. */
  installed: boolean;
};

type NotGraded = { reason: string; platform?: Platform };

type Result =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'substack'; title: string }
  | { state: 'notgraded'; why: NotGraded }
  | { state: 'graded'; data: Graded };

function extractParagraph(html: string): { paragraph?: string; title: string; reason?: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector('title')?.textContent?.trim() || 'your page';
  const lang = (doc.documentElement.getAttribute('lang') || '').toLowerCase();
  if (lang && !lang.startsWith('en')) {
    return { title, reason: 'This page declares a language other than English. The grader only understands English sentences — grading anything else would be guessing, so it doesn’t.' };
  }
  doc.querySelectorAll('nav, footer, aside, header, script, style, figcaption').forEach((n) => n.remove());
  const candidates = Array.from(doc.querySelectorAll('article p, main p, p'))
    .map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.split(' ').length >= 30 && /[.!?]/.test(t) && !/[{}<>]/.test(t));
  if (!candidates.length) {
    return { title, reason: 'No paragraph of running text found — the grader needs at least one real paragraph (30+ words) to measure. It grades writing, not interfaces.' };
  }
  // The opening paragraph is the fairest sample: it's the one readers meet.
  const seen = new Set<string>();
  const unique = candidates.filter((t) => !seen.has(t) && seen.add(t));
  return { title, paragraph: unique[0].split(' ').slice(0, 90).join(' ') };
}

/* ── measured tally, in civilian words ── */

type PanelTally = { hanging: number; orphan: boolean; lines: number };

function measureBrowserPanel(p: HTMLElement): PanelTally {
  const spans = Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'));
  spans.forEach((s) => s.classList.remove('fx-flaw'));
  const rows: { spans: HTMLElement[]; top: number }[] = [];
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    const cur = rows[rows.length - 1];
    if (!cur || Math.abs(r.top - cur.top) > 4) rows.push({ spans: [s], top: r.top });
    else cur.spans.push(s);
  }
  let hanging = 0;
  let orphan = false;
  rows.forEach((row, i) => {
    const last = row.spans[row.spans.length - 1];
    const word = (last.textContent || '').trim().replace(/[^A-Za-z0-9’']+$/g, '').toLowerCase();
    if (i < rows.length - 1 && WEAK.has(word)) {
      hanging++;
      last.classList.add('fx-flaw');
    }
    if (i === rows.length - 1 && rows.length > 1 && row.spans.filter((s) => /[A-Za-z0-9]/.test(s.textContent || '')).length === 1) {
      orphan = true;
      last.classList.add('fx-flaw');
    }
  });
  return { hanging, orphan, lines: rows.length };
}

function measureTypesetPanel(p: HTMLElement): PanelTally {
  const lines = Array.from(p.querySelectorAll<HTMLElement>(':scope > .ts-line'));
  if (!lines.length) return { hanging: 0, orphan: false, lines: 0 };
  let hanging = 0;
  lines.forEach((line, i) => {
    if (i === lines.length - 1) return;
    const word = (line.textContent || '').trim().split(/\s+/).pop()?.replace(/[^A-Za-z0-9’']+$/g, '').toLowerCase() || '';
    if (WEAK.has(word)) hanging++;
  });
  const lastWords = (lines[lines.length - 1].textContent || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return { hanging, orphan: lines.length > 1 && lastWords.length === 1, lines: lines.length };
}

const grade = (t: PanelTally): string => {
  const n = t.hanging + (t.orphan ? 2 : 0);
  return n === 0 ? 'A' : n <= 2 ? 'B' : n <= 4 ? 'C' : 'D';
};

/* ── page ── */

export default function FixPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const [mode, setMode] = useState<'browser' | 'typeset'>('browser');
  const [width, setWidth] = useState(340);
  const [tally, setTally] = useState<{ b: PanelTally; t: PanelTally } | null>(null);
  const [maxW, setMaxW] = useState(420);
  const [copied, setCopied] = useState(false);
  const browserRef = useRef<HTMLParagraphElement>(null);
  const typesetRef = useRef<HTMLParagraphElement>(null);

  const compose = async (text: string, w: number) => {
    await document.fonts.ready.catch(() => {});
    const b = browserRef.current;
    const t = typesetRef.current;
    if (!b || !t) return;
    b.innerHTML = text.split(' ').map((word) => `<span data-w>${word.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`).join(' ');
    t.dataset.tsRaw = text;
    t.textContent = text;
    delete t.dataset.typesetDone;
    typeset(t);
    setTally({ b: measureBrowserPanel(b), t: measureTypesetPanel(t) });
  };

  const gradeUrlFor = async (raw: string) => {
    const target = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    setResult({ state: 'loading' });
    setTally(null);
    setMode('browser');
    try {
      const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(target)}`);
      const body = await res.json();
      if (!res.ok || !body.html) {
        setResult({ state: 'notgraded', why: { reason: `Couldn’t read that page (${body.error || 'no response'}). Nothing was graded.` } });
        return;
      }
      const platform = detectPlatform(body.html, target);
      // Install detection: a typeset script tag in the served HTML (the
      // evergreen go.js, a pinned go@x.y.z.js, or the library build).
      const installed = /<script[^>]+src="[^"]*(?:typeset\.us\/go(?:@[\d.]+)?\.js|typeset\.min\.js|typeset\.us\/typeset)[^"]*"/i.test(body.html);
      const { paragraph, title, reason } = extractParagraph(body.html);
      if (platform === 'substack') {
        setResult({ state: 'substack', title });
        return;
      }
      if (!paragraph) {
        // Still show the install path when we know the platform — "your
        // homepage is a grid" shouldn't dead-end a Ghost owner.
        setResult({ state: 'notgraded', why: { reason: reason!, platform: platform.key !== 'unknown' ? platform : undefined } });
        return;
      }
      setResult({ state: 'graded', data: { paragraph, title, platform, installed } });
    } catch {
      setResult({ state: 'notgraded', why: { reason: 'Couldn’t reach that page. Nothing was graded.' } });
    }
  };
  const gradeUrl = () => gradeUrlFor(url);

  // A badge (or any link) can hand the grader a page directly:
  // /fix?url=https://example.com/post prefills and runs — the badge's
  // "re-runnable claim", made runnable.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('url');
    if (q) {
      setUrl(q);
      void gradeUrlFor(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wide end = a real desktop reading measure; never overflow a phone.
  useEffect(() => {
    const clamp = () => {
      // -40: the dashed measure line runs to within ~16px of a phone's edge.
      const m = Math.min(640, Math.max(250, window.innerWidth - 40));
      setMaxW(m);
      setWidth((w) => Math.min(w, m));
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  // Compose after React has committed the panels (refs are live), and
  // recompose on every squeeze.
  useEffect(() => {
    if (result.state === 'graded') void compose(result.data.paragraph, width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, width]);

  const squeeze = (w: number) => setWidth(w);

  const copy = async () => {
    await navigator.clipboard.writeText(SNIPPET).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const g = result.state === 'graded' ? result.data : null;
  const cardPlatform = g?.platform ?? (result.state === 'notgraded' ? result.why.platform : undefined);

  return (
    <main className="fx-root">
      <section className="fx-hero">
        <p className="fx-label">The Grader</p>
        <h1>What does the browser do to your writing?</h1>
        <p className="fx-lede">
          Paste your page. The grader reads your opening paragraph, sets it two
          ways — the way browsers wrap it, and the way books set it — and
          measures the difference. Nothing is scored by opinion; every mark is
          measured from the rendered lines.
        </p>
        <div className="fx-input-row" data-no-typeset>
          <input
            type="url"
            value={url}
            placeholder="yoursite.com/your-best-piece"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url && gradeUrl()}
            aria-label="Page URL to grade"
          />
          <button onClick={gradeUrl} disabled={!url || result.state === 'loading'}>
            {result.state === 'loading' ? 'Reading…' : 'Grade it'}
          </button>
        </div>
      </section>

      {result.state === 'notgraded' && (
        <section className="fx-card fx-notgraded" data-no-typeset>
          <p className="fx-label">Not graded</p>
          <p>{result.why.reason}</p>
        </section>
      )}

      {result.state === 'substack' && (
        <section className="fx-card" data-no-typeset>
          <p className="fx-label">Substack</p>
          <p>
            Substack doesn&rsquo;t allow custom code, so typeset can&rsquo;t run
            there — no workaround, and we won&rsquo;t pretend otherwise. Your
            words deserve better than the default wrap. A site you own can do
            this.
          </p>
        </section>
      )}

      {g && (
        <>
          <section className="fx-stage">
            <div className="fx-controls" data-no-typeset>
              <div className="fx-toggle" role="tablist" aria-label="Rendering">
                <button role="tab" aria-selected={mode === 'browser'} className={mode === 'browser' ? 'fx-tab fx-tab-on' : 'fx-tab'} onClick={() => setMode('browser')}>
                  What readers get
                </button>
                <button role="tab" aria-selected={mode === 'typeset'} className={mode === 'typeset' ? 'fx-tab fx-tab-on' : 'fx-tab'} onClick={() => setMode('typeset')}>
                  What it could be
                </button>
              </div>
              <label className="fx-squeeze">
                <span>squeeze</span>
                <input type="range" min={250} max={maxW} value={width} onChange={(e) => squeeze(Number(e.target.value))} />
                <span className="fx-width-readout">{width}px</span>
              </label>
            </div>

            {/* Both panels stay laid out (the engine can't measure a
                display:none element); the inactive one is absolutely
                stacked and visibility-hidden. */}
            <div className="fx-panels" style={{ width }} data-no-typeset>
              <p ref={browserRef} className={mode === 'browser' ? 'fx-panel' : 'fx-panel fx-panel-off'} data-no-typeset />
              <p ref={typesetRef} className={mode === 'typeset' ? 'fx-panel' : 'fx-panel fx-panel-off'} data-no-typeset />
            </div>
            <p className="fx-source" data-no-typeset>
              Your opening paragraph, from {g.title} — set in our reading
              face. Squeeze the column and watch the counts. Dotted marks are
              measured, not decorative.
            </p>
            {g.installed && (
              <p className="fx-source fx-gold" data-no-typeset>
                Typeset detected on this page — it ships the engine&rsquo;s
                script, so what your readers see is already composed. The
                panels above re-set the raw text for comparison.
              </p>
            )}
          </section>

          {tally && (
            <section className="fx-verdict" data-no-typeset>
              <p className="fx-grade-line">
                You wrote an A. The browser sets it like{' '}
                {grade(tally.b) === 'A' ? 'an' : 'a'} <strong>{grade(tally.b)}</strong>.
                Typeset sets it like {grade(tally.t) === 'A' ? 'an' : 'a'}{' '}
                <strong className="fx-gold">{grade(tally.t)}</strong>.
              </p>
              <table className="fx-table">
                <thead>
                  <tr><th></th><th>browser</th><th>typeset</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Words left hanging at line edges</td>
                    <td>{tally.b.hanging}</td>
                    <td className={tally.t.hanging <= tally.b.hanging ? 'fx-gold' : ''}>{tally.t.hanging}</td>
                  </tr>
                  <tr>
                    <td>A word abandoned on the last line</td>
                    <td>{tally.b.orphan ? 'yes' : 'no'}</td>
                    <td className={!tally.t.orphan ? 'fx-gold' : ''}>{tally.t.orphan ? 'yes' : 'no'}</td>
                  </tr>
                  <tr>
                    <td>Lines used</td>
                    <td>{tally.b.lines}</td>
                    <td>{tally.t.lines}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

        </>
      )}

      {cardPlatform && (
        <section className="fx-card fx-install" data-no-typeset>
          <p className="fx-label">Fix it on {cardPlatform.name}</p>
          {cardPlatform.tier && <p className="fx-tier">{cardPlatform.tier}</p>}
          <ol className="fx-path">
            {cardPlatform.path.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="fx-snippet">
            <code>{SNIPPET}</code>
            <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="fx-fine">
            One line. Every paragraph on the page, set like a book, verified
            against the live rendering — it un-sets itself rather than ship a
            mistake. Pinnable build with integrity hash:{' '}
            <a href="/sri.json">sri.json</a>.
          </p>
        </section>
      )}

      <style jsx global>{`
        .fx-root {
          max-width: 720px;
          margin: 0 auto;
          padding: 128px 24px 96px;
        }
        .fx-label {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #b8963e;
          margin-bottom: 14px;
        }
        .fx-hero h1 {
          font-size: clamp(2rem, 5.4vw, 3.1rem);
          line-height: 1.12;
          margin-bottom: 18px;
          max-width: 15ch;
        }
        .fx-lede {
          color: #c9c9c9;
          font-size: 1.0625rem;
          line-height: 1.7;
          max-width: 52ch;
          margin-bottom: 34px;
        }
        .fx-input-row {
          display: flex;
          gap: 0;
          max-width: 560px;
        }
        .fx-input-row input {
          flex: 1;
          min-width: 0;
          background: #0d0d0d;
          border: 1px solid #2a2a2a;
          border-right: 0;
          color: #e5e5e5;
          font-family: var(--font-mono), monospace;
          font-size: 14px;
          padding: 14px 16px;
          outline: none;
        }
        .fx-input-row input:focus { border-color: #b8963e; }
        .fx-input-row button {
          background: #b8963e;
          color: #050505;
          border: 0;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          padding: 0 22px;
          cursor: pointer;
        }
        .fx-input-row button:disabled { opacity: 0.5; cursor: default; }
        .fx-card {
          margin-top: 42px;
          border: 1px solid #222;
          background: #0b0b0b;
          padding: 26px 28px;
        }
        .fx-card p { color: #c9c9c9; line-height: 1.7; max-width: 56ch; }
        .fx-stage { margin-top: 48px; }
        .fx-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px;
          margin-bottom: 22px;
        }
        .fx-toggle { display: flex; border: 1px solid #2a2a2a; }
        .fx-tab {
          background: none;
          border: 0;
          color: #a3a3a3;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          padding: 10px 16px;
          cursor: pointer;
        }
        .fx-tab-on { background: #b8963e; color: #050505; }
        .fx-squeeze {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #8f8f8f;
        }
        .fx-squeeze input { width: 150px; accent-color: #b8963e; }
        .fx-width-readout {
          color: #b8963e;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.08em;
          min-width: 4.2em;
        }
        .fx-panels {
          border-left: 1px solid #2a2a2a;
          border-right: 1px dashed #333;
          padding: 4px 0;
        }
        .fx-panels { position: relative; }
        .fx-panel {
          font-size: 1.0625rem;
          line-height: 1.7;
          color: #dcdcdc;
          margin: 0;
          width: 100%;
        }
        .fx-panel-off {
          position: absolute;
          top: 4px;
          left: 0;
          visibility: hidden;
        }
        .fx-flaw {
          border-bottom: 1px dotted #b8963e;
          padding-bottom: 1px;
        }
        .fx-source {
          margin-top: 16px;
          font-size: 0.8125rem;
          color: #8f8f8f;
          max-width: 52ch;
          line-height: 1.6;
        }
        .fx-verdict { margin-top: 40px; }
        .fx-grade-line {
          font-family: var(--font-playfair), Georgia, serif;
          font-size: clamp(1.3rem, 3vw, 1.7rem);
          color: #ededed;
          margin-bottom: 20px;
          max-width: 30ch;
          line-height: 1.35;
        }
        .fx-gold { color: #b8963e; }
        .fx-table { width: 100%; max-width: 480px; border-collapse: collapse; }
        .fx-table th, .fx-table td {
          text-align: left;
          padding: 10px 12px 10px 0;
          border-bottom: 1px solid #1c1c1c;
          font-size: 0.9375rem;
          color: #c9c9c9;
        }
        .fx-table th {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #8f8f8f;
        }
        .fx-table td:not(:first-child), .fx-table th:not(:first-child) {
          text-align: right;
          font-family: var(--font-mono), monospace;
        }
        .fx-install .fx-tier { font-size: 0.875rem; color: #a3a3a3; margin-bottom: 12px; }
        .fx-path {
          list-style: none;
          margin: 14px 0 22px;
          padding: 0;
          counter-reset: step;
        }
        .fx-path li {
          counter-increment: step;
          padding: 7px 0 7px 2.2em;
          position: relative;
          color: #dcdcdc;
        }
        .fx-path li::before {
          content: counter(step, decimal-leading-zero);
          position: absolute;
          left: 0;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: #b8963e;
          top: 11px;
        }
        .fx-snippet {
          display: flex;
          align-items: stretch;
          border: 1px solid #2a2a2a;
          background: #0d0d0d;
        }
        .fx-snippet code {
          flex: 1;
          font-family: var(--font-mono), monospace;
          font-size: 12.5px;
          color: #e5e5e5;
          padding: 13px 14px;
          overflow-x: auto;
          white-space: nowrap;
        }
        .fx-snippet button {
          background: none;
          border: 0;
          border-left: 1px solid #2a2a2a;
          color: #b8963e;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          padding: 0 18px;
          cursor: pointer;
        }
        .fx-fine { margin-top: 16px; font-size: 0.8125rem; color: #8f8f8f; line-height: 1.6; max-width: 56ch; }
        .fx-fine a { color: #b8963e; text-decoration: none; }
        .fx-notgraded { border-color: #3a2f16; }
      `}</style>
    </main>
  );
}
