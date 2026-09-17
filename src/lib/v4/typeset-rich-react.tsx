'use client';

import { Children, Component, Fragment, cloneElement, createElement, createRef, isValidElement } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { BREAK_ATTRIBUTE, planRichText, preserveRichCopy, selectionBookmark, richFingerprint, richLayoutVerified } from './rich-text';
import { measureLayout } from './layout-metrics';
import type { RichPlan } from './rich-text';
import type { Mode, Options } from './typeset.next';
import { smartQuotes } from './smart-quotes';
import { planOpticalHanging, opticalMarkerStyle, opticalVerified } from './optical-hanging';
import type { LayoutMetrics } from './layout-metrics';
import type { OpticalHang } from './optical-hanging';
import { planSpacingFinish, spacingMarkerStyle, spacingVerified } from './spacing-finish';
import type { SpaceAdjustment, SpacingPlan } from './spacing-finish';

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
  contour?: Options['contour'];
}
interface RenderPlan extends RichPlan { hangs?: OpticalHang[]; hanging?: string; spacing?: SpacingPlan; beforeHanging?: LayoutMetrics }
interface State { input: ReactNode; plan: RenderPlan | null }

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

function renderChildren(children: ReactNode, breaks: Set<number>, hangs: OpticalHang[], spaces: SpaceAdjustment[], educate: boolean): ReactNode {
  let offset = 0;
  const educated = educate ? smartQuotes(quoteSource(children)) : null;
  const optical = new Map(hangs.map(hang => [hang.offset, hang.px]));
  const spacing = new Map(spaces.map(space => [space.offset, space.px]));
  const visit = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      const raw = String(child);
      const text = educated === null ? raw : educated.slice(offset, offset + raw.length);
      const start = offset; offset += text.length;
      const stops = [...new Set([...breaks, ...optical.keys(), ...spacing.keys()])].filter(at => at >= start && at < offset).sort((a, b) => a - b);
      let cursor = 0;
      const pieces: ReactNode[] = [];
      for (const stop of stops) {
        const local = stop - start;
        pieces.push(text.slice(cursor, local));
        if (breaks.has(stop)) pieces.push(createElement('br', { key: 'break-' + stop, [BREAK_ATTRIBUTE]: '', 'aria-hidden': true }));
        if (optical.has(stop)) pieces.push(createElement('span', { key: 'hang-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-hang': String(stop), 'aria-hidden': true, style: opticalMarkerStyle(optical.get(stop)!) }));
        if (spacing.has(stop)) pieces.push(createElement('span', { key: 'space-' + stop, [BREAK_ATTRIBUTE]: '', 'data-ts-space': String(stop), 'aria-hidden': true, style: spacingMarkerStyle(spacing.get(stop)!) }));
        cursor = local;
      }
      pieces.push(text.slice(cursor));
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

/** React renders every author element and break. The compositor only measures;
 * it never splits a Text node behind React's reconciliation bookkeeping. */
export class TypesetRichText extends Component<TypesetRichTextProps, State> {
  state: State = { input: this.props.children, plan: null };
  private host = createRef<HTMLElement>();
  private observer?: MutationObserver;
  private resize?: ResizeObserver;
  private releaseCopy?: () => void;
  private frame = 0;
  private mounted = false;

  static getDerivedStateFromProps(props: TypesetRichTextProps, state: State): Partial<State> | null {
    return props.children !== state.input ? { input: props.children, plan: null } : null;
  }
  componentDidMount(): void {
    this.mounted = true;
    const el = this.host.current!;
    this.observer = new MutationObserver(this.schedule);
    this.resize = new ResizeObserver(this.schedule);
    this.bindHost();
    el.ownerDocument.fonts.addEventListener('loadingdone', this.schedule);
    el.ownerDocument.defaultView?.addEventListener('resize', this.schedule);
    el.ownerDocument.fonts.ready.then(this.schedule);
    this.recompose();
  }
  getSnapshotBeforeUpdate(): (() => void) | null {
    this.observer?.disconnect();
    return this.host.current ? selectionBookmark(this.host.current) : null;
  }
  componentDidUpdate(previous: TypesetRichTextProps, _state: State, restoreSelection: (() => void) | null): void {
    restoreSelection?.();
    if (previous.as !== this.props.as) this.bindHost();
    if (previous !== this.props) this.recompose();
    else {
      const el = this.host.current!;
      const plan = this.state.plan;
      if (plan && (plan.outcome === 'composed:rich' || plan.outcome === 'native:fits')) {
        const after = measureLayout(el);
        const title = this.props.mode === 'title' || this.props.mode === 'heading' || (!this.props.mode && /^H[1-6]$/.test(el.tagName));
        if (plan.beforeHanging && plan.hangs?.length && !opticalVerified(el, plan.beforeHanging, after, plan.hangs)) {
          this.setState({ plan: { ...plan, hangs: [], hanging: 'native:hanging-verification' } });
          return;
        }
        const invalid = el.textContent !== plan.source || after.overflow > .5 || (plan.outcome === 'composed:rich' &&
          ((!plan.spacing && !richLayoutVerified(plan, after)) || after.lines.length !== plan.widths.length || richFingerprint(el) !== plan.styleSignature))
          || (!title && !plan.before.lastSingleton && after.lastSingleton);
        if (plan.spacing?.adjustments.length && (invalid || !spacingVerified(el, plan.spacing, after))) {
          this.setState({ plan: { ...plan, spacing: { ...plan.spacing, outcome: 'native:spacing-verification', adjustments: [] } } });
          return;
        }
        if (invalid) {
          this.setState({ plan: { ...plan, breaks: [], hangs: [], spacing: undefined, hanging: 'native:hanging-verification', outcome: 'native:verification' } });
          return;
        }
        if (!plan.spacing && this.props.spacing !== false && !title && plan.outcome === 'composed:rich') {
          this.setState({ plan: { ...plan, spacing: planSpacingFinish(el, after) } });
          return;
        }
        if (this.props.opticalHanging && !plan.hanging) {
          const optical = planOpticalHanging(el, after);
          this.setState({ plan: { ...plan, hangs: optical.hangs, hanging: optical.outcome, beforeHanging: after } });
          return;
        }
      }
      this.observe();
    }
  }
  componentWillUnmount(): void {
    this.mounted = false;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect(); this.resize?.disconnect();
    this.host.current?.ownerDocument.fonts.removeEventListener('loadingdone', this.schedule);
    this.host.current?.ownerDocument.defaultView?.removeEventListener('resize', this.schedule);
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
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.recompose(); });
  };
  private recompose = () => {
    if (!this.mounted || !this.host.current) return;
    this.observer?.disconnect();
    const plan: RenderPlan = planRichText(this.host.current, this.props);
    if (!supportedTree(this.props.children)) { plan.breaks = []; plan.outcome = 'native:react-component'; }
    if (JSON.stringify(plan) !== JSON.stringify(this.state.plan)) this.setState({ plan });
    else this.observe();
  };
  render(): ReactElement {
    const { children, as = 'p', mode: _mode, keep: _keep, maxLines: _maxLines, density: _density, lineBreaks: _lineBreaks, smartQuotes: quotes, opticalHanging: _optical, spacing: _spacing, contour: _contour, ...attributes } = this.props;
    const plan = this.state.plan;
    const educate = quotes === 'en' && /^en(?:-|$)/i.test(this.props.lang || '') && quoteTreeSupported(children);
    return createElement(as, { ...attributes, ref: this.host, 'data-typeset-react-rich': '', 'data-typeset-done': plan ? '1' : undefined,
      'data-ts-outcome': plan?.outcome, 'data-ts-quotes': quotes ? educate ? 'enabled' : 'native:quotes-scope' : undefined,
      'data-ts-hanging': _optical ? plan?.hanging || 'native:hanging-uncomposed' : undefined,
      'data-ts-spacing': _spacing === false ? 'off' : plan?.spacing?.outcome || 'native:spacing-uncomposed' },
    supportedTree(children) ? renderChildren(children, new Set(plan?.breaks || []), plan?.hangs || [], plan?.spacing?.adjustments || [], educate) : children);
  }
}
