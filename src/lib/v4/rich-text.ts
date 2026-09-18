import { composeParagraph, tokenize } from './typeset';
import type { ParagraphSearchEvidence } from './typeset';
import { finishedContour } from './finished-contour';
import { composeTitle } from './title-layout';
import { measureLayout } from './layout-metrics';
import type { LayoutMetrics } from './layout-metrics';
import type { Options } from './typeset.next';
import { analyzeBreaks, languageOf, languageWeakEnding, tokenForUnit } from './break-opportunities';
import { englishPhraseGroups, phraseBreakCosts, retainSentenceLayout, strandedOpener } from './phrase-boundaries';
import { retainParagraphRhythm } from './paragraph-rhythm';
import { opticalMarkerStyle } from './optical-hanging';
import type { OpticalHang } from './optical-hanging';
import { spacingMarkerStyle } from './spacing-finish';
import { inlineBoxInsets } from './inline-box';
import { preservesAdvances } from './geometry';
import type { SpaceAdjustment } from './spacing-finish';

export const BREAK_ATTRIBUTE = 'data-ts-break';
const inlineTags = new Set(['A', 'B', 'STRONG', 'EM', 'I', 'SPAN', 'SMALL', 'U', 'S', 'DEL', 'MARK', 'ABBR', 'CITE', 'CODE']);
const wordPattern = /[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/gu;
interface TextRun { node: Text; start: number; end: number }
interface Point { node: Node; offset: number }
export interface RichConstraint {
  kind: 'unbreakable-run' | 'line-budget' | 'search';
  availableWidth: number;
  requiredWidth: number;
  minimumLines: number | null;
  maxLines: number | null;
}
export interface RichPlan {
  source: string;
  breaks: number[];
  widths: number[];
  before: LayoutMetrics;
  outcome: string;
  styleSignature: string;
  constraint?: RichConstraint;
  search?: ParagraphSearchEvidence[];
}

/** Verify every chosen source span and width, not just the number of lines. */
export function richLayoutVerified(plan: RichPlan, after: LayoutMetrics): boolean {
  const starts = [plan.source.search(/\S/u), ...plan.breaks];
  const ends = [...plan.breaks.map(at => plan.source.slice(0, at).trimEnd().length), plan.source.trimEnd().length];
  return after.lines.length === plan.widths.length && after.overflow <= .5
    && after.lines.every((line, index) => line.sourceStart === starts[index] && line.sourceEnd === ends[index]
      && line.width <= after.width + .5);
}

function textRuns(element: HTMLElement): TextRun[] {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs: TextRun[] = [];
  let node: Node | null;
  let offset = 0;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length || 0;
    runs.push({ node: node as Text, start: offset, end: offset + length });
    offset += length;
  }
  return runs;
}

function pointAt(runs: TextRun[], offset: number, end = false): Point | null {
  const run = runs.find(r => end ? r.end >= offset && r.start < offset : r.start <= offset && r.end > offset) || runs.at(-1);
  return run ? { node: run.node, offset: Math.max(0, Math.min(run.end - run.start, offset - run.start)) } : null;
}

/** Preserve forward/backward selections, including selections crossing the host. */
export function selectionBookmark(element: HTMLElement): () => void {
  const selection = element.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode || (!element.contains(selection.anchorNode) && !element.contains(selection.focusNode))) return () => {};
  const capture = (node: Node, offset: number): Point | number => {
    if (!element.contains(node)) return { node, offset };
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.setEnd(node, offset);
    return range.toString().length;
  };
  const anchor = capture(selection.anchorNode, selection.anchorOffset);
  const focus = capture(selection.focusNode, selection.focusOffset);
  return () => {
    const runs = textRuns(element);
    const a = typeof anchor === 'number' ? pointAt(runs, anchor) : anchor;
    const f = typeof focus === 'number' ? pointAt(runs, focus) : focus;
    if (a?.node.isConnected && f?.node.isConnected) selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset);
  };
}

/** Temporarily modify only named properties and restore their priorities exactly. */
function override(element: HTMLElement, properties: Record<string, string>): () => void {
  const saved = element.getAttribute('style');
  for (const [key, value] of Object.entries(properties)) element.style.setProperty(key, value, 'important');
  return () => {
    // Resolve the live Attr first so lazy CSSOM serialization is synchronized.
    if (saved === null) {
      const attribute = element.getAttributeNode('style');
      if (attribute) element.removeAttributeNode(attribute);
    }
    else element.setAttribute('style', saved);
  };
}

