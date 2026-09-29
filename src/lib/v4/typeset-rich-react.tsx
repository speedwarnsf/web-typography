'use client';

import { Children, Component, Fragment, cloneElement, createElement, forwardRef, isValidElement } from 'react';
import type { AllHTMLAttributes, ForwardedRef, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { BREAK_ATTRIBUTE, breakReplacesSpace, liveText, planRichText, preserveRichCopy, selectionBookmark, richFingerprint, richLayoutVerified } from './rich-text';
import { linesExtent, measureLayout } from './layout-metrics';
import { assignRef, childrenKey, layoutKey, propsKey, transformOnly } from './adapter-keys';
import { adapterRegistry } from './adapter-registry';
import { ENVIRONMENT_OUTCOME } from './environment';
import type { AdapterEntry, Priority } from './adapter-registry';
export type { Priority } from './adapter-registry';
import type { RichPlan } from './rich-text';
import type { Mode, Options, Result } from './typeset.next';
import { smartQuotes } from './smart-quotes';
import { planOpticalHanging, opticalMarkerStyle, opticalVerified } from './optical-hanging';
import type { LayoutMetrics } from './layout-metrics';
import type { OpticalHang } from './optical-hanging';
import { planSpacingFinish, spacingMarkerStyle, spacingVerified } from './spacing-finish';
import type { SpaceAdjustment, SpacingPlan } from './spacing-finish';
import { planTrackingFinish, trackingStyle, trackingVerified, TRACK_ATTRIBUTE } from './tracking-finish';
import type { TrackingPlan, TrackingRun } from './tracking-finish';
import { finishTargets } from './space-policy';
import { markerRules, printing, rendered } from './lifecycle';

/** Host elements the adapters render. The engine decides at run time what it
 * composes: an inline host such as a default label reports native:inline. */
export type TypesetTag = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'div' | 'li' | 'blockquote' | 'figcaption'
  | 'dd' | 'dt' | 'td' | 'th' | 'caption' | 'label' | 'legend' | 'summary';

/** Options and host attributes shared by TypesetText and TypesetRichText. */
export interface TypesetAdapterProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'>,
  Pick<AllHTMLAttributes<HTMLElement>, 'cite' | 'colSpan' | 'rowSpan' | 'headers' | 'scope' | 'htmlFor' | 'value'> {
  as?: TypesetTag;
  mode?: Mode;
  keep?: readonly string[];
  maxLines?: number;
  density?: Options['density'];
  lineBreaks?: Options['lineBreaks'];
  smartQuotes?: Options['smartQuotes'];
  opticalHanging?: Options['opticalHanging'];
  spacing?: Options['spacing'];
  tracking?: Options['tracking'];
  contour?: Options['contour'];
  /** Default `true`: copying composed text puts the source on the clipboard,
   * without the generated line breaks. `false` leaves copying to the
   * browser, whose copied text then has a line break at every composed line
   * end (Options.copy). */
  copy?: Options['copy'];
  /** 'auto' (default) composes in the commit only what is on screen, within
   * a small time budget, and the rest before its first paint or in idle
   * time. 'sync' composes in the commit, as 4.2 did, for hero text.
   * Server-rendered HTML paints natively first and composes after hydration. */
  priority?: Priority;
  /** Called after each composition of the block with the engine's result
   * (outcome, measured lines before and after, and feature statuses). */
  onResult?: (result: Result) => void;
}
export interface TypesetRichTextProps extends TypesetAdapterProps {
  children: ReactNode;
}
interface RichProps extends TypesetRichTextProps { forwardedRef?: ForwardedRef<HTMLElement> }


interface RenderPlan extends RichPlan { hangs?: OpticalHang[]; hanging?: string; spacing?: SpacingPlan; tracking?: TrackingPlan; beforeHanging?: LayoutMetrics }
interface State { children: string; plan: RenderPlan | null; stale: boolean }

function quoteSource(children: ReactNode): string {
  let source = '';
  Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') source += String(child);
    else if (isValidElement<{ children?: ReactNode }>(child)) source += quoteSource(child.props.children);
  });
  return source;
}

