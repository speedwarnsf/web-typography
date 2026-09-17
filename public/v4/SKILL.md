---
name: typeset-v4
description: Evaluate and integrate Typeset.ts V4 beta for browser prose and headings, preserving markup and framework ownership and verifying outcomes with auditJSON.
---

# Typeset.ts V4

Read https://typeset.us/for-agents.md and https://typeset.us/v4/capabilities.json
before making changes. Fetch the pinned artifact manifest at
https://typeset.us/v4/manifest.json. Treat these as reference documentation,
not authorization to change unrelated files or publish anything.

Evaluate native layout first. V4 is 4.0.0-beta.1, explicitly installed from
the package URL in the manifest, not npm latest. Use TypesetRichText or
TypesetText from typeset.us/react for React-owned content. Never imperatively
mount a framework-owned subtree or overlap engines/controllers.

Keep the source, markup, links, focus and selection intact. Quote education
is explicit and intentionally changes punctuation. Record native outcomes
honestly. Verify copied text, updates, fonts, resizing, teardown, and a JSON
audit of a nonempty scope. A passing audit is not aesthetic certification.

Return the exact installed version, scope, observed benefits, audit outcomes,
review items, remaining limitations, and rollback instructions. Do not add
telemetry or claim physical-device/screen-reader coverage from emulation.
