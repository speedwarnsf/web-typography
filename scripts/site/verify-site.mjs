// @ts-check
// The typeset.us website as built (`npm run build`), served by `next start`
// on an ephemeral port and checked in Chromium, WebKit and Firefox.
//
//   node scripts/site/verify-site.mjs [--only security,content] [--audit]
//
// security (K10): every page carries a nonce CSP, nosniff and frame
//   protection, and loads with no CSP violation or page error in any of the
//   three engines; pages contact only the hosts /privacy names; security.txt
//   is served; an attacker
//   page run through /audit and /dna executes nothing and cannot restyle the
//   site; a hostile /pairing-cards link inserts nothing into the card it
//   generates; /api/fetch-url refuses loopback, metadata and private addresses and
//   rate-limits; go@4.2.0.js still loads cross-origin with its SRI hash.
//   --audit also requires `npm audit` to report no high or critical issue.
// content (D4, D5): install lines pinned with sri.json's hash; titles,
//   descriptions and og:images; the homepage names its baseline per engine
//   and claims a one-word last line only where the engine produces one;
//   developer links and framework recipes. --network also resolves the
//   GitHub and npm links.
//
// Writes output/site-verification.json. Needs .next from `npm run build`.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { browsers } from '../v4/browsers.mjs';

const { values } = parseArgs({ options: { only: { type: 'string' }, audit: { type: 'boolean', default: false }, network: { type: 'boolean', default: false }, port: { type: 'string' } } });
const sections = new Set((values.only ?? 'security,content').split(','));
/** @type {{ section: string, label: string, pass: boolean, browser?: string, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} section @param {string} label @param {unknown} pass @param {unknown} [detail] @param {string} [browser] */
const check = (section, label, pass, detail, browser) => { checks.push({ section, label, pass: !!pass, ...(browser ? { browser } : {}), ...(pass ? {} : { detail }) }); };
const watchdog = setTimeout(() => { console.error('verify-site: watchdog after 15 minutes'); process.exit(3); }, 15 * 60 * 1000);

/** @returns {Promise<number>} */
const freePort = () => new Promise(accept => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = /** @type {import('node:net').AddressInfo} */ (s.address()); s.close(() => accept(port)); }); });
const port = values.port ? Number(values.port) : await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, detached: true });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });

const ROUTES = ['/', '/about', '/animations', '/audit', '/clamp', '/dna', '/docs', '/essay', '/faq', '/fix', '/font-inspector', '/for-agents', '/help', '/install', '/install/frameworks', '/library', '/list-test', '/pairing-cards', '/perfect-paragraph', '/privacy', '/proof', '/reading-lab', '/rhetoric', '/silver-bullet', '/specimen', '/sponsor', '/utility', '/v2', '/variable-fonts'];
const ATTACK = `<!doctype html><html><head>
<base href="https://attacker.invalid/">
<meta http-equiv="refresh" content="0;url=https://attacker.invalid/">
<script>window.__pwned = 'script'</script>
<style>body { display: none !important } p { font: 19px/1.5 Georgia }</style>
</head><body>
<h1 onmouseover="window.__pwned='handler'">Welcome</h1>
<p>An ordinary paragraph that is long enough to be measured by the audit, with a closing word.</p>
<img src="x" onerror="window.__pwned = 'img onerror'">
<svg onload="window.__pwned = 'svg onload'"><a xlink:href="javascript:window.__pwned='svg href'"><text>t</text></a><animate attributeName="href" to="javascript:window.__pwned='animate'"/></svg>
<iframe srcdoc="<script>parent.__pwned = 'srcdoc'</script>"></iframe>
<object data="javascript:window.__pwned='object'"></object>
<a href="javascript:window.__pwned='href'">link</a>
<form action="javascript:window.__pwned='form'"><button formaction="javascript:window.__pwned='formaction'">b</button></form>
<details open ontoggle="window.__pwned='ontoggle'"><summary>s</summary></details>
</body></html>`;

