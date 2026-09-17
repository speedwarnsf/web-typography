'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import CopyAction from './CopyAction';
import { V4_BASE, V4_PACKAGE } from '@/lib/v4-release';
import manifest from '../../../vendor/typeset-v4/dist/manifest.json';

const samples = {
  Script: `<p data-typeset>Your carefully written paragraph.</p>\n\n<script\n  src="${V4_BASE}/go.js"\n  integrity="${manifest.artifacts['go.js'].integrity}"\n  crossorigin="anonymous"\n  defer\n></script>`,
  React: `import { TypesetRichText } from 'typeset.us/react';\n\nexport function Story() {\n  return (\n    <TypesetRichText id="story" lang="en">\n      Read <strong>the story</strong> at{' '}\n      <a href="/journal">our journal</a>.\n    </TypesetRichText>\n  );\n}`,
  DOM: `import { mount, auditJSON } from 'typeset.us';\n\nconst controller = mount(document, 'article p');\nawait controller.ready;\nconsole.log(auditJSON('article p'));\n\n// On teardown, restore content and release observers.\ncontroller.disconnect();`,
};
type Tab = keyof typeof samples;
const tabs = Object.keys(samples) as Tab[];
export default function Installer() {
  const [tab, setTab] = useState<Tab>('Script');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next]); buttons.current[next]?.focus();
  }
  return <div>
    <div className="v4-tabs" role="tablist" aria-label="Installation method">{tabs.map((name, index)=><button key={name} ref={node=>{buttons.current[index]=node;}} role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={tab===name} tabIndex={tab===name?0:-1} onKeyDown={event=>navigate(event,index)} onClick={()=>setTab(name)}>{name}</button>)}</div>
    <div className="v4-tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
      {tab !== 'Script' && <><p>Install the exact V4 beta package. The npm <code>latest</code> tag remains V3.</p><div className="v4-code"><pre><code>{`npm install ${V4_PACKAGE}`}</code></pre><CopyAction text={`npm install ${V4_PACKAGE}`} label="Copy package command" /></div></>}
      <div className="v4-code"><pre><code>{samples[tab]}</code></pre><CopyAction key={tab} text={samples[tab]} label={`Copy ${tab} snippet`} /></div>
      <p>{tab==='Script' ? 'The V4 loader targets only elements marked data-typeset. Do not use it on text owned by React or another rendering framework.' : tab==='React' ? 'The tested React target is 19.2.3. Use the adapters for framework-owned text. Ordinary links, bold, and italics are supported; independently stateful custom children retain native rendering.' : 'Choose a narrow prose selector. Mount waits for fonts and observes size and source changes. Never overlap owners or target framework-rendered text.'}</p>
    </div>
  </div>;
}