function quoteTreeSupported(children: ReactNode): boolean {
  let supported = true;
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode; lang?: string; 'data-no-typeset'?: unknown }>(child)) return;
    if ((child.props.lang && !/^en(?:-|$)/i.test(child.props.lang)) || child.props['data-no-typeset'] !== undefined
      || (typeof child.type === 'string' && !['a', 'b', 'strong', 'em', 'i', 'span', 'small', 'u', 's', 'del', 'mark', 'abbr', 'cite'].includes(child.type))
      || !quoteTreeSupported(child.props.children)) supported = false;
  });
  return supported;
}

function trackingForTree(plan: TrackingPlan, children: ReactNode): TrackingPlan {
  let offset = 0;
  const runs: TrackingRun[] = [];
  const visit = (nodes: ReactNode) => Children.forEach(nodes, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      const end = offset + String(child).length;
      for (const run of plan.runs) {
        const start = Math.max(offset, run.start), stop = Math.min(end, run.end);
        if (stop > start) runs.push({ ...run, start, end: stop });
      }
      offset = end;
    } else if (isValidElement<{ children?: ReactNode }>(child)) visit(child.props.children);
  });
  visit(children);
  return { ...plan, runs };
}

/** `inline`: markers carry their shared declarations themselves, where the
 * engine's stylesheet does not reach the host (see markerRules). */
function renderChildren(children: ReactNode, breaks: Set<number>, hangs: OpticalHang[], spaces: SpaceAdjustment[], tracks: TrackingRun[], educate: boolean, inline: boolean): ReactNode {
  let offset = 0;
  const source = quoteSource(children);
  const educated = educate ? smartQuotes(source) : null;
  const optical = new Map(hangs.map(hang => [hang.offset, hang.px]));
  const spacing = new Map(spaces.map(space => [space.offset, space.px]));
  // A line that starts where an element starts breaks before the outermost
  // element starting there, not first inside it (see renderRichText): at the
  // end of the text just before it, or, where that text ends inside another
  // element or a fragment ("<strong>Note: </strong><a>"), as a sibling. Such
  // an element is always rendered as a keyed pair (break or nothing, then the
  // element), so a line starting there or not never remounts it.
  const moved = new Set<number>(), atTextEnd = new Set<number>();
  const paired = new Set<number>();
  {
    let at = 0, index = 0;
    const starts = new Set<number>();
    const scan = (nodes: ReactNode) => {
      let afterText = false;
      Children.forEach(nodes, child => {
        if (typeof child === 'string' || typeof child === 'number') { at += String(child).length; afterText = String(child).length > 0; return; }
        if (isValidElement<{ children?: ReactNode }>(child)) {
          const element = index++;
          if (at > 0 && !starts.has(at) && quoteSource(child.props.children)) {
            starts.add(at);
            if (!afterText) paired.add(element);
            if (breaks.has(at)) { moved.add(at); if (afterText) atTextEnd.add(at); }
          }
          scan(child.props.children);
        }
        afterText = false;
      });
    };
    scan(children);
  }
  let elements = 0;
  const visit = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      const raw = String(child);
      const text = educated === null ? raw : educated.slice(offset, offset + raw.length);
      const start = offset; offset += text.length;
      const stops = [...new Set([...breaks, ...optical.keys(), ...spacing.keys(), ...tracks.flatMap(run => [run.start, run.end])])].filter(at => at >= start && at < offset);
      if (atTextEnd.has(offset) && offset > start) stops.push(offset);
      stops.sort((a, b) => a - b);
      let cursor = 0;
      const pieces: ReactNode[] = [];
      let active: TrackingRun | undefined;
      let tracked: ReactNode[] = [];
      const flush = () => {
        if (active && tracked.length) pieces.push(createElement('span', { key: 'track-' + active.start, [TRACK_ATTRIBUTE]: String(active.start), style: trackingStyle(active, inline) }, ...tracked));
        active = undefined; tracked = [];
      };
      const append = (piece: ReactNode, at: number, marker = false) => {
        if (piece === '') return;
        const run = tracks.find(run => run.start <= at && at < run.end);
        if (marker || run !== active) flush();
        active = marker ? undefined : run;
        if (active) tracked.push(piece); else pieces.push(piece);
      };
      for (const stop of stops) {
        const local = stop - start;
        append(text.slice(cursor, local), start + cursor);
        // Exposed where it stands in for the collapsed space; see renderRichText.
        if (breaks.has(stop) && (stop === offset || !moved.has(stop))) append(createElement('br', { key: 'break-' + stop, [BREAK_ATTRIBUTE]: '', 'aria-hidden': breakReplacesSpace(source, stop) ? undefined : true, style: breakStyle }), stop, true);
        if (stop === offset) { cursor = local; continue; }
        if (optical.has(stop)) append(createElement('span', { key: 'hang-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-hang': String(stop), 'aria-hidden': true, style: opticalMarkerStyle(optical.get(stop)!, inline) }), stop, true);
        if (spacing.has(stop)) append(createElement('span', { key: 'space-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-space': String(stop), 'aria-hidden': true, style: spacingMarkerStyle(spacing.get(stop)!, inline) }), stop);
        cursor = local;
      }
      append(text.slice(cursor), start + cursor); flush();
      return pieces;
    }
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    const element = elements++, at = offset;
    const rendered = cloneElement(child, undefined, visit(child.props.children));
    if (!paired.has(element)) return rendered;
    return [breaks.has(at) ? createElement('br', { key: 'break', [BREAK_ATTRIBUTE]: '', 'aria-hidden': breakReplacesSpace(source, at) ? undefined : true, style: breakStyle }) : null,
      cloneElement(rendered, { key: 'element' })];
  });
  return visit(children);
}

