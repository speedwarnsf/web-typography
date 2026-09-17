'use client';

import { createElement, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { mount, restore, typeset } from './typeset.next';
import type { Mode, Options } from './typeset.next';
export { TypesetRichText } from './typeset-rich-react';
export type { TypesetRichTextProps } from './typeset-rich-react';

export interface TypesetTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> {
  text: string;
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

/**
 * React owns the semantic host and its attributes; this adapter owns only
 * its text subtree. The stable initial child also supplies readable SSR.
 * Inline interactive children belong outside this plain-text adapter.
 */
export function TypesetText({ text, as = 'p', mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, contour, ...attributes }: TypesetTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [initialText] = useState(text);
  const options = useRef<Options>({ text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, contour });
  options.current = { text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, contour };
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const controller = mount(element, '[data-typeset-react]', options.current);
    return () => controller.disconnect();
  }, [as, text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, contour]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) typeset(element, options.current);
    return () => { if (element) restore(element); };
  }, [as, text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, contour]);
  return createElement(as, { ...attributes, ref, 'data-typeset-react': '' }, initialText);
}
