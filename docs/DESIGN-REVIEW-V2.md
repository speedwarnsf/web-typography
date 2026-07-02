# typeset.us — Multi-Perspective Design Review → /v2 Brief

*2026-07-02. Four readings of the current site, each from a different chair.
These findings drive the /v2 redesign.*

---

## Reading 1 — First-time visitor, phone, 2 seconds

**What they see first:** letters scrambling through random fonts on a
letterpress photo. A ransom note.

The hero animation is charming once you understand it — chaos resolving into
Playfair is the whole thesis as theater. But a 2-second glance has a ~70%
chance of landing mid-chaos, and mid-chaos this is a site demonstrating *bad*
typography. The rhetorical figure (antithesis: disorder → order) only pays
off if the visitor stays for the resolution. First impressions don't wait.

**The kicker undersells:** "A resource for designers and developers" is the
most generic sentence in the genre. Nothing in the first viewport says *we
solved something that was broken for forty years and you can watch it work.*

**Verdict:** the 2-second test currently communicates "typography blog,"
not "breakthrough."
**Fix for /v2:** resolution is the resting state. The first viewport is one
perfectly set sentence — composed live by the engine — and a claim, not a
category.

## Reading 2 — Type designer / typographer (the tastemaker audience)

The body text is genuinely beautiful — the composed rag, bound orphans, and
hanging punctuation are visible to a trained eye, and that IS the product
working. But nothing *points at it*. The site never says "the text you are
reading right now is being set by the engine." The strongest evidence on
every page goes unclaimed.

The letterpress photograph behind everything is the wrong texture: it's
someone else's type, a stock-feeling shortcut, and it fights the site's own
blacks. Sections float on it as `black/65` boxes — cards on wallpaper. A
typography site's texture should be *generated from its own glyphs*, not
photographed from a drawer of wood type.

The Proof — the only page of its kind on the web — is the fifth chip in a
row of five.

**Verdict:** the taste is real but modest; the site whispers where it has
earned the right to state.
**Fix for /v2:** pure black, glyph-field texture drawn from the engine's own
character set, self-referential proof ("this page is set by its own
engine"), and the Proof as act one.

## Reading 3 — Front-end developer evaluating the tool

Time-to-install-line is too long: land → decode chip names ("Utility"?
"Silver Bullet"?) → /utility → scroll past an essay modal → find the script
tag. The names are editorial and insider-y; a developer scans for `<script`
and a number (size, performance) and finds them late or not at all.

Good: the install is now genuinely one line, the source is shown in full
("what you read here is exactly what runs" is exactly the right sentence),
and /proof gives measurable before/after — engineers trust instruments, not
adjectives.

**Verdict:** strong substance, slow path to it.
**Fix for /v2:** the script tag appears on the first page, verbatim, with a
copy button. The proof demo runs without a click.

## Reading 4 — Craft & accessibility audit

- `text-neutral-600` (#525252) on #0a0a0a ≈ 2.4:1 — fails WCAG AA. Used for
  footer lines and some micro-labels. `neutral-500` (#737373) ≈ 4.0:1 —
  borderline for 10px uppercase mono. **/v2 floor: neutral-400 for anything
  meant to be read.**
- Discipline held elsewhere: zero rounded corners found, zero emojis, gold
  used sparingly and consistently, the `01 —` section numbering gives real
  editorial rhythm. This DNA is worth keeping wholesale.
- Mobile: sections pad well, no horizontal scroll, composed text verified
  clean at 375px. The hero animation runs long on mobile where attention is
  shortest.

---

## The /v2 thesis

**Typography is the tastemaker.** Anyone can license the same typefaces; the
tell is the setting. /v2 should demonstrate a new era of web design — depth,
organic motion, interface that grows instead of appearing — while making one
argument: all of that spectacle is *earned* by the discipline of the type.
The engine sets every paragraph of the page that shows it off.

Keep: black, gold #B8963E, Playfair/JetBrains Mono/Source Sans, sharp
corners, mono micro-labels, numbered sections.
Add: glyph-field canvas (organic, pointer-aware), 3D perspective on the
composed hero, a menu that blooms from a single gold point, per-line reveal
of engine-composed text (only this engine can animate *typeset lines*),
live proof stage with measured stats, one-line install with copy.
Respect: prefers-reduced-motion, 375px first, WCAG AA floor.