let warnedQuotesLang = false, warnedComponent = false;
/** Development builds only: bundlers replace process.env.NODE_ENV; without a
 * bundler `process` is undefined and nothing is logged. */
function development(): boolean {
  try { return process.env.NODE_ENV !== 'production'; } catch { return false; }
}

// The same switch as the DOM renderer's break: print and stale mode set it to none.
const breakStyle = { display: 'var(--ts-break-display, inline)' };

/** `nodes` as written, with the text React renders from them educated: for a
 * tree the adapter keeps native (a component child), quotes are curled in
 * text children and in the children given to each element, the component's
 * included. Children that are not text or elements (a render function) are
 * passed on untouched. Offsets follow quoteSource, which reads the same
 * children in the same order. */
function educateNodes(nodes: ReactNode, educated: string, at: { offset: number }): ReactNode {
  if (typeof nodes === 'string') { const text = educated.slice(at.offset, at.offset + nodes.length); at.offset += nodes.length; return text; }
  if (typeof nodes === 'number') { at.offset += String(nodes).length; return nodes; }
  if (Array.isArray(nodes)) return nodes.map(node => educateNodes(node, educated, at));
  if (!isValidElement<{ children?: ReactNode }>(nodes)) return nodes;
  const inner = nodes.props.children;
  if (typeof inner !== 'string' && typeof inner !== 'number' && !Array.isArray(inner) && !isValidElement(inner)) { at.offset += quoteSource(inner).length; return nodes; }
  const next = educateNodes(inner, educated, at);
  // Spread, as JSX passes several children: React checks the keys of an
  // array child, and these were never a list.
  return next === inner ? nodes : Array.isArray(next) ? cloneElement(nodes, undefined, ...next) : cloneElement(nodes, undefined, next);
}

function supportedTree(children: ReactNode): boolean {
  let supported = true;
  Children.forEach(children, child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (typeof child.type !== 'string' && child.type !== Fragment) supported = false;
    if (!supportedTree(child.props.children)) supported = false;
  });
  return supported;
}

/** A composed plan's identity without line coordinates or finishing passes,
 * plus the options that choose those passes: two plans with the same key
 * render the same breaks at the same width with the same finish. */
const planKey = (plan: RichPlan, props: TypesetRichTextProps): string => JSON.stringify([plan.outcome, plan.source, plan.breaks,
  plan.widths.map(width => Math.round(width * 4) / 4), Math.round(plan.before.width * 4) / 4, plan.styleSignature,
  props.spacing, props.tracking, props.opticalHanging, props.smartQuotes, props.mode, props.lang]);
