import { composeParagraph, tokenize, shapeExactLines, finalValidate, isWeakEnding } from './typeset';
import type { FrozenLine } from './typeset';
import { composeTitle } from './title-layout';
import { contentWidth, measureLayout } from './layout-metrics';
import type { LayoutMetrics } from './layout-metrics';
import { planRichText, renderRichText, richFingerprint, selectionBookmark, richLayoutVerified } from './rich-text';
import { applySmartQuotes } from './smart-quotes';
import type { QuoteTransform } from './smart-quotes';
import { planOpticalHanging, opticalVerified } from './optical-hanging';
import type { RichOutput, RichPlan } from './rich-text';
import { planSpacingFinish, spacingVerified } from './spacing-finish';
export { analyzeBreaks, UNICODE_VERSION } from './break-opportunities';
import { languageOf, languageWeakEnding } from './break-opportunities';
import { strandedOpener } from './phrase-boundaries';
import { preservesAdvances } from './geometry';
import { finishTargets } from './space-policy';
import { planTrackingFinish, renderTracking, trackingVerified } from './tracking-finish';

export const VERSION = '4.2.0';
export type Mode = 'body' | 'heading' | 'title' | 'ui';
export interface Options {
  /** Opt-in Unicode 17 break opportunities; default preserves the legacy path. */
  lineBreaks?: 'legacy' | 'unicode';
  /** Explicit English text transformation. Off unless requested. */
  smartQuotes?: 'en' | false;
  /** Reversible leading punctuation/capital alignment. Off unless requested. */
  opticalHanging?: boolean;
  /** Full bounded word-space finish on composed body text. On by default. */
  spacing?: boolean;
  /** Bounded per-line tracking after word-space finishing. On with spacing. */
  tracking?: boolean;
  /** Re-rank the finished rag or retain the historical natural-width ranking. */
  contour?: 'natural' | 'finished';
  mode?: Mode;
  keep?: readonly string[];
  maxLines?: number;
  /** Compact preserves native line count, except one extra line to fix an
   * orphan. Editorial permits one additional line for prose phrasing.
   * When omitted, a stranded sentence/clause opener can also earn one line. */
  density?: 'compact' | 'editorial';
  /** Current author text. Framework adapters should pass this on updates. */
  text?: string;
}
export interface Result {
  outcome: string;
  mode: Mode;
  before: LayoutMetrics;
  after: LayoutMetrics;
  changed: boolean;
  durationMs: number;
  constraint?: RichPlan['constraint'];
  search?: RichPlan['search'];
  features?: { quotes: string; hanging: string; spacing: string; tracking: string };
}
interface State {
  nodes: Node[];
  outputNodes: Node[];
  source: string;
  output: string;
  markup: string;
  styles: { textWrap: string; inlineSize: string; maxInlineSize: string };
  appliedStyles: { textWrap: string; inlineSize: string; maxInlineSize: string };
  signature: string;
  result: Result;
  rich?: RichOutput;
  hadStyle: boolean;
  quotes?: QuoteTransform;
  optical?: RichOutput;
  spacing?: RichOutput;
  tracking?: RichOutput;
}
const states = new WeakMap<HTMLElement, State>();
// Controllers share composition state, so only one may write a given target.
const mountOwners = new WeakMap<HTMLElement, symbol>();
const mountWaiters = new WeakMap<HTMLElement, Set<() => void>>();
const measurements = new WeakMap<Document, Map<string, Map<string, number>>>();
const fontVersions = new WeakMap<Document, { epoch: number }>();
const fontIds = new WeakMap<FontFace, number>();
let nextFontId = 0;
function fontVersion(doc: Document): string {
  let version = fontVersions.get(doc);
  if (!version) {
    version = { epoch: 0 };
    fontVersions.set(doc, version);
    const current = version;
    doc.fonts.addEventListener('loadingdone', () => { current.epoch++; });
  }
  // FontFace objects can be added already loaded, or replaced while the set
  // remains "loaded". Those changes need not fire a loadingdone event.
  const faces: string[] = [];
  doc.fonts.forEach(face => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFontId);
    faces.push([fontIds.get(face), face.family, face.status, face.weight, face.style, face.stretch].join(':'));
  });
  return version.epoch + '|' + faces.join('|');
}
const excluded = '[data-no-typeset], pre, code, script, style, template, textarea, input, select, button, nav, [contenteditable]:not([contenteditable="false"])';
const defaults = '[data-typeset], p, blockquote, figcaption, h1, h2, h3, h4, h5, h6';
const emptyMetrics = (): LayoutMetrics => ({ lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 });

