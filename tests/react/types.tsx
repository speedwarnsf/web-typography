// Consumer TypeScript contract for typeset.us/react, compiled by
// scripts/v4/verify-react-node.mjs against the candidate's declarations with
// @types/react 18.3 and 19.2 and skipLibCheck off.
import { createRef, useRef } from 'react';
import type { ReactElement } from 'react';
import { TypesetRichText, TypesetText, whenSettled } from 'typeset.us/react';
import type { Priority, TypesetRichTextProps, TypesetTag, TypesetTextProps } from 'typeset.us/react';
import type { Result } from 'typeset.us';
import { whenSettled as settledCore } from 'typeset.us';
import type { Settled } from 'typeset.us';

const objectRef = createRef<HTMLElement>();
const onResult = (result: Result) => { void result.outcome; void result.features?.spacing; };
const tags: TypesetTag[] = ['p', 'h1', 'h6', 'span', 'div', 'li', 'blockquote', 'figcaption', 'dd', 'dt', 'td', 'th', 'caption', 'label', 'legend', 'summary'];
const priority: Priority = 'sync';
const props: TypesetTextProps = { text: 'A title', as: 'h2', mode: 'title', keep: ['New York'], priority, onResult };
const richProps: TypesetRichTextProps = { children: 'Text', as: 'figcaption', smartQuotes: 'en' };
// whenSettled() (4.4): the same promise from both entries.
const settled: Promise<Settled> = whenSettled({ timeout: 5000 });
void settled.then(({ settled: done }) => done satisfies boolean);
void settledCore();
// @ts-expect-error: the timeout is a number of milliseconds
void whenSettled({ timeout: '5s' });

export function Consumer(): ReactElement {
  const callback = useRef<HTMLElement | null>(null);
  return <>
    <TypesetText as="div" ref={objectRef} text="A block" onResult={onResult} priority="auto" />
    <ul><TypesetText as="li" text="An item" /></ul>
    <table><tbody><tr><TypesetText as="td" colSpan={2} text="A cell" /></tr></tbody></table>
    <TypesetText as="label" htmlFor="field" text="A label" />
    <TypesetRichText as="blockquote" cite="https://example.com" ref={node => { callback.current = node; }} onResult={onResult}>
      Read <a href="/notes">the notes</a>.
    </TypesetRichText>
    <TypesetText {...props} />
    <TypesetRichText {...richProps} />
    {tags.map(tag => <TypesetText key={tag} as={tag} text={tag} />)}
    {/* @ts-expect-error: a button is interactive and not a supported host */}
    <TypesetText as="button" text="No" />
    {/* @ts-expect-error: priority is 'auto' or 'sync' */}
    <TypesetText priority="later" text="No" />
  </>;
}