/** A rendered state that no verification step has rolled back. */
const healthy = (plan: RenderPlan): boolean => ![plan.outcome, plan.hanging, plan.spacing?.outcome, plan.tracking?.outcome].some(status => status?.endsWith('verification'));

/** React renders every author element and break. The compositor only measures;
 * it never splits a Text node behind React's reconciliation bookkeeping. */
class RichText extends Component<RichProps, State> {
  state: State = { children: childrenKey(this.props.children), plan: null, stale: false };
  private host: { current: HTMLElement | null } = { current: null };
  private refCleanup?: () => void;
  /** The caller's ref gets the host element, like any host component. */
  private setHost = (node: HTMLElement | null) => {
    this.host.current = node;
    if (node) this.refCleanup = assignRef(this.props.forwardedRef, node);
    else { if (this.refCleanup) this.refCleanup(); else assignRef(this.props.forwardedRef, null); this.refCleanup = undefined; }
  };
  /** Set when a composition starts; the result is reported once it settles. */
  private reporting = 0;
  private entry?: AdapterEntry;
  private releaseCopy?: () => void;
  private mounted = false;
  /** Props (by value) the current plan was made for. */
  private planned = '';
  /** planKey of the current plan; an equal new plan is carried forward. */
  private base = '';
  /** layoutKey of the settled composition; triggers that leave it equal do nothing. */
  private layout = '';
  /** The widest rendered line of the settled composition. */
  private widest = 0;
  /** Machine translation is rewriting this subtree: no replans. React output
   * stays as it is, since a re-render would write into Text nodes the
   * translator is filling. Unlike mount(), the adapter cannot remove the
   * breaks it rendered. */
  private frozen = false;
  /** Markers carry their shared declarations inline: the engine's stylesheet
   * did not reach the host when it was last rendered (see markerRules). */
  private inlineMarkers = false;