function modeOf(el: HTMLElement, options: Options): Mode {
  const mode = options.mode || el.dataset.typesetMode;
  if (mode === 'heading' || mode === 'title' || mode === 'ui' || mode === 'body') return mode;
  return el.closest('h1,h2,h3,h4,h5,h6') ? 'title' : 'body';
}

function signature(el: HTMLElement, options: Options): string {
  const cs = getComputedStyle(el);
  const context: (string | null)[] = [];
  for (let ancestor: HTMLElement | null = el; ancestor; ancestor = ancestor.parentElement) {
    context.push(ancestor.id, ancestor.getAttribute('class'), ancestor.getAttribute('style'));
  }
  return JSON.stringify([
    el.innerHTML, fontVersion(el.ownerDocument), el.ownerDocument.fonts.status,
    contentWidth(el), el.parentElement && contentWidth(el.parentElement), cs.font, cs.fontFamily, cs.fontSize,
    cs.fontWeight, cs.fontStyle, cs.fontStretch, cs.fontFeatureSettings,
    cs.fontVariationSettings, cs.fontOpticalSizing, cs.fontVariant, cs.fontKerning,
    cs.fontSizeAdjust, cs.fontSynthesis, cs.textRendering, cs.letterSpacing, cs.wordSpacing,
    cs.lineHeight, cs.textTransform, cs.whiteSpace, cs.textAlign, cs.direction,
    cs.writingMode, cs.display, cs.textWrap, cs.hyphens, cs.wordBreak, cs.lineBreak, cs.overflowWrap, cs.getPropertyValue('-webkit-line-clamp'),
    el.closest('[lang]')?.getAttribute('lang'), el.dataset.typesetMode,
    options.mode, options.keep, options.maxLines, options.density, options.text, options.lineBreaks, options.smartQuotes, options.opticalHanging, options.spacing, options.tracking, options.contour,
    context, getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content,
    el.querySelector(':not([data-ts-break]):not(.ts-line)') ? richFingerprint(el) : '',
  ]);
}

function resetStyles(el: HTMLElement, state: State): void {
  if (el.style.textWrap === state.appliedStyles.textWrap && el.style.textWrap !== state.styles.textWrap) el.style.textWrap = state.styles.textWrap;
  if (el.style.inlineSize === state.appliedStyles.inlineSize && el.style.inlineSize !== state.styles.inlineSize) el.style.inlineSize = state.styles.inlineSize;
  if (el.style.maxInlineSize === state.appliedStyles.maxInlineSize && el.style.maxInlineSize !== state.styles.maxInlineSize) el.style.maxInlineSize = state.styles.maxInlineSize;
  if (!state.hadStyle && !el.style.length) {
    const attribute = el.getAttributeNode('style');
    if (attribute) el.removeAttributeNode(attribute);
  }
}
function ownsOutput(el: HTMLElement, state: State): boolean {
  return el.innerHTML === state.markup && el.childNodes.length === state.outputNodes.length
    && state.outputNodes.every((node, i) => el.childNodes[i] === node)
    && (!state.rich || state.rich.nodes.every(node => node === el || el.contains(node)));
}

/** Release this engine's output. Original nodes, attributes, and listeners survive. */
export function restore(element: HTMLElement): void {
  const state = states.get(element);
  if (!state) return;
  const restoreSelection = selectionBookmark(element);
  state.optical?.cleanup();
  state.tracking?.cleanup();
  state.spacing?.cleanup();
  if (state.rich) state.rich.cleanup();
  else if (ownsOutput(element, state) && !state.nodes.every((node, i) => element.childNodes[i] === node)) element.replaceChildren(...state.nodes);
  resetStyles(element, state);
  state.quotes?.restore();
  restoreSelection();
  states.delete(element);
  delete element.dataset.tsOutcome;
  delete element.dataset.typesetDone;
  delete element.dataset.tsQuotes;
  delete element.dataset.tsHanging;
  delete element.dataset.tsSpacing;
  delete element.dataset.tsTracking;
}

