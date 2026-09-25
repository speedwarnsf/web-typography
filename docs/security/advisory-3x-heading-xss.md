# DRAFT advisory: DOM XSS in the typeset.us 3.x `Typeset.auto()` heading branch

Status: draft, not published. The owner publishes it as a GitHub Security
Advisory (Security > Advisories > New draft advisory), requests a CVE from
GitHub in the same form, then runs [deprecate-3x.sh](deprecate-3x.sh). The
fields below map to the advisory form.

## Form fields

- **Ecosystem:** npm
- **Package:** typeset.us
- **Affected versions:** `>= 3.0.0, < 3.4.1`
- **Patched versions:** `3.4.1`
- **Severity:** Moderate. CVSS 3.1
  `AV:N/AC:H/PR:N/UI:R/S:C/C:L/I:L/A:N` (4.7)
- **Weakness:** CWE-79, Improper Neutralization of Input During Web Page
  Generation (Cross-site Scripting)
- **Title:** DOM XSS in `Typeset.auto()` for `[data-typeset-heading]` text

## Description

In typeset.us 3.0.0 through 3.4.0, `Typeset.auto()` in the browser bundle
(`dist/typeset.global.js`, served as `typeset.min.js` and in the
`go@3.3.2.js` and `go@3.4.0.js` loaders) processed each element marked
`data-typeset-heading` like this:

```js
element.innerHTML = typesetHeading(element.textContent || '');
```

`textContent` returns the element's text with HTML entities decoded, and
`typesetHeading()` returned it as an HTML string without escaping `<`, `>`
or `&`. Text a site had correctly escaped, such as a user's display name
rendered as `&lt;img src=x onerror=...&gt;`, was therefore parsed again as
markup, and its event handlers ran in the site's origin.

A page is affected when all of these hold:

1. It loads a 3.0.0 to 3.4.0 browser bundle or one of the two pins above.
2. It calls `Typeset.auto()`. The 3.x loaders call `compose()`, not
   `auto()`, so loading `go@3.x.js` alone does not reach this code.
3. An element with `data-typeset-heading` contains text an attacker can
   influence.

The ESM and CommonJS entry points do not include `auto()`. 3.4.1 assigns
the result to `textContent` instead of `innerHTML`. No 4.x release contains
this code: 4.x `mount()` and `typeset()` never parse HTML strings.

## Proof of concept

```html
<h2 data-typeset-heading>Welcome back, &lt;img src=x onerror="window.__pwned=document.domain"&gt;</h2>
<script src="https://typeset.us/go@3.4.0.js"></script>
<script>addEventListener('load', () => Typeset.auto());</script>
```

On 3.3.2 and 3.4.0, Chromium creates an `<img>` and sets `window.__pwned`.
On 3.4.1 and 4.2.0 the text stays text. (Audit reproduction,
scratch script `lens6/run-legacy.mjs`, 2026-09-23.)

## Workarounds

Upgrade to typeset.us 4.3 (npm, or `go@4.3.0.js` with its integrity hash from
https://typeset.us/sri.json). If you must stay on 3.x, use 3.4.1 or later, or
remove `data-typeset-heading` from any element whose text is not fully
trusted, or stop calling `Typeset.auto()`.

## Why the vulnerable files stay online

typeset.us promises that published files never change, so that every pinned
`integrity` hash keeps working. The vulnerable npm versions and pins remain
downloadable; they are deprecated on npm, listed under `advisories` in
https://typeset.us/release.json and https://typeset.us/sri.json, and named
in SECURITY.md and the migration guide.

## Timeline

- 2026-03-13: `Typeset.auto()` heading branch added (commit 4afdcfd).
- 2026-07-28: fixed in 3.4.1 without an advisory.
- 2026-09-23: found again during the 4.2 audit; advisory drafted for 4.3.

## Credits

Found during the typeset.us 4.2 release audit.
