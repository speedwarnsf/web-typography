# Contributing

Typeset is maintained by one person, so the most useful contributions are
reports that can be reproduced in minutes, and small changes with a test
that fails without them.

## Reporting a bad line break

Use the "Bad line break" issue form. It asks for the page, the width, the
font, the browser and the `auditJSON` output, because a line break depends
on all of them. To get the audit, open the page, then in the console:

```js
copy(JSON.stringify(Typeset.auditJSON('article p'), null, 2))
```

or run the CLI against the page at the width you saw:

```sh
npx typeset-audit --url https://example.com/post --selector 'article p' --widths 390
```

A `native:` outcome is not a bug by itself: it means Typeset kept the
browser's layout on purpose. docs/outcomes.md says what each one means.

Security problems: please report them privately (SECURITY.md), not in an issue.

## Setting up

Node 22 or later and macOS or Linux.

```sh
git clone https://github.com/speedwarnsf/web-typography.git
cd web-typography
npm ci
npx playwright install chromium webkit firefox
```

The engine is `src/lib/v4/`. The npm package is `packages/typeset-v4/`. The
website is the Next.js app in `src/app/` (`npm run dev`).

## Building and testing

```sh
npm run build:dist              # builds the candidate into output/candidate/ (about 1 s)
npm test                        # builds the candidate, then every suite in Chromium, WebKit and Firefox
npm test -- --list              # the suites
npm test -- --only spacing,cli  # just some of them
npm test -- --verbose           # stream each suite's output
npx tsc --noEmit && npm run typecheck:scripts
```

Each suite writes a JSON report to `output/`; `output/test-v4-summary.json`
lists every failing check with its browser. A suite in
`scripts/v4/known-failures.json` is expected to fail until the named change
lands; when it starts passing, the run fails until the entry is removed.

Website changes: `npm run build`, then `node scripts/site/verify-site.mjs`.

## Rules the tests enforce

- **Published files never change.** Nothing under `public/releases/`, no
  `public/go@x.y.z.js`, and no existing entry in
  `public/releases/published.json`. Releases are cut only by
  `npm run release:cut` (docs/RELEASING.md).
- **Default rendering changes only to fix a verified defect**, and each one is
  listed in the CHANGELOG under "Rendering changes" with the number of test
  paragraphs it changed (STABILITY.md).
- **Every fix adds a check** that fails without it, in the suite closest to
  the problem.
- **No runtime dependencies, no network access, no telemetry** in the
  package.
- **Docs follow the code.** New outcome codes go in `src/lib/v4/outcomes.ts`
  and `outcome-docs.ts` (`npm run docs:outcomes`); options get a JSDoc line
  with their default and a row in the package README.

## Pull requests

Keep them small and say why in the description; the template has the
checklist. Commit messages: an imperative subject, then the reason.

This project follows the Code of Conduct in CODE_OF_CONDUCT.md.
