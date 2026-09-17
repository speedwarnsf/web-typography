import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Braces, Link2, Quote, List, ScanLine, Undo2 } from 'lucide-react';
import V4Shell from './Shell';
import LiveProof from './LiveProof';
import CopyAction from './CopyAction';
import { AGENT_PROMPT } from '@/lib/v4-release';

export const metadata: Metadata = {
  title: 'Typeset.ts V4 | Better lines. Richer text. Built for the web.',
  description: 'Meet Typeset.ts V4 beta: markup-aware composition, links and emphasis intact, optical hanging, smart quotes, and a verifiable workflow for coding agents. Free and MIT licensed.',
  alternates: { canonical: 'https://typeset.us' },
  openGraph: { title: 'Typeset.ts V4. Your words deserve better lines.', description: 'Rich text, carefully composed. Made for designers. Ready for coding agents. Free and open source.', url: 'https://typeset.us', siteName: 'Typeset.ts', images: [{ url: 'https://typeset.us/v4/social.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Typeset.ts V4', images: ['https://typeset.us/v4/social.png'] },
};
const features = [
  { icon: Link2, title: 'Your markup stays yours.', text: 'Links, bold and italics are measured as styled text. Better line breaks without flattening the meaning out of your HTML.' },
  { icon: Quote, title: 'Details that make the difference.', text: 'Opt-in optical hanging and English smart quotes bring the small refinements that make type feel considered.' },
  { icon: List, title: 'Lists with a lighter touch.', text: 'Reversible prose-list styling uses real browser markers. List semantics stay intact; navigation and ordered lists stay yours.' },
  { icon: Braces, title: 'React has its own way in.', text: 'Dedicated text and rich-text adapters keep React in control of rendering, source changes, and component lifecycles.' },
  { icon: ScanLine, title: 'Results you can inspect.', text: 'A JSON audit and an installed CLI expose composition, overflow, review items, and the reasons native layout is retained.' },
  { icon: Undo2, title: 'A considered intervention.', text: 'Unsupported content stays native. DOM changes are reversible. You choose the scope, the craft options, and when to roll back.' },
];
export default function Home() {
  const schema = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Typeset.ts', softwareVersion: '4.0.0-beta.1', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web browser', url: 'https://typeset.us', license: 'https://opensource.org/license/mit', description: metadata.description, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Dustin York' } };
  return <V4Shell><main id="main" className="v4-main">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    <section className="v4-hero" aria-labelledby="release-title">
      <Image src="/v4/release-art.png" alt="" fill priority sizes="100vw" className="v4-hero-art" />
      <div className="v4-hero-copy"><p className="v4-eyebrow">A new chapter / V4 beta is here</p>
        <h1 id="release-title">Typeset.ts <span className="v4-sr">4</span></h1>
        <p className="v4-hero-line">Your words deserve<br />better lines.</p>
        <p className="v4-hero-description">Rich text, carefully composed. Made for designers. Ready for the agents who build the web.</p>
        <div className="v4-actions"><Link href="/v4" className="v4-button v4-button-dark">Get V4 beta <ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#proof" className="v4-text-link">See the difference <ArrowRight size={17} aria-hidden="true" /></a></div>
        <p className="v4-hero-note">Free. Open source. No engine telemetry.</p>
      </div>
    </section>
    <div className="v4-release-strip"><span>Now with markup-aware composition</span><span>DOM + React</span><span>Measured. Reversible. Yours.</span></div>
    <section id="proof" className="v4-section v4-proof"><div className="v4-section-heading"><p className="v4-eyebrow">01 / The difference is in the lines</p><h2>Same words.<br />A more considered setting.</h2><p>Not a screenshot. Both versions are rendered by your browser, with the same text, font, and available width.</p></div><LiveProof /></section>
    <section id="new" className="v4-section v4-craft"><div className="v4-section-heading"><p className="v4-eyebrow">02 / New in V4</p><h2>More of the web.<br />More of the craft.</h2><p>Editorial stories. Product descriptions. Documentation. The words that carry your site deserve the same care as everything around them.</p></div>
      <div className="v4-feature-grid">{features.map(({icon: Icon,title,text},i)=><article key={title}><div className="v4-feature-index"><Icon size={23} strokeWidth={1.5} aria-hidden="true" /><span>0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section className="v4-section v4-agent-band"><div><p className="v4-eyebrow">03 / Good taste. Clear instructions.</p><h2>Your agent can<br />care about type, too.</h2><p>A precise installation contract. A pinned release. A measurable audit. Give your coding agent the tools to make better typographic decisions, not another vague instruction to make it look better.</p><div className="v4-actions"><CopyAction text={AGENT_PROMPT} label="Copy agent prompt" className="v4-button-green" /><Link href="/agents" className="v4-text-link">The agent workflow <ArrowRight size={17} aria-hidden="true" /></Link></div></div><div className="v4-agent-sequence"><span>01 <strong>Read the contract</strong></span><span>02 <strong>Compare with native</strong></span><span>03 <strong>Install with intent</strong></span><span>04 <strong>Audit. Report. Refine.</strong></span><a href="/v4/capabilities.json">capabilities.json <ArrowUpRight size={16} aria-hidden="true" /></a></div></section>
    <section className="v4-section v4-evidence"><div className="v4-section-heading"><p className="v4-eyebrow">04 / A release with receipts</p><h2>Care is in the testing, too.</h2></div><dl><div><dt>12,966</dt><dd>comparison and fuzz cases</dd></div><div><dt>1,342</dt><dd>recorded checks passed</dd></div><div><dt>3 engines</dt><dd>Chromium, WebKit, Firefox</dd></div></dl><p>Clean Node 22 installation. Reproducible artifacts. Real macOS clipboard tests. V4 is a beta: physical-device and spoken screen-reader acceptance remain unverified. Native fallback is a decision, not a promise of perfect typography.</p><Link href="/v4#evidence" className="v4-text-link">Read the evidence and support range <ArrowRight size={17} aria-hidden="true" /></Link></section>
    <section className="v4-section v4-last"><p className="v4-eyebrow">One more detail, done with care.</p><h2>Put better type<br />into the world.</h2><Link href="/v4" className="v4-button v4-button-dark">Start with V4 <ArrowUpRight size={18} aria-hidden="true" /></Link><p>Already using Typeset? <Link href="/v4#migration">Take the explicit upgrade path.</Link></p></section>
  </main></V4Shell>;
}
