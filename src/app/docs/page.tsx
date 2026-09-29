import type { Metadata } from 'next';
import Link from 'next/link';
import { PINNED_VERSION } from '@/lib/install-snippet';
import { repoDoc } from '@/lib/docs-links';
import '../install/install.css';

export const metadata: Metadata = {
  title: 'Typeset docs: install, recipes, reference',
  description: 'Every Typeset document in one place: installing on any site or framework, the FAQ, help, and the package reference, support contract, outcome codes, migration guide, stability promise and security policy.',
};

// Pages on this site, then the package's own documents as GitHub renders
// them at the tag of the release the site pins.
const SITE: { href: string; name: string; what: string }[] = [
  { href: '/install', name: 'Install', what: 'The pinned script tag, and exact steps for Ghost, WordPress, Webflow, Squarespace, Framer, Wix, Shopify and Google Tag Manager.' },
  { href: '/install/frameworks', name: 'Framework recipes', what: 'npm, React, Next.js, Vite, Astro, SvelteKit, Vue and Nuxt.' },
  { href: '/faq', name: 'FAQ', what: 'Screen readers, layout shift, SEO, copying, printing and translation, readers without JavaScript, and when it runs.' },
  { href: '/help', name: 'Help', what: 'Checking a page, which issue form to use, and how to report a security problem.' },
  { href: '/privacy', name: 'Privacy', what: 'What this site and its host collect, and why the script makes no network requests.' },
];

const REFERENCE: { path: string; name: string; what: string }[] = [
  { path: 'packages/typeset-v4/README.md', name: 'README', what: 'The package guide: install, options, the API, React, auditing in CI.' },
  { path: 'packages/typeset-v4/SUPPORT.md', name: 'SUPPORT.md', what: 'What is tested, in which browsers, and the known limitations.' },
  { path: 'packages/typeset-v4/OUTCOMES.md', name: 'OUTCOMES.md', what: 'Every data-ts-outcome code: what it means and what to do.' },
  { path: 'packages/typeset-v4/MIGRATION.md', name: 'MIGRATION.md', what: 'Moving from an earlier version.' },
  { path: 'STABILITY.md', name: 'STABILITY.md', what: 'What a version number promises, and when rendering may change.' },
  { path: 'SECURITY.md', name: 'SECURITY.md', what: 'Supported versions and how to report a vulnerability.' },
  { path: 'CHANGELOG.md', name: 'CHANGELOG.md', what: 'What changed in every release, with rendering changes counted.' },
];

export default function Docs() {
  return (
    <main className="in-root">
      <p className="in-label">Docs</p>
      <h1>Everything written about Typeset.</h1>
      <p className="in-lede">
        Start with the install page for a site you run, or the framework
        recipes for an app. The reference documents describe Typeset{' '}
        {PINNED_VERSION}, the version this site installs.
      </p>

      <section className="in-section">
        <h2>On this site</h2>
        <dl className="in-docs">
          {SITE.map(({ href, name, what }) => (
            <div key={href}>
              <dt><Link href={href}>{name}</Link></dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="in-section">
        <h2>Reference, for {PINNED_VERSION}</h2>
        <dl className="in-docs">
          {REFERENCE.map(({ path, name, what }) => (
            <div key={path}>
              <dt><a href={repoDoc(path)}>{name}</a></dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <p className="in-fine">
          On GitHub, at tag v{PINNED_VERSION}. The same files ship inside the
          npm package, and the release archive keeps them at{' '}
          <a href={`/releases/${PINNED_VERSION}/`}>/releases/{PINNED_VERSION}/</a>.
        </p>
      </section>
    </main>
  );
}
