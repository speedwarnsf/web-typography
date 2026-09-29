import type { Metadata } from 'next';
import Link from 'next/link';
import { NPM_INSTALL } from '@/lib/install-snippet';
import '../install/install.css';

// Every statement here is checked: scripts/site/verify-site.mjs loads every
// route in three browsers and requires the hosts pages contact to be exactly
// the data-host entries below. Change the page when the site changes.

export const metadata: Metadata = {
  title: 'Privacy: what typeset.us collects',
  description: 'typeset.us sets no cookies and runs no analytics. What its host logs, which tools contact another site, and why the Typeset script and npm package make no network requests.',
};

const host = (name: string) => <code data-host={name}>{name}</code>;

export default function Privacy() {
  return (
    <main className="in-root">
      <p className="in-label">Privacy</p>
      <h1>What typeset.us collects.</h1>
      <p className="in-lede">
        Very little. This page covers the typeset.us website and the files it
        hosts for other sites. Last updated 29 September 2026.
      </p>

      <section className="in-section">
        <h2>No cookies, analytics or trackers</h2>
        <p className="in-lede">
          The site sets no cookies, stores nothing in your browser, and runs no
          analytics, advertising or session-recording scripts. An earlier
          version sent a notification to a public ntfy.sh channel on every page
          view; that has been removed.
        </p>
      </section>

      <section className="in-section">
        <h2>What the host logs</h2>
        <p className="in-lede">
          typeset.us is hosted by Vercel. Like any web host, Vercel receives
          each request, including your IP address, your browser&rsquo;s user
          agent, the address requested and the time, and keeps its logs under{' '}
          <a href="https://vercel.com/legal/privacy-policy">Vercel&rsquo;s privacy policy</a>.
          typeset.us adds nothing to those logs and runs no analysis on them.
        </p>
      </section>

      <section className="in-section">
        <h2>Tools that contact another site</h2>
        <p className="in-lede">
          <strong>Google Fonts.</strong> The font tools (
          <Link href="/library">Library</Link>, <Link href="/pairing-cards">Pairing Builder</Link>,{' '}
          <Link href="/specimen">Specimen</Link>, <Link href="/variable-fonts">Variable Fonts</Link>{' '}
          and <Link href="/animations">Animations</Link>) load typefaces from
          Google Fonts, so your browser requests them from {host('fonts.googleapis.com')} and{' '}
          {host('fonts.gstatic.com')}, and Google receives your IP address and
          user agent under{' '}
          <a href="https://developers.google.com/fonts/faq/privacy">its Google Fonts privacy terms</a>.
          Every other page uses fonts served by typeset.us itself.
        </p>
        <p className="in-lede">
          <strong>Pages you ask it to read.</strong> <Link href="/audit">Audit</Link>,{' '}
          <Link href="/dna">Font DNA</Link> and <Link href="/fix">the grader</Link>{' '}
          read a page whose address you enter. The typeset.us server fetches that
          page once and hands the HTML back to your browser; it stores nothing.
          The address you enter is part of your request to typeset.us, so it
          appears in the host&rsquo;s request log. To limit abuse, the server
          keeps each client&rsquo;s IP address and request times in memory for
          one minute. Audit and Font DNA then show the page with its own
          stylesheets, fonts and images, which your browser loads from wherever
          that page keeps them.
        </p>
        <p className="in-lede">
          <strong>Fonts you open.</strong> A font file you open in{' '}
          <Link href="/font-inspector">Font Inspector</Link>, Specimen or
          Variable Fonts is read in your browser and never uploaded.
        </p>
        <p className="in-lede">
          <strong>Payments.</strong> The <Link href="/sponsor">sponsor page</Link>{' '}
          links to Stripe. Nothing reaches Stripe until you follow a link, and
          Stripe handles the payment under{' '}
          <a href="https://stripe.com/privacy">its privacy policy</a>.
        </p>
      </section>

      <section className="in-section">
        <h2>The hosted Typeset script</h2>
        <p className="in-lede">
          When a site loads <code>go@&lt;version&gt;.js</code> or another file
          from typeset.us, the request reaches Vercel like any other and lands in
          the same logs, and your browser may tell Vercel which site loaded it.
          typeset.us sets no cookies on these files and does not analyse the
          requests.
        </p>
        <p className="in-lede">
          Once loaded, the script makes no network requests of its own: no fetch,
          XMLHttpRequest, sendBeacon or WebSocket, no cookies, no storage and no
          telemetry. It changes only the text it composes.
        </p>
        <p className="in-lede">
          A site that must keep its readers&rsquo; requests off typeset.us can
          install from npm (<code>{NPM_INSTALL}</code>) and serve the files from
          its own domain, or load the same file from jsDelivr, which then handles
          the requests under{' '}
          <a href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net">jsDelivr&rsquo;s privacy policy</a>.
        </p>
      </section>

      <section className="in-section">
        <h2>The npm package</h2>
        <p className="in-lede">
          The <code>typeset.us</code> package makes no network requests, sets no
          cookies, uses no storage and has no install scripts. Its{' '}
          <code>typeset-audit</code> command opens only the page you give it, in
          a browser on your machine, and uploads no report.
        </p>
      </section>

      <section className="in-section">
        <h2>Contact</h2>
        <p className="in-lede">
          Questions or corrections: <a href="mailto:dyork@typeset.us">dyork@typeset.us</a>.
          Security problems: see the{' '}
          <a href="https://github.com/speedwarnsf/web-typography/blob/master/SECURITY.md">security policy</a>.
        </p>
      </section>
    </main>
  );
}
