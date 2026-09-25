'use client';

import { createElement, forwardRef } from 'react';
import { TypesetText as Plain, TypesetRichText as Rich } from './typeset-react';
import type { TypesetTextProps, TypesetRichTextProps } from './typeset-react';
export type { TypesetTextProps, TypesetRichTextProps, TypesetAdapterProps, TypesetTag, Priority } from './typeset-react';

/** Plain text composed in a React-owned host. A ref resolves to the host element. */
export const TypesetText = /* @__PURE__ */ forwardRef<HTMLElement, TypesetTextProps>(function TypesetText(props, ref) {
  return createElement(Plain, { ...props, ref, lineBreaks: props.lineBreaks ?? 'unicode', contour: props.contour ?? 'finished' });
});
/** Rich inline markup (links, emphasis) composed by React. A ref resolves to the host element. */
export const TypesetRichText = /* @__PURE__ */ forwardRef<HTMLElement, TypesetRichTextProps>(function TypesetRichText(props, ref) {
  return createElement(Rich, { ...props, ref, lineBreaks: props.lineBreaks ?? 'unicode', contour: props.contour ?? 'finished' });
});
