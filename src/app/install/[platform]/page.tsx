import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INSTALL_ORDER, PLATFORMS, SNIPPET } from '@/lib/platforms';
import '../install.css';

// These pages exist to capture "add custom code to <platform>" intent and
// answer it in one screen: tier first, exact click-path, one snippet, then
// verify with the grader.

export function generateStaticParams() {
  return INSTALL_ORDER.map((platform) => ({ platform }));
}

export async function generateMetadata({ params }: { params: Promise<{ platform: string }> }): Promise<Metadata> {
  const { platform } = await params;
  const p = PLATFORMS[platform];
  if (!p) return {};
  return {
    title: `Add typeset to ${p.name} — one line`,
    description: `Exact steps to add book-quality paragraph setting to ${p.name}: ${p.path.join(' → ')}. ${p.tier ?? ''}`,
  };
}

export default async function InstallPlatform({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const p = PLATFORMS[platform];
  if (!p || platform === 'unknown') notFound();

  return (
    <main className="in-root">
      <p className="in-label">Install — {p.name}</p>
      <h1>Add typeset to {p.name}</h1>
      {p.tier && <p className="in-tier" data-no-typeset>{p.tier}</p>}
      {p.note && <p className="in-note">{p.note}</p>}

      <ol className="in-path">
        {p.path.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="in-snippet" data-no-typeset>
        <code>{SNIPPET}</code>
      </div>
      <p className="in-fine">
        That&rsquo;s the whole install. Every paragraph on the page is set
        like a book and re-measured against the live rendering — if the
        engine can&rsquo;t improve a paragraph, it restores the original
        rather than ship a mistake. Then prove it worked: paste your URL into{' '}
        <Link href="/fix">the grader</Link> — it confirms the script is on the
        page and re-sets your opening paragraph both ways.
      </p>

      <Link className="in-back" href="/install">
        ← All platforms
      </Link>
    </main>
  );
}
