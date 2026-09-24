# Owner actions

Settings and one-time steps that live outside the repository: on GitHub, on
npmjs.com and in the Vercel project. Nothing here has been run; each needs
the owner's accounts. Run them in order when 4.3 is ready to ship. Commands
assume `gh` and `vercel` are logged in as the owner.

## GitHub repository

```sh
REPO=speedwarnsf/web-typography

# Private vulnerability reporting (SECURITY.md points reporters here).
gh api -X PUT "repos/$REPO/private-vulnerability-reporting"

# Dependabot alerts and security updates (.github/dependabot.yml handles
# version updates).
gh api -X PUT "repos/$REPO/vulnerability-alerts"
gh api -X PUT "repos/$REPO/automated-security-fixes"

# Protect master: changes arrive through pull requests with a green CI run.
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

# Only release tags from the owner: protect v* tags.
gh api -X POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "Release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "update" }]
}
JSON

# The npm environment the release workflow publishes from: require the
# owner's approval, and allow only v* tags to deploy to it.
OWNER_ID="$(gh api users/speedwarnsf --jq .id)"
gh api -X PUT "repos/$REPO/environments/npm" --input - <<JSON
{ "reviewers": [{ "type": "User", "id": $OWNER_ID }], "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST "repos/$REPO/environments/npm/deployment-branch-policies" -f name='v*' -f type=tag

# Discussions, and a description that matches v4.
gh repo edit "$REPO" --enable-discussions \
  --description "typeset.us: better line breaks for web text. Grammar-aware, links and styling intact, verified in Chrome, Safari and Firefox." \
  --homepage https://typeset.us \
  --add-topic typography --add-topic line-breaking --add-topic text-wrap --add-topic react
```

Then check the community profile:
`gh api repos/$REPO/community/profile --jq .health_percentage` (target 85 or
more; `node scripts/v4/verify-docs.mjs` checks the files locally).

## npm

1. typeset.us > Settings > Trusted publishing > add GitHub Actions:
   organization or user `speedwarnsf`, repository `web-typography`, workflow
   `release.yml`, environment `npm`. After the first provenance release,
   set publishing access to "Require two-factor authentication and disallow
   tokens", so only the workflow can publish.
2. Add a second owner, or move the package into an npm organization, so
   one lost account cannot strand the package:
   `npm owner add <npm-user> typeset.us`.

## Security advisory for 3.x

1. Security > Advisories > New draft advisory, with the fields in
   [security/advisory-3x-heading-xss.md](security/advisory-3x-heading-xss.md).
   Request a CVE from the same page, then publish.
2. Put the advisory id and URL into
   [security/advisories.json](security/advisories.json) (the next cut
   copies it into release.json and sri.json).
3. `GHSA=GHSA-xxxx-xxxx-xxxx sh docs/security/deprecate-3x.sh`

## GitHub Releases for 4.0.0 to 4.2.0

Notes only; no file is uploaded and no artifact changes.

```sh
for v in 4.0.0 4.1.0 4.2.0; do
  node scripts/v4/release-notes.mjs --version "$v" --backfill --out "output/notes-$v.md"
  gh release create "v$v" --verify-tag --title "typeset.us $v" --notes-file "output/notes-$v.md" --latest=false
done
gh release edit v4.2.0 --latest   # until 4.3.0 ships
```

## Vercel

Apply the firewall bypass in [ops/vercel-firewall.md](ops/vercel-firewall.md),
then run `node scripts/field/verify-cdn-reachability.mjs`.