/** Exact DOM measurements inherit font features, axes, tracking and transforms. */
function makeMeasurer(element: HTMLElement): { prepare: (texts: string[]) => void; measure: (text: string) => number; dispose: () => void } {
  const cs = getComputedStyle(element);
  const styleKey = JSON.stringify([
    fontVersion(element.ownerDocument), element.ownerDocument.fonts.status,
    cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.fontStretch,
    cs.fontVariant, cs.fontFeatureSettings, cs.fontVariationSettings,
    cs.fontOpticalSizing, cs.fontKerning, cs.fontSizeAdjust, cs.letterSpacing,
    cs.wordSpacing, cs.textTransform, cs.textRendering, cs.direction,
  ]);
  let fonts = measurements.get(element.ownerDocument);
  if (!fonts) { fonts = new Map(); measurements.set(element.ownerDocument, fonts); }
  let cache = fonts.get(styleKey);
  if (!cache) { cache = new Map(); fonts.set(styleKey, cache); }
  // Bounded per-document LRU. Same text/font measurements can be shared
  // across 1,600 screening rows without sharing element layout state.
  fonts.delete(styleKey); fonts.set(styleKey, cache);
  if (fonts.size > 8) fonts.delete(fonts.keys().next().value!);
  const widths = cache;
  const remember = (text: string, width: number) => {
    if (widths.size >= 4096) widths.delete(widths.keys().next().value!);
    widths.set(text, width);
  };
  const probe = element.ownerDocument.createElement('span');
  probe.dataset.tsProbe = '1';
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;inset:auto;display:inline-block;width:max-content;max-width:none;min-width:0;visibility:hidden;pointer-events:none;white-space:pre;font:inherit;letter-spacing:inherit;word-spacing:inherit;text-transform:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-optical-sizing:inherit;';
  return {
    prepare(texts) {
      const pending = [...new Set(texts)].filter(t => !widths.has(t));
      if (!pending.length) return;
      if (!probe.isConnected) element.appendChild(probe);
      const spans = pending.map(text => {
        const span = element.ownerDocument.createElement('span');
        span.style.cssText = 'display:block;width:max-content;white-space:pre;font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-optical-sizing:inherit;letter-spacing:inherit;word-spacing:inherit;text-transform:inherit;';
        span.textContent = text;
        return span;
      });
      probe.replaceChildren(...spans);
      // All writes precede all reads: one layout flush per batch, not one
      // synchronous layout for every candidate substring.
      spans.forEach((span, i) => remember(pending[i], span.getBoundingClientRect().width));
      probe.replaceChildren();
    },
    measure(text) {
      const prior = widths.get(text);
      if (prior !== undefined) return prior;
      if (!probe.isConnected) element.appendChild(probe);
      probe.textContent = text;
      const width = probe.getBoundingClientRect().width;
      remember(text, width);
      return width;
    },
    dispose() { probe.remove(); },
  };
}