  static getDerivedStateFromProps(props: RichProps, state: State): Partial<State> | null {
    const key = childrenKey(props.children);
    return key !== state.children ? { children: key, plan: null, stale: false } : null;
  }
  componentDidMount(): void {
    this.mounted = true;
    this.bind();
  }
  /** Register the current host element with the document's adapter registry. */
  private bind(): void {
    const el = this.host.current;
    if (!el || this.entry?.element === el) return;
    this.unbind();
    this.releaseCopy = this.props.copy === false ? undefined : preserveRichCopy(el);
    const entry: AdapterEntry = {
      element: el, priority: this.props.priority ?? 'auto',
      // Outside a commit the whole plan-and-finish chain runs synchronously
      // too, so a frame never paints half of it.
      compose: (_reason, inCommit) => { if (inCommit) this.recompose(); else flushSync(this.recompose); },
      changed: fonts => {
        if (this.state.stale) return true;
        const now = layoutKey(el, fonts);
        if (now === this.layout) return false;
        // Only an ancestor transform changed: the composed lines stay correct.
        if (this.layout && this.state.plan?.breaks.length && transformOnly(now, this.layout)) { this.layout = now; return false; }
        return true;
      },
      // Frozen, nothing may re-render: a narrower container must not pick
      // this host for stale mode.
      widest: () => this.frozen || this.state.stale || !this.state.plan?.breaks.length ? 0 : this.widest,
      // Every state update outside a commit is refused while frozen. React
      // would remove Text nodes the translator already replaced and, with no
      // error boundary, unmount the whole root.
      stale: () => { if (!this.frozen) flushSync(() => this.setState({ stale: true })); },
      translation: active => {
        this.frozen = active;
        if (!active) adapterRegistry(el.ownerDocument).request(entry, 'force', false);
      },
      unsupported: () => {
        if (this.frozen) return;
        this.reporting = performance.now();
        this.planned = propsKey(this.props);
        this.setState({ plan: { source: el.textContent || '', before: { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 },
          outcome: ENVIRONMENT_OUTCOME, breaks: [], widths: [], styleSignature: '' }, stale: false });
      },
    };
    this.entry = entry;
    const registry = adapterRegistry(el.ownerDocument);
    registry.add(entry);
    registry.request(entry, 'mount', true);
  }
  private unbind(): void {
    if (this.entry) adapterRegistry(this.entry.element.ownerDocument).remove(this.entry);
    this.entry = undefined;
    this.releaseCopy?.(); this.releaseCopy = undefined;
  }
  private rendering(previous: RichProps, before: State): boolean {
    return before.plan !== this.state.plan || before.stale !== this.state.stale || before.children !== this.state.children
      || previous.as !== this.props.as || propsKey(previous) !== propsKey(this.props);
  }
  getSnapshotBeforeUpdate(previous: RichProps, before: State): (() => void) | null {
    // A parent re-render that changes nothing here writes nothing here, and
    // needs no selection bookmark.
    if (!this.rendering(previous, before)) return null;
    return this.host.current ? selectionBookmark(this.host.current) : () => {};
  }
  componentDidUpdate(previous: RichProps, before: State, restoreSelection: (() => void) | null): void {
    if (previous.forwardedRef !== this.props.forwardedRef && this.host.current) {
      if (this.refCleanup) this.refCleanup(); else assignRef(previous.forwardedRef, null);
      this.refCleanup = assignRef(this.props.forwardedRef, this.host.current);
    }
    // copy={false} leaves this host's copying to the browser.
    if ((previous.copy === false) !== (this.props.copy === false) && this.entry) {
      this.releaseCopy?.();
      this.releaseCopy = this.props.copy === false ? undefined : preserveRichCopy(this.entry.element);
    }
    if (!restoreSelection) return;
    restoreSelection();
    if (this.frozen) return;
    if (this.entry) this.entry.priority = this.props.priority ?? 'auto';
    if (previous.as !== this.props.as) { this.bind(); return; }
    if (!this.state.plan || propsKey(this.props) !== this.planned) {
      if (this.entry) adapterRegistry(this.entry.element.ownerDocument).request(this.entry, 'force', true);
      return;
    }
    if (before.plan === this.state.plan && before.stale === this.state.stale) return;
    this.settle();
  }
  /** Verify what is rendered, then take the next finishing step (spacing,
   * tracking, hanging), one commit each, or roll back to native. Settled, the
   * layout key is recorded so later triggers that leave it equal do nothing. */
  private settle(): void {
    const el = this.host.current!;
    const plan = this.state.plan;
    if (plan && !this.state.stale && (plan.outcome === 'composed:rich' || plan.outcome === 'native:fits')) {
      const after = measureLayout(el);
      const title = this.props.mode === 'title' || this.props.mode === 'heading' || (!this.props.mode && /^H[1-6]$/.test(el.tagName));
      if (plan.beforeHanging && plan.hangs?.length && !opticalVerified(el, plan.beforeHanging, after, plan.hangs)) {
        this.setState({ plan: { ...plan, hangs: [], hanging: 'native:hanging-verification' } });
        return;
      }
      const invalid = el.textContent !== plan.source || after.overflow > .5 || (plan.outcome === 'composed:rich' &&
        ((!plan.spacing && !richLayoutVerified(plan, after)) || after.lines.length !== plan.widths.length || richFingerprint(el) !== plan.styleSignature))
        || (!title && !plan.before.lastSingleton && after.lastSingleton);
      if (plan.spacing?.adjustments.length && (invalid || !spacingVerified(el, plan.spacing, plan.tracking?.before || plan.beforeHanging || after))) {
        this.setState({ plan: { ...plan, tracking: undefined, spacing: { ...plan.spacing, outcome: 'native:spacing-verification', adjustments: [] } } });
        return;
      }
      if (invalid) {
        this.setState({ plan: { ...plan, breaks: [], hangs: [], spacing: undefined, tracking: undefined, hanging: 'native:hanging-verification', outcome: 'native:verification' } });
        return;
      }
      if (!plan.spacing && this.props.spacing !== false && !title && plan.outcome === 'composed:rich') {
        this.setState({ plan: { ...plan, spacing: planSpacingFinish(el, after) } });
        return;
      }
      if (plan.tracking?.runs.length && !trackingVerified(el, plan.tracking, plan.beforeHanging || after)) {
        this.setState({ plan: { ...plan, tracking: { ...plan.tracking, outcome: 'native:tracking-verification', runs: [] }, hangs: [], hanging: undefined, beforeHanging: undefined } });
        return;
      }
      if (!plan.tracking && this.props.tracking !== false && plan.spacing && ['applied', 'unchanged'].includes(plan.spacing.outcome)) {
        const targets = finishTargets(plan.spacing.before.lines.map(line => line.width), plan.spacing.before.width);
        this.setState({ plan: { ...plan, tracking: trackingForTree(planTrackingFinish(el, after, targets), this.props.children) } });
        return;
      }
      if (this.props.opticalHanging && !plan.hanging) {
        const optical = planOpticalHanging(el, after);
        this.setState({ plan: { ...plan, hangs: optical.hangs, hanging: optical.outcome, beforeHanging: after } });
        return;
      }
      // As the registry compares it with the content width: a hung first
      // glyph is not part of what the box must hold.
      this.widest = linesExtent(el, after.lines);
    }
    if (!this.state.stale) {
      // No layout key where nothing can be measured (jsdom, happy-dom), and
      // none for a decision made while hidden: revealing a content-visibility
      // subtree or a <details> keeps the host's width and style, so an equal
      // key would leave it native.
      if (plan?.outcome !== ENVIRONMENT_OUTCOME) {
        this.layout = plan?.outcome !== 'unmeasurable' && rendered(el) ? layoutKey(el) : '';
        // The box's size as this composition left it is not a resize.
        if (this.entry) adapterRegistry(el.ownerDocument).composed(this.entry);
      }
      if (this.reporting) this.report(el, plan);
    }
  }
  /** onResult, in the engine's Result shape, once a composition has settled. */
  private report(el: HTMLElement, plan: RenderPlan | null): void {
    const started = this.reporting;
    this.reporting = 0;
    const callback = this.props.onResult;
    if (!callback || !plan) return;
    const props = this.props;
    const mode: Mode = props.mode || (el.dataset.typesetMode as Mode | undefined) || (el.closest('h1,h2,h3,h4,h5,h6') ? 'title' : 'body');
    const educate = props.smartQuotes === 'en' && /^en(?:-|$)/i.test(props.lang || '') && quoteTreeSupported(props.children);
    const result: Result = {
      // Nothing was measured for these; a long unbreakable run is not read now either.
      outcome: plan.outcome, mode, before: plan.before, after: plan.outcome === ENVIRONMENT_OUTCOME || plan.outcome === 'native:run-budget' ? plan.before : measureLayout(el),
      changed: !!(plan.breaks.length || plan.hangs?.length || plan.spacing?.adjustments.length || plan.tracking?.runs.length),
      durationMs: performance.now() - started,
      ...(plan.constraint && { constraint: plan.constraint }), ...(plan.search && { search: plan.search }),
      features: {
        quotes: props.smartQuotes ? educate ? 'enabled' : 'native:quotes-scope' : 'off',
        hanging: props.opticalHanging ? plan.hanging || 'native:hanging-uncomposed' : 'off',
        spacing: props.spacing === false ? 'off' : plan.spacing?.outcome || 'native:spacing-uncomposed',
        tracking: props.tracking === false || props.spacing === false ? 'off' : plan.tracking?.outcome || 'native:tracking-uncomposed',
      },
    };
    // After the commit, outside the registry's own writes.
    queueMicrotask(() => callback(result));
  }
  componentWillUnmount(): void {
    this.mounted = false;
    this.unbind();
  }
  private recompose = () => {
    const el = this.host.current;
    if (!this.mounted || !el || this.frozen) return;
    // Hidden or printing: keep the current plan. Shown again at the same
    // width, the text paints composed instead of native first and re-broken
    // a frame later; print CSS shows native wrapping at the paper's width.
    if (this.state.plan && (!rendered(el) || printing(el.ownerDocument))) return;
    this.reporting = performance.now();
    this.planned = propsKey(this.props);
    // A live region announces every change: never measure or break it, or
    // text that contains one.
    const none = { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
    const plan: RenderPlan = liveText(el)
      ? { source: el.textContent || '', breaks: [], widths: [], outcome: 'native:live-region', styleSignature: '', before: none }
      // Mounted hidden (a skipped content-visibility subtree, a closed
      // <details>): nothing can be measured until it is shown.
      : !rendered(el) ? { source: el.textContent || '', breaks: [], widths: [], outcome: 'unmeasurable', styleSignature: '', before: none }
      : planRichText(el, this.props);
    if (!supportedTree(this.props.children)) {
      plan.breaks = []; plan.outcome = 'native:react-component';
      if (!warnedComponent && development()) {
        warnedComponent = true;
        // React renders a component child itself, so the adapter cannot place breaks inside it.
        console.warn('TypesetRichText: a component child (next/link\'s <Link>, a router link, any function or class component) keeps the paragraph native (native:react-component). Use host elements such as <a>, <strong> and <em> inside it, or compose the rendered HTML with mount().');
      }
    }
    const base = planKey(plan, this.props);
    if (this.state.plan && base === this.base && healthy(this.state.plan)) {
      // The same breaks at the same width: keep the spacing, tracking and
      // hanging already rendered and verify them again, with no commit chain.
      // A state a verification rolled back is planned afresh instead.
      if (this.state.stale) this.setState({ stale: false }); else this.settle();
      return;
    }
    this.base = base;
    this.setState({ plan, stale: false });
  };
  render(): ReactElement {
    const { children, as = 'p', mode: _mode, keep: _keep, maxLines: _maxLines, density: _density, lineBreaks: _lineBreaks, smartQuotes: quotes, opticalHanging: _optical, spacing: _spacing, tracking: _tracking, contour: _contour, copy: _copy, priority: _priority, onResult: _onResult, forwardedRef: _ref, ...attributes } = this.props;
    const plan = this.state.plan;
    const shown = this.state.stale ? null : plan;
    const educate = quotes === 'en' && /^en(?:-|$)/i.test(this.props.lang || '') && quoteTreeSupported(children);
    if (quotes === 'en' && !this.props.lang && !warnedQuotesLang && development()) {
      warnedQuotesLang = true;
      // Education happens during render, where an ancestor's lang is invisible.
      console.warn('TypesetRichText: smartQuotes="en" needs lang="en" (or en-*) on the component itself; quotes are left as written.');
    }
    const props = { ...attributes, ref: this.setHost, 'data-typeset-react-rich': '', 'data-typeset-done': plan ? '1' : undefined,
      'data-ts-outcome': plan?.outcome, 'data-ts-stale': this.state.stale ? '' : undefined, 'data-ts-quotes': quotes ? educate ? 'enabled' : 'native:quotes-scope' : undefined,
      'data-ts-hanging': _optical ? plan?.hanging || 'native:hanging-uncomposed' : undefined,
      'data-ts-spacing': _spacing === false ? 'off' : plan?.spacing?.outcome || 'native:spacing-uncomposed',
      'data-ts-tracking': _tracking === false || _spacing === false ? 'off' : plan?.tracking?.outcome || 'native:tracking-uncomposed' };
    // Read only: the registry installs the sheet, and puts it back if the
    // page drops it. React 19's strict mode renders again while the host ref
    // is detached; the last answer stands then.
    const markers = !!(shown?.hangs?.length || shown?.spacing?.adjustments.length || shown?.tracking?.runs.length);
    if (markers && this.host.current) this.inlineMarkers = !markerRules(this.host.current, false);
    const inline = markers && this.inlineMarkers;
    if (supportedTree(children)) return createElement(as, props, renderChildren(children, new Set(shown?.breaks || []), shown?.hangs || [], shown?.spacing?.adjustments || [], shown?.tracking?.runs || [], educate, inline));
    if (!educate) return createElement(as, props, children);
    // Kept native (native:react-component), still with the quotes asked for.
    const educated = educateNodes(children, smartQuotes(quoteSource(children)), { offset: 0 });
    return Array.isArray(educated) ? createElement(as, props, ...educated) : createElement(as, props, educated);
  }
}

/** Rich inline markup composed by React: author elements and breaks are
 * React's, and a ref resolves to the host element. */
export const TypesetRichText = /* @__PURE__ */ forwardRef<HTMLElement, TypesetRichTextProps>(function TypesetRichText(props, ref) {
  return createElement(RichText, { ...props, forwardedRef: ref });
});
