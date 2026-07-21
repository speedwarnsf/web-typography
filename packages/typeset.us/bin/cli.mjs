#!/usr/bin/env node
/**
 * typeset.us CLI — the agent/CI skin of the grader.
 *
 *   npx typeset.us audit <url> [--selector "p"] [--json]
 *
 * Exit code 0 = clean, 1 = violations found, 2 = could not grade.
 *
 * Measures the ACTUAL rendering in a local Chrome (playwright-core,
 * channel: chrome/msedge — no browser download). Two layers:
 *   raw       — violations in the browser's own line breaking (weak
 *               line-ends, orphans), measured from real line boxes on
 *               paragraphs matching the selector
 *   composed  — Typeset.audit() when the page runs typeset
 *
 * Scope, honestly: public, English, long-form prose. Pages this can't
 * grade (blocked fetch, no qualifying paragraphs, non-English lang)
 * return {graded:false, reason} and exit 2 — never a guessed score.
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const cmd = args[0];

const usage = () => {
  console.error('usage: typeset.us audit <url> [--selector "p"] [--json]');
  process.exit(2);
};
if (cmd !== 'audit' || !args[1]) usage();

const url = args[1];
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const selector = flag('--selector', 'p');
const asJson = args.includes('--json');

// The measurement that runs inside the page. Line boxes reconstructed with
// DOM Ranges — the same technique the engine's own self-checks use.
const PAGE_FN = ({ selector }) => {
  const WEAK = new Set(['a','an','the','of','in','at','by','to','for','with','from','on','into','upon','about','between','through','without','during','before','after','against','among','within','beyond','toward','towards','across','along','behind','beneath','beside','besides','despite','except','inside','outside','underneath','until','unlike','and','or','but','nor','yet','so','is','are','was','were','be','been','as','if','than','that']);
  const lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
  if (lang && !lang.startsWith('en')) {
    return { graded: false, reason: `page lang="${lang}" — English-only heuristics do not apply` };
  }
  let optedOut = 0;
  const els = Array.from(document.querySelectorAll(selector)).filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    // Composed elements are typeset's domain — audit() grades those; the
    // raw scan grades only the browser's own line breaking.
    if (el.querySelector(':scope > .ts-line')) return false;
    const words = (el.textContent || '').trim().split(/\s+/);
    if (words.length < 15 || el.getBoundingClientRect().width <= 120) return false;
    // The site owner's explicit opt-out (demo exhibits, chrome, dynamic
    // regions). Honored — but DISCLOSED, never silently passed.
    if (el.closest('[data-no-typeset]')) {
      optedOut++;
      return false;
    }
    return true;
  });
  // Composed paragraphs are graded from their frozen lines directly — no
  // need for the library to be exposed; the rendering IS the record.
  const composedEls = Array.from(document.querySelectorAll(selector)).filter(
    (el) => el.querySelector(':scope > .ts-line'),
  );
  const composedViolations = [];
  for (const el of composedEls) {
    const lines = Array.from(el.querySelectorAll(':scope > .ts-line'));
    const excerpt = (el.textContent || '').trim().slice(0, 60);
    lines.forEach((line, i) => {
      if (i === lines.length - 1) return;
      const last = ((line.textContent || '').trim().split(/\s+/).pop() || '')
        .replace(/[^A-Za-z0-9’']+$/g, '')
        .toLowerCase();
      if (WEAK.has(last)) {
        composedViolations.push({ type: 'weak-line-end', word: last, paragraph: excerpt });
      }
    });
    const lastWords = ((lines[lines.length - 1]?.textContent || '').trim().split(/\s+/) || [])
      .filter((w) => /[A-Za-z0-9]/.test(w));
    if (lines.length > 1 && lastWords.length === 1) {
      composedViolations.push({ type: 'orphan', word: lastWords[0], paragraph: excerpt });
    }
  }

  if (!els.length && !composedEls.length) {
    return { graded: false, reason: `no qualifying paragraphs for selector "${selector}" (need 15+ words, visible)` };
  }
  const violations = [];
  let paragraphs = 0;
  let lines = 0;
  for (const el of els.slice(0, 200)) {
    // Walk words; group into rendered lines by their Range rect tops.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const wordRects = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      const re = /\S+/g;
      let m;
      while ((m = re.exec(text))) {
        const r = document.createRange();
        r.setStart(node, m.index);
        r.setEnd(node, m.index + m[0].length);
        const rect = r.getBoundingClientRect();
        if (rect.width > 0) wordRects.push({ word: m[0], top: Math.round(rect.top) });
      }
    }
    if (wordRects.length < 15) continue;
    paragraphs++;
    const lineWords = [];
    let current = null;
    for (const w of wordRects) {
      if (!current || Math.abs(w.top - current.top) > 4) {
        current = { top: w.top, words: [] };
        lineWords.push(current);
      }
      current.words.push(w.word);
    }
    lines += lineWords.length;
    const excerpt = (el.textContent || '').trim().slice(0, 60);
    lineWords.forEach((line, i) => {
      const last = (line.words[line.words.length - 1] || '')
        .replace(/[^A-Za-z0-9’']+$/g, '')
        .toLowerCase();
      if (i < lineWords.length - 1 && WEAK.has(last)) {
        violations.push({ type: 'weak-line-end', line: i + 1, word: line.words[line.words.length - 1], paragraph: excerpt });
      }
    });
    const lastLine = lineWords[lineWords.length - 1];
    if (lineWords.length > 1 && lastLine.words.filter((w) => /[A-Za-z0-9]/.test(w)).length === 1) {
      violations.push({ type: 'orphan', word: lastLine.words.join(' '), paragraph: excerpt });
    }
  }
  const composed = typeof window.Typeset?.audit === 'function'
    ? window.Typeset.audit().map((v) => ({ type: v.type, detail: v.detail }))
    : null;
  const typesetPresent = !!document.querySelector('[data-ts-outcome]') || typeof window.Typeset !== 'undefined';
  return {
    graded: true,
    paragraphs,
    lines,
    violations,
    typesetPresent,
    composed,
    composedParagraphs: composedEls.length,
    composedViolations,
    optedOut,
  };
};

let browser;
try {
  for (const channel of ['chrome', 'msedge']) {
    try {
      browser = await chromium.launch({ channel });
      break;
    } catch { /* try next channel */ }
  }
  if (!browser) {
    console.error('typeset.us audit needs a local Chrome or Edge (uses your installed browser; downloads nothing).');
    process.exit(2);
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500); // fonts + late scripts settle
  const result = await page.evaluate(PAGE_FN, { selector });
  const report = { url, selector, ...result };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!result.graded) {
    console.log(`not graded: ${result.reason}`);
  } else {
    const n = result.violations.length;
    const cn = result.composedViolations?.length ?? 0;
    console.log(`${result.paragraphs} browser-set paragraphs (${result.lines} lines) + ${result.composedParagraphs ?? 0} typeset-composed`);
    if (result.optedOut) {
      console.log(`${result.optedOut} paragraph${result.optedOut === 1 ? '' : 's'} opted out via data-no-typeset — not graded`);
    }
    for (const v of result.violations.slice(0, 25)) {
      console.log(`  ${v.type}: "${v.word}" — ${v.paragraph}…`);
    }
    if (n > 25) console.log(`  …and ${n - 25} more`);
    for (const v of (result.composedViolations ?? []).slice(0, 10)) {
      console.log(`  composed ${v.type}: "${v.word}" — ${v.paragraph}…`);
    }
    if (result.composed) console.log(`typeset audit(): ${result.composed.length} violations reported by the page's own library`);
    console.log(n + cn === 0 && (result.composed?.length ?? 0) === 0
      ? (result.composedParagraphs
          ? `clean: 0 violations — ${result.composedParagraphs} paragraphs composed and verified`
          : 'clean: 0 violations')
      : `${n + cn + (result.composed?.length ?? 0)} violations — one script tag fixes this: https://typeset.us`);
  }
  const dirty =
    (result.graded && result.violations.length > 0) ||
    (result.composedViolations?.length ?? 0) > 0 ||
    (result.composed?.length ?? 0) > 0;
  process.exit(result.graded ? (dirty ? 1 : 0) : 2);
} catch (err) {
  console.error(`could not grade ${url}: ${err.message}`);
  process.exit(2);
} finally {
  await browser?.close();
}
