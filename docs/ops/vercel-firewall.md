# Vercel firewall: let tools fetch release assets

Other sites embed `go@<v>.js`, and package tools, CI jobs and agents fetch
`/releases/**`, `sri.json`, `release.json`, `for-agents.md`,
`capabilities.json` and `llms.txt`. In the 4.2 audit, Vercel's bot protection
answered bursts of automated requests for these files with a 403 "Vercel
Security Checkpoint" page (`x-vercel-mitigated: challenge`). Browsers passed;
curl, Node fetch and headless CI did not.

This is not applied from the repository. `vercel.json` accepts only deny and
challenge rules, so the bypass is a WAF custom rule that the project owner
creates once, in the dashboard or with the Vercel CLI.

## Apply (project owner)

The rule is in [`vercel-firewall-bypass.json`](vercel-firewall-bypass.json):
GET and HEAD requests to those paths skip the remaining custom rules and,
as Vercel's WAF documentation describes custom-rule bypasses, the managed
rulesets (Bot Protection, AI Bots). The check below confirms it. It does not
bypass Vercel's system DDoS mitigations or Attack Mode, and it does not
change caching.

```sh
vercel link                      # in this repository, once
vercel firewall rules add --json "$(cat docs/ops/vercel-firewall-bypass.json)" --yes
vercel firewall rules reorder "Release assets: skip bot challenges" --first --yes
vercel firewall diff             # review the staged rule
vercel firewall publish --yes    # rules are drafts until published
```

In the dashboard instead: Firewall > Configure > New rule. If Request Path
matches the regular expression in the JSON file and Method is any of GET,
HEAD, then Bypass. Move it to the top and publish.

## Check

After publishing, and after each deploy:

```sh
node scripts/field/verify-cdn-reachability.mjs
```

It requests each path 30 times with a headless-browser user agent and
fails on any status other than 200, on a challenge page, or on a
cache or CORS header that differs from `next.config.ts`.

## Caching

Cache headers come from `next.config.ts` and ship with each deploy:
versioned files (`go@x.y.z.js`, `typeset@x.y.z.min.js`,
`typeset@x.y.z.esm.js`, `/releases/**`) are `immutable` for a year;
aliases and indexes (`go.js`, `go@4.js`, `typeset.min.js`,
`typeset.esm.js`, `sri.json`, `release.json`, `for-agents.md`,
`capabilities.json`, `llms.txt`, `/releases/published.json`) revalidate
after five minutes. All of them send `Access-Control-Allow-Origin: *`.
