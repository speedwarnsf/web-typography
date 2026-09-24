'use client';

import { Children, Component, Fragment, cloneElement, createElement, createRef, isValidElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { BREAK_ATTRIBUTE, planRichText, preserveRichCopy, selectionBookmark, richFingerprint, richLayoutVerified } from './rich-text';
import { contentWidth, measureLayout } from './layout-metrics';
import { childrenKey, layoutKey, propsKey } from './adapter-keys';
import type { RichPlan } from './rich-text';
import type { Mode, Options } from './typeset.next';
import { smartQuotes } from './smart-quotes';
import { planOpticalHanging, opticalMarkerStyle, opticalVerified } from './optical-hanging';
import type { LayoutMetrics } from './layout-metrics';
import type { OpticalHang } from './optical-hanging';
import { planSpacingFinish, spacingMarkerStyle, spacingVerified } from './spacing-finish';
import type { SpaceAdjustment, SpacingPlan } from './spacing-finish';
import { planTrackingFinish, trackingStyle, trackingVerified, TRACK_ATTRIBUTE } from './tracking-finish';
import type { TrackingPlan, TrackingRun } from './tracking-finish';
import { finishTargets } from './space-policy';

export interface TypesetRichTextProps extends Omit<HTMLAttributes<HTMLElement>, 'dangerouslySetInnerHTML'> {
  children: ReactNode;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span';
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
}
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

function renderChildren(children: ReactNode, breaks: Set<number>, hangs: OpticalHang[], spaces: SpaceAdjustment[], tracks: TrackingRun[], educate: boolean): ReactNode {
  let offset = 0;
  const educated = educate ? smartQuotes(quoteSource(children)) : null;
  const optical = new Map(hangs.map(hang => [hang.offset, hang.px]));
  const spacing = new Map(spaces.map(space => [space.offset, space.px]));
  const visit = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      const raw = String(child);
      const text = educated === null ? raw : educated.slice(offset, offset + raw.length);
      const start = offset; offset += text.length;
      const stops = [...new Set([...breaks, ...optical.keys(), ...spacing.keys(), ...tracks.flatMap(run => [run.start, run.end])])].filter(at => at >= start && at < offset).sort((a, b) => a - b);
      let cursor = 0;
      const pieces: ReactNode[] = [];
      let active: TrackingRun | undefined;
      let tracked: ReactNode[] = [];
      const flush = () => {
        if (active && tracked.length) pieces.push(createElement('span', { key: 'track-' + active.start, [TRACK_ATTRIBUTE]: String(active.start), style: trackingStyle(active) }, ...tracked));
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
        if (breaks.has(stop)) append(createElement('br', { key: 'break-' + stop, [BREAK_ATTRIBUTE]: '', 'aria-hidden': true }), stop, true);
        if (optical.has(stop)) append(createElement('span', { key: 'hang-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-hang': String(stop), 'aria-hidden': true, style: opticalMarkerStyle(optical.get(stop)!) }), stop, true);
        if (spacing.has(stop)) append(createElement('span', { key: 'space-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-space': String(stop), 'aria-hidden': true, style: spacingMarkerStyle(spacing.get(stop)!) }), stop);
        cursor = local;
      }
      append(text.slice(cursor), start + cursor); flush();
      return pieces;
    }
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    return cloneElement(child, undefined, visit(child.props.children));
  });
  return visit(children);
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
export class TypesetRichText extends Component<TypesetRichTextProps, State> {
  state: State = { children: childrenKey(this.props.children), plan: null, stale: false };
  private host = createRef<HTMLElement>();
  private observer?: MutationObserver;
  private resize?: ResizeObserver;
  private releaseCopy?: () => void;
  private frame = 0;
  private staleFrame = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private mounted = false;
  /** Props (by value) the current plan was made for. */
  private planned = '';
  /** planKey of the current plan; an equal new plan is carried forward. */
  private base = '';
  /** layoutKey when the current plan was made; triggers that leave it equal do nothing. */
  private layout = '';
  /** The widest rendered line of the settled composition. */
  private widest = 0;
  private widths = new WeakMap<Element, number>();