function render(element: HTMLElement, source: string, lines: FrozenLine[]): void {
  const words = Array.from(source.matchAll(/[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/gu));
  let word = 0;
  let cursor = 0;
  const fragment = element.ownerDocument.createDocumentFragment();
  for (const line of lines) {
    const count = line.tokens.length;
    const first = words[word];
    const last = words[word + count - 1];
    if (!first || !last) throw new Error('Token/source mismatch');
    const end = last.index! + last[0].length;
    if (first.index! > cursor) fragment.append(source.slice(cursor, first.index));
    const span = element.ownerDocument.createElement('span');
    span.className = 'ts-line';
    span.dataset.tsGenerated = '1';
    span.style.display = 'block';
    // A narrower container can arrive before the next observer delivery.
    // Permit native wrapping during that interval instead of spilling ink.
    span.style.whiteSpace = 'normal';
    span.style.font = 'inherit';
    span.style.fontFeatureSettings = 'inherit';
    span.style.fontVariationSettings = 'inherit';
    span.style.fontOpticalSizing = 'inherit';
    span.style.letterSpacing = 'inherit';
    if (line.wordSpacingEm) span.style.wordSpacing = line.wordSpacingEm + 'em';
    span.textContent = source.slice(first.index, end);
    fragment.append(span);
    cursor = end;
    word += count;
  }
  fragment.append(source.slice(cursor));
  element.replaceChildren(fragment);
}

/** Compose supported text while preserving source content and live elements. */
export function typeset(element: HTMLElement, options: Options = {}): Result {
  const started = performance.now();
  const mode = modeOf(element, options);
  if (element.closest('[data-typeset-react-rich]')) return { outcome: 'skipped:framework', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  if (element.closest(excluded) || element.closest('[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line')) {
    return { outcome: 'skipped:excluded', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: 0 };
  }
  const prior = states.get(element);
  const sig = signature(element, options);
  if (prior?.signature === sig && ownsOutput(element, prior)) return { ...prior.result, changed: false, durationMs: performance.now() - started };
  if (prior) {
    const restoreSelection = selectionBookmark(element);
    const unchanged = ownsOutput(element, prior);
    prior.optical?.cleanup();
    prior.tracking?.cleanup();
    prior.spacing?.cleanup();
    resetStyles(element, prior);
    if (prior.rich) prior.rich.cleanup();
    else if (unchanged && !prior.nodes.every((node, i) => element.childNodes[i] === node)) element.replaceChildren(...prior.nodes);
    else if (element.querySelector('[data-ts-generated]')) {
      // An external edit inside a generated line is new author text, never
      // permission to resurrect our cached source.
      for (const node of prior.outputNodes) {
        if (node instanceof HTMLElement && node.parentNode === element && node.hasAttribute('data-ts-generated')) {
          node.replaceWith(...node.childNodes);
        }
      }
    }
    prior.quotes?.restore();
    restoreSelection();
  }
  if (options.text !== undefined && element.textContent !== options.text) element.textContent = options.text;
  const rawMarkup = element.innerHTML;
  const restoreQuoteSelection = selectionBookmark(element);
  const quotes = options.smartQuotes === 'en' ? applySmartQuotes(element) : undefined;
  restoreQuoteSelection();
  const source = element.textContent || '';
  const originalMarkup = element.innerHTML;
  const nodes = Array.from(element.childNodes);
  const hadStyle = element.hasAttribute('style');
  const styles = { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize };
  const before = measureLayout(element);
  let rich: RichOutput | undefined;
  let search: RichPlan['search'];
  const finish = (outcome: string, constraint?: RichPlan['constraint']): Result => {
    let optical: RichOutput | undefined;
    let spacing: RichOutput | undefined;
    let tracking: RichOutput | undefined;
    let targets: number[] | undefined;
    const features = { quotes: quotes?.outcome || 'off', hanging: options.opticalHanging ? 'native:hanging-uncomposed' : 'off',
      spacing: options.spacing === false ? 'off' : mode !== 'body' ? 'native:spacing-mode' : 'native:spacing-uncomposed',
      tracking: options.tracking === false || options.spacing === false ? 'off' : mode !== 'body' ? 'native:tracking-mode' : 'native:tracking-uncomposed' };
    if (options.spacing !== false && mode === 'body' && outcome === 'composed:rich') {
      const plan = planSpacingFinish(element, measureLayout(element));
      targets = finishTargets(plan.before.lines.map(line => line.width), plan.before.width);
      const fingerprint = richFingerprint(element);
      features.spacing = plan.outcome;
      if (plan.adjustments.length) {
        spacing = renderRichText(element, [], [], plan.adjustments);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !spacingVerified(element, plan, measureLayout(element))) {
          spacing.cleanup(); spacing = undefined; features.spacing = 'native:spacing-verification';
        }
      }
    } else if (options.spacing !== false && mode === 'body' && outcome === 'composed') {
      features.spacing = Array.from(element.querySelectorAll<HTMLElement>('.ts-line')).some(line => parseFloat(line.style.wordSpacing)) ? 'applied' : 'unchanged';
    }
    if (targets && options.tracking !== false && ['applied', 'unchanged'].includes(features.spacing)) {
      const plan = planTrackingFinish(element, measureLayout(element), targets);
      const fingerprint = richFingerprint(element);
      features.tracking = plan.outcome;
      if (plan.runs.length) {
        tracking = renderTracking(element, plan);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !trackingVerified(element, plan, measureLayout(element))) {
          tracking.cleanup(); tracking = undefined; features.tracking = 'native:tracking-verification';
        }
      }
    }
    if (options.opticalHanging && (outcome === 'composed:rich' || outcome === 'native:fits')) {
      const layout = measureLayout(element);
      const fingerprint = richFingerprint(element);
      const plan = planOpticalHanging(element, layout);
      features.hanging = plan.outcome;
      if (plan.hangs.length) {
        optical = renderRichText(element, [], plan.hangs);
        const after = measureLayout(element);
        if (!opticalVerified(element, layout, after, plan.hangs) || richFingerprint(element) !== fingerprint) {
          optical.cleanup(); optical = undefined; features.hanging = 'native:hanging-verification';
        }
      }
    }
    element.dataset.tsOutcome = outcome;
    element.dataset.typesetDone = '1';
    element.dataset.tsQuotes = features.quotes;
    element.dataset.tsHanging = features.hanging;
    element.dataset.tsSpacing = features.spacing;
    element.dataset.tsTracking = features.tracking;
    const result: Result = { outcome, mode, before, after: measureLayout(element), changed: element.innerHTML !== rawMarkup, durationMs: performance.now() - started, ...(constraint && { constraint }), ...(search && { search }), features };
    states.set(element, {
      nodes, outputNodes: Array.from(element.childNodes), source, output: element.textContent || '', markup: element.innerHTML, styles,
      appliedStyles: { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize },
      signature: signature(element, options), result,
      rich, hadStyle, quotes, optical, spacing, tracking,
    });
    return result;
  };
  if (!source.trim()) return finish('native:empty');
  const cs = getComputedStyle(element);
  const lang = element.closest('[lang]')?.getAttribute('lang');
  if (options.lineBreaks !== 'unicode' && ((lang && !/^en(?:-|$)/i.test(lang)) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return finish('native:language');
  if (!before.width || !before.lines.length) return finish('unmeasurable');
  if (cs.writingMode !== 'horizontal-tb' || cs.direction !== 'ltr') return finish('native:direction');
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (!preservesAdvances(style) || (style.zoom && style.zoom !== '1' && style.zoom !== 'normal')) return finish('native:transformed');
  }
  for (const pseudo of ['::before', '::after']) {
    const content = getComputedStyle(element, pseudo).content;
    if (content && content !== 'none' && content !== 'normal' && content !== '""') return finish('native:decorated');
  }
  if (cs.whiteSpace !== 'normal' && cs.whiteSpace !== 'pre-line') return finish('native:whitespace');
  if (cs.whiteSpace === 'pre-line' && /[\r\n]/.test(source)) return finish('native:author-breaks');
  const clamp = parseInt(cs.getPropertyValue('-webkit-line-clamp'), 10);
  if (cs.overflow !== 'visible' && cs.textOverflow === 'ellipsis') return finish('native:clamped');
  if (cs.display === 'inline') return finish('native:inline');
  if (options.lineBreaks === 'unicode' || options.opticalHanging || options.smartQuotes || element.children.length || nodes.some(node => node.nodeType !== Node.TEXT_NODE)) {
    const plan = planRichText(element, { ...options, mode }, before);
    search = plan.search;
    if (plan.outcome !== 'composed:rich') return finish(plan.outcome, plan.constraint);
    rich = renderRichText(element, plan.breaks);
    const after = measureLayout(element);
    if (!richLayoutVerified(plan, after) || element.textContent !== source || richFingerprint(element) !== plan.styleSignature
      || (!before.lastSingleton && after.lastSingleton && mode === 'body')) {
      rich.cleanup(); rich = undefined;
      return finish('native:verification');
    }
    return finish('composed:rich');
  }
  if (before.lines.length === 1 && before.overflow <= 0.5) return finish('native:fits');
  if (mode === 'ui') return finish('native:ui');
  if (source.length > 12000 || source.trim().split(/\s+/u).length > 500) return finish('native:budget');
  const measure = makeMeasurer(element);
  let lines: FrozenLine[] | null = null;
  try {
    const parts = source.trim().split(/[^\S\u00a0\u202f]+/u);
    const measurements = ['0', ' ', ...parts];
    if ((mode === 'title' || mode === 'heading') && parts.length <= 64) {
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j <= parts.length; j++) measurements.push(parts.slice(i, j).join(' '));
      }
    }
    measure.prepare(measurements);
    const tokens = tokenize(source, measure.measure);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const ch = before.width / Math.max(1, measure.measure('0'));
    if (mode === 'title' || mode === 'heading') {
      lines = composeTitle(tokens, before.width, measure.measure, { ...options, maxLines: options.maxLines || (clamp > 0 ? clamp : undefined) });
    } else {
      const maxLines = options.maxLines || before.lines.length + (before.lastSingleton || options.density === 'editorial' ? 1 : 0);
      const tail = parts.slice(-2).join(' ');
      const unavoidableOrphan = before.lastSingleton && measure.measure(tail) > before.width;
      const composed = composeParagraph(tokens, before.width, ch, { maxLines, candidateBar: 1, allowOrphan: unavoidableOrphan });
      const spaceEm = measure.measure(' ') / fontSize;
      lines = composed && (options.spacing === false ? composed : shapeExactLines(composed, ch, before.width, false, spaceEm, fontSize));
      if (lines && !finalValidate(lines, ch, false, spaceEm, unavoidableOrphan)) lines = null;
    }
  } finally {
    measure.dispose();
  }
  if (!lines) return finish(clamp > 0 ? 'native:clamped' : 'native:no-candidate');
  if (options.maxLines && lines.length > options.maxLines) return finish('native:line-budget');
  // Extra lines need a real readability benefit; never buy a nicer rag by
  // making a title taller or inflating a paragraph without a bounded budget.
  const bodyAllowance = mode === 'body' && (before.lastSingleton || options.density === 'editorial') ? 1 : 0;
  if (lines.length > before.lines.length + bodyAllowance) return finish('native:line-budget');
  try {
    render(element, source, lines);
  } catch {
    element.replaceChildren(...nodes);
    return finish('native:render-failed');
  }
  // Preserve a shrink-to-fit element's measured allocation for this render.
  // Restoration removes this constraint before EVERY subsequent measurement.
  if (cs.display === 'inline-block') element.style.inlineSize = cs.boxSizing === 'border-box'
    ? (before.width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)) + 'px'
    : before.width + 'px';
  if (cs.display === 'inline-block' && cs.maxInlineSize === 'none') element.style.maxInlineSize = '100%';
  const after = measureLayout(element);
  if (after.overflow > 0.5 || element.textContent !== source || after.lines.length !== lines.length || (clamp > 0 && after.lines.length > clamp)) {
    element.replaceChildren(...nodes);
    element.style.inlineSize = styles.inlineSize;
    element.style.maxInlineSize = styles.maxInlineSize;
    return finish('native:verification');
  }
  if (!before.lastSingleton && after.lastSingleton && mode === 'body') {
    element.replaceChildren(...nodes);
    element.style.inlineSize = styles.inlineSize;
    element.style.maxInlineSize = styles.maxInlineSize;
    return finish('native:quality');
  }
  return finish('composed');
}

