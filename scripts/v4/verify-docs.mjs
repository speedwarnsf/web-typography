// @ts-check
// The docs describe the code and the release they ship with (D1-D6):
//
// - outcomes: every outcome and feature-status code the engine writes is in
//   src/lib/v4/outcomes.ts and nothing there is unused; OUTCOMES.md and
//   docs/outcomes.md are regenerated; `Outcome` supports an exhaustive
//   switch; every option has a documented default.
// - stability: STABILITY.md states the promise; site pages take install
//   lines from public/sri.json; pinned snippets in the docs carry
//   crossorigin and the right integrity (before the cut, the placeholder
//   release-cut fills).
// - readme: the package README introduces the product in order, covers every
//   option, links only absolutely and to things that exist, and names the
//   release it ships with; the root README's install block is generated.
// - claims: no v3-era claim (audit() returns [], 1.6 ms per paragraph, 20 KB,
//   English only, ...) in current docs, the site or SKILL.md's frontmatter;
//   SUPPORT.md's known limitations and /faq cover the standard objections;
//   the CHANGELOG has the published and the next version.
// - community: contributor files and issue forms exist and ask for what a
//   report needs (`--community` also reads GitHub's community profile).
//
// `--network` also fetches every external README link.
//
// Later sections are added by the other docs items. TODO(docs-sync) anchors
// are counted and listed; release-cut refuses to cut while any remain.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { renderOutcomes, OUTCOME_FILES } from './outcomes-doc.mjs';

/** @type {{ section: string, label: string, pass: boolean, detail?: unknown }[]} */
const checks = [];
/** @type {string[]} */
const errors = [];
/** @param {string} section @param {string} label @param {unknown} pass @param {unknown} [detail] */
const check = (section, label, pass, detail) => { checks.push({ section, label, pass: !!pass, ...(pass ? {} : { detail }) }); };

// Codes only the retained v3 helpers in typeset.ts write; 4.x entry points
// never report them, so they are not part of `Outcome`.
const LEGACY_V3 = { 'skipped:short': 'src/lib/v4/typeset.ts', 'skipped:non-english': 'src/lib/v4/typeset.ts' };