function unsupported(element: HTMLElement): string | null {
  for (const el of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
    if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
    if (el !== element && !inlineTags.has(el.tagName)) return 'native:rich-element';
    if (el.matches('[hidden], [aria-hidden="true"], [contenteditable]:not([contenteditable="false"]), [data-no-typeset]')) return 'native:rich-excluded';
    const cs = getComputedStyle(el);
    if (cs.direction !== 'ltr' || cs.writingMode !== 'horizontal-tb' || (el !== element && cs.unicodeBidi !== 'normal') || cs.visibility !== 'visible') return 'native:rich-direction';
    if ((cs.whiteSpace !== 'normal' && !(el !== element && cs.whiteSpace === 'nowrap'))
      || !preservesAdvances(cs) || cs.textIndent !== '0px') return 'native:rich-whitespace';
    if (el !== element && (cs.display !== 'inline' || cs.position !== 'static' || cs.verticalAlign !== 'baseline')) return 'native:rich-layout';
    if (el !== element && !inlineBoxInsets(cs).supported) return 'native:rich-box';
    for (const pseudo of ['::before', '::after']) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== 'none' && content !== 'normal' && content !== '""') return 'native:rich-decorated';
    }
  }
  return null;
}

/** Read the real styled DOM. No clone can reproduce contextual selectors reliably. */
export function planRichText(element: HTMLElement, options: Options = {}, nativeLayout?: RichPlan['before']): RichPlan {
  const source = element.textContent || '';
  const markers = Array.from(element.querySelectorAll<HTMLElement>('[' + BREAK_ATTRIBUTE + ']'));
  const restoreMarkers = markers.map(marker => override(marker, { display: 'none' }));
  const tracking = Array.from(element.querySelectorAll<HTMLElement>('[data-ts-track]'));
  restoreMarkers.push(...tracking.map(wrapper => override(wrapper, { 'letter-spacing': 'inherit', 'word-spacing': 'inherit' })));
  try {
    const before = !markers.length && nativeLayout ? nativeLayout : measureLayout(element);
    const search: ParagraphSearchEvidence[] = [];
    const result = (outcome: string, breaks: number[] = [], widths: number[] = [], constraint?: RichConstraint): RichPlan => ({ source, before, outcome, breaks, widths, ...(constraint && { constraint }),
      styleSignature: outcome === 'composed:rich' ? richFingerprint(element) : '', ...(search.length && { search }) });
    const lang = element.closest('[lang]')?.getAttribute('lang');
    if (source.length > 12000) return result('native:budget');
    const unicode = options.lineBreaks === 'unicode';
    const analysis = unicode ? analyzeBreaks(source, { language: lang, hyphens: getComputedStyle(element).hyphens }) : null;
    if (analysis && analysis.outcome !== 'supported') return result(analysis.outcome);
    if (!unicode && ((lang && !/^en(?:-|$)/i.test(lang)) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return result('native:language');
    if (unicode) for (const el of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
      if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
      if (languageOf(el.closest('[lang]')?.getAttribute('lang')) !== analysis!.language) return result('native:mixed-language');
      const cs = getComputedStyle(el);
      if (cs.hyphens === 'auto') return result('native:auto-hyphens');
      // break-word adds emergency opportunities only. Normal opportunities
      // remain valid; overlong runs still retain native layout below.
      if (cs.wordBreak !== 'normal' || !['auto', 'normal'].includes(cs.lineBreak) || !['normal', 'break-word'].includes(cs.overflowWrap)) return result('native:break-policy');
    }
    if (getComputedStyle(element).display === 'inline') return result('native:inline');
    const reason = unsupported(element);
    if (reason) return result(reason);
    if (!before.width || !before.lines.length) return result('unmeasurable');
    if (before.lines.length === 1 && before.overflow <= .5) return result('native:fits');
    if (options.mode === 'ui') return result('native:ui');
    const runs = textRuns(element);
    const words = analysis?.units || Array.from(source.matchAll(wordPattern)).flatMap(word => {
      // Authored, breakable hyphens are opportunities, not new characters.
      // Keep NBSP-bound groups and nonbreaking hyphens indivisible.
      if (/[\u00a0\u202f]/u.test(word[0])) return [{ text: word[0], index: word.index!, hyphen: false }];
      const parts: { text: string; index: number; hyphen: boolean }[] = [];
      let cursor = 0;
      for (const match of word[0].matchAll(/(?<=\p{L})[-\u2010\u2013\u2014](?=\p{L})/gu)) {
        const end = match.index! + 1;
        const point = pointAt(runs, word.index! + end - 1);
        if (/[-\u2010]/u.test(match[0]) && point?.node.parentElement && getComputedStyle(point.node.parentElement).hyphens === 'none') continue;
        parts.push({ text: word[0].slice(cursor, end), index: word.index! + cursor, hyphen: true }); cursor = end;
      }
      parts.push({ text: word[0].slice(cursor), index: word.index! + cursor, hyphen: false });
      return parts;
    });
    if (words.length > 500 || source.length > 12000) return result('native:budget');
    // A nonwrapping inline phrase removes only its own internal opportunities.
    // It must not prevent composition of the surrounding paragraph or links.
    const noWrapRuns: { start: number; end: number }[] = [];
    for (const run of runs) {
      if (getComputedStyle(run.node.parentElement!).whiteSpace !== 'nowrap') continue;
      const previous = noWrapRuns.at(-1);
      if (previous?.end === run.start) previous.end = run.end;
      else noWrapRuns.push({ start: run.start, end: run.end });
    }
    for (let i = words.length - 2; i >= 0; i--) {
      const end = words[i].index + words[i].text.length;
      const next = words[i + 1];
      if (noWrapRuns.some(run => run.start <= end && run.end > next.index)) {
        words[i].text = source.slice(words[i].index, next.index + next.text.length);
        words[i].hyphen = next.hyphen;
        words.splice(i + 1, 1);
      }
    }
    if (unicode) {
      // Respect a descendant's hyphens:none even when the host permits them.
      for (let i = words.length - 2; i >= 0; i--) {
        const point = pointAt(runs, words[i].index + words[i].text.length - 1);
        if (words[i].hyphen && point?.node.parentElement && getComputedStyle(point.node.parentElement).hyphens === 'none') {
          const next = words[i + 1]; words[i].text = source.slice(words[i].index, next.index + next.text.length);
          words[i].hyphen = next.hyphen; words.splice(i + 1, 1);
        }
      }
    }
    const range = element.ownerDocument.createRange();
    const leadingInsets = new Map<number, number>(), trailingInsets = new Map<number, number>();
    for (const el of element.querySelectorAll<HTMLElement>('*')) {
      if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
      const insets = inlineBoxInsets(getComputedStyle(el));
      if (!insets.left && !insets.right) continue;
      const children = runs.filter(run => el.contains(run.node));
      if (!children.length) continue;
      const start = children[0].start, end = children.at(-1)!.end;
      leadingInsets.set(start, (leadingInsets.get(start) || 0) + insets.left);
      trailingInsets.set(end, (trailingInsets.get(end) || 0) + insets.right);
    }
    const restoreWhiteSpace = [element, ...element.querySelectorAll<HTMLElement>('*')].filter(el => !el.hasAttribute(BREAK_ATTRIBUTE))
      .map(el => override(el, { 'white-space': 'nowrap', 'text-wrap': 'nowrap' }));
    let edges: { left: number; right: number }[];
    try {
      // One write phase, then one read phase. The browser shapes each run in
      // its real ancestors, including fonts, axes, tracking and nested emphasis.
      edges = words.map(word => {
        const a = pointAt(runs, word.index);
        const b = pointAt(runs, word.index + word.text.length, true);
        if (!a || !b) throw new Error('Unmapped rich text');
        range.setStart(a.node, a.offset); range.setEnd(b.node, b.offset);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
    } finally { restoreWhiteSpace.reverse().forEach(restore => restore()); }
    const tokens = words.map(word => {
      if (analysis) return tokenForUnit(word, analysis.language);
      const token = tokenize(word.text, () => 0)[0];
      if (word.hyphen) token.protectedCompound = false;
      return token;
    });
    const content = tokens;
    if (content.length !== words.length || !edges.length) return result('native:rich-tokens');
    content.forEach((token, i) => { token.width = edges[i].right - edges[i].left; });
    const nativeSpans = new Map(before.lines.map(line => [line.sourceStart + ':' + line.sourceEnd, line]));
    const measureRange = (start: number, end: number) => {
      const last = words[end - 1];
      const width = edges[end - 1].right - edges[start].left
        + (leadingInsets.get(words[start].index) || 0) + (trailingInsets.get(last.index + last.text.length) || 0);
      if (width <= before.width || width > before.width + .5) return width;
      const witness = nativeSpans.get(words[start].index + ':' + (last.index + last.text.length));
      // Only an identical native line can witness a borderline fit. This is
      // not extra room for arbitrary spans; rendering still verifies the plan.
      return witness && witness.width <= before.width + .5 && Math.abs(witness.width - width) <= .5
        ? Math.min(before.width, witness.width) : width;
    };
    const breakPenalty = (end: number) => words[end - 1].hyphen ? 1600 : 0;
    const title = options.mode === 'title' || options.mode === 'heading' || (!options.mode && /^H[1-6]$/.test(element.tagName));
    const clamp = parseInt(getComputedStyle(element).getPropertyValue('-webkit-line-clamp'), 10);
    const openerRepair = options.density !== 'compact' && (!analysis || analysis.language === 'en')
      && before.lines.slice(0, -1).some(line => strandedOpener(line.text));
    const allowance = !title && (before.lastSingleton || options.density === 'editorial' || openerRepair) ? 1 : 0;
    const maxLines = Math.min(options.maxLines || Infinity, clamp > 0 ? clamp : Infinity, before.lines.length + allowance);
    const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
    const contourWidths = !title && options.contour === 'finished' && ['left', 'start'].includes(getComputedStyle(element).textAlign)
      ? finishedContour(element, words, before.width) : undefined;
    const onSearch = (evidence: ParagraphSearchEvidence) => { search.push(evidence); };
    let lines = title
      ? composeTitle(tokens, before.width, () => 0, { ...options, maxLines, measureRange, breakPenalty,
        ...(analysis && analysis.language !== 'en' && { weakEnding: (word: string) => languageWeakEnding(word, analysis.language) }) })
      : composeParagraph(tokens, before.width, before.width / (fontSize * .5), {
        maxLines, candidateBar: 1, measureRange, breakPenalty, englishLexical: !analysis || analysis.language === 'en', contourWidths, onSearch,
        allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width),
      });
    if (analysis?.language === 'en' && lines) {
      const texts = words.map(word => word.text);
      const groups = englishPhraseGroups(texts, before.width, measureRange);
      const costs = phraseBreakCosts(texts, groups, title);
      const attachmentCost = (composition: NonNullable<typeof lines>) => {
        let end = 0;
        return composition.slice(0, -1).reduce((sum, line) => { end += line.tokens.length; return sum + costs[end]; }, 0);
      };
      const originalCost = attachmentCost(lines);
      if (originalCost > 0) {
        const phrasedPenalty = (end: number) => breakPenalty(end) + costs[end];
        const phrased = title
          ? composeTitle(tokens, before.width, () => 0, { ...options, maxLines, measureRange, breakPenalty: phrasedPenalty })
          : composeParagraph(tokens, before.width, before.width / (fontSize * .5), {
            maxLines, candidateBar: 1, measureRange, breakPenalty: phrasedPenalty, englishLexical: true, contourWidths, onSearch,
            allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width),
          });
        const wordCounts = (composition: NonNullable<typeof lines>) => {
          let end = 0;
          return composition.map(line => {
            const start = end;
            end += line.tokens.length;
            const last = words[end - 1];
            // Break units may be fragments of one hyphenated source word.
            return source.slice(words[start].index, last.index + last.text.length).trim().split(/\s+/u).length;
          });
        };
        if (phrased && attachmentCost(phrased) < originalCost) {
          const originalWords = wordCounts(lines), proposedWords = wordCounts(phrased);
          // A substantial location/name on the last line is a valid title
          // ending when the alternative splits a recognized proper-name group.
          let originalEnd = 0;
          const repairsName = lines.slice(0, -1).some(line => {
            originalEnd += line.tokens.length;
            return groups.some(group => group.kind === 'name' && group.start < originalEnd && group.end > originalEnd);
          });
          const nameTail = repairsName && proposedWords.at(-1) === 1
            && phrased.at(-1)!.width >= before.width * .4;
          const stranded = title && ((proposedWords[0] === 1 && originalWords[0] > 1)
            || (!nameTail && proposedWords.at(-1) === 1 && originalWords.at(-1)! > 1)
            || (!nameTail && proposedWords.filter(n => n === 1).length > originalWords.filter(n => n === 1).length));
          if (!stranded) lines = phrased;
        }
      }
      let end = 0;
      const chosenEnds = lines.map(line => {
        end += line.tokens.length;
        return words[end - 1].index + words[end - 1].text.length;
      });
      if (!title && options.density !== 'editorial' && !options.keep?.length && before.lines.length <= maxLines
        && retainSentenceLayout(source, before, chosenEnds)) return result('native:sentence-aligned');
      if (!title && options.density !== 'editorial' && !options.keep?.length && before.lines.length <= maxLines
        && retainParagraphRhythm(source, before, lines.map(line => line.width))) return result('native:paragraph-rhythm');
    }
    if (!lines) {
      // Diagnose the permitted-break graph, not an imagined ability to shrink
      // type or invent hyphenation. Subpixel discrepancies remain visible.
      const limit = before.width + (title ? .25 : 0);
      const requiredWidth = Math.max(...content.map((_, i) => measureRange(i, i + 1)));
      const minimum = Array<number>(content.length + 1).fill(Infinity);
      minimum[content.length] = 0;
      for (let start = content.length - 1; start >= 0; start--) {
        for (let end = start + 1; end <= content.length; end++) {
          if (measureRange(start, end) <= limit) minimum[start] = Math.min(minimum[start], 1 + minimum[end]);
        }
      }
      return result('native:no-candidate', [], [], {
        kind: requiredWidth > limit ? 'unbreakable-run' : minimum[0] > maxLines ? 'line-budget' : 'search',
        availableWidth: before.width, requiredWidth,
        minimumLines: Number.isFinite(minimum[0]) ? minimum[0] : null,
        maxLines: Number.isFinite(maxLines) ? maxLines : null,
      });
    }
    let index = 0;
    const breaks = lines.slice(0, -1).map(line => {
      index += line.tokens.length;
      return words[index].index;
    });
    return result('composed:rich', breaks, lines.map(line => line.width));
  } finally { restoreMarkers.reverse().forEach(restore => restore()); }
}

interface Split { head: Text; parts: Text[] }
export interface RichOutput { cleanup: () => void; nodes: Node[] }

/** Insert breaks without moving or cloning author elements. Split Text nodes
 * are reversible; their original head object is retained for restoration. */
export function renderRichText(element: HTMLElement, breaks: readonly number[], hangs: readonly OpticalHang[] = [], spaces: readonly SpaceAdjustment[] = []): RichOutput {
  const restoreSelection = selectionBookmark(element);
  const runs = textRuns(element);
  const markers: HTMLElement[] = [];
  const splits = new Map<Text, Split>();
  const insertions = [...breaks.map(offset => ({ offset, px: 0, spacing: false })), ...hangs.map(hang => ({ ...hang, spacing: false })),
    ...spaces.map(space => ({ ...space, spacing: true }))].sort((a, b) => b.offset - a.offset || b.px - a.px);
  for (const { offset, px, spacing } of insertions) {
    const point = pointAt(runs, offset);
    if (!point) continue;
    const head = point.node as Text;
    const marker = element.ownerDocument.createElement(px ? 'span' : 'br');
    marker.setAttribute(BREAK_ATTRIBUTE, '');
    marker.setAttribute('aria-hidden', 'true');
    if (spacing) {
      marker.dataset.tsSpace = String(offset);
      Object.assign(marker.style, spacingMarkerStyle(px));
    } else if (px) {
      marker.dataset.tsHang = String(offset);
      Object.assign(marker.style, opticalMarkerStyle(px));
    } else marker.style.setProperty('display', 'inline', 'important');
    if (point.offset === 0) head.before(marker);
    else {
      const tail = head.splitText(point.offset);
      const split = splits.get(head) || { head, parts: [head] };
      split.parts.splice(1, 0, tail);
      splits.set(head, split);
      tail.before(marker);
    }
    markers.push(marker);
  }
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  return {
    nodes: [element, ...element.querySelectorAll('*'), ...textRuns(element).map(r => r.node)],
    cleanup() {
      const restoreSelection = selectionBookmark(element);
      markers.forEach(marker => marker.remove());
      if (spaces.length) element.querySelectorAll('[data-ts-break][data-ts-space]').forEach(marker => marker.remove());
      // A client may replace a link with a same-markup clone. Empty engine
      // markers copied with it are still output, never author line breaks.
      // Only clean copied markers when this renderer owns line breaks. A
      // separate optical pass must not remove the underlying composition.
      if (breaks.length) element.querySelectorAll('[' + BREAK_ATTRIBUTE + ']').forEach(marker => marker.remove());
      for (const { head, parts } of splits.values()) {
        // Only merge adjacent fragments we own. External replacements are
        // never resurrected and unrelated author Text nodes are never normalized.
        if (!element.contains(head)) continue;
        for (const part of parts.slice(1)) {
          if (head.nextSibling !== part || part.parentNode !== head.parentNode) break;
          head.appendData(part.data); part.remove();
        }
      }
      releaseCopy();
      restoreSelection();
    },
  };
}

const copyRoots = new WeakMap<Document, WeakMap<HTMLElement, number>>();
/** Source copying is independent of visual line breaks. Respect site handlers. */
export function preserveRichCopy(element: HTMLElement): () => void {
  const doc = element.ownerDocument;
  let roots = copyRoots.get(doc);
  if (!roots) {
    roots = new WeakMap(); copyRoots.set(doc, roots);
    const registered = roots;
    doc.addEventListener('copy', event => {
      if (event.defaultPrevented || !event.clipboardData) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      const selection = doc.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return;
      const ranges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i));
      const containingRoot = (range: Range) => {
        let root = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
        while (root && !(registered.has(root) && root.contains(range.endContainer))) root = root.parentElement;
        return root;
      };
      const affected = ranges.some(range => {
        if (containingRoot(range)) return true;
        const common = range.commonAncestorContainer;
        const parent = common instanceof Element ? common : common.parentElement;
        return Array.from(parent?.querySelectorAll<HTMLElement>('*') || []).some(el => registered.has(el) && range.intersectsNode(el));
      });
      if (!affected) return;
      const html = ranges.map(range => {
        const fragment = range.cloneContents();
        fragment.querySelectorAll('[' + BREAK_ATTRIBUTE + ']').forEach(marker => marker.remove());
        fragment.querySelectorAll('[data-ts-track]').forEach(wrapper => wrapper.replaceWith(...wrapper.childNodes));
        for (const el of fragment.querySelectorAll('*')) {
          for (const attribute of ['data-ts-outcome', 'data-typeset-done', 'data-ts-quotes', 'data-ts-hanging', 'data-ts-spacing', 'data-ts-tracking']) el.removeAttribute(attribute);
          // Relative links must still point to the source document after paste.
          if (el instanceof HTMLAnchorElement && el.hasAttribute('href')) {
            try { el.href = new URL(el.getAttribute('href')!, doc.baseURI).href; } catch { /* Preserve invalid author URLs as authored. */ }
          }
        }
        const container = doc.createElement('div'); container.append(fragment);
        return container.innerHTML;
      }).join('');
      let text: string;
      if (ranges.length === 1 && containingRoot(ranges[0])) text = ranges[0].toString();
      else {
        // Let the browser serialize real paragraphs, lists and authored breaks.
        // Hide only generated markers for this synchronous read; source nodes,
        // selection endpoints and author layout are never replaced or cloned.
        const restore = Array.from(doc.querySelectorAll<HTMLElement>('[' + BREAK_ATTRIBUTE + ']'))
          .filter(marker => ranges.some(range => range.intersectsNode(marker)))
          .map(marker => override(marker, { display: 'none' }));
        try { text = selection.toString(); }
        finally { restore.forEach(undo => undo()); }
      }
      event.clipboardData.setData('text/plain', text);
      event.clipboardData.setData('text/html', html);
      event.preventDefault();
    });
  }
  roots.set(element, (roots.get(element) || 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (roots!.get(element) || 1) - 1;
    if (count) roots!.set(element, count); else roots!.delete(element);
  };
}

export function richFingerprint(element: HTMLElement): string {
  return [element, ...element.querySelectorAll<HTMLElement>('*')].filter(el => !el.hasAttribute(BREAK_ATTRIBUTE) && !el.hasAttribute('data-ts-track')).map(el => {
    const cs = getComputedStyle(el);
    return [cs.font, cs.fontFeatureSettings, cs.fontVariationSettings, cs.fontOpticalSizing, cs.fontKerning,
      cs.fontVariant, cs.fontSizeAdjust, cs.fontSynthesis, cs.textRendering, cs.lineHeight, cs.letterSpacing,
      cs.wordSpacing, cs.textTransform, cs.whiteSpace, cs.hyphens, cs.wordBreak, cs.lineBreak, cs.overflowWrap, el.getAttribute('lang'), cs.display, cs.direction, cs.unicodeBidi, cs.verticalAlign,
      cs.transform, cs.visibility, cs.paddingInline, cs.marginInline, cs.borderInlineWidth,
      cs.color, cs.backgroundColor, cs.textDecoration, cs.textShadow,
      getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content].join('|');
  }).join(';');
}
