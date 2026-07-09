import type { Metadata } from 'next';
import Link from 'next/link';
import { INSTALL_ORDER, PLATFORMS, SNIPPET } from '@/lib/platforms';
import '../install/install.css';

export const metadata: Metadata = {
  title: 'Install typeset — one line, any site',
  description:
    'Add book-quality paragraph setting to Ghost, Webflow, Framer, Squarespace, WordPress, Shopify, Wix, or any site that can carry one script tag. Exact click-paths per platform.',
};

export default function InstallIndex() {
  return (
    <main className="in-root">
      <p className="in-label">Install</p>
      <h1>One line. Any site you own.</h1>
      <p className="in-lede">
        Typeset is a single script tag. Every platform below can carry it —
        the only question is which settings screen the paste box lives on.
        Each guide states the required plan before the steps, so nobody
        follows instructions their tier can&rsquo;t use.
      </p>

      <div className="in-snippet" data-no-typeset>
        <code>{SNIPPET}</code>
      </div>
      <p className="in-fine">
        Prefer a pinned build with an integrity hash? Take the exact tag from{' '}
        <a href="/sri.json">sri.json</a>. Not sure it worked? Paste your URL
        into <Link href="/fix">the grader</Link> after — it measures the live
        page.
      </p>

      <div className="in-grid">
        {INSTALL_ORDER.map((key) => {
          const p = PLATFORMS[key];
          return (
            <Link key={key} href={`/install/${key}`} className="in-card">
              <span className="in-card-name">{p.name}</span>
              <span className="in-card-tier" data-no-typeset>{p.tier}</span>
            </Link>
          );
        })}
        <div className="in-card in-card-dead">
          <span className="in-card-name">Substack</span>
          <span className="in-card-tier">
            Allows no custom code — typeset can&rsquo;t run there. A site you
            own can do this.
          </span>
        </div>
      </div>

      <section className="in-mark">
        <p className="in-label">The mark</p>
        <h2>Set with typeset</h2>
        <p className="in-lede">
          A small mark for the foot of a site that cares. It links to a live
          re-grade of the exact page it sits on — a re-runnable claim, not a
          sticker.
        </p>
        <div className="in-badge" data-no-typeset>
          <img src="/badge.svg" alt="Set with typeset" width={132} height={28} />
        </div>
        <div className="in-snippet" data-no-typeset>
          <code>{`<a href="https://typeset.us/fix"><img src="https://typeset.us/badge.svg" alt="Set with typeset" width="132" height="28"></a>`}</code>
        </div>
      </section>
    </main>
  );
}
