import type { Metadata } from 'next';
import Link from 'next/link';
import { BAD_BREAK_FORM, CONTACT_EMAIL, INTEGRATION_FORM, repoDoc } from '@/lib/docs-links';
import '../install/install.css';

export const metadata: Metadata = {
  title: 'Help: questions, bad breaks and security reports',
  description: 'Where to look first, how to check a page with typeset-audit, which issue form to use, how to report a security problem, and what response to expect from a one-person project.',
};

const AUDIT = `npm i -D playwright && npx playwright install chromium
npx typeset-audit --url http://localhost:3000 --selector 'article p'`;

export default function Help() {
  return (
    <main className="in-root">
      <p className="in-label">Help</p>
      <h1>How to get help with Typeset.</h1>
      <p className="in-lede">
        Typeset is written and maintained by one person, Dustin York. Most
        answers are already written down; here is where to look, how to check
        your page, and how to reach him.
      </p>

      <section className="in-section">
        <h2>Look it up</h2>
        <p className="in-lede">
          <Link href="/faq">The FAQ</Link> answers the usual questions: screen
          readers, layout shift, SEO, copying, printing and translation, readers
          without JavaScript, and when the script runs.{' '}
          <Link href="/docs">The docs</Link> cover installing, framework recipes,
          known limitations and every outcome code.
        </p>
      </section>

      <section className="in-section">
        <h2>Check your page</h2>
        <p className="in-lede">
          Every element Typeset handles gets a <code>data-ts-outcome</code>{' '}
          attribute: <code>composed</code>, or the reason it kept the
          browser&rsquo;s layout. Look the reason up in{' '}
          <a href={repoDoc('packages/typeset-v4/OUTCOMES.md')}>OUTCOMES.md</a>.
          To check a whole page, run the audit in a project with typeset.us
          installed:
        </p>
        <div className="in-snippet" data-no-typeset>
          <pre style={{ margin: 0, flex: 1, overflowX: 'auto' }}><code style={{ whiteSpace: 'pre' }}>{AUDIT}</code></pre>
        </div>
        <p className="in-fine">
          It is read-only, uploads nothing, and exits 0 on a pass. For a live
          page, paste its address into <Link href="/fix">the grader</Link>.
        </p>
      </section>

      <section className="in-section">
        <h2>Report a problem</h2>
        <p className="in-lede">
          <strong>A bad line break</strong>, changed text or styling, or a
          paragraph Typeset should have set:{' '}
          <a href={BAD_BREAK_FORM}>open a bad-break issue</a>. It asks for the
          page, width, font, browser, version and the audit output.
        </p>
        <p className="in-lede">
          <strong>A question</strong> about a framework, CMS, CSP, test runner
          or build tool: <a href={INTEGRATION_FORM}>open an integration question</a>.
        </p>
        <p className="in-lede">
          <strong>A security problem:</strong> do not open a public issue. Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with
          &ldquo;typeset.us security&rdquo; in the subject, as the{' '}
          <a href={repoDoc('SECURITY.md')}>security policy</a> describes.
        </p>
        <p className="in-lede">
          <strong>Anything else:</strong>{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="in-section">
        <h2>What to expect</h2>
        <p className="in-lede">
          This is a one-person project. For security reports the policy sets
          targets of an acknowledgement within 3 business days and an
          assessment within 10; other reports are answered as time allows.
          These are targets, not a contract.
        </p>
        <p className="in-lede">
          Typeset is free and MIT licensed. If it helps your work, you can{' '}
          <Link href="/sponsor">sponsor it</Link>.
        </p>
      </section>
    </main>
  );
}
