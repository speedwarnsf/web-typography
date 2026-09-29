import { composeParagraph, tokenize, shapeExactLines, finalValidate, isWeakEnding } from './typeset';
import type { FrozenLine } from './typeset';
import { composeTitle } from './title-layout';
import { contentWidth, measureForAudit, measureLayout } from './layout-metrics';
import type { LayoutMetrics } from './layout-metrics';
import { inLiveRegion, liveText, planRichText, renderRichText, richFingerprint, selectionBookmark, richLayoutVerified, breaksChangeAlignment } from './rich-text';
import { applySmartQuotes, englishScope, smartQuotes } from './smart-quotes';
import type { QuoteTransform } from './smart-quotes';
import { planOpticalHanging, opticalVerified } from './optical-hanging';
import type { RichOutput, RichPlan } from './rich-text';
import { planSpacingFinish, spacingVerified } from './spacing-finish';
export { analyzeBreaks, UNICODE_VERSION } from './break-opportunities';
import { exceedsRunBudget, languageOf, languageWeakEnding } from './break-opportunities';
import { boundPair, boundaryBefore, strandedOpener } from './phrase-boundaries';
import { preservesAdvances } from './geometry';
import { finishTargets } from './space-policy';
import { planTrackingFinish, renderTracking, trackingVerified } from './tracking-finish';
import { armFonts, ensureLifecycleStyles, installLifecycleStyles, lifecycleStylesFor, markTranslated, movedOnly, nearObserver, printing, rendered, signalQueued, subscribe, translationActive } from './lifecycle';
import { describe } from './validate';
// Controllers share composition state, so only one may write a given target.
import { mountOwners, mountWaiters } from './ownership';
import { canCompose, canMaintain, ENVIRONMENT_OUTCOME } from './environment';
import type { Outcome, QuoteStatus, HangingStatus, SpacingStatus, TrackingStatus } from './outcomes';
import { commonest, NOTHING_TO_IMPROVE } from './loader-notes';

export const VERSION = '4.3.1';
export type Mode = 'body' | 'heading' | 'title' | 'ui';
/**
 * Composition options. Defaults are those of the typeset.us package entry
 * points (typeset, typesetAll, mount, planRichText and the React adapters).
 * The same options are accepted by every entry point.
 */
export interface Options {
  /** Where lines may break. Default `'unicode'`: Unicode 17 line-break
   * opportunities with English, French, German and Spanish preferences from
   * the declared `lang`. `'legacy'` is the earlier English-only research path,
   * kept for comparison; it is not identical to 3.x. */
  lineBreaks?: 'legacy' | 'unicode';
  /** Default `false`. `'en'` converts straight quotes and apostrophes to curly
   * ones in English text: declared English, or untagged (quotes only; same
   * length, so offsets and copying stay aligned). `'en-declared'` converts
   * them only where the element or an ancestor declares English (the auto
   * loader's default), so an untagged German or French page keeps its
   * quotes. Changes the copied text. */
  smartQuotes?: 'en' | 'en-declared' | false;
  /** Default `false`. `true` hangs opening punctuation and measured capitals
   * into the left margin, reversibly, when the glyph fits inside any clip. */
  opticalHanging?: boolean;
  /** Default `true`. Adjusts word spaces on composed, left-aligned body text
   * within -20% to +33% of their natural width. `false` also turns off
   * `tracking`. */
  spacing?: boolean;
  /** Default `true` (while `spacing` is on). Adjusts letter spacing by at most
   * 0.01em per line after word spacing. `false` keeps word spacing only. */
  tracking?: boolean;
  /** Default `'finished'`: ranks candidates by their predicted rag after
   * spacing. `'natural'` ranks by natural widths, the earlier ranking, kept
   * for comparison. */
  contour?: 'natural' | 'finished';
  /** Default `'body'`, or `'title'` inside h1-h6; also read from
   * `data-typeset-mode`. `'title'` and `'heading'` balance short display text
   * and never add a line; `'body'` composes paragraphs; `'ui'` never composes
   * (outcome `native:ui`). */
  mode?: Mode;
  /** Default none. Phrases whose words should stay on one line, such as
   * `['New York']`. Matching ignores case, treats NBSP and runs of spaces as
   * one space and ignores punctuation around the phrase. In body text a kept
   * phrase that fits the measure is never split, a phrase the browser splits
   * can earn one extra line (not with `density: 'compact'`), and a longer
   * phrase is split as few times as possible. Titles and headings keep
   * phrases within their minimum line count. The browser's lines are kept
   * as they are only when they split no kept phrase. */
  keep?: readonly string[];
  /** Default none. The most lines a composition may use; a result that needs
   * more is declined with `native:line-budget`. */
  maxLines?: number;
  /** Default (omitted): body text keeps the browser's line count, or uses one
   * more line to repair a one-word last line or a stranded sentence or
   * clause opener. `'compact'`: one more line only to repair a one-word last
   * line. `'editorial'`: one more line allowed for better phrasing. */
  density?: 'compact' | 'editorial';
  /** Default `true`: a document copy handler puts the source text on the
   * clipboard, without the generated line breaks (and, for rich text, the
   * markup without engine markers). `false` leaves this element's copying to
   * the browser, whose copied text then has a line break at every composed
   * line end. The handler is installed only when some composed element has
   * copy on, and it yields to any copy handler the page registered first. */
  copy?: boolean;
  /** Current author text. Framework adapters pass this on updates. */
  text?: string;
}
/** What typeset() did to one element. `outcome` is also written to
 * `data-ts-outcome`; OUTCOMES.md explains every value. */
export interface Result {
  /** One of OUTCOMES; typed so that a future code still compiles. */
  outcome: Outcome | (string & {});
  mode: Mode;
  /** Line boxes before and after, as measured in the browser. */
  before: LayoutMetrics;
  after: LayoutMetrics;
  /** True when the DOM was changed (composed, or quotes converted). */
  changed: boolean;
  durationMs: number;
  /** Why no candidate fitted, when outcome is `native:no-candidate`. */
  constraint?: RichPlan['constraint'];
  /** Candidate-search evidence for rich composition. */
  search?: RichPlan['search'];
  /** Finishing-feature statuses (also `data-ts-quotes`, `-hanging`, `-spacing`, `-tracking`). */
  features?: { quotes: QuoteStatus | (string & {}); hanging: HangingStatus | (string & {}); spacing: SpacingStatus | (string & {}); tracking: TrackingStatus | (string & {}) };
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
  /** layoutKey() of the composed element, for cheap rechecks. */
  layout: string;
  /** optionsKey() of the options it was composed with. */
  options: string;
  /** Right edge of the widest composed line from the content box's left edge;
   * 0 when nothing is composed. Narrower than this, the forced breaks wrap twice. */
  widest: number;
  result: Result;
  rich?: RichOutput;
  hadStyle: boolean;
  quotes?: QuoteTransform;
  optical?: RichOutput;
  spacing?: RichOutput;
  tracking?: RichOutput;
  /** Every Text node an output split, with its data as composed. */
  heads: Map<Text, string>;
  /** Composed with English lexical preferences (declared English, or the
   * legacy break path, which applies them to untagged text). */
  english: boolean;
}
const states = new WeakMap<HTMLElement, State>();

/** A write to, or removal of, a Text node the engine split: its tails still
 * show the old text. Frameworks do this for every text update (Svelte, Vue,
 * Lit, Solid and React set .data or .nodeValue on the node they created). */
function staleSplit(element: HTMLElement, state: State, record: MutationRecord, written: Set<Node>): boolean {
  if (record.type === 'characterData') {
    // A write from the composed value is external even when it writes the
    // same value: a framework emptying a node the engine already emptied.
    const composed = state.heads.get(record.target as Text);
    if (composed === undefined || ((record.target as Text).data === composed && record.oldValue !== composed)) return false;
    written.add(record.target);
    return true;
  }
  return record.type === 'childList' && Array.from(record.removedNodes).some(node => state.heads.has(node as Text) && !element.contains(node));
}

/** Remove stale tails and every engine node now, before the next frame, and
 * leave the element for recomposition. Quotes stay educated until then. */
