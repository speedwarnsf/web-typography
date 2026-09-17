'use client';

import { createElement } from 'react';
import { TypesetText as Plain, TypesetRichText as Rich } from './typeset-react';
import type { TypesetTextProps, TypesetRichTextProps } from './typeset-react';
export type { TypesetTextProps, TypesetRichTextProps } from './typeset-react';

export function TypesetText(props: TypesetTextProps) {
  return createElement(Plain, { ...props, lineBreaks: props.lineBreaks ?? 'unicode', contour: props.contour ?? 'finished' });
}
export function TypesetRichText(props: TypesetRichTextProps) {
  return createElement(Rich, { ...props, lineBreaks: props.lineBreaks ?? 'unicode', contour: props.contour ?? 'finished' });
}