export function typesetAll(selector = defaults, options: Options = {}): Result[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector), el => typeset(el, options));
}

export interface AuditIssue { element: HTMLElement; type: string; severity: 'error' | 'review'; detail: string }
export interface AuditReport {
  examined: number;
  outcomes: Record<string, number>;
  features: Record<'quotes' | 'hanging' | 'spacing' | 'tracking', Record<string, number>>;
  issues: AuditIssue[];
}
export function auditReport(selector = defaults): AuditReport {
  const report: AuditReport = { examined: 0, outcomes: {}, features: { quotes: {}, hanging: {}, spacing: {}, tracking: {} }, issues: [] };
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-ts-generated], [data-ts-probe]')) continue;
    report.examined++;
    const outcome = element.dataset.tsOutcome || (element.closest(excluded) ? 'excluded' : 'unprocessed');
    report.outcomes[outcome] = (report.outcomes[outcome] || 0) + 1;
    for (const [feature, value] of [['quotes', element.dataset.tsQuotes], ['hanging', element.dataset.tsHanging], ['spacing', element.dataset.tsSpacing], ['tracking', element.dataset.tsTracking]] as const) {
      const status = value || 'off';
      report.features[feature][status] = (report.features[feature][status] || 0) + 1;
    }
    const layout = measureLayout(element);
    const add = (type: string, severity: 'error' | 'review', detail: string) => report.issues.push({ element, type, severity, detail });
    if (layout.overflow > 0.75) add('overflow', 'error', layout.overflow.toFixed(2) + 'px outside content box');
    if (element.querySelector('.ts-line .ts-line')) add('nested-output', 'error', 'Generated lines contain generated lines');
    if (layout.lastSingleton) add('orphan', 'review', 'One word on the final line; may be unavoidable');
    if (layout.firstSingleton) add('first-singleton', 'review', 'One word on the first line; may be unavoidable');
    for (const [index, line] of layout.lines.slice(0, -1).entries()) {
      const word = line.text.trim().split(/\s+/u).at(-1) || '';
      const language = languageOf(element.closest('[lang]')?.getAttribute('lang'));
      if (language === 'und' ? isWeakEnding(word) : language !== 'invalid' && languageWeakEnding(word, language)) add('weak-line-end', 'review', 'Line ' + (index + 1) + ' ends on "' + word + '"');
      if (['en', 'und'].includes(language) && strandedOpener(line.text)) add('stranded-opener', 'review', 'Line ' + (index + 1) + ' leaves a sentence or clause opener at its end');
    }
    const state = states.get(element);
    if (state && state.output !== element.textContent) add('stale-output', 'error', 'Content changed since the last composition');
    if (outcome === 'native:no-candidate') {
      const constraint = state?.output === element.textContent ? state.result.constraint : undefined;
      const detail = constraint?.kind === 'unbreakable-run'
        ? 'A run needs ' + constraint.requiredWidth.toFixed(3) + 'px in ' + constraint.availableWidth.toFixed(3) + 'px with the permitted breaks'
        : constraint?.kind === 'line-budget'
          ? 'At least ' + constraint.minimumLines + ' lines are required; the budget is ' + constraint.maxLines
          : 'No acceptable composition found; inspect permitted breaks, measurement, and search constraints';
      add('composition-constraint', 'review', detail);
    }
    if (!layout.lines.length && (element.textContent || '').trim()) add('unmeasurable', 'review', 'No visible line boxes');
    if (outcome === 'unprocessed') add('unprocessed', 'review', 'No engine decision recorded');
  }
  return report;
}
export function audit(selector?: string): AuditIssue[] { return auditReport(selector).issues; }

