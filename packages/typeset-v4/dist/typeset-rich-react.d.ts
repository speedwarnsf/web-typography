import { Component } from 'react';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import type { RichPlan } from './rich-text.js';
import type { Mode, Options } from './typeset.next.js';
import type { LayoutMetrics } from './layout-metrics.js';
import type { OpticalHang } from './optical-hanging.js';
import type { SpacingPlan } from './spacing-finish.js';
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
interface RenderPlan extends RichPlan {
    hangs?: OpticalHang[];
    hanging?: string;
    spacing?: SpacingPlan;
    beforeHanging?: LayoutMetrics;
}
interface State {
    input: ReactNode;
    plan: RenderPlan | null;
}
/** React renders every author element and break. The compositor only measures;
 * it never splits a Text node behind React's reconciliation bookkeeping. */
export declare class TypesetRichText extends Component<TypesetRichTextProps, State> {
    state: State;
    private host;
    private observer?;
    private resize?;
    private releaseCopy?;
    private frame;
    private mounted;
    static getDerivedStateFromProps(props: TypesetRichTextProps, state: State): Partial<State> | null;
    componentDidMount(): void;
    getSnapshotBeforeUpdate(): (() => void) | null;
    componentDidUpdate(previous: TypesetRichTextProps, _state: State, restoreSelection: (() => void) | null): void;
    componentWillUnmount(): void;
    private observe;
    private bindHost;
    private schedule;
    private recompose;
    render(): ReactElement;
}
export {};
