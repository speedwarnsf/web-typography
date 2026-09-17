'use client';
import { useState } from 'react';
import { TypesetRichText, TypesetText } from 'typeset.us/react';

export default function Specimen() {
  const [updated, setUpdated] = useState(false);
  const [width, setWidth] = useState(280);
  const [quotes, setQuotes] = useState(true);
  const [visible, setVisible] = useState(true);
  const [clicks, setClicks] = useState(0);
  return <section>
    <div className="controls">
      <button id="update" onClick={() => setUpdated(value => !value)}>Change passage</button>
      <button id="toggle" onClick={() => setVisible(value => !value)}>Toggle specimen</button>
      <label>Measure <input id="measure" type="range" min="160" max="480" value={width} onChange={event => setWidth(Number(event.target.value))} /></label>
      <label><input id="quotes" type="checkbox" checked={quotes} onChange={event => setQuotes(event.target.checked)} /> Smart quotes</label>
    </div>
    <div style={{ width, maxWidth: '100%' }}>
      {visible && <TypesetRichText id="react-specimen" lang="en" smartQuotes={quotes ? 'en' : false} opticalHanging>
        {'"Read '}<strong>{updated ? "the artist's letters" : "the curator's notes"}</strong>{' at '}
        <a href="#collection" onClick={event => { event.preventDefault(); setClicks(value => value + 1); }}>the neighborhood gallery</a>
        {'," she said. "There is always another detail to discover."'}
      </TypesetRichText>}
      <TypesetText id="plain-specimen" lang="en" text={updated ? '"The artist has another story to tell."' : '"The neighborhood has a history worth reading."'} smartQuotes={quotes ? 'en' : false} opticalHanging />
    </div>
    <output id="activations" aria-live="polite">{clicks} link activations</output>
  </section>;
}