  static getDerivedStateFromProps(props: TypesetRichTextProps, state: State): Partial<State> | null {
    const key = childrenKey(props.children);
    return key !== state.children ? { children: key, plan: null, stale: false } : null;
  }
  componentDidMount(): void {
    this.mounted = true;
    const el = this.host.current!;
    this.observer = new MutationObserver(this.schedule);
    this.resize = new ResizeObserver(this.resized);
    this.bindHost();
    el.ownerDocument.fonts.addEventListener('loadingdone', this.schedule);
    el.ownerDocument.defaultView?.addEventListener('resize', this.resizing);
    el.ownerDocument.fonts.ready.then(this.schedule);
    this.recompose(true);
  }
  private rendering(previous: TypesetRichTextProps, before: State): boolean {
    return before.plan !== this.state.plan || before.stale !== this.state.stale || before.children !== this.state.children
      || previous.as !== this.props.as || propsKey(previous) !== propsKey(this.props);
  }
  getSnapshotBeforeUpdate(previous: TypesetRichTextProps, before: State): (() => void) | null {
    // A parent re-render that changes nothing here writes nothing here, so it
    // needs no selection bookmark and no observer detach.
    if (!this.rendering(previous, before)) return null;
    this.observer?.disconnect();
    return this.host.current ? selectionBookmark(this.host.current) : () => {};
  }
  componentDidUpdate(previous: TypesetRichTextProps, before: State, restoreSelection: (() => void) | null): void {
    if (!restoreSelection) return;
    restoreSelection();
    if (previous.as !== this.props.as) this.bindHost();
    if (!this.state.plan || propsKey(this.props) !== this.planned) { this.recompose(true); return; }
    if (before.plan === this.state.plan && before.stale === this.state.stale) { this.observe(); return; }
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
      this.widest = Math.max(0, ...after.lines.map(line => line.width));
    }
    if (!this.state.stale) this.layout = layoutKey(el);
    this.observe();
  }
  componentWillUnmount(): void {
    this.mounted = false;
    cancelAnimationFrame(this.frame); cancelAnimationFrame(this.staleFrame);
    clearTimeout(this.debounce);
    this.observer?.disconnect(); this.resize?.disconnect();
    this.host.current?.ownerDocument.fonts.removeEventListener('loadingdone', this.schedule);
    this.host.current?.ownerDocument.defaultView?.removeEventListener('resize', this.resizing);
    this.releaseCopy?.();
  }
  private observe = () => {
    if (this.host.current) this.observer?.observe(this.host.current, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'lang'] });
    for (let ancestor = this.host.current?.parentElement; ancestor; ancestor = ancestor.parentElement) {
      this.observer?.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class', 'lang'] });
    }
  };
  private bindHost = () => {
    this.releaseCopy?.(); this.resize?.disconnect();
    const el = this.host.current;
    if (!el) return;
    this.releaseCopy = preserveRichCopy(el);
    this.resize?.observe(el);
    if (el.parentElement) this.resize?.observe(el.parentElement);
  };
  private schedule = () => {
    if (!this.mounted || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.recompose(false); });
  };
  private resized = (entries: ResizeObserverEntry[]) => {
    let changed = false;
    for (const entry of entries) {
      const previous = this.widths.get(entry.target);
      this.widths.set(entry.target, entry.contentRect.width);
      if (previous !== undefined && Math.abs(previous - entry.contentRect.width) > .01) changed = true;
    }
    if (changed) this.resizing();
  };
  /** During continuous resizing, show native wrapping wherever the composed
   * lines no longer fit, and recompose once the size has held for 100 ms
   * instead of on every frame. Resize observations arrive after layout; a
   * layout change made there would be a same-depth notification the browser
   * reports as a ResizeObserver loop error. The stale commit therefore
   * happens in the next animation frame, before that frame's layout. */
  private resizing = () => {
    if (!this.mounted) return;
    if (!this.staleFrame) this.staleFrame = requestAnimationFrame(this.staleCheck);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { this.debounce = undefined; this.recompose(false); }, 100);
  };
  private staleCheck = () => {
    this.staleFrame = 0;
    const el = this.host.current;
    if (!this.mounted || !el || this.state.stale || !this.state.plan?.breaks.length) return;
    // Synchronous, so this frame paints native lines rather than composed
    // lines wrapping a second time.
    if (contentWidth(el) + .5 < this.widest) flushSync(() => this.setState({ stale: true }));
  };
  private recompose = (force: boolean) => {
    const el = this.host.current;
    if (!this.mounted || !el) return;
    if (!force && this.debounce !== undefined) return;
    if (!force && !this.state.stale && layoutKey(el) === this.layout) { this.observe(); return; }
    this.observer?.disconnect();
    this.planned = propsKey(this.props);
    const plan: RenderPlan = planRichText(el, this.props);
    if (!supportedTree(this.props.children)) { plan.breaks = []; plan.outcome = 'native:react-component'; }
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
    const { children, as = 'p', mode: _mode, keep: _keep, maxLines: _maxLines, density: _density, lineBreaks: _lineBreaks, smartQuotes: quotes, opticalHanging: _optical, spacing: _spacing, tracking: _tracking, contour: _contour, ...attributes } = this.props;
    const plan = this.state.plan;
    const shown = this.state.stale ? null : plan;
    const educate = quotes === 'en' && /^en(?:-|$)/i.test(this.props.lang || '') && quoteTreeSupported(children);
    return createElement(as, { ...attributes, ref: this.host, 'data-typeset-react-rich': '', 'data-typeset-done': plan ? '1' : undefined,
      'data-ts-outcome': plan?.outcome, 'data-ts-stale': this.state.stale ? '' : undefined, 'data-ts-quotes': quotes ? educate ? 'enabled' : 'native:quotes-scope' : undefined,
      'data-ts-hanging': _optical ? plan?.hanging || 'native:hanging-uncomposed' : undefined,
      'data-ts-spacing': _spacing === false ? 'off' : plan?.spacing?.outcome || 'native:spacing-uncomposed',
      'data-ts-tracking': _tracking === false || _spacing === false ? 'off' : plan?.tracking?.outcome || 'native:tracking-uncomposed' },
    supportedTree(children) ? renderChildren(children, new Set(shown?.breaks || []), shown?.hangs || [], shown?.spacing?.adjustments || [], shown?.tracking?.runs || [], educate) : children);
  }
}