/** JSON-safe evidence for agents and CI. Review items are not hard failures;
 * an empty selector match is never reported as a successful audit. */
export function auditJSON(selector = defaults) {
  const report = auditReport(selector);
  const identify = (element: HTMLElement) => {
    const path: string[] = [];
    for (let el: HTMLElement | null = element; el; el = el.parentElement) {
      if (el.id) { path.unshift('#' + CSS.escape(el.id)); break; }
      path.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + (Array.from(el.parentElement?.children || []).filter(sibling => sibling.tagName === el!.tagName).indexOf(el) + 1) + ')');
    }
    return path.join(' > ');
  };
  const errors = report.issues.filter(issue => issue.severity === 'error').length;
  const reviews = report.issues.filter(issue => issue.severity === 'review').length;
  const unprocessed = report.outcomes.unprocessed || 0;
  return {
    schemaVersion: 1, engineVersion: VERSION, examined: report.examined,
    pass: report.examined > 0 && errors === 0 && unprocessed === 0,
    errors, reviews, unprocessed, outcomes: report.outcomes, features: report.features,
    issues: report.issues.map(({ element, ...issue }) => ({ ...issue, target: identify(element) })),
  };
}

export interface Controller {
  ready: Promise<void>;
  refresh: () => void;
  disconnect: (restoreContent?: boolean) => void;
  stats: { passes: number; compositions: number; maxBatchMs: number; readonly overlappingTargets: number };
}