try {
  // outcomes
  const modulePath = resolve(`output/outcomes-${process.pid}.mjs`);
  await mkdir('output', { recursive: true });
  await build({ entryPoints: ['src/lib/v4/outcomes.ts'], bundle: true, format: 'esm', outfile: modulePath, logLevel: 'silent' });
  const { OUTCOMES, FEATURE_STATUSES } = await import(pathToFileURL(modulePath).href);
  await rm(modulePath, { force: true });
  const listed = new Set([...OUTCOMES, ...Object.values(FEATURE_STATUSES).flat()]);
  /** @type {Map<string, Set<string>>} */
  const found = new Map();
  for (const file of (await readdir('src/lib/v4')).filter(f => /\.tsx?$/.test(f) && !['outcomes.ts', 'outcome-docs.ts'].includes(f))) {
    const text = await readFile(`src/lib/v4/${file}`, 'utf8');
    for (const [, code] of text.matchAll(/['`"]((?:native|composed|skipped|applied):[a-z-]+|composed|unmeasurable)['`"]/g)) {
      if (!found.has(code)) found.set(code, new Set());
      /** @type {Set<string>} */ (found.get(code)).add(file);
    }
  }
  const missing = [...found.keys()].filter(code => !listed.has(code) && !(code in LEGACY_V3));
  check('outcomes', 'every outcome and feature-status code in src/lib/v4 is listed in outcomes.ts', missing.length === 0, missing.map(code => `${code} (${[.../** @type {Set<string>} */ (found.get(code))].join(', ')})`));
  const prefixed = [...listed].filter(code => /:/.test(code) || code === 'composed' || code === 'unmeasurable');
  const unused = prefixed.filter(code => !found.has(code));
  check('outcomes', 'every code in outcomes.ts is written somewhere in the engine', unused.length === 0, unused);
  const legacyElsewhere = Object.entries(LEGACY_V3).filter(([code, file]) => [.../** @type {Set<string>} */ (found.get(code) ?? new Set())].some(f => `src/lib/v4/${f}` !== file));
  check('outcomes', 'v3-only codes (skipped:short, skipped:non-english) appear only in the retained v3 helpers', legacyElsewhere.length === 0, legacyElsewhere);
  const rendered = await renderOutcomes();
  for (const file of OUTCOME_FILES) check('outcomes', `${file} is generated from outcome-docs.ts (npm run docs:outcomes)`, (await readFile(file, 'utf8').catch(() => '')) === rendered);
  const pkg = JSON.parse(await readFile('packages/typeset-v4/package.json', 'utf8'));
  check('outcomes', 'the package publishes OUTCOMES.md', pkg.files.includes('OUTCOMES.md'), pkg.files);

  // A consumer can switch exhaustively over Outcome, and unknown strings still compile.
  const consumer = resolve(`output/outcome-consumer-${process.pid}.ts`);
  await writeFile(consumer, [
    "import type { Outcome, Result, FeatureStatus } from '../src/lib/v4/typeset.release';",
    "import { OUTCOMES } from '../src/lib/v4/typeset.release';",
    'export function label(outcome: Outcome): string {',
    '  switch (outcome) {',
    ...OUTCOMES.map((/** @type {string} */ code) => `    case '${code}': return '${code}';`),
    '    default: { const unreachable: never = outcome; return unreachable; }',
    '  }',
    '}',
    "export const future: Result['outcome'] = 'native:some-future-code';",
    "export const known: Result['outcome'] = OUTCOMES[0];",
    "export const status: FeatureStatus = 'native:spacing-verification';",
    '',
  ].join('\n'));
  try {
    execFileSync('node_modules/.bin/tsc', ['--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--jsx', 'react-jsx', '--lib', 'es2022,dom,dom.iterable', consumer], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    check('outcomes', 'a strict consumer switches exhaustively over Outcome, and Result.outcome still accepts other strings', true);
  } catch (error) {
    check('outcomes', 'a strict consumer switches exhaustively over Outcome, and Result.outcome still accepts other strings', false, String(/** @type {{ stdout?: string }} */ (error).stdout).slice(0, 800));
  } finally { await rm(consumer, { force: true }); }

  // Every option documents its default.
  const engine = await readFile('src/lib/v4/typeset.next.ts', 'utf8');
  const options = /export interface Options \{([\s\S]*?)\n\}/.exec(engine)?.[1] ?? '';
  const undocumented = [...options.matchAll(/(\/\*\*[\s\S]*?\*\/\s*)?\n\s*(\w+)\?:/g)].filter(([, doc, name]) => name !== 'text' && !/Default/.test(doc ?? '')).map(m => m[2]);
  check('outcomes', 'every Options field states its default in JSDoc', options && undocumented.length === 0, undocumented);
  check('outcomes', 'the lineBreaks JSDoc names unicode as the default', /Default `'unicode'`/.test(options));
  // stability (D4): a written promise, and pinned-first install lines.
  const changelog = await readFile('CHANGELOG.md', 'utf8');
  const target = /^## (\d+\.\d+\.\d+(?:-[\w.]+)?)\b/m.exec(changelog)?.[1] ?? '';
  const released = pkg.version === target;
  const sri = JSON.parse(await readFile('public/sri.json', 'utf8'));
  const stability = await readFile('STABILITY.md', 'utf8').catch(() => '');
  for (const [label, pattern] of /** @type {[string, RegExp][]} */ ([
    ['API names', /API names/], ['auditJSON schemaVersion', /schemaVersion/], ['outcome codes', /Outcome codes/], ['default rendering only for verified defects', /only to fix a\s+verified defect/],
    ['a "Rendering changes" list with golden-diff counts', /"Rendering changes"[\s\S]*number of test\s+paragraphs/], ['exact installs (npm i -E)', /npm i -E typeset\.us@/], ['go.js never moves to 5.0', /never move to 5\.0/], ['release cadence', /two to four weeks/],
  ])) check('stability', `STABILITY.md covers ${label}`, pattern.test(stability));
  check('stability', `the CHANGELOG's first version (${target}) is the package version or the next release`, !!target && (released || /^## \d+\.\d+\.\d+ - Unreleased$/m.test(changelog.split('\n').find(line => line.startsWith(`## ${target}`)) ?? '')), { target, package: pkg.version });
  /** @type {string[]} */
  const hardcoded = [];
  const ALLOWED = new Set(['src/lib/install-snippet.ts', 'src/app/fix/page.tsx', 'src/lib/go-entry.ts', 'src/lib/typeset.standalone.ts']);
  /** @param {string} dir */
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (!['v4', 'vendor'].includes(entry.name)) await walk(path); continue; }
      if (!/\.(tsx?|mjs)$/.test(entry.name) || ALLOWED.has(path)) continue;
      const text = await readFile(path, 'utf8');
      if (/<script src="https:\/\/typeset\.us\/(?:go|typeset)[^"]*"/.test(text)) hardcoded.push(path);
    }
  };
  await walk('src');
  check('stability', 'site pages take install lines from src/lib/install-snippet.ts (public/sri.json), not hard-coded URLs', hardcoded.length === 0, hardcoded);
  const docs = { 'packages/typeset-v4/README.md': await readFile('packages/typeset-v4/README.md', 'utf8'), 'STABILITY.md': stability, 'README.md': await readFile('README.md', 'utf8') };
  for (const [file, text] of Object.entries(docs)) {
    const snippets = [...text.matchAll(/<script src="https:\/\/(?:typeset\.us\/go@|cdn\.jsdelivr\.net\/npm\/typeset\.us@)([\d.]+(?:-[\w.]+)?)(?:\.js|\/dist\/auto\.js)"([^>]*)>/g)];
    const wrong = snippets.filter(([, version, attributes]) => {
      if (!/crossorigin="anonymous"/.test(attributes)) return true;
      const integrity = /integrity="([^"]+)"/.exec(attributes)?.[1];
      if (version !== target) return integrity !== sri.files[`go@${version}.js`];
      return released ? integrity !== sri.files[`go@${version}.js`] : integrity !== 'sha384-FILLED-BY-RELEASE-CUT';
    }).map(m => m[0]);
    check('stability', `${file}: every pinned loader snippet has crossorigin and the right integrity (${released ? 'from sri.json' : 'the release-cut placeholder for ' + target})`, wrong.length === 0, wrong);
  }
  const exists = async (/** @type {string} */ path) => readFile(path).then(() => true, () => false);
  // readme (D1): an introduction with every option, absolute links that
  // resolve, and version strings for the release it ships with.
  const readme = docs['packages/typeset-v4/README.md'];
  const headings = [...readme.matchAll(/^## (.+)$/gm)].map(m => m[1]);
  const ORDER = ['Do I need it?', 'Install', 'Options', 'What happened to my paragraph?', 'Checking it in CI', 'What it costs', "What it won't do", 'Browsers', 'Accessibility', 'Recommended CSS', 'FAQ', 'Stability', 'Glossary'];
  check('readme', 'package README sections: value, image, do I need it, install, options, outcomes, costs, limits, browsers, accessibility, baseline CSS, FAQ, stability, glossary', JSON.stringify(headings.filter(h => ORDER.includes(h))) === JSON.stringify(ORDER) && /^# typeset\.us\n\nBetter line breaks/.test(readme) && /!\[[^\]]+\]\(https:\/\/typeset\.us\/releases\/[^)]+\/before-after\.png\)/.test(readme), headings);
  const optionTable = readme.split('## Options')[1]?.split('## ')[0] ?? '';
  const optionKeys = [...options.matchAll(/\n\s*(\w+)\?:/g)].map(m => m[1]);
  const missingOptions = optionKeys.filter(key => !optionTable.includes(`| \`${key}\` |`));
  check('readme', `every option (${optionKeys.length}) has a row in the README options table`, optionKeys.length > 0 && missingOptions.length === 0, missingOptions);
  const outcomeCount = /All (\d+) outcomes/.exec(readme)?.[1];
  check('readme', 'the README states the number of outcomes in OUTCOMES', Number(outcomeCount) === OUTCOMES.length, { readme: outcomeCount, OUTCOMES: OUTCOMES.length });
  const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]);
  const relative = links.filter(link => !/^(https?:|#)/.test(link));
  check('readme', 'package README links are absolute (npm renders them outside the repository)', relative.length === 0, relative);
  const versions = [...readme.matchAll(/(?:typeset\.us@|go@|typeset\.us\/releases\/)(\d+\.\d+\.\d+(?:-[\w.]+)?)/g)].map(m => m[1]);
  check('readme', `install lines and release links in the package README name ${target}`, versions.length > 0 && versions.every(v => v === target), [...new Set(versions)]);
  const urls = [...new Set([...readme.matchAll(/https?:\/\/[^\s)<>"'`]+/g)].map(m => m[0].replace(/[.,;:]+$/, '')))];
  const archived = new Set([...(await import('../build-recipe.mjs')).CURRENT_RECIPE.archivedFiles, 'manifest.json', 'index.js', 'typeset.global.js', 'go.js', 'auto.js', `typeset.us-${target}.tgz`]);
  /** @type {string[]} */
  const unresolved = [];
  for (const url of urls) {
    let m;
    if ((m = /^https:\/\/typeset\.us\/releases\/([^/]+)\/(.+)$/.exec(url))) { if (m[1] === target ? !archived.has(m[2]) || (!['manifest.json', 'index.js', 'typeset.global.js', 'go.js', 'auto.js', `typeset.us-${target}.tgz`].includes(m[2]) && !await exists(`packages/typeset-v4/${m[2]}`)) : !await exists(`public/releases/${m[1]}/${m[2]}`)) unresolved.push(url); }
    else if ((m = /^https:\/\/typeset\.us(\/[^?#]*)?$/.exec(url))) { const route = (m[1] ?? '/').replace(/\/$/, ''); if (route && !await exists(`src/app${route}/page.tsx`) && !await exists(`src/app${route}/route.ts`) && !await exists(`public${route}`) && !/^\/go@\d/.test(route)) unresolved.push(url); }
    else if ((m = /^https:\/\/github\.com\/speedwarnsf\/web-typography\/blob\/master\/(.+)$/.exec(url))) { if (!await exists(m[1])) unresolved.push(url); }
    else if ((m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/typeset\.us@([^/]+)\/(.+)$/.exec(url))) { if (m[1] !== target || !pkg.files.includes(m[2].split('/')[0])) unresolved.push(url); }
  }
  check('readme', 'links to typeset.us, the release archive, the repository and jsDelivr resolve to real files and routes', unresolved.length === 0, unresolved);
  if (process.argv.includes('--network')) {
    const external = urls.filter(url => !url.includes(`/releases/${target}/`) && !url.includes(`typeset.us@${target}`) && !url.startsWith('https://typeset.us/go@'));
    /** @type {string[]} */
    const failed = [];
    for (const url of external) { const r = await fetch(url, { redirect: 'follow' }).catch(() => null); if (!r || r.status !== 200) failed.push(`${url} ${r?.status}`); }
    check('readme', 'external README links return 200 (unreleased-version links excepted)', failed.length === 0, failed);
  }
  check('readme', 'the before/after image exists and the release archive carries it', await exists('packages/typeset-v4/before-after.png') && archived.has('before-after.png') && !pkg.files.includes('before-after.png'));
  const { rootInstallBlock, currentInstallBlock } = await import('./docs-blocks.mjs');
  const rootReadme = docs['README.md'];
  check('readme', `the root README install block names the published ${pkg.version} and its sri.json hash`, sri.version === pkg.version && currentInstallBlock(rootReadme) === rootInstallBlock(pkg.version, sri.files[`go@${pkg.version}.js`]), currentInstallBlock(rootReadme));
  const rootLinks = [...rootReadme.matchAll(/\]\(([^)\s#]+)\)/g)].map(m => m[1]).filter(link => !/^https?:/.test(link));
  const brokenRoot = [];
  for (const link of rootLinks) if (!await exists(link) && !(await readdir(link).then(() => true, () => false))) brokenRoot.push(link);
  check('readme', 'root README relative links name files in the repository', brokenRoot.length === 0, brokenRoot);

  // claims (D3): no stale v3 claim in current docs, known limitations and an
  // FAQ, and a CHANGELOG entry for both the published and the next version.
  check('claims', `CHANGELOG.md has "## ${pkg.version}" (the published version)`, new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog));
  const next = changelog.split('\n## ').find(section => section.startsWith(target)) ?? '';
  check('claims', `the ${target} CHANGELOG section has a "Rendering changes" subsection`, /### Rendering changes/.test(next));
  const STALE = [
    [/audit\(\) returns \[\]/, 'audit() returns []'], [/Zero means zero/, 'audit zero-violation claim'],
    [/~?1\.[46] ?ms (?:median )?per paragraph|1\.[46] ?ms per paragraph/i, 'v3 per-paragraph timing'], [/\b20 ?KB\b/, 'v3 bundle size'], [/38(?:&nbsp;|\s)KB/, 'old homepage size'],
    [/English (?:prose )?only/i, 'English-only claim'], [/cloned per\s+segment/, 'v3 link cloning'], [/npx typeset\.us audit/, 'old CLI name'], [/48[–-]80 retained/, 'v3 search size'],
    [/React 19\.2\.3 is the local target|Locally targeted React: 19\.2\.3/, 'React 19.2.3-only claim'], [/abandons a word\.\s+The book version never does/, 'homepage orphan claim'], [/SceneF/, 'client name'],
  ];
  const CURRENT = ['packages/typeset-v4/README.md', 'packages/typeset-v4/SUPPORT.md', 'packages/typeset-v4/MIGRATION.md', 'packages/typeset-v4/for-agents.md', 'packages/typeset-v4/OUTCOMES.md', 'README.md', 'STABILITY.md', 'SECURITY.md', 'CONTRIBUTING.md', 'ROADMAP.md', 'docs/show-hn.md', 'docs/outcomes.md', 'docs/RELEASING.md', 'public/llms.txt'];
  /** @type {Record<string, string>} */
  const texts = {};
  for (const file of CURRENT) texts[file] = await readFile(file, 'utf8');
  texts['SKILL.md (frontmatter)'] = (await readFile('SKILL.md', 'utf8')).split('\n---\n')[0];
  /** @param {string} dir */
  const site = async dir => { for (const entry of await readdir(dir, { withFileTypes: true })) { const path = `${dir}/${entry.name}`; if (entry.isDirectory()) await site(path); else if (/\.tsx$/.test(entry.name)) texts[path] = await readFile(path, 'utf8'); } };
  await site('src/app');
  const stale = [];
  for (const [file, text] of Object.entries(texts)) for (const [pattern, what] of STALE) {
    // Claims can wrap across lines; check sentences of the joined text. A
    // sentence that says the claim is historical (3.x, V3) may quote it.
    const joined = text.replace(/\n\s*(?:>\s*)?/g, ' ').replace(/\s+/g, ' ');
    const hits = joined.split(/(?<=[.!?])\s+/).filter(sentence => /** @type {RegExp} */ (pattern).test(sentence) && !/\b(?:3\.x|V3|v3)\b/.test(sentence));
    if (hits.length) stale.push(`${file}: ${what}: ${hits[0].trim().slice(0, 120)}`);
  }
  check('claims', 'no stale v3-era claim in current docs, the site or the SKILL.md frontmatter', stale.length === 0, stale);
  const historical = [];
  for (const file of ['docs/for-agents-copy.md', 'docs/agents-canonical.md']) if (!/^> \*\*Historical\.\*\*/m.test((await readFile(file, 'utf8')).split('\n').slice(0, 8).join('\n'))) historical.push(file);
  check('claims', 'v3-era agent docs are marked historical at the top', historical.length === 0, historical);
  const support = texts['packages/typeset-v4/SUPPORT.md'];
  const limitations = support.split('## Known limitations')[1] ?? '';
  check('claims', 'SUPPORT.md lists known limitations: find-in-page, Text Fragments, innerText and selection, print, translation, CSP/Trusted Types, hyphenation, justification, RTL, browser floor', ['Find-in-page', 'Text Fragment', 'innerText', 'selection.toString', 'Print', 'translation', 'Trusted Types', 'hyphenation', 'justification', 'Right-to-left', 'Browser floor'].every(term => limitations.includes(term)));
  const faq = await readFile('src/app/faq/page.tsx', 'utf8').catch(() => '');
  check('claims', '/faq answers screen readers, layout shift, SEO, copying, print and translation, no-JS, when it runs, and text-wrap: pretty', ['screen readers', 'layout shift', 'SEO', 'copies text', 'Printing and translation', 'without JavaScript', 'defer it', 'text-wrap: pretty'].every(q => faq.includes(q)));
  check('claims', 'the README has an FAQ section that links /faq', /## FAQ\n\nMore answers: https:\/\/typeset\.us\/faq/.test(readme));
  const llmsVersions = [...texts['public/llms.txt'].matchAll(/typeset\.us@(\d+\.\d+\.\d+)|go@(\d+\.\d+\.\d+)\.js|releases\/(\d+\.\d+\.\d+)\/(?!README)/g)].map(m => m[1] || m[2] || m[3]).filter(v => v !== '3.5.1');
  check('claims', `llms.txt names ${target} in its install lines and links`, llmsVersions.length > 0 && llmsVersions.every(v => v === target), [...new Set(llmsVersions)]);

  // community (D6): the files GitHub's community profile looks for, and issue
  // forms that ask for what a bad-break report needs.
  const community = ['README.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', '.github/pull_request_template.md', '.github/ISSUE_TEMPLATE/bad-break.yml', '.github/ISSUE_TEMPLATE/integration-question.yml', 'ROADMAP.md'];
  const absent = [];
  for (const file of community) if (!await exists(file)) absent.push(file);
  check('community', 'README, LICENSE, code of conduct, contributing guide, security policy, issue forms, PR template and roadmap exist', absent.length === 0, absent);
  const form = await readFile('.github/ISSUE_TEMPLATE/bad-break.yml', 'utf8').catch(() => '');
  const ids = [...form.matchAll(/^\s+id: (\w+)$/gm)].map(m => m[1]);
  check('community', 'the bad-break form asks for URL, width, font, browser, version, auditJSON and a screenshot', ['url', 'width', 'font', 'browser', 'version', 'audit', 'screenshot'].every(id => ids.includes(id)) && /render: json/.test(form), ids);
  const contributing = await readFile('CONTRIBUTING.md', 'utf8').catch(() => '');
  check('community', 'CONTRIBUTING.md covers setup, build:dist, test:v4 with --only, and attaching auditJSON', /npm ci/.test(contributing) && /build:dist/.test(contributing) && /--only/.test(contributing) && /auditJSON/.test(contributing));
  const coc = await readFile('CODE_OF_CONDUCT.md', 'utf8').catch(() => '');
  check('community', 'CODE_OF_CONDUCT.md adopts the Contributor Covenant and names a contact', /Contributor Covenant/.test(coc) && /@typeset\.us/.test(coc));
  if (process.argv.includes('--community')) {
    // After these files reach the default branch: GitHub's own score.
    let health = null;
    try { health = Number(execFileSync('gh', ['api', 'repos/speedwarnsf/web-typography/community/profile', '--jq', '.health_percentage'], { encoding: 'utf8', timeout: 30000 }).trim()); } catch {}
    check('community', "GitHub's community profile scores at least 85%", health !== null && health >= 85, health);
  }
} catch (error) {
  errors.push(String(/** @type {Error} */ (error).stack || error));
}

// Pending docs-sync anchors, listed (release-cut refuses them).
/** @type {string[]} */
const pending = [];
for (const file of ['packages/typeset-v4/README.md', 'packages/typeset-v4/SUPPORT.md', 'packages/typeset-v4/MIGRATION.md', 'packages/typeset-v4/for-agents.md', 'packages/typeset-v4/OUTCOMES.md', 'src/lib/v4/outcomes.ts', 'src/lib/v4/typeset.next.ts', 'CHANGELOG.md', 'STABILITY.md', 'README.md']) {
  const text = await readFile(file, 'utf8').catch(() => '');
  text.split('\n').forEach((line, index) => { if (line.includes('TODO(docs-sync)')) pending.push(`${file}:${index + 1}`); });
}
await writeFile('output/docs-verification.json', JSON.stringify({ checks, errors, pendingDocsSync: pending }, null, 2));
const failures = checks.filter(c => !c.pass);
console.log(JSON.stringify({ checks: checks.length, failures, errors, pendingDocsSync: pending.length }, null, 2));
if (failures.length || errors.length) process.exitCode = 1;
