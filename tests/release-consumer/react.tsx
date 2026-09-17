import { TypesetText, TypesetRichText } from 'typeset.us/react';
export const plain = <TypesetText as="h2" lang="en" text="The End of Oak Street" opticalHanging smartQuotes="en" />;
export const rich = <TypesetRichText lang="en" smartQuotes="en" opticalHanging>Read <a href="/notes"><strong>the notes</strong></a>.</TypesetRichText>;
