# Maintainer checklist

Settings and one-time steps that live outside the repository: on GitHub, on
npmjs.com, in the Vercel project and at the domain registrar. Each needs the
owner's accounts. "Done" lists what is in place and how it was checked;
"Open" lists what is not, with the check that shows it and the command or
dashboard path that fixes it. Commands assume `gh`, `npm` and `vercel` are
logged in as the owner, and `REPO=speedwarnsf/web-typography`. Re-run a
check before relying on its line: this page records what the checks showed
on the date given, and settings change outside the repository.

## Done

Checked 2026-09-29.

- **The release environment.** The GitHub environment `npm`, which
  `release.yml` publishes from, requires a review by speedwarnsf and deploys
  only `v*` tags.
  `gh api repos/$REPO/environments --jq '.environments[] | {name, protection_rules}'`
  and `gh api repos/$REPO/environments/npm/deployment-branch-policies`.
- **GitHub Releases for 4.0.0, 4.1.0 and 4.2.0** exist (created
  2026-09-27, with 4.3.0's). `gh release list -R $REPO`.
- **npm trusted publishing** for `release.yml` and environment `npm`: the
  owner reports it configured. npm has no public read of the setting; the
  first release that carries a provenance attestation confirms it:
  `npm view typeset.us@4.3.1 dist.attestations`. At 17:16 UTC on
  2026-09-29 that could not confirm it yet: 4.3.1 was not on npm (`npm view
  typeset.us@4.3.1` answered E404; `latest` was 4.3.0), and the Release run
  for the v4.3.1 tag (36601559574) was still verifying. 4.3.0 and earlier
  carry no attestation; they were published by hand.

## Open

Checked 2026-09-29.

### GitHub repository

- **Private vulnerability reporting is off.**
  `gh api repos/$REPO/private-vulnerability-reporting` prints
  `{"enabled":false}`. Until it is on, security reports go to the email
  address in SECURITY.md.

  ```sh
  gh api -X PUT "repos/$REPO/private-vulnerability-reporting"
  ```

- **Dependabot alerts and automated security fixes are off.**
  `gh api repos/$REPO/vulnerability-alerts` answers 404, and
  `gh api repos/$REPO/automated-security-fixes` prints
  `{"enabled":false,...}`. (`.github/dependabot.yml` handles version
  updates.)

  ```sh
  gh api -X PUT "repos/$REPO/vulnerability-alerts"
  gh api -X PUT "repos/$REPO/automated-security-fixes"
  ```

- **master is unprotected and there are no rulesets.**
  `gh api repos/$REPO/branches/master/protection` answers 404 "Branch not
  protected", and `gh api repos/$REPO/rulesets` prints `[]`.

  ```sh
  # Changes arrive through pull requests with a green CI run.
  gh api -X PUT "repos/$REPO/branches/master/protection" --input - <<'JSON'
  {
    "required_status_checks": { "strict": true, "contexts": ["test"] },
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }
  JSON

  # Release tags cannot be moved or deleted.
  gh api -X POST "repos/$REPO/rulesets" --input - <<'JSON'
  {
    "name": "Release tags",
    "target": "tag",
    "enforcement": "active",
    "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
    "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "update" }]
  }
  JSON
  ```

- **Discussions is off, and the description is still the 3.x pitch**
  ("... audit() returns [] ..."). `gh api repos/$REPO --jq '{has_discussions, description}'`.

  ```sh
  gh repo edit "$REPO" --enable-discussions \
    --description "typeset.us: better line breaks for web text. Grammar-aware, links and styling intact, tested in Chromium, WebKit and Firefox." \
    --homepage https://typeset.us \
    --add-topic typography --add-topic line-breaking --add-topic text-wrap --add-topic react
  ```

  Once Discussions is on, restore the links taken out while it was off:
  the Discussions entry in `.github/ISSUE_TEMPLATE/config.yml`, the
  "Suggestions" line in ROADMAP.md, and a Discussions link on
  https://typeset.us/help (`src/app/help/page.tsx`).

- **No security advisory for the 3.x heading XSS.**
  `gh api repos/$REPO/security-advisories --jq length` prints 0.
  1. Security > Advisories > New draft advisory, with the fields in
     [security/advisory-3x-heading-xss.md](security/advisory-3x-heading-xss.md).
     Request a CVE from the same page, then publish.
  2. Put the advisory id and URL into
     [security/advisories.json](security/advisories.json) (the next cut
     copies it into release.json and sri.json).
  3. `GHSA=GHSA-xxxx-xxxx-xxxx sh docs/security/deprecate-3x.sh`

- **Five merged `codex/*` branches are still on GitHub:** release-4.0.0,
  release-4.1.0, release-4.2.0, restore-original-site and
  typeset-v4-launch. Each is an ancestor of master
  (`git merge-base --is-ancestor origin/codex/<name> origin/master`).

  ```sh
  git ls-remote --heads origin 'codex/*'
  git push origin --delete codex/release-4.0.0 codex/release-4.1.0 codex/release-4.2.0 codex/restore-original-site codex/typeset-v4-launch
  ```

- **The GitHub profile has no name.** `gh api users/speedwarnsf --jq .name`
  prints `null`. Set it at https://github.com/settings/profile.
- **A second GitHub admin**, so one lost account cannot strand the
  repository: Settings > Collaborators and teams, or move the repository to
  an organization.
- **The three 4.3.0 defects that 4.3.1 fixes are not public issues.** File
  one issue each (the CHANGELOG's 4.3.1 "Fixed" entries), with the
  workaround for 4.3.0, and close them against 4.3.1.
- **No person has listened to the output with a screen reader.** Run
  VoiceOver on macOS and iOS, NVDA with Firefox and Chrome, and TalkBack
  on a paragraph, a two-line heading and a link that crosses a line, and
  publish the transcripts. README and capabilities.json list this as
  outstanding.

### npm

- **One maintainer.** `npm view typeset.us maintainers` lists only
  `typesetusall`. Add a second owner, or move the package into an npm
  organization: `npm owner add <npm-user> typeset.us`.
- **No version is deprecated.** `npm view typeset.us@3.4.0 deprecated`
  (and 4.0.0, 4.1.0, 4.2.0) prints nothing.
  - 3.0.0 to 3.4.0: `docs/security/deprecate-3x.sh`, after the advisory
    above.
  - 4.0.0 to 4.2.x ran words together for screen readers, which 4.3.0
    fixed. SECURITY.md still gives 4.2.x security fixes; when the owner
    decides 4.2.x installs should be steered to 4.3:

    ```sh
    npm deprecate 'typeset.us@>=4.0.0 <4.3.0' "Screen readers hear words run together at composed line breaks; upgrade to typeset.us@4.3"
    npm view 'typeset.us@>=4.0.0 <4.3.0' deprecated
    ```

- **Publishing access still allows tokens.** After the first release with
  provenance: npmjs.com > typeset.us > Settings > Publishing access >
  "Require two-factor authentication and disallow tokens", so only the
  workflow can publish.
- **Two publish tokens from 2026-07-09 are active, and one is in
  `~/.npmrc`.** `npm token list`, then `npm token revoke <id>` for each,
  and delete the `//registry.npmjs.org/:_authToken=` line from `~/.npmrc`,
  so no script or agent running as the owner can publish.

### Vercel

- **The firewall bypass for release assets is not applied.** The rule is
  written ([ops/vercel-firewall.md](ops/vercel-firewall.md)), but `vercel`
  CLI 50.6.0 rejects `vercel firewall`, so apply it in the dashboard:
  Firewall > Configure > New rule, as that page describes, then publish and
  run `node scripts/field/verify-cdn-reachability.mjs`.

### Domain

- **typeset.us auto-renew**, at the registrar, and a recovery email outside
  the typeset.us domain on the registrar, npm and GitHub accounts, so a
  lapsed domain cannot lock the owner out of the accounts that recover it.
