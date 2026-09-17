'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TypesetRichText } from 'typeset.us/react';
import { measureLayout } from 'typeset.us';

const passages = {
  editorial: 'A small gallery can change the way we see a neighborhood. The photographs, letters, and handwritten notes tell a story that belongs to everyone who has called this place home.',
  product: 'Made for the things you carry every day. Soft canvas, thoughtful pockets, and a shape that feels as good on the morning train as it does on the long way home.',
};
export default function LiveProof() {
  const [sample, setSample] = useState<'editorial' | 'product' | 'custom'>('editorial');
  const [custom, setCustom] = useState(passages.editorial);
  const [width, setWidth] = useState(350);
  const [hanging, setHanging] = useState(true);
  const [details, setDetails] = useState({ nativeLines: 0, typesetLines: 0, outcome: 'Measuring' });
  const root = useRef<HTMLDivElement>(null);
  const text = sample === 'custom' ? custom : passages[sample];
  const children = sample === 'editorial'
    ? <>A small gallery can change the way we see <a href="/v4">a neighborhood</a>. The <strong>photographs, letters, and handwritten notes</strong> tell a story that belongs to everyone who has called this place home.</>
    : text;
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0, stopped = false;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (stopped) return;
        const before = node.querySelector<HTMLElement>('#native-proof'), after = node.querySelector<HTMLElement>('#typeset-proof');
        if (!before || !after) return;
        const outcome = after.dataset.tsOutcome;
        const next = { nativeLines: measureLayout(before).lines.length, typesetLines: measureLayout(after).lines.length, outcome: outcome?.startsWith('composed') ? 'Composed with V4' : outcome?.startsWith('native:') ? 'Native layout retained' : 'Measuring' };
        setDetails(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      });
    };
    const mutation = new MutationObserver(update);
    const specimen = node.querySelector('#typeset-proof');
    if (specimen) mutation.observe(specimen, { attributes: true, attributeFilter: ['data-ts-outcome', 'data-typeset-done'] });
    const resize = new ResizeObserver(update); resize.observe(node);
    document.fonts.ready.then(update); update();
    return () => { stopped = true; mutation.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); };
  }, [sample, custom, width, hanging]);
  return <div ref={root} className="v4-live-proof">
    <div className="v4-proof-controls"><label>Passage <select value={sample} onChange={event => setSample(event.target.value as typeof sample)}><option value="editorial">Editorial / rich text</option><option value="product">Product description</option><option value="custom">Your text</option></select></label><label className="v4-measure">Measure <input aria-label="Text measure" type="range" min={180} max={480} value={width} onChange={event => setWidth(Number(event.target.value))} /><output>{width}px</output></label><label className="v4-check"><input type="checkbox" checked={hanging} onChange={event => setHanging(event.target.checked)} /> Optical hanging</label></div>
    {sample === 'custom' && <label className="v4-custom">Your passage<textarea maxLength={3000} value={custom} onChange={event=>setCustom(event.target.value)} rows={4} /></label>}
    <div className="v4-proof-columns" style={{ '--proof-measure': `${width}px` } as CSSProperties}>
      <div><div className="v4-proof-label"><span>Native browser</span><span>{details.nativeLines || '-'} lines</span></div><div className="v4-specimen"><p id="native-proof">{children}</p></div></div>
      <div><div className="v4-proof-label"><span>Typeset.ts V4</span><span>{details.typesetLines || '-'} lines</span></div><div className="v4-specimen"><TypesetRichText id="typeset-proof" lang="en" opticalHanging={hanging}>{children}</TypesetRichText></div></div>
    </div><div className="v4-proof-result"><output aria-live="polite">{details.outcome}</output><span>Live rendering / source text preserved</span></div>
  </div>;
}
