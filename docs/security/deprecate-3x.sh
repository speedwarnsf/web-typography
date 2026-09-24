#!/bin/sh
# Owner-run, once, after the GitHub advisory for the 3.x heading XSS is
# published: set GHSA to its id (GHSA-xxxx-xxxx-xxxx). npm deprecate changes
# registry metadata only; the published tarballs keep their bytes and hashes.
# Requires an npm login with publish rights on typeset.us (and 2FA).
set -eu
: "${GHSA:?Set GHSA to the published advisory id, e.g. GHSA=GHSA-xxxx-xxxx-xxxx}"
npm deprecate 'typeset.us@>=3.0.0 <3.4.1' "DOM XSS in Typeset.auto() for [data-typeset-heading] text ($GHSA). Upgrade to typeset.us@4.3 (or >=3.4.1 on 3.x)."
# Confirm: every affected version now carries the message, 3.4.1+ does not.
npm view 'typeset.us@>=3.0.0 <3.4.1' deprecated
npm view typeset.us@3.4.1 deprecated
