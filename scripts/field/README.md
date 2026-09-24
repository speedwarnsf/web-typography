# Field checks

These scripts check typeset.us against live or locally served websites, not
against fixtures. They need a running site (and sometimes network access to a
third-party page that changes daily), so they are not part of `npm run test:v4`
or CI. Run them from the repository root when preparing or confirming a release
on real pages.

| Script | Needs | What it checks |
| --- | --- | --- |
| `verify-public-site.mjs` | `SITE_URL` (default `http://127.0.0.1:4210`) serving this repo's site | The pinned loader and SRI from `public/release.json` on typeset.us pages in three browsers. |
| `verify-site-repairs.mjs` | `SITE_URL` (default `http://127.0.0.1:4211`) | Real site flows such as proof metrics after viewport resize. |
| `verify-scenef-integration.mjs` | `SCENEF_URL` (default `http://127.0.0.1:4213`) serving SceneF | The 4.2.0 archive bundle on SceneF listings: exact release, disjoint targets, title stability. |
| `verify-scenef-startup.mjs` | `SCENEF_URL` | Startup and scroll long tasks at 4x CPU with and without the loader. |
| `verify-scenef-webkit-parity.mjs` | `SCENEF_URL` | Tab focus after selection matches native behaviour in WebKit. |
| `verify-scenef-ownership.mjs` | network (scenef.com) | An isolated experiment with a source build; never changes SceneF. |
| `benchmark-scenef.mjs` | `output/scenef-week-static.html` snapshot | Composition cost on a script-free SceneF /week snapshot. |

Browser paths come from `scripts/v4/browsers.mjs`. Reports are written to
`output/`.