try {
  for (let n = 0; ; n++) {
    if (server.exitCode !== null) throw new Error('next start exited: ' + serverLog.slice(-1500));
    try { if ((await fetch(base + '/robots.txt')).status < 600) break; } catch {}
    if (n > 150) throw new Error('next start did not answer in 30 s: ' + serverLog.slice(-800));
    await new Promise(r => setTimeout(r, 200));
  }

  if (sections.has('security')) {
    // Headers: a fresh nonce per request, used on the page's scripts.
    const first = await fetch(base + '/'), second = await fetch(base + '/');
    const csp = first.headers.get('content-security-policy') ?? '';
    const html = await first.text();
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    check('security', 'pages send a nonce CSP with strict-dynamic, no unsafe-inline scripts, object-src none and frame-ancestors', !!nonce && /script-src 'self' 'nonce-[^']+' 'strict-dynamic'(;|$)/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'self'/.test(csp) && /base-uri 'self'/.test(csp), csp);
    check('security', 'the nonce changes on every request', nonce && nonce !== /'nonce-([^']+)'/.exec(second.headers.get('content-security-policy') ?? '')?.[1]);
    check('security', "the page's scripts carry the request's nonce", !!nonce && [...html.matchAll(/<script\b[^>]*>/g)].every(m => m[0].includes(`nonce="${nonce}"`)), [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]).filter(t => !t.includes(`nonce="${nonce}"`)).slice(0, 3));
    check('security', 'pages send nosniff, SAMEORIGIN framing and a referrer policy', first.headers.get('x-content-type-options') === 'nosniff' && first.headers.get('x-frame-options') === 'SAMEORIGIN' && first.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', Object.fromEntries(first.headers));
    const pin = await fetch(base + '/go@4.2.0.js');
    check('security', 'go@4.2.0.js: immutable, readable cross-origin, nosniff, no page CSP', /immutable/.test(pin.headers.get('cache-control') ?? '') && pin.headers.get('access-control-allow-origin') === '*' && pin.headers.get('x-content-type-options') === 'nosniff' && !pin.headers.get('content-security-policy') && /javascript/.test(pin.headers.get('content-type') ?? ''), Object.fromEntries(pin.headers));
    for (const path of ['/sri.json', '/release.json', '/for-agents.md', '/capabilities.json', '/llms.txt', '/go.js']) {
      const r = await fetch(base + path);
      check('security', `${path}: served, readable cross-origin, revalidated after 300 s`, r.status === 200 && r.headers.get('access-control-allow-origin') === '*' && /max-age=300/.test(r.headers.get('cache-control') ?? ''), { status: r.status, cache: r.headers.get('cache-control') });
    }

    // fetch-url refuses private targets before connecting.
    for (const target of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://localhost/', 'http://[::1]/', 'http://10.0.0.1/', `http://127.0.0.1:${port}/`, 'file:///etc/passwd']) {
      const r = await fetch(`${base}/api/fetch-url?url=${encodeURIComponent(target)}`, { headers: { 'x-forwarded-for': '198.51.100.7' } });
      const body = await r.json().catch(() => ({}));
      check('security', `/api/fetch-url refuses ${target}`, (r.status === 403 || r.status === 400) && !body.html, { status: r.status, body });
    }

    /** @type {Record<string, Set<string>>} */
    const contactedBy = {};
    for (const config of browsers) {
      const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        for (const route of ROUTES) {
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          /** @type {string[]} */
          const problems = [];
          // Every request this page makes to another origin, by host.
          page.on('request', request => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== base) (contactedBy[url.host] ??= new Set()).add(`${config.name} ${route}`); });
          page.on('pageerror', error => { problems.push('pageerror: ' + error.message.slice(0, 200)); });
          page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|CSP|Refused to/.test(message.text())) problems.push('console: ' + message.text().slice(0, 200)); });
          await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => { (/** @type {any} */ (window).__violations ??= []).push(`${e.violatedDirective} ${e.blockedURI}`); }); });
          try {
            const response = await page.goto(base + route, { waitUntil: 'load' });
            await page.waitForTimeout(700);
            // Route handlers such as /for-agents return text, not a React page.
            const isPage = /text\/html/.test(response?.headers()['content-type'] ?? '');
            const state = await page.evaluate(() => ({ violations: /** @type {any} */ (window).__violations ?? [], hydrated: !!(/** @type {any} */ (window).next || /** @type {any} */ (window).__next_f) }));
            check('security', `${route}: loads under the CSP with no violation or page error`, response?.status() === 200 && state.violations.length === 0 && problems.length === 0 && (state.hydrated || !isPage), { status: response?.status(), isPage, violations: state.violations, problems }, config.name);
            if (route === '/') {
              await page.waitForFunction(() => document.querySelectorAll('[data-ts-outcome^="composed"]').length > 0, undefined, { timeout: 15000 }).catch(() => {});
              const composed = await page.evaluate(() => document.querySelectorAll('[data-ts-outcome^="composed"]').length);
              check('security', '/: the site still composes its own text under the CSP', composed > 0, composed, config.name);
            }
          } catch (error) {
            check('security', `${route}: loads under the CSP with no violation or page error`, false, String(/** @type {Error} */ (error).message).slice(0, 300), config.name);
          } finally { await page.close(); }
        }

        // An attacker page through /audit and /dna (paste-HTML mode).
        for (const route of ['/audit', '/dna']) {
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          try {
            await page.goto(base + route, { waitUntil: 'load' });
            await page.getByRole('button', { name: 'Paste HTML' }).click();
            await page.locator('textarea').fill(ATTACK);
            await page.getByRole('button', { name: route === '/audit' ? 'Analyze' : 'Extract DNA' }).click();
            await page.waitForFunction(route === '/audit' ? () => /Overall Typography Score/i.test(document.body.innerText) : () => /Copy as CSS Custom Properties/i.test(document.body.innerText), undefined, { timeout: 20000 });
            await page.mouse.move(5, 5); await page.waitForTimeout(600);
            const state = await page.evaluate(() => ({ pwned: /** @type {any} */ (window).__pwned ?? null, hidden: getComputedStyle(document.body).display === 'none', url: location.href, base: document.baseURI }));
            check('security', `${route}: attacker HTML runs no script, handler or javascript: URL`, state.pwned === null, state, config.name);
            check('security', `${route}: attacker HTML cannot restyle, redirect or rebase typeset.us`, !state.hidden && state.url === base + route && state.base === base + route, state, config.name);
          } catch (error) {
            check('security', `${route}: attacker HTML runs no script, handler or javascript: URL`, false, String(/** @type {Error} */ (error).message).slice(0, 300), config.name);
          } finally { await page.close(); }
        }

        // A shared /pairing-cards link sets the fonts and colours the card
        // generator renders. Hostile values insert no markup, run nothing,
        // request nothing from another origin and navigate nowhere.
        {
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          /** @type {string[]} */
          const outside = [];
          await page.route(/^https:\/\/attacker\.invalid\//, route => { outside.push(route.request().url()); return route.abort(); });
          const hostile = new URLSearchParams({
            heading: 'Inter<img id="inj" src="https://attacker.invalid/heading.png" onerror="window.__pwned=\'heading\'">',
            body: 'Inter\' onmouseover=\'window.__pwned="body"',
            fg: 'e0e0e0;background:url(https://attacker.invalid/fg.png)',
            bg: '000"><meta http-equiv="refresh" content="0;url=https://attacker.invalid/bg">',
            hc: 'fff"><meta http-equiv="refresh" content="0;url=/faq">',
            bc: 'fff" id="inj2',
          });
          try {
            await page.goto(`${base}/pairing-cards?${hostile}`, { waitUntil: 'load' });
            await page.evaluate(() => {
              const w = /** @type {any} */ (window);
              w.__injected = [];
              new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) for (const el of [/** @type {Element} */ (node), .../** @type {Element} */ (node).querySelectorAll('*')]) if (el.id === 'inj' || el.id === 'inj2' || el.hasAttribute('onerror') || el.hasAttribute('onmouseover') || /refresh/i.test(el.getAttribute('http-equiv') ?? '')) w.__injected.push(el.outerHTML.slice(0, 120)); }).observe(document, { childList: true, subtree: true });
            });
            await page.getByRole('button', { name: 'Generate Cards' }).click();
            await page.waitForFunction(() => document.querySelectorAll('img[src^="data:image/png"]').length >= 2, undefined, { timeout: 20000 });
            await page.waitForTimeout(500);
            const state = await page.evaluate(() => ({ pwned: /** @type {any} */ (window).__pwned ?? null, injected: /** @type {any} */ (window).__injected, url: location.pathname }));
            check('security', '/pairing-cards: hostile query parameters insert no markup, run nothing, request nothing and navigate nowhere', state.pwned === null && state.injected.length === 0 && outside.length === 0 && state.url === '/pairing-cards', { ...state, outside }, config.name);
          } catch (error) {
            check('security', '/pairing-cards: hostile query parameters insert no markup, run nothing, request nothing and navigate nowhere', false, String(/** @type {Error} */ (error).message).slice(0, 300), config.name);
          } finally { await page.close(); }
        }

        // The pinned loader, cross-origin, with SRI, from another origin.
        const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
        const other = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<!doctype html><html lang="en"><body><p style="width:300px;font:18px/1.5 Georgia">A paragraph on another site that loads the pinned loader from typeset.us with its integrity hash and composes this text.</p><script src="${base}/go@4.2.0.js" integrity="${sri.files['go@4.2.0.js']}" crossorigin="anonymous" defer></script></body></html>`); });
        await new Promise(accept => other.listen(0, '127.0.0.1', () => accept(undefined)));
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          await page.goto(`http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (other.address()).port}/`);
          const outcome = await page.evaluate(async () => { await /** @type {any} */ (window).TypesetReady; return { version: /** @type {any} */ (window).Typeset?.VERSION, outcome: document.querySelector('p')?.getAttribute('data-ts-outcome') }; });
          check('security', 'go@4.2.0.js loads cross-origin with its SRI hash and composes', outcome.version === '4.2.0' && /^composed/.test(String(outcome.outcome)), outcome, config.name);
          await page.close();
        } catch (error) {
          check('security', 'go@4.2.0.js loads cross-origin with its SRI hash and composes', false, String(/** @type {Error} */ (error).message).slice(0, 300), config.name);
        } finally { await new Promise(accept => other.close(() => accept(undefined))); }
        await context.close();
      } finally { await browser.close(); }
    }

    // The site sets no trackers: pages contact no origin but their own and
    // the hosts /privacy names (data-host), and /privacy names no host that
    // no page contacts.
    const privacy = await (await fetch(base + '/privacy')).text();
    const listed = [...new Set([...privacy.matchAll(/data-host="([^"]+)"/g)].map(m => m[1]))].sort();
    const contacted = Object.keys(contactedBy).sort();
    check('security', 'pages contact no origin but their own and the hosts /privacy lists, and /privacy lists only hosts pages contact', listed.length > 0 && JSON.stringify(listed) === JSON.stringify(contacted), { listed, contacted: Object.fromEntries(Object.entries(contactedBy).map(([host, where]) => [host, [...where].slice(0, 6)])) });
    const connect = /connect-src ([^;]*)/.exec(csp)?.[1] ?? '';
    check('security', "the page CSP lets scripts connect only to the site itself (connect-src 'self' data:)", connect.trim() === "'self' data:", connect);

    // security.txt (RFC 9116): contact, a policy and an expiry under a year.
    const securityTxt = await fetch(base + '/.well-known/security.txt');
    const fields = Object.fromEntries([...(await securityTxt.text()).matchAll(/^([\w-]+): (.+)$/gm)].map(m => [m[1], m[2].trim()]));
    const expires = Date.parse(fields.Expires ?? '');
    check('security', '/.well-known/security.txt: text/plain with Contact, Expires (under a year away), Policy, Preferred-Languages and Canonical', securityTxt.status === 200 && /^text\/plain/.test(securityTxt.headers.get('content-type') ?? '') && /^mailto:/.test(fields.Contact ?? '') && expires > Date.now() && expires - Date.now() < 365 * 864e5 && /SECURITY\.md$/.test(fields.Policy ?? '') && fields['Preferred-Languages'] === 'en' && fields.Canonical === 'https://typeset.us/.well-known/security.txt', { status: securityTxt.status, type: securityTxt.headers.get('content-type'), fields });

    // Rate limit last: it spends this client's budget.
    const statuses = [];
    for (let n = 0; n < 14; n++) statuses.push((await fetch(`${base}/api/fetch-url?url=${encodeURIComponent('http://127.0.0.1/')}`, { headers: { 'x-forwarded-for': '203.0.113.9' } })).status);
    check('security', '/api/fetch-url rate-limits one client to 12 requests a minute', statuses.slice(0, 12).every(s => s !== 429) && statuses.slice(12).every(s => s === 429), statuses);

    if (values.audit) {
      const audit = spawnSync('npm', ['audit', '--json', ...(process.env.npm_config_cache ? ['--cache', process.env.npm_config_cache] : [])], { encoding: 'utf8', timeout: 120000 });
      const counts = JSON.parse(audit.stdout || '{}').metadata?.vulnerabilities ?? null;
      check('security', 'npm audit reports no high or critical vulnerability', counts && counts.high === 0 && counts.critical === 0, counts);
    }
  }
  if (sections.has('content')) {
    // D4: every install line the site renders is the pinned loader with the
    // integrity hash from public/sri.json; the evergreen go.js appears only
    // with its label.
    const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
    // React separates adjacent text with <!-- --> in server HTML.
    const decode = (/** @type {string} */ html) => html.replace(/<!-- -->/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
    const installIndex = await (await fetch(base + '/install')).text();
    const platforms = [...new Set([...installIndex.matchAll(/href="(\/install\/[a-z-]+)"/g)].map(m => m[1]))];
    for (const route of ['/', '/install', ...platforms, '/utility', '/essay', '/fix']) {
      const response = await fetch(base + route);
      const html = decode(await response.text());
      const snippets = [...html.matchAll(/<script src="https:\/\/typeset\.us\/(go(?:@[\d.]+)?\.js|typeset(?:@[\d.]+\.min)?\.min\.js|typeset@[\d.]+\.min\.js)"([^>]*)>/g)];
      const bad = snippets.filter(([, file, attributes]) => {
        if (/@/.test(file)) return /integrity="([^"]+)"/.exec(attributes)?.[1] !== sri.files[file] || !/crossorigin="anonymous"/.test(attributes);
        return !/never move to 5\.0/.test(html);
      }).map(m => m[0]);
      check('content', `${route}: install lines are pinned with sri.json's integrity (go.js only with its label)`, response.status === 200 && bad.length === 0 && (route === '/fix' || snippets.length > 0), { status: response.status, snippets: snippets.length, bad });
    }

    // D5: titles, descriptions and unfurl images.
    for (const route of ['/', '/sponsor', '/library', '/install/frameworks']) {
      const html = decode(await (await fetch(base + route)).text());
      const meta = (/** @type {string} */ key) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1] ?? null;
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
      const image = meta('og:image');
      let imageOK = false;
      if (image) { const r = await fetch(image.replace(/^https?:\/\/[^/]+/, base)); imageOK = r.status === 200 && /image\/png/.test(r.headers.get('content-type') ?? ''); }
      check('content', `${route}: own title, description and an og:image that renders`, !!title && !!meta('description') && !!meta('og:title') && imageOK, { title, description: meta('description'), image, imageOK });
    }
    check('content', '/privacy has its own title', decode(await (await fetch(base + '/privacy')).text()).includes('<title>Privacy: what typeset.us collects</title>'));
    check('content', '/ and /sponsor have their own titles', decode(await (await fetch(base + '/')).text()).includes('<title>Typeset: better line breaks for web text</title>') && decode(await (await fetch(base + '/sponsor')).text()).includes('<title>Sponsor Typeset'));
    // The Stripe page moved from /support; published 3.x manifests still link there.
    const moved = await fetch(base + '/support', { redirect: 'manual' });
    check('content', '/support redirects permanently (308) to /sponsor', moved.status === 308 && new URL(moved.headers.get('location') ?? '', base).pathname === '/sponsor', { status: moved.status, location: moved.headers.get('location') });
    // Help pages, and menu labels: "Help" and "Sponsor", never "Support".
    const help = decode(await (await fetch(base + '/help')).text());
    check('content', '/help has its own title and links the FAQ, docs, both issue forms, the security policy and Sponsor', help.includes('<title>Help: questions, bad breaks and security reports</title>') && ['href="/faq"', 'href="/docs"', 'template=bad-break.yml', 'template=integration-question.yml', '/SECURITY.md"', 'href="/sponsor"'].every(link => help.includes(link)));
    const menu = await readFile('src/lib/sitemap.ts', 'utf8');
    check('content', 'the menu and command palette name Help and Sponsor, and no page "Support"', /name: "Help"/.test(menu) && /name: "Sponsor"/.test(menu) && !/name: "Support"/.test(menu));

    // D5: the homepage names its baseline by engine and claims only what that
    // engine does; the developer band links to GitHub, npm and the docs.
    const developer = decode(await (await fetch(base + '/')).text());
    for (const [label, href] of [['GitHub', 'https://github.com/speedwarnsf/web-typography'], ['npm', 'https://www.npmjs.com/package/typeset.us'], ['framework recipes', '/install/frameworks'], ['the docs page', '/docs']]) {
      check('content', `homepage links to ${label}`, developer.includes(`href="${href}"`));
    }
    check('content', 'homepage states a measured loader size, not "38 KB", and no "--" dash', !/38(&nbsp;|\s)KB/.test(developer) && !developer.includes('doing -- visible') && /\d+\.\d(&nbsp;|\s)KB gzipped/.test(developer));
    const frameworks = await (await fetch(base + '/install/frameworks')).text();
    check('content', '/install/frameworks has Next.js, Vite, Astro, SvelteKit and Vue recipes', ['Next.js (App Router)', 'Vite + React', 'Astro', 'SvelteKit', 'Vue and Nuxt'].every(t => frameworks.includes(t)));
    // New SvelteKit projects compile every file in runes mode, where
    // `export let` is a build error.
    const plain = frameworks.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/<!-- -->/g, '');
    check('content', '/install/frameworks: the SvelteKit recipe uses $props(), which runes mode requires', plain.includes('let { html } = $props();') && !/^\s*export let html;/m.test(plain));
    // The TypeScript scaffolds (create-vite vue-ts, create-vue --ts) run
    // vue-tsc before building: an untyped ref(null) and controller fail it.
    check('content', '/install/frameworks: the Vue recipe type-checks as TypeScript (typed ref and controller)', plain.includes('<script setup lang="ts">') && plain.includes('ref<HTMLElement | null>(null)') && plain.includes('let controller: ReturnType<typeof mount> | undefined;'));
    for (const config of browsers) {
      const browser = await config.engine.launch({ executablePath: config.executablePath, timeout: 20000 });
      try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        await page.goto(base + '/', { waitUntil: 'load' });
        await page.locator('#v2-squeeze-input').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        const pretty = await page.evaluate(() => /pretty/.test(getComputedStyle(/** @type {HTMLElement} */ (document.querySelector('.v2-panel'))).getPropertyValue('text-wrap-style') || getComputedStyle(/** @type {HTMLElement} */ (document.querySelector('.v2-panel'))).getPropertyValue('text-wrap')));
        const baseline = await page.locator('#v2-baseline').textContent();
        const note = await page.locator('#v2-squeeze-note').textContent();
        let orphanWidths = 0, hangingBrowser = 0, hangingTypeset = 0;
        for (let width = 250; width <= 345; width += 5) {
          await page.locator('#v2-squeeze-input').fill(String(width));
          await page.waitForTimeout(150);
          const row = await page.evaluate(() => [...document.querySelectorAll('.v2-stat-row')].map(r => [...r.querySelectorAll('.v2-stat-vals em')].map(e => e.textContent)));
          hangingBrowser += Number(row[0]?.[0] ?? 0); hangingTypeset += Number(row[0]?.[1] ?? 0);
          if (row[1]?.[0] === 'yes') orphanWidths++;
        }
        const claimsOrphan = /alone on the last line/.test(note ?? '');
        check('content', 'homepage names the baseline by what this engine does', pretty ? /with CSS text-wrap: pretty/.test(baseline ?? '') : /has no text-wrap: pretty/.test(baseline ?? ''), { pretty, baseline }, config.name);
        check('content', 'homepage claims a one-word last line only in an engine that produced one', claimsOrphan ? orphanWidths > 0 : true, { claimsOrphan, orphanWidths, note }, config.name);
        check('content', 'homepage lead claim holds: the browser leaves more short words hanging than Typeset', hangingBrowser > hangingTypeset, { hangingBrowser, hangingTypeset, widths: 20 }, config.name);
        await context.close();
      } finally { await browser.close(); }
    }
    // /docs and /help: every link on this site resolves.
    for (const route of ['/docs', '/help']) {
      const html = await (await fetch(base + route)).text();
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
      const local = [...new Set([...main.matchAll(/href="(\/[^"#]*)"/g)].map(m => m[1]))];
      const broken = [];
      for (const path of local) { const r = await fetch(base + path); if (r.status !== 200) broken.push(`${path} ${r.status}`); }
      check('content', `${route}: every link to this site resolves`, local.length > 0 && broken.length === 0, { local, broken });
    }
    if (values.network) {
      // npmjs.com answers scripts with 403, so the npm link is checked through
      // the registry, which serves the same package.
      for (const [label, url] of [['GitHub link', 'https://github.com/speedwarnsf/web-typography'], ['npm link (registry)', 'https://registry.npmjs.org/typeset.us']]) {
        const r = await fetch(url, { method: 'GET', redirect: 'follow' }).catch(() => null);
        check('content', `${label} resolves: ${url}`, r?.status === 200, r?.status);
      }
      // The repository documents /docs and /help link, at the pinned tag.
      for (const route of ['/docs', '/help']) {
        const html = decode(await (await fetch(base + route)).text());
        const remote = [...new Set([...html.matchAll(/href="(https:\/\/github\.com\/speedwarnsf\/web-typography\/blob\/[^"]+)"/g)].map(m => m[1]))];
        const broken = [];
        for (const url of remote) { const r = await fetch(url, { method: 'GET', redirect: 'follow' }).catch(() => null); if (r?.status !== 200) broken.push(`${url} ${r?.status}`); }
        check('content', `${route}: every repository document it links resolves on GitHub`, remote.length > 0 && broken.length === 0, { remote: remote.length, broken });
      }
    }
  }
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
} finally {
  try { process.kill(-(/** @type {number} */ (server.pid)), 'SIGTERM'); } catch {}
  clearTimeout(watchdog);
}
await mkdir('output', { recursive: true });
await writeFile('output/site-verification.json', JSON.stringify({ base, checks, errors }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures: failures.map(f => ({ browser: f.browser, label: f.label, detail: typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)?.slice(0, 300) })), errors }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