/** One lifecycle owner per mount. Observers are disconnected during our writes. */
export function mount(root: ParentNode = document, selector = defaults, options: Options = {}): Controller {
  const identity = Symbol('typeset-mount');
  const claimed = new Set<HTMLElement>();
  const blocked = new Map<HTMLElement, () => void>();
  const owned = new Set<HTMLElement>();
  const pending = new Set<HTMLElement>();
  const nearby = new Set<HTMLElement>();
  let stopped = false;
  let fontsReady = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: number | undefined;
  const stats = { passes: 0, compositions: 0, maxBatchMs: 0, get overlappingTargets() { return blocked.size; } };
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
  const eligible = (el: HTMLElement) => (el === root || root.contains(el)) && el.matches(selector) && !el.closest(excluded);
  const stopWaiting = (el: HTMLElement) => {
    const wake = blocked.get(el);
    if (!wake) return;
    const waiters = mountWaiters.get(el);
    waiters?.delete(wake);
    if (!waiters?.size) mountWaiters.delete(el);
    blocked.delete(el);
  };
  const claim = (el: HTMLElement): boolean => {
    const owner = mountOwners.get(el);
    if (owner && owner !== identity) {
      if (!blocked.has(el)) {
        const wake = () => {
          blocked.delete(el);
          if (!stopped && eligible(el)) { enqueue(el); schedule(); }
        };
        blocked.set(el, wake);
        let waiters = mountWaiters.get(el);
        if (!waiters) { waiters = new Set(); mountWaiters.set(el, waiters); }
        waiters.add(wake);
      }
      return false;
    }
    stopWaiting(el);
    mountOwners.set(el, identity);
    claimed.add(el);
    return true;
  };
  const release = (el: HTMLElement) => {
    claimed.delete(el);
    if (mountOwners.get(el) !== identity) return;
    mountOwners.delete(el);
    const waiters = mountWaiters.get(el);
    mountWaiters.delete(el);
    for (const wake of waiters || []) wake();
  };
  const select = (within: ParentNode = root) => {
    const scope = root instanceof HTMLElement && within instanceof Node && within.contains(root) ? root : within;
    const elements = Array.from(scope.querySelectorAll<HTMLElement>(selector));
    if (scope instanceof HTMLElement && scope.matches(selector)) elements.unshift(scope);
    return elements.filter(el => (el === root || root.contains(el)) && !el.closest(excluded) && !el.closest('[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line'));
  };
  const viewport = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) nearby.add(el); else nearby.delete(el);
      // One viewport snapshot per queued job. Watching thousands of finished
      // elements through every reflow costs more than the scheduling saves.
      viewport?.unobserve(el);
    }
  }, { rootMargin: '400px' });
  const enqueue = (el: HTMLElement) => {
    if (!claim(el)) return;
    if (!pending.has(el)) viewport?.observe(el);
    pending.add(el);
  };
  const discover = (within: ParentNode = root) => {
    for (const el of select(within)) enqueue(el);
  };
  const schedule = () => {
    if (stopped || !fontsReady || timer !== undefined || idle !== undefined || !pending.size) return;
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(flush, { timeout: 200 });
    else timer = setTimeout(() => flush(), 16);
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target instanceof HTMLElement ? record.target : record.target.parentElement;
      for (let el = target; el && (el === root || root.contains(el)); el = el.parentElement) {
        if (owned.has(el)) pending.add(el);
      }
      if (record.type === 'attributes' && target) {
        // An ancestor's styles can affect its entire subtree, but a clock tick
        // or an unrelated inserted node must not rescan the whole document.
        discover(target);
        if (target.closest(excluded)) for (const el of owned) if (target.contains(el)) pending.add(el);
      }
      if (record.type === 'childList') {
        for (const node of record.addedNodes) if (node instanceof HTMLElement) discover(node);
        if (target && !owned.has(target) && target.matches(selector) && !target.closest(excluded)) discover(target);
        for (const node of record.removedNodes) if (node instanceof Element && !root.contains(node)) {
          for (const el of claimed) if (node.contains(el) && !root.contains(el)) {
            owned.delete(el); pending.delete(el); nearby.delete(el); viewport?.unobserve(el); unwatch(el); release(el);
          }
          for (const el of blocked.keys()) if (node.contains(el) && !root.contains(el)) stopWaiting(el);
        }
      }
    }
    schedule();
  });
  const observedWidths = new WeakMap<Element, number>();
  const watched = new Map<Element, Set<HTMLElement>>();
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
    for (const entry of entries) {
      const previous = observedWidths.get(entry.target);
      observedWidths.set(entry.target, entry.contentRect.width);
      if (previous !== undefined && Math.abs(previous - entry.contentRect.width) <= .01) continue;
      for (const el of watched.get(entry.target) || []) pending.add(el);
    }
    if (pending.size) schedule();
  });
  const parents = new Map<HTMLElement, HTMLElement | null>();
  const watch = (el: HTMLElement) => {
    parents.set(el, el.parentElement);
    for (const target of [el, el.parentElement]) {
      if (!target) continue;
      let dependents = watched.get(target);
      if (!dependents) {
        dependents = new Set(); watched.set(target, dependents);
        observedWidths.set(target, contentWidth(target)); resize?.observe(target);
      }
      dependents.add(el);
    }
  };
  const unwatch = (el: HTMLElement) => {
    if (!parents.has(el)) return;
    for (const target of [el, parents.get(el)]) {
      if (!target) continue;
      const dependents = watched.get(target);
      dependents?.delete(el);
      if (!dependents?.size) { resize?.unobserve(target); watched.delete(target); }
    }
    parents.delete(el);
  };
  function observe() {
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'lang', 'data-no-typeset', 'data-typeset', 'data-typeset-mode'] });
    if (root instanceof HTMLElement) for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'lang'] });
    }
  }
  function flush(deadline?: IdleDeadline) {
    timer = undefined;
    idle = undefined;
    if (stopped) return;
    observer.disconnect();
    const start = performance.now();
    stats.passes++;
    function* work() {
      for (const el of nearby) if (pending.has(el)) yield el;
      yield* pending;
    }
    for (const el of work()) {
      pending.delete(el);
      nearby.delete(el); viewport?.unobserve(el);
      if (!(root === el || root.contains(el))) { owned.delete(el); unwatch(el); release(el); continue; }
      if (!eligible(el)) { restore(el); owned.delete(el); unwatch(el); release(el); continue; }
      if (owned.has(el) && parents.get(el) !== el.parentElement) { unwatch(el); watch(el); }
      const result = typeset(el, options);
      if (result.changed) stats.compositions++;
      if (!owned.has(el)) { owned.add(el); watch(el); }
      if (performance.now() - start >= 8 || (deadline && deadline.timeRemaining() <= 1)) break;
    }
    stats.maxBatchMs = Math.max(stats.maxBatchMs, performance.now() - start);
    observe();
    if (pending.size) schedule();
    else resolveReady();
  }
  const refresh = () => {
    if (stopped) return;
    discover();
    schedule();
  };
  const resized = () => {
    for (const el of owned) pending.add(el);
    schedule();
  };
  const fontsChanged = () => {
    for (const el of owned) {
      const state = states.get(el);
      if (state) state.signature = '';
    }
    refresh();
  };
  document.fonts.ready.then(() => {
    if (stopped) { resolveReady(); return; }
    fontsReady = true;
    discover();
    schedule();
    if (!pending.size) resolveReady();
  });
  observe();
  document.fonts.addEventListener('loadingdone', fontsChanged);
  window.addEventListener('resize', resized);
  return {
    ready, refresh, stats,
    disconnect(restoreContent = true) {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      observer.disconnect(); resize?.disconnect(); viewport?.disconnect();
      document.fonts.removeEventListener('loadingdone', fontsChanged);
      window.removeEventListener('resize', resized);
      if (restoreContent) for (const el of owned) restore(el);
      owned.clear(); pending.clear(); nearby.clear();
      watched.clear(); parents.clear();
      for (const el of blocked.keys()) stopWaiting(el);
      for (const el of claimed) release(el);
      resolveReady();
    },
  };
}

export { measureLayout, contentWidth, planRichText };
export type { RichPlan } from './rich-text';
export { typesetText, typesetHeading, measureCh, safeWrite, shouldIgnoreMutation } from './typeset';