function releaseOutput(element: HTMLElement, state: State, written: ReadonlySet<Node>): void {
  const restoreSelection = selectionBookmark(element);
  state.optical?.cleanup(written);
  state.tracking?.cleanup(written);
  state.spacing?.cleanup(written);
  state.rich?.cleanup(written);
  state.signature = '';
  restoreSelection();
}
// The last options.text written to an element: a translator's rewrite of that
// text is not a new value to write back.
const authorTexts = new WeakMap<HTMLElement, string>();
const measurements = new WeakMap<Document, Map<string, Map<string, number>>>();
const fontVersions = new WeakMap<Document, { epoch: number }>();
const fontIds = new WeakMap<FontFace, number>();
// WebKit may collect and re-create the wrapper of a face nothing references,
// which a WeakMap would count as a new face: every key would change once.
const fontsSeen = new WeakMap<Document, FontFace[]>();
let nextFontId = 0;
function fontVersion(doc: Document): string {
  let version = fontVersions.get(doc);
  if (!version) {
    version = { epoch: 0 };
    fontVersions.set(doc, version);
    const current = version;
    doc.fonts?.addEventListener?.('loadingdone', () => { current.epoch++; });
  }
  // FontFace objects can be added already loaded, or replaced while the set
  // remains "loaded". Those changes need not fire a loadingdone event.
  const faces: string[] = [], seen: FontFace[] = [];
  doc.fonts?.forEach(face => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFontId);
    seen.push(face);
    faces.push([fontIds.get(face), face.family, face.status, face.weight, face.style, face.stretch].join(':'));
  });
  fontsSeen.set(doc, seen);
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

/** Everything that decides line layout, read from computed values rather than
 * from attribute strings: an ancestor's class or style counts only through
 * what it computes to. Cheap per block, but an ancestor change rechecks every
 * block inside it (about 15 ms for 1,000 blocks at 4x CPU), so a translation
 * or fade, written every frame by an animation, is not rechecked (movedOnly). */
function layoutKey(el: HTMLElement): string {
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const inset = parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0') + parseFloat(cs.borderLeftWidth || '0') + parseFloat(cs.borderRightWidth || '0');
  // Transforms, zoom and scale on any ancestor change glyph advances without
  // changing a computed style here; their ratio to the layout width does.
  // The two drawn-size terms come first (see transformOnly).
  const used = parseFloat(cs.width);
  const layout = cs.boxSizing === 'border-box' ? used : used + inset;
  const scale = layout > 0 ? Math.round(box.width / layout * 1000) / 1000 : 1;
  const zoom = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
  return JSON.stringify([Math.max(0, box.width - inset), scale, layout,
    fontVersion(el.ownerDocument), el.ownerDocument.fonts?.status,
    zoom, cs.font, cs.fontFamily, cs.fontSize,
    cs.fontWeight, cs.fontStyle, cs.fontStretch, cs.fontFeatureSettings,
    cs.fontVariationSettings, cs.fontOpticalSizing, cs.fontVariant, cs.fontKerning,
    cs.fontSizeAdjust, cs.fontSynthesis, cs.textRendering, cs.letterSpacing, cs.wordSpacing,
    cs.lineHeight, cs.textTransform, cs.whiteSpace, cs.textAlign, cs.textAlignLast, cs.direction,
    cs.writingMode, cs.display, cs.textWrap, cs.hyphens, cs.wordBreak, cs.lineBreak, cs.overflowWrap, cs.getPropertyValue('-webkit-line-clamp'),
    cs.overflow, cs.textOverflow, cs.textIndent, cs.boxSizing, cs.maxInlineSize,
    // A shrink-to-fit block is pinned to its composed width; its parent's width decides.
    cs.display === 'inline-block' && el.parentElement ? contentWidth(el.parentElement) : null,
    el.closest('[lang]')?.getAttribute('lang'), el.dataset.typesetMode,
    getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content,
    // Author descendants only: the engine's own tracking spans need no fingerprint.
    el.querySelector(':not([data-ts-break]):not(.ts-line):not([data-ts-track])') ? richFingerprint(el) : '',
  ]);
}
/** Whether two layout keys differ only in the size a transform draws the
 * element at (a scale, a rotation), not in its layout: its lines break where
 * they did, so a composition made without the transform stays correct. */
function transformOnly(a: string, b: string): boolean {
  return a.slice(a.indexOf(',', a.indexOf(',') + 1)) === b.slice(b.indexOf(',', b.indexOf(',') + 1));
}
function optionsKey(options: Options): string {
  return JSON.stringify([options.mode, options.keep, options.maxLines, options.density, options.text, options.lineBreaks, options.smartQuotes, options.opticalHanging, options.spacing, options.tracking, options.contour, options.copy]);
}
function signature(el: HTMLElement, options: Options, layout = layoutKey(el)): string {
  return el.innerHTML + '\u0000' + layout + '\u0000' + optionsKey(options);
}

/** A composition still renders as composed: one line per generated line, no
 * native wraps added by a font, spacing or size change since it was verified. */
function layoutIntact(el: HTMLElement): boolean {
  const outcome = el.dataset.tsOutcome;
  if (outcome !== 'composed:rich' && outcome !== 'composed') return true;
  const lines = measureLayout(el).lines.length;
  return outcome === 'composed' ? lines === el.querySelectorAll(':scope > .ts-line').length
    : lines === el.querySelectorAll('br[data-ts-break]').length + 1;
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
  settleTranslation(element);
  const state = states.get(element);
  if (!state) {
    // Released to a translator: only the outcome is left to remove.
    if (element.dataset.tsOutcome === 'native:translated') delete element.dataset.tsOutcome;
    return;
  }
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
  element.removeAttribute('data-ts-stale');
}

/** Compositions released to a translator, until the translation ends. */
const translated = new WeakMap<HTMLElement, State>();
/** Release to a translator. Engine markers are removed and wrappers unwrapped
 * by moving their existing Text nodes; no Text node is split, merged, edited
 * or removed, since the translator holds and fills them. Quote substitutions
 * stay as they are for the same reason; both are undone when the translation
 * ends (settleTranslation). A word space beside a removed break or wrapper is
 * moved in place too: Chromium left it out of its accessibility tree while it
 * collapsed at a line end and does not add it back as it comes to sit
 * mid-line, which would join the words around every former break for a
 * screen reader already running. */
function yieldToTranslation(element: HTMLElement): void {
  const state = states.get(element);
  const spaces = new Set<Text>();
  const beside = (node: Node) => {
    for (const sibling of [node.previousSibling, node.nextSibling]) if (sibling?.nodeType === Node.TEXT_NODE && (sibling as Text).length && !/\S/u.test((sibling as Text).data)) spaces.add(sibling as Text);
  };
  for (const marker of element.querySelectorAll('[data-ts-break]')) { beside(marker); marker.remove(); }
  for (const wrapper of element.querySelectorAll('[data-ts-track], .ts-line[data-ts-generated]')) { beside(wrapper); wrapper.replaceWith(...wrapper.childNodes); }
  for (const space of spaces) if (space.parentNode && element.contains(space)) space.parentNode.insertBefore(space, space.nextSibling);
  if (state && !translated.has(element)) translated.set(element, state);
  if (state) {
    resetStyles(element, state);
    if (element.style.getPropertyPriority('text-wrap-style') === 'important' && element.style.getPropertyValue('text-wrap-style') === 'auto') element.style.removeProperty('text-wrap-style');
    if (!state.hadStyle && !element.style.length) element.removeAttribute('style');
  }
  states.delete(element);
  for (const name of ['typesetDone', 'tsQuotes', 'tsHanging', 'tsSpacing', 'tsTracking']) delete element.dataset[name];
  element.removeAttribute('data-ts-stale');
}
/** The translation ended ("show original"): merge the Text nodes the released
 * composition split and put its straight quotes back, wherever the translator
 * left them as they were, so the next composition, a restore() or a
 * framework's next write starts from the author's text, not from engine
 * fragments (a write to a split author node would leave its old tails on
 * screen beside the new text). */
function settleTranslation(element: HTMLElement): void {
  const state = translated.get(element);
  if (!state || translationActive(element.ownerDocument)) return;
  translated.delete(element);
  const restoreSelection = selectionBookmark(element);
  for (const output of [state.optical, state.tracking, state.spacing, state.rich]) output?.rejoin();
  state.quotes?.restore();
  restoreSelection();
}

