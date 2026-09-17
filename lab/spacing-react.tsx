import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TypesetRichText, TypesetText } from '../src/lib/v4/typeset.release.react';

function Fixture() {
  const [revision, setRevision] = useState(0);
  const [spacing, setSpacing] = useState(true);
  const [visible, setVisible] = useState(true);
  const [clicks, setClicks] = useState(0);
  const text = revision ? 'The exhibition has moved to another room, where visitors can listen to the stories behind each print. A conversation with the artist begins at the end of the afternoon.'
    : 'Your browser does not know what a sentence is. It does not know that a thought should not snap in half, or that a word left alone on a line looks abandoned, because it is. It fills each line until the words run out, and calls that typography.';
  return <>
    <button onClick={() => setRevision(value => value + 1)}>Update source</button>
    <button onClick={() => setSpacing(value => !value)}>Toggle finish</button>
    <button onClick={() => setVisible(value => !value)}>Toggle mount</button>
    <output id="clicks">{clicks}</output>
    {visible && <>
      <TypesetRichText id="rich" spacing={spacing} lang="en">
        {text.slice(0, 36)}<strong>{text.slice(36, 88)}</strong><a href="#linked" onClick={event => {event.preventDefault();setClicks(value => value + 1);}}><em>{text.slice(88, 128)}</em></a>{text.slice(128)}
      </TypesetRichText>
      <TypesetText id="plain" spacing={spacing} lang="en" text={text}/>
    </>}
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>);
