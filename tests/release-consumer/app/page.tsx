import { TypesetRichText } from 'typeset.us/react';
import Specimen from './specimen';

export default function Page() {
  return <main>
    <h1>Typeset.ts 4</h1>
    <TypesetRichText id="server-rich" lang="en" smartQuotes="en" opticalHanging>
      {'"A room for looking closely," says '}<strong>the curator</strong>{', "and a place to begin again."'}
    </TypesetRichText>
    <Specimen />
    <ul className="ts-styled" id="declarative-list">
      <li>Photographs from the neighborhood.</li>
      <li>Letters, sketches, and annotated maps.</li>
    </ul>
  </main>;
}