/** Exact DOM measurements inherit font features, axes, tracking and transforms. */
function makeMeasurer(element: HTMLElement): { prepare: (texts: string[]) => void; measure: (text: string) => number; dispose: () => void } {
  const cs = getComputedStyle(element);
  const styleKey = JSON.stringify([
    fontVersion(element.ownerDocument), element.ownerDocument.fonts?.status,
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
  if ((element as Node | null)?.nodeType !== 1) {
    throw new TypeError('[typeset] typeset() expects an HTMLElement (received ' + describe(element) + (typeof element === 'string' ? '; typesetAll() and mount() take selectors' : '') + ')');
  }
  const started = performance.now();
  const mode = modeOf(element, options);
  if (element.closest('[data-typeset-react-rich]')) return { outcome: 'skipped:framework', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  if (element.closest(excluded) || element.closest('[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line')) {
    return { outcome: 'skipped:excluded', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: 0 };
  }
  // No layout engine (jsdom, happy-dom) or no Intl.Segmenter: leave the text
  // as authored and say why, rather than throw.
  if (!canCompose(element.ownerDocument)) {
    element.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
    return { outcome: ENVIRONMENT_OUTCOME, mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  if (translationActive(element.ownerDocument)) {
    if (states.has(element) || element.querySelector('[data-ts-break], [data-ts-track]')) yieldToTranslation(element);
    if (options.text !== undefined && authorTexts.get(element) !== options.text) { element.textContent = options.text; authorTexts.set(element, options.text); }
    element.dataset.tsOutcome = 'native:translated';
    return { outcome: 'native:translated', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  settleTranslation(element);
  if (liveText(element)) {
    // Release any earlier composition and apply adapter text, then leave the
    // region alone: no measurement overrides, no markers, no attributes.
    if (states.has(element)) restore(element);
    if (options.text !== undefined) {
      // TypesetText curls quotes as it renders: that text is current, and a
      // new value is written educated as it would be outside a region.
      const curled = options.smartQuotes === 'en' || options.smartQuotes === 'en-declared' ? smartQuotes(options.text) : options.text;
      const lang = element.closest('[lang]')?.getAttribute('lang');
      if (element.textContent !== options.text && element.textContent !== curled) element.textContent = englishScope(lang, options.smartQuotes === 'en-declared') ? curled : options.text;
      authorTexts.set(element, options.text);
    }
    return { outcome: 'native:live-region', mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  const prior = states.get(element);
  // Hidden (display:none, a closed dialog, a skipped content-visibility
  // subtree): nothing can be measured, so keep the composition. When the
  // block is shown at the same width it paints composed, with no re-break.
  const visible = rendered(element);
  if (prior && !visible && prior.options === optionsKey(options) && ownsOutput(element, prior)) return { ...prior.result, changed: false, durationMs: performance.now() - started };
  // Only a prior composition can be current; a first one needs no signature yet.
  if (prior && prior.signature === signature(element, options) && ownsOutput(element, prior)) {
    // Back at the geometry it was composed for (a resize that returned).
    element.removeAttribute('data-ts-stale');
    return { ...prior.result, changed: false, durationMs: performance.now() - started };
  }
  element.removeAttribute('data-ts-stale');
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
        if (node.nodeType === 1 && node.parentNode === element && (node as Element).hasAttribute('data-ts-generated')) {
          (node as Element).replaceWith(...node.childNodes);
        }
      }
    }
    prior.quotes?.restore();
    restoreSelection();
  }
  if (options.text !== undefined) {
    if (element.textContent !== options.text) element.textContent = options.text;
    authorTexts.set(element, options.text);
  }
  const rawMarkup = element.innerHTML;
  const restoreQuoteSelection = selectionBookmark(element);
  const quotes = options.smartQuotes === 'en' || options.smartQuotes === 'en-declared' ? applySmartQuotes(element, options.smartQuotes === 'en-declared') : undefined;
  restoreQuoteSelection();
  const source = element.textContent || '';
  const originalMarkup = element.innerHTML;
  const nodes = Array.from(element.childNodes);
  const hadStyle = element.hasAttribute('style');
  const styles = { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize };
  // An unbreakable run too long to measure safely (see RUN_BUDGET): decline
  // before reading a single box, so nothing here costs its square.
  const overlong = visible && exceedsRunBudget(source);
  const before = visible && !overlong ? measureLayout(element) : emptyMetrics();
  let rich: RichOutput | undefined;
  let search: RichPlan['search'];
  // The composition's style fingerprint as the last verification confirmed
  // it, so a finish pass reads it again only after a rollback.
  let fingerprinted: string | undefined;
  // Natural word spaces measured for the contour serve the spacing finish.
  // Only within this call: a later call may see different fonts.
  const spaceWidths = new Map<string, number>();
  // With copy: false the document copy handler leaves this element alone.
  const copy = options.copy !== false;
  const finish = (outcome: string, constraint?: RichPlan['constraint']): Result => {
    let optical: RichOutput | undefined;
    let spacing: RichOutput | undefined;
    let tracking: RichOutput | undefined;
    let targets: number[] | undefined;
    const features = { quotes: quotes?.outcome || 'off', hanging: options.opticalHanging ? 'native:hanging-uncomposed' : 'off',
      spacing: options.spacing === false ? 'off' : mode !== 'body' ? 'native:spacing-mode' : 'native:spacing-uncomposed',
      tracking: options.tracking === false || options.spacing === false ? 'off' : mode !== 'body' ? 'native:tracking-mode' : 'native:tracking-uncomposed' };
    if (options.spacing !== false && mode === 'body' && outcome === 'composed:rich') {
      const plan = planSpacingFinish(element, measureLayout(element), spaceWidths);
      targets = finishTargets(plan.before.lines.map(line => line.width), plan.before.width);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      features.spacing = plan.outcome;
      if (plan.adjustments.length) {
        spacing = renderRichText(element, [], [], plan.adjustments, copy);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !spacingVerified(element, plan, measureLayout(element))) {
          spacing.cleanup(); spacing = undefined; features.spacing = 'native:spacing-verification';
        }
      }
      fingerprinted = spacing || !plan.adjustments.length ? fingerprint : undefined;
    } else if (options.spacing !== false && mode === 'body' && outcome === 'composed') {
      features.spacing = Array.from(element.querySelectorAll<HTMLElement>('.ts-line')).some(line => parseFloat(line.style.wordSpacing)) ? 'applied' : 'unchanged';
    }
    if (targets && options.tracking !== false && ['applied', 'unchanged'].includes(features.spacing)) {
      const plan = planTrackingFinish(element, measureLayout(element), targets);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      features.tracking = plan.outcome;
      if (plan.runs.length) {
        tracking = renderTracking(element, plan, copy);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !trackingVerified(element, plan, measureLayout(element))) {
          tracking.cleanup(); tracking = undefined; features.tracking = 'native:tracking-verification';
        }
      }
      fingerprinted = tracking || !plan.runs.length ? fingerprint : undefined;
    }
    if (options.opticalHanging && (outcome === 'composed:rich' || outcome === 'native:fits')) {
      const layout = measureLayout(element);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      const plan = planOpticalHanging(element, layout);
      features.hanging = plan.outcome;
      if (plan.hangs.length) {
        optical = renderRichText(element, [], plan.hangs, [], copy);
        const after = measureLayout(element);
        if (!opticalVerified(element, layout, after, plan.hangs) || richFingerprint(element) !== fingerprint) {
          optical.cleanup(); optical = undefined; features.hanging = 'native:hanging-verification';
        }
      }
    }
    const after = visible && !overlong ? measureLayout(element) : emptyMetrics();
    let widest = 0;
    if (outcome.startsWith('composed') && after.lines.length) {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      const left = box.left + parseFloat(style.borderLeftWidth || '0') + parseFloat(style.paddingLeft || '0');
      widest = Math.max(...after.lines.map(line => line.right - left));
      installLifecycleStyles(element.ownerDocument, element);
    }
    element.dataset.tsOutcome = outcome;
    element.dataset.typesetDone = '1';
    element.dataset.tsQuotes = features.quotes;
    element.dataset.tsHanging = features.hanging;
    element.dataset.tsSpacing = features.spacing;
    element.dataset.tsTracking = features.tracking;
    const result: Result = { outcome, mode, before, after, changed: element.innerHTML !== rawMarkup, durationMs: performance.now() - started, ...(constraint && { constraint }), ...(search && { search }), features };
    const layout = layoutKey(element);
    const heads = new Map<Text, string>();
    for (const output of [rich, spacing, tracking, optical]) for (const head of output?.heads || []) heads.set(head, head.data);
    states.set(element, {
      nodes, outputNodes: Array.from(element.childNodes), source, output: element.textContent || '', markup: element.innerHTML, styles,
      appliedStyles: { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize },
      // Never cache a decision made without measurement: the next call decides again.
      signature: outcome === 'unmeasurable' ? '' : signature(element, options, layout), layout, options: optionsKey(options), widest, result,
      rich, hadStyle, quotes, optical, spacing, tracking, heads,
      english: options.lineBreaks !== 'unicode' || languageOf(element.closest('[lang]')?.getAttribute('lang')) === 'en',
    });
    return result;
  };
  if (!source.trim()) return finish('native:empty');
  if (overlong) return finish('native:run-budget');
  const cs = getComputedStyle(element);
  const lang = element.closest('[lang]')?.getAttribute('lang');
  if (options.lineBreaks !== 'unicode' && ((lang && !/^en(?:-|$)/i.test(lang)) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return finish('native:language');
  if (!visible || !before.width || !before.lines.length) return finish('unmeasurable');
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
    const plan = planRichText(element, { ...options, mode }, before, spaceWidths);
    search = plan.search;
    if (plan.outcome !== 'composed:rich') return finish(plan.outcome, plan.constraint);
    rich = renderRichText(element, plan.breaks, [], [], copy);
    const after = measureLayout(element);
    if (!richLayoutVerified(plan, after) || element.textContent !== source || richFingerprint(element) !== plan.styleSignature
      || (!before.lastSingleton && after.lastSingleton && mode === 'body')) {
      rich.cleanup(); rich = undefined;
      return finish('native:verification');
    }
    fingerprinted = plan.styleSignature;
    return finish('composed:rich');
  }
  if (before.lines.length === 1 && before.overflow <= 0.5) return finish('native:fits');
  if (breaksChangeAlignment(cs)) return finish('native:justify');
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
      const composed = composeParagraph(tokens, before.width, ch, { maxLines, candidateBar: 1, allowOrphan: unavoidableOrphan, keep: options.keep });
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

const isElement = (node: unknown): node is HTMLElement => (node as Node | null)?.nodeType === 1;

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
/**
 * What a reader notices where lines end, judged by the policy the compositor
 * applies to this text: English lexical preferences for declared English (or
 * text the legacy path composed), the language profile for fr/de/es, and no
 * word lists for untagged text, which the compositor treats neutrally.
 */
function lineReview(layout: LayoutMetrics, language: string, english: boolean): { type: string; detail: string }[] {
  const review: { type: string; detail: string }[] = [];
  const add = (type: string, detail: string) => review.push({ type, detail });
  if (layout.lastSingleton) add('orphan', 'One word on the final line; may be unavoidable');
  if (layout.firstSingleton) add('first-singleton', 'One word on the first line; may be unavoidable');
  for (const [index, line] of layout.lines.slice(0, -1).entries()) {
    const words = line.text.trim().split(/\s+/u);
    const word = words.at(-1) || '', previous = words.at(-2), earlier = words.at(-3);
    const first = layout.lines[index + 1].text.trim().split(/\s+/u)[0] || '';
    const at = 'Line ' + (index + 1);
    // A word before sentence punctuation ends its sentence ("through."), and
    // a letter designator completes its phrase ("type A"); both may end a line.
    const designated = previous !== undefined && boundPair(previous, word, earlier) === 'designator';
    const weak = !boundaryBefore(word, first) && !designated && (english ? isWeakEnding(word)
      : language !== 'und' && language !== 'en' && language !== 'invalid' && languageWeakEnding(word, language));
    if (weak) add('weak-line-end', at + ' ends on "' + word + '"');
    if (english && strandedOpener(line.text)) add('stranded-opener', at + ' leaves a sentence or clause opener at its end');
    const pair = english ? boundPair(word, first, previous) : null;
    if (pair) add('bound-split', at + ' separates "' + word + '" from "' + first + '" (' + { unit: 'number and unit', honorific: 'honorific and name', label: 'label and number', designator: 'word and letter designator' }[pair] + ')');
    if (/^\./u.test(first)) add('split-ellipsis', 'Line ' + (index + 2) + ' begins with the rest of a split ellipsis');
    // An apostrophe that opens an elided word (’n’, ’round, ’90s, ’tis) is
    // not closing punctuation; the word may start a line.
    else if (/^[\u2013\u2014,;:!?)\]}\u201D\u2019\u00BB]/u.test(first) && !/^\u2019[\p{L}\p{N}]/u.test(first)) add('line-initial-punctuation', 'Line ' + (index + 2) + ' begins with "' + first[0] + '"');
  }
  return review;
}

export function auditReport(selector = defaults): AuditReport {
  const report: AuditReport = { examined: 0, outcomes: {}, features: { quotes: {}, hanging: {}, spacing: {}, tracking: {} }, issues: [] };
  // For the scope's own review items (4.4): elements with an engine outcome,
  // how many were composed, and composed ones set without a language.
  const decided: HTMLElement[] = [], untagged: HTMLElement[] = [];
  let composedCount = 0;
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest('[data-ts-generated], [data-ts-probe]')) continue;
    report.examined++;
    const outcome = element.dataset.tsOutcome || (element.closest(excluded) ? 'excluded' : liveText(element) ? 'native:live-region' : 'unprocessed');
    report.outcomes[outcome] = (report.outcomes[outcome] || 0) + 1;
    for (const [feature, value] of [['quotes', element.dataset.tsQuotes], ['hanging', element.dataset.tsHanging], ['spacing', element.dataset.tsSpacing], ['tracking', element.dataset.tsTracking]] as const) {
      const status = value || 'off';
      report.features[feature][status] = (report.features[feature][status] || 0) + 1;
    }
    const layout = measureForAudit(element);
    const add = (type: string, severity: 'error' | 'review', detail: string) => report.issues.push({ element, type, severity, detail });
    const style = getComputedStyle(element);
    if (layout.overflow > 0.75) {
      // Text cut off on purpose (overflow hidden or clip with an ellipsis or
      // a line clamp) is the author's layout: a review item, not an error.
      const clips = ['hidden', 'clip'].includes(style.overflowX) || ['hidden', 'clip'].includes(style.overflowY);
      const clamp = parseInt(style.getPropertyValue('-webkit-line-clamp'), 10) > 0;
      if (clips && (/ellipsis/.test(style.textOverflow) || clamp)) {
        add('clipped', 'review', layout.overflow.toFixed(2) + 'px clipped on purpose (overflow: ' + (['hidden', 'clip'].includes(style.overflowX) ? style.overflowX : style.overflowY)
          + (clamp ? ', -webkit-line-clamp: ' + style.getPropertyValue('-webkit-line-clamp') : ', text-overflow: ellipsis') + ')');
      } else add('overflow', 'error', layout.overflow.toFixed(2) + 'px outside content box');
    }
    if (element.querySelector('.ts-line .ts-line')) add('nested-output', 'error', 'Generated lines contain generated lines');
    // Composed while left-aligned, then justified: every generated break now
    // ends a line that takes the last-line alignment.
    if (outcome.startsWith('composed') && breaksChangeAlignment(style)) {
      add('alignment-lost', 'error', 'text-align: ' + style.textAlign + (style.textAlignLast && style.textAlignLast !== 'auto' ? ', text-align-last: ' + style.textAlignLast : '')
        + ' cannot apply to composed lines, which each end in a generated break');
    }
    // A generated break at a space stands in for that space, which collapses at
    // the line end. Hidden from assistive technology, it leaves nothing between
    // the two words. (A break after a hyphen or dash separates no words.)
    let hiddenBreaks = 0;
    for (const br of element.querySelectorAll('br[data-ts-break][aria-hidden="true" i]')) {
      const range = element.ownerDocument.createRange();
      range.setStart(element, 0); range.setEndBefore(br);
      const before = range.toString();
      range.setStartAfter(br); range.setEnd(element, element.childNodes.length);
      if (/\s$/u.test(before) || /^\s/u.test(range.toString())) hiddenBreaks++;
    }
    if (hiddenBreaks) add('hidden-break', 'error', hiddenBreaks + ' generated line break' + (hiddenBreaks === 1 ? ' is' : 's are') + ' hidden from assistive technology where ' + (hiddenBreaks === 1 ? 'it replaces' : 'they replace') + ' a space; the words on either side are read as one');
    // A space alone in its Text node beside an atomic-inline marker is dropped
    // from Chromium's accessibility tree, joining the words around it.
    let isolatedSpaces = 0;
    for (const marker of element.querySelectorAll<HTMLElement>('[data-ts-break]:not(br)')) {
      if (['inline', 'none', 'contents'].includes(getComputedStyle(marker).display)) continue;
      for (const sibling of [marker.previousSibling, marker.nextSibling]) if (sibling?.nodeType === 3 && /^\s+$/.test((sibling as Text).data)) isolatedSpaces++;
    }
    if (isolatedSpaces) add('isolated-space', 'error', isolatedSpaces + ' word space' + (isolatedSpaces === 1 ? ' stands' : 's stand') + ' alone beside inline-block engine markers; Chromium drops ' + (isolatedSpaces === 1 ? 'it' : 'them') + ' from the accessibility tree');
    // A composition renders one line per generated line. A font, spacing or
    // size change since then adds native wraps: alternating long and short lines.
    if ((outcome === 'composed:rich' || outcome === 'composed') && !element.hasAttribute('data-ts-stale')) {
      const expected = outcome === 'composed' ? element.querySelectorAll(':scope > .ts-line').length : element.querySelectorAll('br[data-ts-break]').length + 1;
      if (layout.lines.length !== expected) add('stale-layout', 'error', layout.lines.length + ' rendered lines where the composition has ' + expected + '; text metrics changed after it was composed');
    }
    const state = states.get(element);
    const language = languageOf(element.closest('[lang]')?.getAttribute('lang'));
    const english = language === 'en' || (language === 'und' && !!state?.english);
    if (element.dataset.tsOutcome) decided.push(element);
    if (outcome.startsWith('composed')) { composedCount++; if (language === 'und' && !english) untagged.push(element); }
    const review = lineReview(layout, language, english);
    for (const item of review) add(item.type, 'review', item.detail);
    const current = !!state && state.output === element.textContent;
    if (state && !current) add('stale-output', 'error', 'Content changed since the last composition');
    // More line-end problems than the browser's own layout had.
    if (current && outcome.startsWith('composed')) {
      const native = lineReview(state.result.before, language, english).length;
      if (review.length > native) add('regressed-vs-native', 'review', review.length + ' line review items after composition; the native layout had ' + native);
    }
    if (outcome === 'native:no-candidate') {
      const constraint = current ? state!.result.constraint : undefined;
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
  // Composed text that declares no language gets neutral preferences: no
  // English weak-word or phrase preferences. One item, on the first such element.
  if (untagged.length) {
    report.issues.push({ element: untagged[0], type: 'untagged', severity: 'review', detail: untagged.length + ' composed element' + (untagged.length === 1 ? ' declares' : 's declare')
      + ' no language, so English line-end preferences are off; add lang="en" to <html> if the text is English' });
  }
  // Nothing in scope composed, for a reason other than nothing to improve
  // (a language, markup, jsdom's native:environment): one item, with the
  // most common reason. 4.3 passed such a page with no word.
  const declined = decided.filter(element => !NOTHING_TO_IMPROVE.has(element.dataset.tsOutcome!));
  if (!composedCount && declined.length) {
    const [outcome, count] = commonest(declined);
    report.issues.push({ element: declined[0], type: 'uncomposed', severity: 'review', detail: 'None of the ' + decided.length + ' element' + (decided.length === 1 ? '' : 's')
      + ' with an outcome was composed; most common: ' + outcome + ' \u00d7' + count + ' (OUTCOMES.md says why)' });
  }
  return report;
}
export function audit(selector?: string): AuditIssue[] { return auditReport(selector).issues; }

/** JSON-safe evidence for agents and CI. Review items are not hard failures;
 * an empty selector match is never reported as a successful audit. */
export function auditJSON(selector = defaults) {
  const report = auditReport(selector);
  // A selector document.querySelector resolves to the element: from a unique
  // id, or else from body (or :root for the root element itself).
  const identify = (element: HTMLElement) => {
    const path: string[] = [];
    const doc = element.ownerDocument;
    for (let el: HTMLElement | null = element; el; el = el.parentElement) {
      // CSS.escape is missing in jsdom.
      const id = el.id && (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id.replace(/[^\w-]/gu, c => '\\' + c));
      if (id && doc.querySelectorAll('#' + id).length === 1) { path.unshift('#' + id); break; }
      if (el === doc.documentElement) { path.unshift(':root'); break; }
      if (el === doc.body) { path.unshift('body'); break; }
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

// Controller jobs. CONTENT recomposes through typeset()'s full signature;
// KEY rechecks the computed layout key and composes only if it changed;
// VERIFY also checks that the rendered lines still match the composition;
// RELEASE removes the markup of stale text left waiting (see settle).
const CONTENT = 1, KEY = 2, VERIFY = 4, RELEASE = 8;
const RESIZE_SETTLE_MS = 100;
const REVEAL_BUDGET_MS = 24;

/** One lifecycle owner per mount. Observers are disconnected during our writes.
 * mount('article p', options) is mount(document, 'article p', options). */
export function mount(selector: string, options?: Options): Controller;
export function mount(root?: ParentNode, selector?: string, options?: Options): Controller;
export function mount(target: ParentNode | string = document, selectorOrOptions?: string | Options, maybeOptions: Options = {}): Controller {
  const byString = typeof target === 'string';
  const root: ParentNode = byString ? document : target as ParentNode;
  const selector = byString ? target as string : typeof selectorOrOptions === 'string' ? selectorOrOptions : defaults;
  const options: Options = (byString && selectorOrOptions && typeof selectorOrOptions === 'object' ? selectorOrOptions : maybeOptions) || {};
  if (![1, 9, 11].includes((root as Node | null)?.nodeType as number)) {
    throw new TypeError('[typeset] mount() expects a Document, an Element or a selector string (received ' + describe(root) + ')');
  }
  // Realm-safe: a parent page may mount into a same-origin iframe, whose
  // nodes fail instanceof checks against this window's constructors.
  const doc = (root as Node).nodeType === 9 ? root as Document : (root as Node).ownerDocument!;
  const view = doc.defaultView;
  // Without observers or layout (jsdom, happy-dom, older engines) nothing can
  // be kept correct: mark the scope native and return an inert controller.
  if (!canMaintain(doc)) {
    const scope = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (isElement(root) && root.matches(selector)) scope.unshift(root);
    for (const el of scope) if (!el.closest(excluded)) el.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
    return { ready: Promise.resolve(), refresh() {}, disconnect() {}, stats: { passes: 0, compositions: 0, maxBatchMs: 0, overlappingTargets: 0 } };
  }
  const identity = Symbol('typeset-mount');
  const claimed = new Set<HTMLElement>();
  const blocked = new Map<HTMLElement, () => void>();
  const owned = new Set<HTMLElement>();
  const pending = new Map<HTMLElement, number>();
  const nearby = new Set<HTMLElement>();
  // Owned blocks last seen without boxes. Their compositions are kept.
  const hidden = new Set<HTMLElement>();
  // Owned blocks whose width is changing. They are recomposed once, after the
  // size has held for RESIZE_SETTLE_MS; meanwhile any that would wrap twice
  // show their native wrapping ([data-ts-stale]).
  const resizing = new Set<HTMLElement>();
  // Offscreen blocks a resize left for later: composed when they come within a viewport.
  const deferred = new Set<HTMLElement>();
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let guardFrame = 0;
  // Blocks the ResizeObserver saw shown again, guarded in the next frame.
  const shownNow = new Set<HTMLElement>();
  let shownFrame = 0;
  let windowWidth = view?.innerWidth ?? 0;
  // Whether a composition wrote, and whether anything outside this controller
  // that can move a line (an observed mutation other than a style change that
  // only moves or fades a box, a window resize, a font, stylesheet, metric,
  // visibility or translation signal, refresh()) happened, since the ResizeObserver last
  // delivered: widths that changed with only the former are our own
  // compositions' (see keeps).
  let composedSince = false, triggeredSince = false;
  let stopped = false;
  let fontsReady = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: number | undefined;
  const stats = { passes: 0, compositions: 0, maxBatchMs: 0, get overlappingTargets() { return blocked.size; } };
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
  const within = (el: Node) => el === root || root.contains(el);
  const eligible = (el: HTMLElement) => within(el) && el.matches(selector) && !el.closest(excluded) && !liveText(el);
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
  const select = (scope: ParentNode = root) => {
    if (isElement(root) && (scope as Node).contains(root as Node)) scope = root;
    const elements = Array.from(scope.querySelectorAll<HTMLElement>(selector));
    if (isElement(scope) && scope.matches(selector)) elements.unshift(scope);
    return elements.filter(el => within(el) && !el.closest(excluded) && !el.closest('[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line') && !liveText(el));
  };
  // Within a viewport height of the window, or of the scroll container a
  // block scrolls in (see nearObserver).
  const viewport = nearObserver(doc, entries => {
    let near = false;
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) nearby.add(el); else nearby.delete(el);
      if (deferred.has(el)) {
        // Deferred work is watched until the block comes within a viewport.
        if (!entry.isIntersecting) continue;
        deferred.delete(el);
        enqueue(el, KEY, true);
      }
      // One viewport snapshot per queued job. Watching thousands of finished
      // elements through every reflow costs more than the scheduling saves.
      viewport?.unobserve(el);
      if (entry.isIntersecting && pending.has(el)) near = true;
    }
    // Visible work waits for no idle period.
    if (near) schedule();
  });
  /** Queue a job. New or changed text takes one intersection snapshot to
   * learn whether it is near the screen; rechecks come from callers that
   * already read layout, and say so with `near`. */
  const enqueue = (el: HTMLElement, job = CONTENT, near = false) => {
    if (!claim(el)) return;
    const queued = pending.get(el);
    if (near) nearby.add(el);
    else if (queued === undefined && job & CONTENT && !nearby.has(el)) viewport?.observe(el);
    if (job & CONTENT) deferred.delete(el);
    pending.set(el, (queued || 0) | job);
  };
  /** A recheck: near the screen means the next task, elsewhere idle time. */
  const recheck = (el: HTMLElement, job: number) => enqueue(el, job, onScreen(el));
  /** Shown again: within a viewport of the screen, check it in the next task;
   * further away, wait until it comes near, as offscreen resize work does. */
  const revealed = (el: HTMLElement, job: number) => {
    hidden.delete(el);
    const box = el.getBoundingClientRect(), height = view?.innerHeight ?? 0;
    if (!viewport || (box.bottom > -height && box.top < 2 * height)) enqueue(el, job, true);
    else { deferred.add(el); viewport.observe(el); }
  };
  /** Owned text declined under each running animation, rechecked when it
   * ends. One that never ends (infinite iterations: a pulse, a breathing
   * circle) is not waited on: its set would hold every block replaced or
   * unmounted under it for as long as it runs. */
  const animating = new WeakMap<Animation, Set<HTMLElement>>();
  const awaitTransforms = (el: HTMLElement) => {
    for (const animation of doc.getAnimations?.() ?? []) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!target || animation.playState === 'finished' || !(target === el || target.contains(el))) continue;
      if (animation.effect?.getComputedTiming().endTime === Infinity) continue;
      let waiting = animating.get(animation);
      if (!waiting) {
        const set = waiting = new Set();
        animating.set(animation, set);
        const ended = () => {
          animating.delete(animation);
          if (stopped) return;
          for (const block of set) if (owned.has(block)) recheck(block, KEY);
          schedule();
        };
        animation.finished.then(ended, ended);
      }
      waiting.add(el);
    }
  };
  /** Queue matching elements this controller does not own yet. */
  const discover = (scope: ParentNode = root) => {
    for (const el of select(scope)) if (!owned.has(el)) enqueue(el);
  };
  /** Owned elements inside (or equal to) a mutated node. */
  const ownedWithin = (node: Node) => {
    const found: HTMLElement[] = [];
    for (const el of owned) if (node === el || node.contains(el)) found.push(el);
    return found;
  };
  const drop = (el: HTMLElement) => {
    owned.delete(el); pending.delete(el); nearby.delete(el); hidden.delete(el); deferred.delete(el); viewport?.unobserve(el); unwatch(el); release(el);
  };
  const onScreen = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    return box.bottom > 0 && box.top < (view?.innerHeight ?? 0) && box.right > 0 && box.left < (view?.innerWidth ?? 0);
  };
  /** Compose now, before this frame paints: for text an attribute change just
   * revealed. Called from the MutationObserver callback, never from a
   * ResizeObserver callback, where a size change would report a loop error. */
  const composeNow = (elements: HTMLElement[]) => {
    const start = performance.now(), later: HTMLElement[] = [];
    observer.disconnect();
    for (const el of elements) {
      // A reveal is often a click: keep the frame short. The rest show
      // native wrapping (or their retained composition) and compose next.
      if (performance.now() - start > REVEAL_BUDGET_MS) { later.push(el); continue; }
      pending.delete(el); process(el, KEY);
    }
    guard(later);
    for (const el of later) enqueue(el, KEY, true);
    observe();
  };
  /** Before a frame's layout only (a mutation callback, the window's resize
   * event, an animation frame): blocks now narrower than their widest composed
   * line would paint alternating long and short lines, so they show native
   * wrapping until they are recomposed. All reads come before any write. */
  const guard = (elements: Iterable<HTMLElement>) => {
    if (printing(doc)) return;
    ensureLifecycleStyles(doc);
    const stale: HTMLElement[] = [];
    for (const el of elements) {
      const widest = states.get(el)?.widest;
      if (!widest || el.hasAttribute('data-ts-stale')) continue;
      const width = boxOf(el).w;
      if (width > 0 && width < widest - .01) stale.push(el);
    }
    for (const el of stale) { lifecycleStylesFor(el); el.setAttribute('data-ts-stale', ''); }
  };
  /** The size has held: recompose what is on or near the screen now, and
   * leave offscreen blocks until they come near. A stale one is released to
   * native in idle time meanwhile: with its breaks hidden, the word spaces
   * beside them drop out of Chromium's accessibility tree and WebKit joins
   * words at its markers, so it keeps no engine markup while it waits. */
  const settle = () => {
    settleTimer = undefined;
    if (stopped) return;
    const height = view?.innerHeight ?? 0;
    for (const el of resizing) {
      if (!owned.has(el)) continue;
      const box = el.getBoundingClientRect();
      if (!viewport || (box.bottom > -height && box.top < 2 * height)) enqueue(el, KEY, true);
      else { deferred.add(el); viewport.observe(el); if (el.hasAttribute('data-ts-stale')) enqueue(el, RELEASE); }
    }
    resizing.clear();
    schedule();
  };
  /** Release the markup of stale text still waiting to be recomposed: far
   * offscreen, or hidden (a skipped content-visibility:auto section is in the
   * accessibility tree). Its outcome stays; it is composed when it is near or
   * shown, as before. */
  const releaseWaiting = (el: HTMLElement) => {
    const state = states.get(el);
    if (state?.signature && el.hasAttribute('data-ts-stale') && !resizing.has(el) && (deferred.has(el) || hidden.has(el))) releaseOutput(el, state, new Set());
  };
  /** The size is changing: settle RESIZE_SETTLE_MS after the last change.
   * Once per batch of resizeStarted() calls, not once per block (a drag
   * over 1,000 blocks set and cleared 1,000 timers in every frame). */
  const settleLater = () => {
    if (settleTimer !== undefined) clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, RESIZE_SETTLE_MS);
  };
  /** A block's width is changing: recompose once it settles, not every
   * frame. Callers then call settleLater() once. */
  const resizeStarted = (el: HTMLElement) => {
    resizing.add(el);
    if (deferred.delete(el)) viewport?.unobserve(el);
    // Widths the observers cannot see change ahead of layout (a stylesheet
    // rule, a sibling outside the root): check them before each frame.
    if (!guardFrame && view) guardFrame = view.requestAnimationFrame(function frame() {
      guardFrame = 0;
      if (stopped || !resizing.size) return;
      guard(resizing);
      guardFrame = view.requestAnimationFrame(frame);
    });
  };
  /** Owned blocks whose content width differs from the last one observed.
   * A block last seen hidden (width 0) is being revealed, not resized. */
  const widthChanged = (elements: Iterable<HTMLElement>) => {
    const changed: HTMLElement[] = [];
    for (const el of elements) {
      const last = sizes.get(el), width = boxOf(el).w;
      if (last?.w && width && Math.abs(last.w - width) > .01) changed.push(el);
    }
    return changed;
  };
  /** Work near the viewport runs in the next task; idle callbacks are only for
   * offscreen work, since a busy page may leave no idle time at all. */
  const schedule = () => {
    if (stopped || !fontsReady || !pending.size) return;
    let near = false;
    for (const el of nearby) if (pending.has(el)) { near = true; break; }
    if (near) {
      if (timer !== undefined) return;
      if (idle !== undefined) { cancelIdleCallback(idle); idle = undefined; }
      timer = setTimeout(() => flush(), 0);
      return;
    }
    if (timer !== undefined || idle !== undefined) return;
    if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(flush, { timeout: 200 });
    else timer = setTimeout(() => flush(), 16);
  };
  /** Class, style and visibility attributes restyle a subtree. Owned text in it
   * gets a layout-key recheck instead of a recomposition: most changes (a menu
   * class, a transform, a scroll-linked variable) leave every line unchanged. */
  const attributesChanged = (target: HTMLElement, newMatches: boolean) => {
    const affected = ownedWithin(target);
    // A width this change sets (a sidebar drag, a container animation):
    // guard the frame about to paint, and recompose once it settles.
    const resized = fontsReady && affected.length ? widthChanged(affected) : [];
    if (resized.length) { guard(resized); for (const el of resized) resizeStarted(el); settleLater(); }
    // A tab, dialog or card this change just showed: on-screen text that could
    // not be composed while hidden, or was hidden at another width, composes
    // before the reveal paints. A retained composition needs nothing.
    const shown: HTMLElement[] = [];
    const revealing = fontsReady && hidden.size > 0 && !printing(doc);
    for (const el of affected) {
      if (resizing.has(el)) continue;
      if (revealing && hidden.has(el) && rendered(el)) { if (onScreen(el)) shown.push(el); else revealed(el, KEY); }
      else recheck(el, KEY);
    }
    if (shown.length) composeNow(shown);
    // An attribute on an author element inside owned text is new markup.
    for (let el = target.parentElement; el && within(el); el = el.parentElement) if (owned.has(el)) enqueue(el, CONTENT);
    // Only an attribute other than style can make new elements match.
    if (newMatches) discover(target);
  };
  /** An observed mutation that can move a line: any but a style change that
   * only moves or fades a box. */
  const outside = (record: MutationRecord) => !(record.type === 'attributes' && record.attributeName === 'style'
    && movedOnly(record.oldValue, (record.target as Element).getAttribute('style')));
  const mutated = (records: MutationRecord[]) => {
    const restyled = new Set<HTMLElement>(), matching = new Set<HTMLElement>();
    const stale = new Set<HTMLElement>(), written = new Set<Node>();
    // Owned text that may now be in a live region: moved into one (a toast),
    // given one, or under a region that turned live.
    const live = new Set<HTMLElement>();
    for (const record of records) {
      const target = isElement(record.target) ? record.target : record.target.parentElement;
      if (!target) continue;
      if (record.type === 'attributes' && record.attributeName?.startsWith('_mst')) { triggeredSince = true; markTranslated(doc); continue; }
      if (record.type === 'childList' && !translationActive(doc) && [...record.addedNodes].some(node => node.nodeName === 'FONT')) {
        for (let el: HTMLElement | null = target; el && within(el); el = el.parentElement) if (owned.has(el)) { markTranslated(doc); break; }
      }
      // Restyles (including a region turning live, or an exclusion) are
      // handled per node in attributesChanged, whose recheck releases what is
      // no longer eligible.
      if (record.type === 'attributes') {
        if (!outside(record)) continue;
        triggeredSince = true;
        restyled.add(target);
        if (record.attributeName !== 'style') matching.add(target);
        if (record.attributeName === 'aria-live' || record.attributeName === 'role') for (const el of ownedWithin(target)) live.add(el);
        continue;
      }
      triggeredSince = true;
      for (let el: HTMLElement | null = target; el && within(el); el = el.parentElement) {
        if (!owned.has(el)) continue;
        enqueue(el, CONTENT);
        if (record.type === 'childList') live.add(el);
        const state = states.get(el);
        if (state?.heads.size && staleSplit(el, state, record, written)) stale.add(el);
      }
      if (record.type === 'childList') {
        for (const node of record.addedNodes) if (isElement(node)) {
          discover(node);
          if (inLiveRegion(node)) for (const el of ownedWithin(node)) live.add(el);
        }
        if (!owned.has(target) && target.matches(selector) && !target.closest(excluded)) discover(target);
        for (const node of record.removedNodes) {
          if (!isElement(node) || within(node)) continue;
          // Walk the removed subtree once, not every claimed element per node.
          if (claimed.has(node)) drop(node);
          if (node.firstElementChild) for (const el of node.getElementsByTagName('*')) if (claimed.has(el as HTMLElement)) drop(el as HTMLElement);
          if (blocked.size) for (const el of blocked.keys()) if (node.contains(el) && !within(el)) stopWaiting(el);
        }
      }
    }
    const released = [...live].filter(el => owned.has(el) && liveText(el));
    if (stale.size || released.length) {
      // Still inside the mutation's microtask checkpoint, so no frame shows
      // the stale tails. Our own writes here are not observed.
      observer.disconnect();
      for (const el of stale) { const state = states.get(el); if (state) releaseOutput(el, state, written); }
      // Text now in a live region is released with the change that put it
      // there: one update for assistive technology, not a second one (an
      // announcement) on the next pass.
      for (const el of released) { restore(el); drop(el); }
      observe();
    }
    // Each restyled node once per delivery, however many records it produced.
    for (const target of restyled) attributesChanged(target, matching.has(target));
    schedule();
  };
  // Records the ResizeObserver took before the MutationObserver delivered
  // them (see resize).
  let late: MutationRecord[] = [];
  let lateTimer: ReturnType<typeof setTimeout> | undefined;
  /** Handle records in the order they were queued: those the ResizeObserver
   * took, then those delivered, then any still queued, which the handler's
   * own disconnect() would otherwise discard. */
  const drain = (records: MutationRecord[] = []) => {
    if (lateTimer !== undefined) { clearTimeout(lateTimer); lateTimer = undefined; }
    const all = late.concat(records, observer.takeRecords());
    late = [];
    if (all.length) mutated(all);
  };
  const observer = new MutationObserver(records => drain(records));
  // Content-box sizes as last seen by the ResizeObserver or left by our writes.
  const sizes = new WeakMap<Element, { w: number; h: number }>();
  // Layout sizes, like the ResizeObserver's: a transform (a scale animation)
  // changes a box's rectangle but not the width its lines were composed for.
  const boxOf = (el: Element) => {
    const cs = getComputedStyle(el);
    let w = parseFloat(cs.width), h = parseFloat(cs.height);
    if (Number.isNaN(w) || Number.isNaN(h)) {
      const rect = el.getBoundingClientRect();
      w = rect.width - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0') - parseFloat(cs.borderLeftWidth || '0') - parseFloat(cs.borderRightWidth || '0');
      h = rect.height - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0') - parseFloat(cs.borderTopWidth || '0') - parseFloat(cs.borderBottomWidth || '0');
    } else if (cs.boxSizing === 'border-box') {
      w -= parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0') + parseFloat(cs.borderLeftWidth || '0') + parseFloat(cs.borderRightWidth || '0');
      h -= parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0') + parseFloat(cs.borderTopWidth || '0') + parseFloat(cs.borderBottomWidth || '0');
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  };
  /** A width changed by this controller's own compositions alone: a box sized
   * by its content (an auto grid track, an auto table column, a shrink-to-fit
   * flex item, w-fit, inline-block, a float) narrowed to a block's composed
   * lines, or gave a neighbour's room to this block. A composed block whose
   * lines still fit keeps them, and is recorded as composed for this layout,
   * so a later key check does not recompose it either. Counted as a resize,
   * each composition moved its neighbours and they it: two auto grid tracks
   * traded 3 px every 110 ms without end, and the first block's height flipped
   * between six and eight lines. Reads only (see the ResizeObserver). */
  const keeps = (el: HTMLElement) => {
    const state = states.get(el);
    if (!state?.widest || !state.signature || !state.result.outcome.startsWith('composed') || el.hasAttribute('data-ts-stale')) return false;
    if (state.widest > boxOf(el).w + .5) return false;
    state.layout = layoutKey(el);
    return true;
  };
  const watched = new Map<Element, Set<HTMLElement>>();
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
    // Reads only. A write here that changed any observed size would make every
    // engine report "ResizeObserver loop completed with undelivered notifications".
    let widened = false;
    // Only our compositions, as far as the signals delivered so far tell. A
    // mutation this layout already shows may still have its record queued:
    // WebKit delivers the records of a mutation an about:blank page makes in
    // its same-origin iframe after that frame's ResizeObserver callbacks.
    // Counted as our own, an author's width change kept lines composed for
    // the old width. Queued records, this controller's and the lifecycle
    // hub's (in mount(body) only the hub observes <head>), are outside
    // changes; they are handled in the next task, since nothing here may
    // write.
    if (composedSince && !triggeredSince) {
      const queued = observer.takeRecords();
      if (queued.length) {
        if (queued.some(outside)) triggeredSince = true;
        late = late.concat(queued);
        if (lateTimer === undefined) lateTimer = setTimeout(() => { lateTimer = undefined; if (!stopped) drain(); }, 0);
      }
      if (!triggeredSince && signalQueued(doc)) triggeredSince = true;
    }
    const own = composedSince && !triggeredSince;
    composedSince = triggeredSince = false;
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const previous = sizes.get(entry.target);
      sizes.set(entry.target, { w: width, h: height });
      if (!previous) continue;
      if (!width) {
        // Hidden. Keep the composition: shown again at this width, it paints composed.
        if (owned.has(entry.target as HTMLElement)) hidden.add(entry.target as HTMLElement);
        continue;
      }
      if (Math.abs(previous.w - width) > .01) {
        for (const el of watched.get(entry.target) || []) {
          // Revealed: a retained composition is already painting; verify it.
          // Shown by CSS alone or an attribute this controller does not watch
          // (aria-expanded, :checked, a media query) at another width, it may
          // paint alternating long and short lines this frame; from the next
          // it shows native wrapping until it is recomposed.
          if (!previous.w || hidden.has(el)) { revealed(el, VERIFY); shownNow.add(el); }
          else if (entry.target === el || (states.get(el)?.appliedStyles.inlineSize ?? '') !== (states.get(el)?.styles.inlineSize ?? '')) {
            if (own && keeps(el)) continue;
            resizeStarted(el); widened = true;
          }
        }
      } else if (Math.abs(previous.h - height) > .5 && owned.has(entry.target as HTMLElement)) {
        // Same width, new height: a font, a text-spacing override, a browser
        // font-size setting or text-only zoom can add native wraps to composed
        // lines without any mutation. Verify the rendered lines.
        recheck(entry.target as HTMLElement, VERIFY);
      }
    }
    if (widened) settleLater();
    if (shownNow.size && !shownFrame && view) shownFrame = view.requestAnimationFrame(() => {
      shownFrame = 0;
      if (!stopped) guard(shownNow);
      shownNow.clear();
    });
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
        sizes.set(target, boxOf(target)); resize?.observe(target);
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
    observer.observe(root, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'lang', 'hidden', 'open', 'data-no-typeset', 'data-typeset', 'data-typeset-mode', 'aria-live', 'role', '_msttexthash', '_msthash'] });
    if (isElement(root)) for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style', 'lang', 'hidden', 'open', 'aria-live', 'role'] });
    }
  }
  /** One job. Rechecks are a computed-style read; only a changed key, changed
   * content or a composition that no longer renders as composed is recomposed. */
  const process = (el: HTMLElement, job: number) => {
    if (!within(el)) { drop(el); return; }
    if (!eligible(el)) { restore(el); drop(el); return; }
    if (owned.has(el) && parents.get(el) !== el.parentElement) { unwatch(el); watch(el); }
    const state = states.get(el);
    if (!(job & CONTENT) && state && owned.has(el) && !rendered(el)) { hidden.add(el); return; }
    hidden.delete(el);
    const key = !(job & CONTENT) && state?.signature && owned.has(el) ? layoutKey(el) : '';
    if (key && state && key === state.layout) {
      // Back at the width it was composed for: show the composition again.
      if (el.hasAttribute('data-ts-stale')) { el.removeAttribute('data-ts-stale'); job |= VERIFY; }
      // Nothing that decides layout changed. The rendered lines are the safety
      // net for anything the key cannot see.
      if (!(job & VERIFY) || layoutIntact(el)) return;
      state.signature = '';
    } else if (key && state && state.result.outcome.startsWith('composed') && !el.hasAttribute('data-ts-stale') && transformOnly(key, state.layout)) {
      // Only an ancestor transform changed (a drawer scaling the page behind
      // it, a card's hover scale): the lines stay where they were composed,
      // and recomposing under the transform would decline and rewrap them.
      state.layout = key;
      return;
    }
    const result = typeset(el, options);
    if (result.changed) { stats.compositions++; composedSince = true; }
    if (result.outcome === 'unmeasurable') hidden.add(el);
    // Declined while a transform animates (a dialog's @starting-style entry,
    // a scale-in, a drawer closing): check again once it ends, since neither
    // a CSS transition nor a Web Animation ends with a mutation.
    if (result.outcome === 'native:transformed') awaitTransforms(el);
    if (!owned.has(el)) { owned.add(el); watch(el); }
    // Our own write may change the block's height; that is not a reason to verify.
    else if (result.changed) { const box = boxOf(el); sizes.set(el, { w: sizes.get(el)?.w ?? box.w, h: box.h }); }
  };
  function flush(deadline?: IdleDeadline) {
    timer = undefined;
    idle = undefined;
    // Print shows native wrapping; the work waits until printing ends.
    if (stopped || printing(doc)) return;
    // Records still queued belong to others: handle them before disconnect()
    // discards them, as the adapter registry's writing() does.
    drain();
    observer.disconnect();
    ensureLifecycleStyles(doc);
    const start = performance.now();
    stats.passes++;
    // While fonts load, text may be about to change metrics again: recheck
    // what is near the screen now and leave the rest to the fonts' arrival,
    // which rechecks everything.
    const fontsLoading = doc.fonts?.status === 'loading';
    if (fontsLoading) armFonts(doc);
    function* work() {
      for (const el of nearby) if (pending.has(el)) yield el;
      yield* pending.keys();
    }
    for (const el of work()) {
      const job = pending.get(el);
      if (job === undefined) continue;
      pending.delete(el);
      if (job & RELEASE) releaseWaiting(el);
      // Superseded: a width still changing is recomposed once it settles, and
      // offscreen text a resize deferred is recomposed when it comes near.
      if ((resizing.has(el) || deferred.has(el) || (fontsLoading && !nearby.has(el))) && !(job & CONTENT)) continue;
      if (job & (CONTENT | KEY | VERIFY)) {
        nearby.delete(el); viewport?.unobserve(el);
        process(el, job);
      }
      // An idle callback that fired on its timeout reports no time remaining;
      // it still gets the 8 ms budget, or a busy page composes one block per 200 ms.
      if (performance.now() - start >= 8 || (deadline && !deadline.didTimeout && deadline.timeRemaining() <= 1)) break;
    }
    stats.maxBatchMs = Math.max(stats.maxBatchMs, performance.now() - start);
    observe();
    // A composition can start a font load (a face first used by this text).
    armFonts(doc);
    if (pending.size) schedule();
    else resolveReady();
  }
  const refresh = () => {
    if (stopped) return;
    triggeredSince = true;
    discover();
    for (const el of owned) recheck(el, KEY | VERIFY);
    schedule();
  };
  // The window's resize event runs before the frame's layout: guard what is
  // on screen, and let the settle recompose what changed width. A viewport
  // resize can also change vw/vh sizes without resizing a box; those blocks
  // get a key recheck, which composes nothing unless it changed.
  const resized = () => {
    triggeredSince = true;
    if (stopped || !fontsReady) return;
    // Hidden text is likely to be shown at another width once the window's
    // width changes: it shows native wrapping until then. Written now, inside
    // a hidden subtree, this moves nothing; at the reveal it would be a
    // ResizeObserver loop error, and a reveal by CSS alone would paint
    // alternating long and short lines. A height-only resize (a mobile URL
    // bar) leaves it composed.
    const width = view?.innerWidth ?? 0;
    if (width !== windowWidth) {
      windowWidth = width;
      for (const el of hidden) if (states.get(el)?.widest && !rendered(el)) { lifecycleStylesFor(el); el.setAttribute('data-ts-stale', ''); enqueue(el, RELEASE); }
    }
    const visible: HTMLElement[] = [];
    for (const el of owned) if (states.get(el)?.widest && onScreen(el)) visible.push(el);
    const changed = widthChanged(visible);
    guard(changed);
    for (const el of changed) resizeStarted(el);
    if (changed.length) settleLater();
    for (const el of owned) if (!resizing.has(el)) enqueue(el, KEY, visible.includes(el));
    schedule();
  };
  const fontsChanged = () => {
    triggeredSince = true;
    if (stopped) return;
    discover();
    for (const el of owned) recheck(el, KEY | VERIFY);
    schedule();
  };
  // Owned text a transition or animation ended on, inside or around. The key
  // holds the final computed metrics; a composition made mid-transition holds
  // intermediate ones, so a recheck is enough (an animation on <body> must not
  // measure every block).
  const metricsChanged = (target: Element) => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of ownedWithin(target)) recheck(el, KEY);
    for (let el = target.parentElement; el && within(el); el = el.parentElement) if (owned.has(el)) recheck(el, KEY);
    schedule();
  };
  const stylesChanged = () => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of owned) recheck(el, KEY);
    schedule();
  };
  // Translation started: step aside at once, before the translator fills the
  // Text nodes it holds. Ended ("show original"): compose the current DOM.
  const translationChanged = (active: boolean) => {
    triggeredSince = true;
    if (stopped) return;
    if (active) {
      observer.disconnect();
      for (const el of owned) typeset(el, options);
      observe();
    } else for (const el of owned) enqueue(el, CONTENT);
    schedule();
  };
  // A content-visibility:auto section scrolled into range: its text can be measured now.
  const visibilityChanged = (target: Element) => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of ownedWithin(target)) recheck(el, KEY);
    schedule();
  };
  (doc.fonts?.ready ?? Promise.resolve()).then(() => {
    if (stopped) { resolveReady(); return; }
    fontsReady = true;
    discover();
    schedule();
    if (!pending.size) resolveReady();
  });
  observe();
  const unsubscribe = subscribe(doc, { fonts: fontsChanged, metrics: metricsChanged, styles: stylesChanged, visibility: visibilityChanged, resize: resized, translation: translationChanged });
  return {
    ready, refresh, stats,
    disconnect(restoreContent = true) {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
      observer.disconnect(); resize?.disconnect(); viewport?.disconnect();
      unsubscribe();
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      if (lateTimer !== undefined) clearTimeout(lateTimer);
      late = [];
      if (guardFrame) view?.cancelAnimationFrame(guardFrame);
      if (shownFrame) view?.cancelAnimationFrame(shownFrame);
      if (restoreContent) for (const el of owned) restore(el);
      owned.clear(); pending.clear(); nearby.clear(); hidden.clear(); resizing.clear(); deferred.clear(); shownNow.clear();
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
