'use client';

/**
 * The essay's centerpiece: the same paragraph set three ways, live, with
 * counts measured from the actual rendering — browser default, the
 * platform's best effort (text-wrap: pretty), and typeset. As far as we
 * know this is the first public artifact that puts a measured number on
 * what `pretty` does.
 */

import { useEffect, useRef, useState } from 'react';
import typeset from '@/lib/typeset';

// Chosen empirically (scripts/screen-demo-text.mjs, 18 widths, production
// face): browser-set it fails at 12/18 widths and orphans at 5; typeset
// holds zero flaws at every width screened.
const DEMO_TEXT =
  'Look closely at the right edge of this paragraph as you squeeze it. Watch which words get left at the ends of lines, and what happens to the last word when the column gets narrow enough. This is the shape of every article you have ever read on a phone, and none of it was decided by anyone.';

const WEAK = new Set([
  'a', 'an', 'the', 'of', 'in', 'at', 'by', 'to', 'for', 'with', 'from', 'on',
  'into', 'upon', 'about', 'between', 'through', 'without', 'during', 'before',
  'after', 'against', 'among', 'within', 'beyond', 'toward', 'towards',
  'across', 'along', 'behind', 'beneath', 'beside', 'despite', 'except',
  'inside', 'outside', 'until', 'unlike', 'and', 'or', 'but', 'nor', 'yet',
  'so', 'is', 'are', 'was', 'were', 'be', 'been', 'as', 'if', 'than', 'that',
]);

type Tally = { hanging: number; orphan: boolean; lines: number };
type ModeKey = 'browser' | 'pretty' | 'typeset';

const MODES: { key: ModeKey; label: string; sub: string }[] = [
  { key: 'browser', label: 'Browser', sub: 'what you ship today' },
  { key: 'pretty', label: 'text-wrap: pretty', sub: 'the platform’s best' },
  { key: 'typeset', label: 'Typeset', sub: 'one script tag' },
];

function measureSpans(p: HTMLElement, mark: boolean): Tally {
  const spans = Array.from(p.querySelectorAll<HTMLElement>('span[data-w]'));
  spans.forEach((s) => s.classList.remove('es-flaw'));
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
      if (mark) last.classList.add('es-flaw');
    }
    if (i === rows.length - 1 && rows.length > 1 && row.spans.filter((s) => /[A-Za-z0-9]/.test(s.textContent || '')).length === 1) {
      orphan = true;
      if (mark) last.classList.add('es-flaw');
    }
  });
  return { hanging, orphan, lines: rows.length };
}

function measureComposed(p: HTMLElement): Tally {
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

export default function ThreeWay() {
  const [mode, setMode] = useState<ModeKey>('browser');
  const [width, setWidth] = useState(0); // set to the wide-open max on mount
  const [maxW, setMaxW] = useState(592);
  const [tallies, setTallies] = useState<Record<ModeKey, Tally> | null>(null);
  const refs = {
    browser: useRef<HTMLParagraphElement>(null),
    pretty: useRef<HTMLParagraphElement>(null),
    typeset: useRef<HTMLParagraphElement>(null),
  };

  useEffect(() => {
    // Wide end = the full reading column (592px inside .es-root), so the
    // squeeze travels from a real desktop measure down to phone-narrow —
    // the whole collapse, not a tour of narrow-column land. Start wide
    // open; the reader does the squeezing.
    const clamp = () => {
      // -40, not -72: on a phone the dashed measure line should run to
      // within ~16px of the screen edge (the panel may overhang the reading
      // column's right padding; main clips nothing until the viewport).
      const m = Math.min(592, Math.max(250, window.innerWidth - 40));
      setMaxW(m);
      setWidth((w) => (w === 0 ? m : Math.min(w, m)));
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (width === 0) return; // waiting for the mount-time clamp
      await document.fonts.ready.catch(() => {});
      if (cancelled) return;
      const spanHtml = DEMO_TEXT.split(' ').map((w) => `<span data-w>${w}</span>`).join(' ');
      const b = refs.browser.current;
      const pr = refs.pretty.current;
      const t = refs.typeset.current;
      if (!b || !pr || !t) return;
      b.innerHTML = spanHtml;
      pr.innerHTML = spanHtml;
      t.dataset.tsRaw = DEMO_TEXT;
      t.textContent = DEMO_TEXT;
      delete t.dataset.typesetDone;
      typeset(t);
      setTallies({
        browser: measureSpans(b, true),
        pretty: measureSpans(pr, true),
        typeset: measureComposed(t),
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  return (
    <div className="es-demo" data-no-typeset>
      <div className="es-controls">
        <div className="es-toggle" role="tablist" aria-label="Rendering">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              className={mode === m.key ? 'es-tab es-tab-on' : 'es-tab'}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="es-squeeze">
          <span>squeeze</span>
          <input type="range" min={250} max={maxW} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          <span className="es-width-readout">{width || maxW}px</span>
        </label>
      </div>

      <div className="es-panels" style={{ width }}>
        <p ref={refs.browser} className={mode === 'browser' ? 'es-panel' : 'es-panel es-panel-off'} data-no-typeset />
        <p ref={refs.pretty} className={mode === 'pretty' ? 'es-panel es-pretty' : 'es-panel es-pretty es-panel-off'} data-no-typeset />
        <p ref={refs.typeset} className={mode === 'typeset' ? 'es-panel' : 'es-panel es-panel-off'} data-no-typeset />
      </div>

      {tallies && (
        <table className="es-table">
          <thead>
            <tr>
              <th></th>
              {MODES.map((m) => (
                <th key={m.key} className={mode === m.key ? 'es-th-on' : ''}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Words left hanging at line edges</td>
              {MODES.map((m) => (
                <td key={m.key}>{tallies[m.key].hanging}</td>
              ))}
            </tr>
            <tr>
              <td>A word abandoned on the last line</td>
              {MODES.map((m) => (
                <td key={m.key}>{tallies[m.key].orphan ? 'yes' : 'no'}</td>
              ))}
            </tr>
            <tr>
              <td>Lines used</td>
              {MODES.map((m) => (
                <td key={m.key}>{tallies[m.key].lines}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      <p className="es-note">
        Counts are measured from the rendering above, right now, in your
        browser — drag the slider and watch them change. Dotted marks show
        each measured flaw.
      </p>
    </div>
  );
}
