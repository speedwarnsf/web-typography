'use client';

/**
 * typeset.ts — Typographic refinement utility
 * 
 * Applies professional typographic rules to text elements:
 * 
 * Rule 1: No orphans — last line must have at least 2 words
 * Rule 2: Sentence-start protection — if a new sentence starts and only 1 word
 *         fits on the remaining line, push it to the next line
 * Rule 3: Sentence-end protection — if the last word of a sentence would be
 *         alone on a new line, bring a companion with it
 * Rule 4: Rag smoothing — if a line's last word juts out 3+ chars past the
 *         line below, knock it down for a smoother right edge
 * 
 * Usage:
 *   typeset(element)                    — process a single element
 *   typesetAll(selector)                — process all matching elements
 *   <Typeset> wrapper component         — React component
 */

const NBSP = '\u00A0'; // non-breaking space
const HAIR = '\u200A'; // hair space (invisible, used as marker)
const NBHY = '\u2011'; // non-breaking hyphen — keeps compound words like "human-centric" together
const ZWSP = '\u200B'; // zero-width space for discretionary break opportunities

// WeakMap to store canonical raw text before any processing
const canonicalText = new WeakMap<HTMLElement, string>();

// Internal write flag for MutationObserver
let isInternalWrite = false;

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE PARAGRAPH COMPOSITOR V2 — Token-aware beam search compositor
// ═══════════════════════════════════════════════════════════════════════════

/** Token types for compositor */
type TokenKind = "word" | "space" | "openPunct" | "closePunct" | "dash" | "compound" | "longSlug";

/** Token with measurements and stickiness rules */
type Token = {
  text: string;
  kind: TokenKind;
  width: number;
  stickyPrev?: boolean;   // must stay with previous token
  stickyNext?: boolean;   // must stay with next token
  weakEnd?: boolean;      // penalized at line end (not forbidden)
  protectedCompound?: boolean;  // e.g., "human-centric" — don't split
  emergencyBreakParts?: string[];  // for long slugs like ThePaperLanternStore
  compoundId?: string;             // shared ID for tokens in the same protected compound
};

/** Frozen line with exact membership and spacing adjustments */
interface FrozenLine {
  text: string;  // exact line content
  tokens: Token[];  // tokens in this line
  fill: number;  // 0-1 fill ratio
  width: number;  // actual line width in pixels
  wordSpacingEm: number;  // spacing adjustment in em units
}

// Token classification sets
const WEAK_END_WORDS = new Set(["a","an","the","of","to","in","on","at","by","for","and","or","but","nor","so","as"]);
// Copula / auxiliary verbs that read poorly when stranded at a line end
// ("…Advertising is"). Penalized gently (below weakEndPenalty) so they're only
// bumped to the next line when the shortened line stays full — "where width allows."
const LINKING_END_WORDS = new Set([
  "is","are","was","were","be","been","am","being","has","have","had",
]);
const OPEN_PUNCT = new Set(["(", "[", "{", "\u201C", "\u2018"]);  // opening quotes/brackets
const CLOSE_PUNCT = new Set([")", "]", "}", ".", ",", ";", ":", "!", "?", "\u201D", "\u2019", "%"]);
const DASHES = new Set(["\u2014", "\u2013"]);  // em-dash, en-dash

// \u2500\u2500\u2500 Optical margin alignment (hanging punctuation) \u2500\u2500\u2500
// Characters whose full advance hangs into the left margin when they begin a
// line, so the optical left edge aligns with the lines above/below.
const HANG_OPEN = new Set(["\u201C", "\u2018", '"', "'", "(", "[", "{", "\u00AB", "\u00BF", "\u00A1"]);
// Capitals with visible left sidebearing \u2014 pulled left by a small fraction of
// the font size (em). Values mirror the project's original optical CSS.
const PULL_LETTERS: Record<string, number> = {
  T: 0.06, V: 0.06, W: 0.05, Y: 0.06, A: 0.04, J: 0.03,
  O: 0.03, C: 0.03, G: 0.03, Q: 0.03, o: 0.02, c: 0.02,
};

/**
 * Leading optical indent (px) for a composed line: full-glyph hang for opening
 * punctuation, a sidebearing pull for optical capitals, otherwise none.
 */
function leadingOpticalIndentPx(
  text: string,
  measurer: (t: string) => number,
  fontSizePx: number,
): number {
  const ch = text.charAt(0);
  if (!ch) return 0;
  if (HANG_OPEN.has(ch)) return measurer(ch);          // hang the whole glyph
  const pull = PULL_LETTERS[ch];
  if (pull) return fontSizePx * pull;                  // optical sidebearing pull
  return 0;
}

/**
 * Options for typesetText
 */
export interface TypesetOptions {
  mode?: 'body' | 'heading';
  /** Line length in characters. Bindings scale with measure via width-tiered
   *  rules; the V2 compositor itself runs at every measure with tiered
   *  profiles (see profileForMeasure) and falls back to bindings when no
   *  valid composition exists. */
  measure?: number;
}

/**
 * Safe write wrapper for DOM mutations.
 * Sets isInternalWrite flag to prevent MutationObserver from reacting to our own changes.
 */
export function safeWrite(fn: () => void): void {
  isInternalWrite = true;
  fn();
  // setTimeout, NOT requestAnimationFrame: rAF never fires in hidden tabs,
  // which left the flag stuck true and the MutationObserver permanently deaf
  // for content that hydrated while backgrounded (richmondfog dogfood #7).
  setTimeout(() => { isInternalWrite = false; }, 0);
}

/**
 * Check if MutationObserver should ignore current mutations.
 */
export function shouldIgnoreMutation(): boolean {
  return isInternalWrite;
}

/**
 * Detect sentence boundaries
 */
const isSentenceEnd = (word: string) =>
  /[.!?]$/.test(word) || /[.!?]["'\u201D\u2019]$/.test(word);

// ─── Tokenizer ───

/**
 * Tokenize text into typed tokens with measurements.
 * Detects compound words, long slugs, punctuation stickiness, weak-end words.
 */
function tokenize(text: string, measurer: (text: string) => number): Token[] {
  if (!text || text.trim().length === 0) return [];

  // Split on whitespace while preserving the whitespace
  const parts = text.split(/(\s+)/);
  const tokens: Token[] = [];

  for (const part of parts) {
    if (!part) continue;

    // Whitespace token
    if (/^\s+$/.test(part)) {
      tokens.push({
        text: part,
        kind: "space",
        width: measurer(part),
      });
      continue;
    }

    // Word/punctuation token
    const lower = part.toLowerCase();
    const firstChar = part[0];
    const lastChar = part[part.length - 1];

    // Classify token kind
    let kind: TokenKind = "word";
    let stickyPrev = false;
    let stickyNext = false;
    let weakEnd = false;
    let protectedCompound = false;
    let emergencyBreakParts: string[] | undefined;

    // Opening punctuation
    if (OPEN_PUNCT.has(firstChar) && part.length === 1) {
      kind = "openPunct";
      stickyNext = true;
    }
    // Closing punctuation
    else if (CLOSE_PUNCT.has(lastChar) && (part.length === 1 || CLOSE_PUNCT.has(part))) {
      kind = "closePunct";
      stickyPrev = true;
    }
    // Dash
    else if (DASHES.has(part)) {
      kind = "dash";
      stickyPrev = true;
    }
    // Compound word (internal hyphen, <=20 chars)
    else if (part.length <= 20 && part.indexOf('-') > 0 && part.indexOf('-') < part.length - 1) {
      kind = "compound";
      protectedCompound = true;
    }
    // Long slug (>16 chars, no spaces)
    else if (part.length > 16 && !/\s/.test(part)) {
      kind = "longSlug";
      // Detect camelCase boundaries
      const camelParts = part.split(/(?<=[a-z])(?=[A-Z])/);
      if (camelParts.length > 1) {
        emergencyBreakParts = camelParts;
      } else {
        // Try underscore/slash
        const delimParts = part.split(/[_\/]/);
        if (delimParts.length > 1) {
          emergencyBreakParts = delimParts;
        }
      }
    }
    // Weak-end word
    else if (WEAK_END_WORDS.has(lower.replace(/[.,;:!?'"\u201D\u2019]+$/, ''))) {
      weakEnd = true;
    }

    tokens.push({
      text: part,
      kind,
      width: measurer(part),
      stickyPrev,
      stickyNext,
      weakEnd,
      protectedCompound,
      emergencyBreakParts,
    });
  }

  return tokens;
}

// ─── Compositor (replaces optimizeBreaks) ───

interface CompositorProfile {
  mainTarget: number;
  lastTarget: number;
  weakEndPenalty: number;
  orphanPenalty: number;
  flatShelfPenalty: number;
  snapPenalty: number;
  maxWordSpacing: number;
}

/**
 * Get compositor profile based on measure (character width).
 */
function profileForMeasure(measureCh: number): CompositorProfile {
  if (measureCh < 18) return {
    mainTarget: 0.85,
    lastTarget: 0.55,
    weakEndPenalty: 8200,
    orphanPenalty: 1e9,
    flatShelfPenalty: 240,
    snapPenalty: 180,
    maxWordSpacing: 0.018,
  };
  if (measureCh < 24) return {
    mainTarget: 0.82,
    lastTarget: 0.52,
    weakEndPenalty: 7600,
    orphanPenalty: 1e9,
    flatShelfPenalty: 200,
    snapPenalty: 140,
    maxWordSpacing: 0.025,
  };
  return {
    // 0.85 is the documented design center (RESEARCH.md: "cubic badness
    // centered on 85% fill — the sweet spot for ragged-right"). At 0.80 the
    // compositor set ~20% looser than the browser and cost 2-3 extra lines
    // per paragraph at 375px with no rag improvement (measured on /proof).
    mainTarget: 0.85,
    lastTarget: 0.48,
    weakEndPenalty: 7000,
    orphanPenalty: 1e9,
    flatShelfPenalty: 160,
    snapPenalty: 100,
    maxWordSpacing: 0.035,
  };
}

/**
 * Compose paragraph using beam search over exact break candidates.
 * Returns frozen lines with exact membership, or null if no valid composition.
 */
function composeParagraph(
  tokens: Token[],
  measurePx: number,
  measureCh: number,
  opts: { isHeading?: boolean } = {}
): FrozenLine[] | null {
  if (tokens.length === 0) return null;

  const profile = profileForMeasure(measureCh);
  // Long paragraphs need a wider beam: at 48, contour-diverse candidates
  // get pruned before the re-rank can consider them.
  const BEAM = tokens.length > 120 ? 80 : 48;
  const isHeading = opts.isHeading === true;
  // Heading-only sentence-boundary preference. Weighted far below orphanPenalty
  // (1e9) so widow prevention always wins — sentence breaks happen only "where
  // width allows." Rewards ending a line at a sentence boundary; penalizes a
  // line that crosses a boundary and leaves a sentence-start word dangling.
  const SENTENCE_END_BONUS = 1300;
  // 5200, was 2600: "…abandoned word. Books" — a five-letter sentence
  // opener dangled at a line end because the mild tier was cheap enough
  // for shape costs to outbid meaning (Dustin caught it on the essay,
  // 2026-07-09). Now above any plausible cliff sum, below the weak-end
  // floor (7000) that short openers already get.
  const DANGLING_START_PENALTY = 5200;
  // Gentle nudge against copula/auxiliary verbs at a line end (below the fill
  // penalty for a sub-0.70 line, so it only bumps when the line stays full).
  const LINKING_END_PENALTY = 1600;

  // Filter out pure whitespace tokens for line candidates
  const contentTokens = tokens.filter(t => t.kind !== "space");
  if (contentTokens.length < 2) return null;

  // Epistrophe detection — does the final word repeat a word that also closes an
  // earlier sentence ("…together. … together.")? In a heading that is a
  // deliberate rhetorical figure (parallel clauses), not a widow: a lone
  // repeated closer on the last line is intentional, so it's allowed instead of
  // prohibited. Body text keeps the hard one-word-last-line ban.
  const normWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isLexicalKind = (t: Token) =>
    t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  let parallelCloser = "";
  if (isHeading) {
    const lex = contentTokens.filter(isLexicalKind);
    const lastLex = lex[lex.length - 1];
    if (lastLex && isSentenceEnd(lastLex.text)) {
      const lastNorm = normWord(lastLex.text);
      for (let i = 0; i < lex.length - 1; i++) {
        if (isSentenceEnd(lex[i].text) && normWord(lex[i].text) === lastNorm) {
          parallelCloser = lastNorm;
          break;
        }
      }
    }
  }

  interface BeamState {
    tokenIndex: number;  // next token to place
    lines: { tokens: Token[]; width: number; fill: number }[];
    cost: number;
  }

  // Get space width from the original token list (first space token's width)
  const spaceToken = tokens.find(t => t.kind === "space");
  const spaceWidth = spaceToken ? spaceToken.width : 0;

  // Compute line width from content tokens + inter-word spaces
  const lineWidth = (lineTokens: Token[]): number => {
    const tokenWidths = lineTokens.reduce((sum, t) => sum + t.width, 0);
    const gaps = Math.max(0, lineTokens.length - 1);
    return tokenWidths + gaps * spaceWidth;
  };

  // --- Lexical helpers for scoring ---
  const isContent = (t: Token) => t.kind !== "space";
  const isLexical = (t: Token) =>
    t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";

  function firstContentToken(toks: Token[]): Token | null {
    return toks.find(isContent) ?? null;
  }
  function lastContentToken(toks: Token[]): Token | null {
    for (let i = toks.length - 1; i >= 0; i--) {
      if (isContent(toks[i])) return toks[i];
    }
    return null;
  }
  function lastLexicalToken(toks: Token[]): Token | null {
    for (let i = toks.length - 1; i >= 0; i--) {
      if (isLexical(toks[i])) return toks[i];
    }
    return null;
  }
  function lexicalWordCount(toks: Token[]): number {
    let n = 0;
    for (const t of toks) { if (isLexical(t)) n++; }
    return n;
  }

  // Protected compound boundary check
  // Currently compounds like "human-centric" are single tokens, so this catches
  // future cases where compound parts might be separate tokens with shared compoundId.
  function breaksProtectedCompoundAt(breakIndex: number): boolean {
    if (breakIndex <= 0 || breakIndex >= contentTokens.length) return false;
    const prev = contentTokens[breakIndex - 1];
    const next = contentTokens[breakIndex];
    if (!prev || !next) return false;
    if (prev.compoundId && next.compoundId && prev.compoundId === next.compoundId) {
      return true;
    }
    // Also check: if the previous token is a protected compound ending with hyphen
    // and next token could be its continuation (shouldn't happen with current tokenizer, but safety net)
    if (prev.protectedCompound && prev.text.endsWith('-')) {
      return true;
    }
    return false;
  }

  // Score a single line using lexical helpers
  const scoreLine = (
    lineTokens: Token[],
    fill: number,
    isLast: boolean,
    breakEnd: number
  ): number => {
    let penalty = 0;

    const lexCount = lexicalWordCount(lineTokens);
    const firstContent = firstContentToken(lineTokens);
    const lastContent = lastContentToken(lineTokens);
    const lastLexical = lastLexicalToken(lineTokens);

    // One lexical word on the final line. A lone repeated closer that completes
    // an epistrophe is intentional rhythm, not a widow — allow it (tiny cost).
    // Otherwise: a hard prohibition in body; a strong-but-finite deterrent in
    // headings, so display type only falls back to it when nothing else fits.
    if (isLast && lexCount === 1) {
      if (parallelCloser && lastLexical && normWord(lastLexical.text) === parallelCloser) {
        penalty += 200;
      } else if (isHeading) {
        penalty += 60000;
      } else {
        return profile.orphanPenalty;
      }
    }

    // One-word non-last line: terrible — unless it's a parallel closer completing
    // an epistrophe (then a lone repeated word is intentional rhythm, like the
    // last line) or a special long-token fallback.
    if (!isLast && lexCount === 1 && fill < 0.85 && lastLexical?.kind !== "longSlug") {
      const isParallelCloser =
        !!parallelCloser && !!lastLexical && normWord(lastLexical.text) === parallelCloser;
      penalty += isParallelCloser ? 200 : 50000;
    }

    // Two-word non-last line: bad if visually tiny
    if (!isLast && lexCount === 2 && fill < 0.50) {
      penalty += 5000;
    }

    // Fill deviation from target. Asymmetric: a line SHORTER than target wastes
    // measure and frays the rag, so it pays the full quadratic cost. A line
    // FULLER than target is typographically fine in ragged-right (TeX sets at
    // natural spacing) — it pays a soft cost only, and the justification guard
    // below handles the "every line full" failure mode at the paragraph level.
    const target = isLast ? profile.lastTarget : profile.mainTarget;
    const deviation = fill - target;
    penalty += (deviation < 0 ? 3000 : 1200) * deviation * deviation;

    // Very short non-last line
    // Short non-last lines — progressively harsh penalties
    if (!isLast && fill < 0.50) {
      penalty += 8000;
    } else if (!isLast && fill < 0.60) {
      penalty += 4000;
    } else if (!isLast && fill < 0.70) {
      penalty += 2000;
    } else if (!isLast && fill < 0.75) {
      penalty += 800;
    }

    // Tiny last line that feels quasi-orphaned even if 2 words
    if (isLast && fill < 0.30 && lexCount <= 2) {
      penalty += 4000;
    }

    // Long non-last lines. This ladder used to start charging at >0.84, which
    // (with nothing charged below target) centered the feasible band at ~0.79
    // and cost 2-3 extra lines per paragraph at 375px vs the browser — measured
    // on /proof. Full-ish lines are legitimate ragged-right; only genuinely
    // overfull ones pay, and the anti-justification transition scoring guards
    // against runs of them.
    if (!isLast && fill > 0.955) {
      penalty += 4000;
    } else if (!isLast && fill > 0.93) {
      penalty += 1200;
    }

    // Illegal line start: closePunct, dash, or stickyPrev
    if (firstContent && (
      firstContent.kind === "closePunct" ||
      firstContent.kind === "dash" ||
      firstContent.stickyPrev
    )) {
      penalty += 1e9;
    }

    // Illegal line end: openPunct or stickyNext
    if (lastContent && (
      lastContent.kind === "openPunct" ||
      lastContent.stickyNext
    )) {
      penalty += 1e9;
    }

    // Weak lexical word at line end: penalty, not hard fail
    if (!isLast && lastLexical?.weakEnd) {
      penalty += profile.weakEndPenalty;
    }

    // Gentle: copula/auxiliary verb stranded at a line end ("…Advertising is").
    if (!isLast && lastLexical && LINKING_END_WORDS.has(
      lastLexical.text.toLowerCase().replace(/[.,;:!?’'"”]+$/, "")
    )) {
      penalty += LINKING_END_PENALTY;
    }

    // Extra penalty for single-letter lexical endings like "a" / "I"
    if (!isLast && lastLexical && /^[A-Za-z]$/.test(lastLexical.text)) {
      penalty += profile.weakEndPenalty * 1.5;
    }

    // Protected compound boundary break
    if (breaksProtectedCompoundAt(breakEnd)) {
      penalty += 7000;
    }

    // Sentence-start dangling — BOTH modes. Penalize a non-last line that
    // crosses a sentence boundary and ends on the first word(s) of the next
    // sentence (e.g. "…public good. That"). The bump-down alternative wins
    // whenever the shortened previous line's fill penalty stays under this, so
    // it only fires "where width allows" and never overrides orphanPenalty.
    if (!isLast && lastContent && !isSentenceEnd(lastContent.text)) {
      let crossesBoundary = false;
      for (const t of lineTokens) {
        if (t === lastContent) break;
        if (t.kind !== "space" && isSentenceEnd(t.text)) {
          crossesBoundary = true;
          break;
        }
      }
      if (crossesBoundary) {
        // A SHORT opener stranded at a line end ("…justice. He") is the worst
        // case — penalize it hard enough to beat all but the most extreme
        // short-line cost, so the engine breaks before it. Longer openers get
        // the milder base penalty.
        const openerLen = lastContent.text.replace(/[^A-Za-z0-9]/g, "").length;
        penalty += openerLen <= 4 ? 7000 : DANGLING_START_PENALTY;
      }
    }

    // Heading-only: additionally reward a line that ends exactly at a sentence
    // boundary, so headlines break into clean parallel clauses when they fit.
    if (isHeading && lastContent && isSentenceEnd(lastContent.text)) {
      penalty -= SENTENCE_END_BONUS;
    }

    return penalty;
  };

  // Score transition for the NEWEST line only (not full history — that was double-counting)
  const scoreTransition = (lines: { fill: number }[], isLast: boolean): number => {
    if (lines.length < 2 || isLast) return 0; // the last line is short by design

    let penalty = 0;
    const i = lines.length - 1;
    const currFill = lines[i].fill;
    const prevFill = lines[i - 1].fill;

    // Graduated cliff cost with REAL teeth. This used to charge nothing
    // below a 22% jump — cliffs were free while the fill ladder charged
    // thousands, so the optimizer bought stairsteps to save pennies (the
    // choppy-rag bug). Quadratic from 6%: 10% ≈ 400, 14% ≈ 1600,
    // 18% ≈ 3600 — a cliff now costs as much as the flaw it "avoids".
    const jump = Math.abs(currFill - prevFill);
    if (jump > 0.06) {
      // Capped BELOW the weak-end penalty (3400): shape must never outbid
      // meaning — a cliff is ugly, a stranded "of" is a broken promise.
      penalty += Math.min(1800, 250000 * (jump - 0.06) * (jump - 0.06));
    }

    // Flat-shelf applies ONLY to the justified look (three matched FULL
    // lines). Three even lines at reading fills are book-normal — the old
    // rule punished smoothness itself.
    if (lines.length >= 3) {
      const prevPrevFill = lines[i - 2].fill;
      const avg = (currFill + prevFill + prevPrevFill) / 3;
      if (avg > 0.9 &&
          Math.abs(prevPrevFill - prevFill) < 0.04 &&
          Math.abs(prevFill - currFill) < 0.04) {
        penalty += profile.flatShelfPenalty;
      }
    }

    return penalty;
  };

  // Beam search — collect all complete states and pick the best
  let beam: BeamState[] = [{ tokenIndex: 0, lines: [], cost: 0 }];
  const completes: BeamState[] = [];
  let iterations = 0;
  const MAX_ITERATIONS = 500;  // Safety valve for very long paragraphs

  while (beam.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    const newBeam: BeamState[] = [];

    for (const state of beam) {
      const start = state.tokenIndex;

      // If this state is complete, keep it for contour re-ranking.
      if (start >= contentTokens.length) {
        if (completes.length < 200) completes.push(state);
        continue;
      }


      // Try all legal line candidates from this position
      for (let end = start + 1; end <= Math.min(start + 25, contentTokens.length); end++) {
        const lineTokens = contentTokens.slice(start, end);
        const width = lineWidth(lineTokens);
        const fill = width / measurePx;

        // Skip overfull lines (but allow slight overflow for last line)
        const isLast = end === contentTokens.length;
        // Hard admissibility cap. This was 0.85, which made browser-quality
        // fills (87-99%) inadmissible by construction — every paragraph set
        // ~15% looser than the browser and cost 2-3 extra lines at 375px
        // (measured on /proof). Full-ish lines must be POSSIBLE; the long-line
        // penalty ladder and the anti-justification guard decide how many are
        // wise. 0.97 leaves headroom so word-spacing contraction never overflows.
        if (fill > 0.97) continue;

        const linePenalty = scoreLine(lineTokens, fill, isLast, end);
        const newLines = [...state.lines, { tokens: lineTokens, width, fill }];
        const transitionPenalty = scoreTransition(newLines, isLast);

        newBeam.push({
          tokenIndex: end,
          lines: newLines,
          cost: state.cost + linePenalty + transitionPenalty,
        });
      }
    }

    // Keep top BEAM states
    newBeam.sort((a, b) => a.cost - b.cost);
    beam = newBeam.slice(0, BEAM);
  }

  // No valid composition found
  if (completes.length === 0) return null;

  // Contour re-ranking (the journal's Part V insight, applied to the beam
  // instead of Monte Carlo reruns): the cheapest composition by badness is not
  // always the most beautiful. Among compositions within a small slack of
  // optimal — where break-quality rules are already satisfied, since
  // violations carry penalties far larger than the slack — prefer the rag
  // with the best shape: low spread, no cliffs between neighbors, and no
  // "two-register" drift where the opening sets full and the tail sets loose.
  completes.sort((a, b) => a.cost - b.cost);
  let winner = completes[0];
  const isLong = winner.lines.length >= 10;
  // Slack capped below the weak-end penalty: the contour re-rank may trade
  // fill economics for shape, but can never adopt a candidate carrying a
  // violation the cheapest one avoided.
  const slack = Math.min(
    winner.cost * (isLong ? 0.2 : 0.15) + (isLong ? 1200 : 600),
    3200
  );
  const nearOptimal = completes.filter(s => s.cost <= winner.cost + slack);

  if (nearOptimal.length > 1) {
    const contourScore = (s: BeamState): number => {
      const fills = s.lines.slice(0, -1).map(l => l.fill);
      if (fills.length < 2) return 0;
      const spread = Math.max(...fills) - Math.min(...fills);
      let maxStep = 0;
      for (let i = 1; i < fills.length; i++) {
        maxStep = Math.max(maxStep, Math.abs(fills[i] - fills[i - 1]));
      }
      let registerShift = 0;
      if (fills.length >= 4) {
        const half = Math.ceil(fills.length / 2);
        const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
        registerShift = Math.abs(mean(fills.slice(0, half)) - mean(fills.slice(half)));
      }
      return 2.0 * spread + 3.0 * maxStep + 1.5 * registerShift;
    };
    winner = nearOptimal.reduce(
      (best, s) => (contourScore(s) < contourScore(best) ? s : best),
      nearOptimal[0]
    );
  }

  return winner.lines.map(line => ({
    text: line.tokens.map(t => t.text).join(' '),
    tokens: line.tokens,
    fill: line.fill,
    width: line.width,
    wordSpacingEm: 0,
  }));
}

// ─── Shape Exact Lines (replaces shapeRag) ───

/**
 * Adjust word-spacing within fixed line membership.
 * May NOT change which words belong to which line.
 */
function shapeExactLines(lines: FrozenLine[], measureCh: number, measurePx: number): FrozenLine[] | null {
  const profile = profileForMeasure(measureCh);
  const maxSpacingEm = profile.maxWordSpacing;

  const shapedLines: FrozenLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;

    // Last line: no adjustment
    if (isLast) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }

    // Count word gaps (spaces between word tokens — space tokens were filtered out,
    // so gaps = number of words minus 1)
    const wordCount = line.tokens.length;
    const gaps = Math.max(0, wordCount - 1);
    if (gaps === 0) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }

    // SHORT LINES: expand toward container edge
    // LONG LINES: contract slightly to create breathing room
    // Goal: visible rag adjustment, not uniform fill
    const fill = line.fill;
    let targetFill: number;

    // Target the median fill of non-last lines to smooth the rag dynamically
    const nonLastFills = lines.slice(0, -1).map(l => l.fill).sort((a, b) => a - b);
    const mid = Math.floor(nonLastFills.length / 2);
    targetFill = nonLastFills.length % 2 === 0 
      ? (nonLastFills[mid - 1] + nonLastFills[mid]) / 2 
      : nonLastFills[mid];
      
    // Prevent target from being too wide (justification) or too narrow.
    // Upper clamp must track the compositor's admissible band (fill <= 0.97)
    // or the accordion leans tight across the whole page: at 0.93, every
    // line legitimately composed in the 0.93-0.97 band was pulled DOWN by
    // word-spacing contraction — on real pages ~40% of lines sat at maximum
    // contraction and whole text blocks read "kerned tight" (Dustin's catch,
    // 2026-07-09). 0.965 re-centers the accordion where the compositor
    // actually lives; short lines still expand, genuinely overfull lines
    // still contract.
    targetFill = Math.max(0.70, Math.min(0.965, targetFill));

    const targetWidth = measurePx * targetFill;
    const delta = targetWidth - line.width;

    // Compute word-spacing adjustment in pixels, per gap
    const spacingPx = delta / gaps;

    // Convert to em using approximate font size
    const approxFontSize = measurePx / measureCh;
    const spacingEm = spacingPx / approxFontSize;

    // Gentle caps - revert to subtle.
    // NOTE: maxContract must stay within finalValidate()'s accepted range
    // (it rejects wordSpacingEm < -0.04). Previously 0.05, which caused every
    // line needing contraction to be composed and then rejected by the
    // validator — so longer paragraphs silently fell back to browser wrapping.
    const maxExpand = 0.03;    // subtle expansion on short lines
    const maxContract = 0.04;  // contraction cap, aligned with finalValidate

    // The accordion is ASYMMETRIC (Dustin, 2026-07-09). Expansion: short
    // lines always breathe out, at the cap if need be — air helps the rag
    // and never reads cramped. Contraction: only within reach; a line
    // needing more than twice the cap would gain a fraction of a gap at
    // the edge while visibly tightening its texture, so it stays natural
    // (the whole-page-reads-tight regression: at narrow measures most
    // lines were out of reach and piled at maximum contraction).
    if (spacingEm > maxExpand) {
      shapedLines.push({ ...line, wordSpacingEm: maxExpand });
    } else if (spacingEm < -maxContract) {
      shapedLines.push({ ...line, wordSpacingEm: spacingEm < -maxContract * 2 ? 0 : -maxContract });
    } else {
      shapedLines.push({ ...line, wordSpacingEm: spacingEm });
    }
  }

  return shapedLines;
}

// ─── Final Validator ───

/**
 * Validate final composition before rendering.
 */
function finalValidate(lines: FrozenLine[], measureCh: number, isHeading = false): boolean {
  if (!lines.length) return false;

  const profile = profileForMeasure(measureCh);

  const isContent = (t: Token) => t.kind !== "space";
  const isLexical = (t: Token) =>
    t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";

  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].tokens;
    const isLast = i === lines.length - 1;

    let lexCount = 0;
    for (const t of tokens) { if (isLexical(t)) lexCount++; }

    // One-word last line
    if (isLast && lexCount === 1 && !isHeading) return false;

    // Illegal line start
    const firstContent = tokens.find(isContent) ?? null;
    if (firstContent && (
      firstContent.kind === "closePunct" ||
      firstContent.kind === "dash" ||
      firstContent.stickyPrev
    )) {
      return false;
    }

    // Illegal line end
    let lastContent: Token | null = null;
    for (let j = tokens.length - 1; j >= 0; j--) {
      if (isContent(tokens[j])) { lastContent = tokens[j]; break; }
    }
    if (lastContent && (
      lastContent.kind === "openPunct" ||
      lastContent.stickyNext
    )) {
      return false;
    }

    // Spacing exceeds generous threshold
    if (lines[i].wordSpacingEm > 0.08 || lines[i].wordSpacingEm < -0.04) {
      return false;
    }
  }

  return true;
}

// ─── Render Frozen Lines as Block Spans ───

/**
 * Render exact lines as block spans (no pre-line + \n).
 */
function renderFrozenLines(p: HTMLElement, lines: FrozenLine[]): void {
  const cs = getComputedStyle(p);
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const measurer = makeMeasurer(p);
  safeWrite(() => {
    p.innerHTML = "";
    p.dataset.typesetDone = "1";
    p.setAttribute("role", "text");


    lines.forEach((line, i) => {
      const span = document.createElement("span");
      span.className = "ts-line";
      span.style.display = "block";
      span.style.whiteSpace = "pre";

      if (Math.abs(line.wordSpacingEm) > 0.0005) {
        span.style.wordSpacing = `${line.wordSpacingEm}em`;
      }

      // Optical margin alignment: hang leading punctuation / pull optical
      // capitals into the left margin so each line's optical left edge aligns.
      const indentPx = leadingOpticalIndentPx(line.text, measurer, fontSizePx);
      if (indentPx > 0.25) {
        span.style.textIndent = `-${indentPx.toFixed(2)}px`;
      }

      span.textContent = line.text;
      // Newline text node between block spans: invisible in layout, but it
      // restores word boundaries for clipboard, find-in-page, and screen
      // readers — without it textContent reads "The BalboaIs OlderThan Sound"
      // (dogfood #6).
      if (i > 0) p.appendChild(document.createTextNode('\n'));
      p.appendChild(span);
    });
  });
  measurer.cleanup?.();
}

/**
 * Heading mode: semantic-aware line breaks.
 * Prioritizes meaning over orphan prevention.
 * Binds at punctuation boundaries, keeps phrases together.
 */
function typesetHeadingText(text: string): string {
  if (!text || text.length < 5) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;

  const ARTICLES = new Set(['a', 'an', 'the']);
  const PREPS = new Set(['to', 'in', 'on', 'of', 'at', 'by', 'for', 'with', 'from']);

  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let word = words[i];

    // Compound hyphen protection (same as body text)
    if (word.length <= 20 && word.indexOf('-') > 0 && word.indexOf('-') < word.length - 1) {
      word = word.replace(/-/g, NBHY);
      words[i] = word;
    }

    const nextWord = i < words.length - 1 ? words[i + 1] : null;

    // Never let an article sit alone at end of line — bind to next word
    if (ARTICLES.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    // Never let a short preposition sit alone at end of line
    if (PREPS.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    result.push(word);
  }

  return result.join(' ');
}

/**
 * Insert non-breaking spaces to enforce typographic rules.
 * Works by analyzing word groups and binding words that must stay together.
 *
 * @param text The text to process
 * @param options Optional: { mode: 'body' | 'heading' }. Default: 'body'.
 */
export function typesetText(text: string, options?: TypesetOptions): string {
  const mode = options?.mode ?? 'body';
  // Educate quotes/dashes first so both the SSR string and the rendered glyphs
  // match what the client-side compositor measures. Idempotent.
  const educated = educateQuotes(text);
  if (mode === 'heading') {
    return typesetHeadingText(educated);
  }
  return typesetBodyText(educated, options?.measure);
}

/**
 * Convenience export for heading mode.
 */
export function typesetHeading(text: string): string {
  return typesetText(text, { mode: 'heading' });
}

/**
 * Body mode: LIGHTENED Phase 1 bindings.
 *
 * COMPOSITOR V2 (2026-03-17):
 * Phase 1 now ONLY handles truly inseparable relationships:
 *   - Opening quotes/brackets attach to next token
 *   - Closing punctuation attaches to previous token
 *   - Percent signs attach to previous token
 *   - Currency symbols attach to following token
 *   - One-letter article/pronoun protection (a, I) at every measure
 *   - Rule-1 floor: the final two atoms always bind (no one-word last lines)
 *
 * All weak-word handling is now done by the compositor via penalties.
 */
function typesetBodyText(text: string, measure?: number): string {
  if (!text || text.length < 10) return text;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;

  void measure; // kept for API compatibility; all bindings now run at every measure
  const result: string[] = [];

  for (let i = 0; i < words.length; i++) {
    let word = words[i];

    // Compound hyphen protection: replace internal hyphens with non-breaking hyphens
    // so the browser can't break "human-centric" into "human-" / "centric".
    if (word.length <= 20 && word.indexOf('-') > 0 && word.indexOf('-') < word.length - 1) {
      word = word.replace(/-/g, NBHY);
      words[i] = word;
    }

    const nextWord = i < words.length - 1 ? words[i + 1] : null;

    // Opening punctuation: bind to next word
    if (nextWord && /^[\(\[\{\u201C\u2018]$/.test(word)) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    // Closing punctuation at start of word: bind to previous word
    if (result.length > 0 && /^[\)\]\}\.,;:!?\u201D\u2019%]/.test(word)) {
      const last = result.pop()!;
      result.push(last + NBSP + word);
      continue;
    }

    // Currency symbols: bind to following token
    if (nextWord && /^[\$£€¥]$/.test(word)) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }

    // One-letter article/pronoun protection (a, I) — at EVERY measure. This
    // was gated to >=45ch, but phones need it most: "…households. I / know,
    // because…" is the worst-looking strand in the system, and a two-character
    // atom cannot meaningfully distort even a narrow rag (dogfood #3).
    if (nextWord) {
      const lc = word.toLowerCase();
      if (lc === 'a' || lc === 'i') {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }

    // Weak-end-word binding — orphan prevention for paragraphs the compositor
    // skips (because they contain inline HTML like <strong>, <a>, <em>). Binds
    // short function words and linking verbs to the next word with NBSP so they
    // can't land alone at line end. Responsive: browser still picks break points,
    // it just can't break on the NBSP.
    if (nextWord) {
      const lc = word.toLowerCase().replace(/[.,;:!?]+$/, '');
      const nextIsPunctOnly = /^[\)\]\}\.,;:!?\u201D\u2019%]+$/.test(nextWord);
      if (!nextIsPunctOnly && PHASE1_BIND_END_WORDS.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }

    result.push(word);
  }

  // Rule-1 floor: the last line must never be a single word. Weak-word
  // binding alone doesn't guarantee it ("…not to / through-traffic." — a
  // strong lone last word still orphans). Bind the final two atoms
  // unconditionally; worst case the pair wraps together, which is the
  // desired floor (dogfood #5).
  if (result.length >= 3) {
    const lastAtom = result.pop()!;
    const prevAtom = result.pop()!;
    result.push(prevAtom + NBSP + lastAtom);
  }

  return result.join(' ');
}

// Short function words + linking verbs bound to the next token in Phase 1
// so they can't hang alone at line end in paragraphs the compositor skips.
const PHASE1_BIND_END_WORDS = new Set([
  "a", "an", "the",
  "of", "to", "in", "on", "at", "by", "for", "from", "with",
  "and", "or", "but", "nor", "so", "as",
  "is", "are", "was", "were", "be", "been"
]);

/**
 * Measure an element's width in `ch` units using Canvas (no DOM mutation).
 * Falls back to an estimate if measurement fails.
 *
 * Exported so pages that call typesetText() directly can pass accurate measure.
 * NEVER use DOM probe spans for measurement — triggers MutationObserver loops.
 */
const _chCache = new WeakMap<HTMLElement, { width: number; ch: number }>();
let _canvas: CanvasRenderingContext2D | null = null;

export function measureCh(element: HTMLElement): number {
  // Check cache — invalidate if element width changed.
  // clientWidth is 0 on inline elements; fall back to the bounding rect
  // so they measure instead of silently defaulting (dogfood #8).
  const cached = _chCache.get(element);
  const elWidth = element.clientWidth || element.getBoundingClientRect().width;
  if (cached && cached.width === elWidth) return cached.ch;

  const cs = getComputedStyle(element);
  const containerPx = elWidth
    - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

  if (containerPx <= 0) return 65;

  // Use Canvas to measure '0' width — zero DOM mutations
  if (!_canvas) {
    const c = document.createElement('canvas');
    _canvas = c.getContext('2d');
  }
  if (_canvas) {
    _canvas.font = '7px serif'; // clear sticky state
    if ('letterSpacing' in _canvas) {
      (_canvas as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    }
    _canvas.font = canvasFontString(cs);
    const chPx = _canvas.font.includes(cs.fontSize) ? _canvas.measureText('0').width : 0;
    if (chPx > 0) {
      const ch = Math.floor(containerPx / chPx);
      _chCache.set(element, { width: elWidth, ch });
      return ch;
    }
  }

  // Fallback: estimate from font-size
  const fsPx = parseFloat(cs.fontSize) || 16;
  const ch = Math.floor(containerPx / (fsPx * 0.6));
  _chCache.set(element, { width: elWidth, ch });
  return ch;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITOR WIRING (2026-05-22) — connects the V2 beam-search compositor to
// the public `typeset()` entry point. Additive: the existing Phase-1 per-text-
// node path is preserved as the fallback for inline-markup blocks and for any
// element where no valid full composition exists.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Educate quotes & dashes: straight quotes → curly, "--" → em dash,
 * "..." → ellipsis. Conservative and idempotent — already-curly characters and
 * single hyphens (compounds like "human-centric") are left untouched. Runs
 * BEFORE line-breaking so the compositor measures the glyphs that actually render.
 */
function educateQuotes(text: string): string {
  if (!text) return text;
  let s = text;
  // Em dash from a double hyphen. Preserve the author's spacing style:
  // "word -- word" → "word — word" (spaced em dash, the site's house style),
  // "word--word" → "word—word" (closed em dash).
  s = s.replace(/\s+--\s+/g, ' — ');
  s = s.replace(/--/g, '—');
  // Ellipsis.
  s = s.replace(/\.\.\./g, '…');
  // Opening double quote: at start, or after whitespace / opening bracket / dash.
  s = s.replace(/(^|[\s([{—–])"/g, '$1“');
  // Any remaining double quote → closing.
  s = s.replace(/"/g, '”');
  // Apostrophe before a digit (decade/elision, e.g. '90s) → right single quote.
  s = s.replace(/'(?=\d)/g, '’');
  // Genuine opening single quote: after start/space/bracket, before a letter.
  s = s.replace(/(^|[\s([{—–])'(?=[A-Za-z])/g, '$1‘');
  // Contraction / possessive: letter|digit ' letter → right single quote.
  s = s.replace(/([A-Za-z0-9])'(?=[A-Za-z])/g, '$1’');
  // Anything left (e.g. plural possessive "workers'") → right single quote.
  s = s.replace(/'/g, '’');
  return s;
}

/**
 * Serialize a computed font for canvas with every family name QUOTED.
 * next/font's internal names ("__Source_Sans_3_abc123") are invalid in the
 * canvas font shorthand unless quoted — Safari rejects the string and
 * silently KEEPS THE PREVIOUS FONT, so a paragraph measured right after a
 * Playfair headline gets headline-sized metrics and composes starved
 * stanza lines (the iOS short-column bug).
 */
function canvasFontString(cs: CSSStyleDeclaration): string {
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i;
  const fams = cs.fontFamily
    .split(',')
    .map((f) => {
      const t = f.trim();
      if (generic.test(t) || /^['"]/.test(t)) return t;
      return '"' + t.replace(/"/g, '') + '"';
    })
    .join(', ');
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${fams}`;
}

/**
 * Build a font-accurate text measurer for an element. Canvas-first (zero DOM
 * mutation); if the canvas refuses the font string, falls back to a hidden
 * in-element span that inherits the REAL rendered font. Call .cleanup()
 * after measuring.
 */
type Measurer = ((text: string) => number) & { cleanup?: () => void };

function makeMeasurer(element: HTMLElement): Measurer {
  const cs = getComputedStyle(element);
  if (!_canvas) {
    const c = document.createElement('canvas');
    _canvas = c.getContext('2d');
  }
  const ctx = _canvas;
  const font = canvasFontString(cs);
  // '0px', NEVER '' — an empty string is an invalid letterSpacing and the
  // canvas SILENTLY KEEPS THE PREVIOUS VALUE. One tracked-out label (the
  // hero kicker runs .38em) then poisons every subsequent measurement on
  // the shared canvas: words measure ~25% wide, compositions starve.
  const letterSpacing =
    cs.letterSpacing && cs.letterSpacing !== 'normal' ? cs.letterSpacing : '0px';
  const fallbackCh = (parseFloat(cs.fontSize) || 16) * 0.5;

  // Verify the canvas actually accepted the font: reset to a sentinel, set,
  // and require the requested size to appear in the serialized result.
  let canvasOk = false;
  if (ctx) {
    ctx.font = '7px serif'; // sentinel — clears any sticky previous font
    if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    }
    ctx.font = font;
    canvasOk = ctx.font.includes(cs.fontSize);
  }

  if (ctx && canvasOk) {
    const m: Measurer = (text: string) => {
      ctx.font = font;
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = letterSpacing;
      }
      return ctx.measureText(text).width;
    };
    return m;
  }

  // DOM fallback: inherits the element's true font — correct on every engine.
  const probe = document.createElement('span');
  probe.style.cssText =
    'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
    'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
  element.appendChild(probe);
  const m: Measurer = (text: string) => {
    if (!probe.isConnected) return text.length * fallbackCh;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };
  m.cleanup = () => {
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  };
  return m;
}

/** Content-box width of an element in px (clientWidth minus horizontal padding). */
function containerPxOf(element: HTMLElement): number {
  const cs = getComputedStyle(element);
  // clientWidth is 0 on inline elements (a linked headline's <a>, a styled
  // <span>) — fall back to the bounding rect so they measure instead of
  // silently failing (dogfood #8).
  const base = element.clientWidth || element.getBoundingClientRect().width;
  return base - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/**
 * True when an element holds only text (or our own previously-rendered
 * `.ts-line` spans / `<br>`), so the compositor can safely reflow it. Elements
 * containing real inline markup (<strong>, <a>, <em>, …) or list structure are
 * left to the Phase-1 text-node path.
 */
function canCompose(element: HTMLElement): boolean {
  const tag = element.tagName;
  if (tag === 'UL' || tag === 'OL' || tag === 'LI') return false;
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;
    const el = child as HTMLElement;
    if (el.classList && el.classList.contains('ts-line')) continue; // our own prior render
    if (el.tagName === 'BR') continue;
    return false; // real inline markup — defer to Phase-1
  }
  return true;
}

/** Restore plain (educated) text so the Phase-1 fallback can bind it. */
function restorePlain(element: HTMLElement, raw: string): boolean {
  safeWrite(() => { element.textContent = raw; });
  return false;
}

/**
 * Post-render self-check: does any frozen line's actual rendered ink exceed
 * the paragraph's content box? Composition math and browser rendering can
 * disagree — most often when a webfont finished loading after measurement —
 * and a composed line that overflows the measure is worse than no composition
 * at all. Callers should restore plain text (or re-typeset) when this is true.
 */
export function linesOverflow(element: HTMLElement, tolerancePx = 0.75): boolean {
  const cs = getComputedStyle(element);
  const rightEdge = element.getBoundingClientRect().right - parseFloat(cs.paddingRight);
  for (const span of Array.from(element.querySelectorAll<HTMLElement>('.ts-line'))) {
    const range = document.createRange();
    range.selectNodeContents(span);
    if (range.getBoundingClientRect().right - rightEdge > tolerancePx) return true;
  }
  return false;
}

export interface TypesetAuditViolation {
  element: HTMLElement;
  type: 'overflow' | 'orphan' | 'weak-line-end';
  detail: string;
}

/**
 * Typeset.audit(selector?) — turn "trust us" into a checkable guarantee.
 * Scans composed elements (frozen .ts-line output) and returns typographic
 * violations measured from the ACTUAL rendering via DOM Range probes:
 * lines overflowing the measure, one-word last lines, and weak words
 * stranded at line ends. Suitable for CI and integration smoke tests.
 *
 * Note: a weak-line-end can be a deliberate trade at very narrow measures
 * (the engine bumps weak enders only "where width allows") — treat those
 * entries as review items, not hard failures.
 */
export function audit(
  selector = 'p, li, blockquote, figcaption, h1, h2, h3, h4'
): TypesetAuditViolation[] {
  if (typeof document === 'undefined') return [];
  const violations: TypesetAuditViolation[] = [];
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const lines = Array.from(el.querySelectorAll<HTMLElement>(':scope > .ts-line'));
    if (!lines.length) return;
    const cs = getComputedStyle(el);
    const rightEdge = el.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    lines.forEach((span, i) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const over = range.getBoundingClientRect().right - rightEdge;
      if (over > 0.75) {
        violations.push({
          element: el,
          type: 'overflow',
          detail: `line ${i + 1} exceeds the measure by ${over.toFixed(1)}px: "${(span.textContent || '').slice(0, 48)}"`,
        });
      }
      if (i < lines.length - 1) {
        const lastWord = (span.textContent || '').trim().split(/\s+/).pop() || '';
        const clean = lastWord.replace(/[^A-Za-z0-9’']+$/g, '').toLowerCase();
        if (WEAK_END_WORDS.has(clean) || LINKING_END_WORDS.has(clean)) {
          violations.push({
            element: el,
            type: 'weak-line-end',
            detail: `line ${i + 1} ends on "${lastWord}"`,
          });
        }
      }
    });
    const last = lines[lines.length - 1];
    const words = (last.textContent || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    if (lines.length > 1 && words.length === 1 && !/^H[1-6]$/.test(el.tagName)) {
      violations.push({
        element: el,
        type: 'orphan',
        detail: `last line is a single word: "${(last.textContent || '').trim()}"`,
      });
    }
  });
  return violations;
}

/**
 * The inverse of linesOverflow: were the composed lines rendered STARVED —
 * median non-last fill far below anything the compositor would choose on
 * purpose? Happens when the measurer overstated widths (e.g. a canvas that
 * silently kept a headline-sized font). Only meaningful with 3+ measured
 * lines; heading mode is exempt (display lines run loose by design).
 */
export function linesStarved(element: HTMLElement, medianFloor = 0.62): boolean {
  const cs = getComputedStyle(element);
  const left = element.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
  const width = element.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (width <= 0) return false;
  const spans = Array.from(element.querySelectorAll<HTMLElement>('.ts-line'));
  if (spans.length < 4) return false;
  const fills: number[] = [];
  for (let i = 0; i < spans.length - 1; i++) {
    const r = document.createRange();
    r.selectNodeContents(spans[i]);
    fills.push((r.getBoundingClientRect().right - left) / width);
  }
  fills.sort((a, b) => a - b);
  const median = fills[Math.floor(fills.length / 2)];
  return median < medianFloor;
}

/**
 * Full V2 line composition for a pure-text block. Sources the canonical raw
 * text (wrapper-provided `data-ts-raw`, then cache, then the live DOM), educates
 * quotes, runs the beam-search compositor, and renders frozen lines. Idempotent
 * across resize because the canonical text is cached and reused. Returns false
 * (after restoring plain text) when no valid composition exists.
 */
function composeElement(element: HTMLElement, measure: number): boolean {
  let raw = element.dataset.tsRaw
    ?? canonicalText.get(element)
    ?? (element.textContent || '');
  raw = educateQuotes(raw.trim());
  if (raw.length < 10) {
    element.dataset.tsOutcome = 'skipped:short';
    return false;
  }
  canonicalText.set(element, raw);

  const measurePx = containerPxOf(element);
  if (measurePx <= 0) {
    // Usually an inline element (clientWidth 0) or display:none.
    element.dataset.tsOutcome = 'unmeasurable';
    return false;
  }

  const measurer = makeMeasurer(element);
  const tokens = tokenize(raw, measurer);
  measurer.cleanup?.();
  // Heading detection must survive the linked-headline pattern (h4 > a, the
  // most common listing markup on the web): an anchor composed in body mode
  // hits the absolute orphan ban and can have NO legal composition at narrow
  // measures — the engine then ships the exact orphan it exists to prevent
  // (dogfood #1).
  const isHeading =
    /^H[1-6]$/.test(element.tagName) || !!element.closest('h1,h2,h3,h4,h5,h6');
  const composed = composeParagraph(tokens, measurePx, measure, { isHeading });
  if (!composed) {
    element.dataset.tsOutcome = 'fallback:no-composition';
    return restorePlain(element, raw);
  }

  const shaped = shapeExactLines(composed, measure, measurePx) ?? composed;
  if (!finalValidate(shaped, measure, isHeading)) {
    element.dataset.tsOutcome = 'fallback:validate';
    return restorePlain(element, raw);
  }

  renderFrozenLines(element, shaped);
  if (linesOverflow(element)) {
    element.dataset.tsOutcome = 'fallback:overflow';
    return restorePlain(element, raw);
  }
  // Symmetric self-check: overstated metrics produce STARVED lines (the
  // iOS canvas-font bug composed ~60% stanza columns). The compositor
  // never intends a median body fill below ~0.62 — if the render says
  // otherwise, the measurements were wrong; browser wrapping is better.
  if (!isHeading && linesStarved(element)) {
    element.dataset.tsOutcome = 'fallback:starved';
    return restorePlain(element, raw);
  }
  element.dataset.tsOutcome = 'composed';
  return true;
}

/**
 * Apply typographic rules to a DOM element's text content.
 * Processes text nodes recursively.
 *
 * Measures the element's actual width in `ch` units so that binding rules
 * scale appropriately — narrow mobile columns won't get aggressive bindings
 * that create near-justified text with a stranded last line.
 */
export function typeset(element: HTMLElement): void {
  if (!element) return;


  // Inject global styles once for typeset list refinements
  if (typeof document !== 'undefined' && !document.getElementById('ts-list-styles')) {
    const style = document.createElement('style');
    style.id = 'ts-list-styles';
    style.textContent = `
      /* ════════════════════════════════════════════════════════════════════
         SILVER BULLET — hung list markers with optical left alignment.
         Add class="ts-styled" to any <ul> (typeset() also adds it for you).

         CUSTOMIZE THE BULLET by setting CSS variables on the list, a wrapper,
         or :root — no need to edit this file. All are optional; the defaults
         reproduce the classic hung "•".

           --ts-bullet-content   the marker glyph        (default: "•")
           --ts-bullet-color     marker color            (default: currentColor)
           --ts-bullet-size      marker font-size        (default: 1.25em)
           --ts-bullet-opacity   marker opacity          (default: 0.8)
           --ts-bullet-top       vertical nudge          (default: 0.05em)

         EXAMPLES
           Dash:    ul.notes        { --ts-bullet-content: "–"; }
           Arrow:   ul.steps        { --ts-bullet-content: "‣"; --ts-bullet-color: #1D9E75; }
           Square:  ul.brand        { --ts-bullet-content: "\\25AA"; --ts-bullet-color: #1D9E75; }
           Hollow:  ul.subtle       { --ts-bullet-content: "\\25E6"; --ts-bullet-opacity: 1; }

         For a pixel-crisp box (rather than a glyph square), override the
         ::before in your own stylesheet:
           ul.brand > li::before {
             content: "" !important; background: #1D9E75 !important;
             width: .5em !important; height: .5em !important;
             font-size: inherit !important; top: .55em !important; left: -1.1em !important;
           }
         ════════════════════════════════════════════════════════════════════ */
      ul.ts-styled {
        list-style: none !important;
        padding-left: 1.25em !important;
      }
      ul.ts-styled > li {
        position: relative;
        margin-bottom: 1em !important;
        line-height: inherit !important;
      }
      ul.ts-styled > li:last-child {
        margin-bottom: 0 !important;
      }
      ul.ts-styled > li::before {
        content: var(--ts-bullet-content, "•");
        position: absolute;
        left: -1.25em;
        width: 1.25em;
        /* Right-align the bullet within its box so it sits close to the text */
        text-align: right;
        padding-right: 0.28em;
        box-sizing: border-box;
        font-size: var(--ts-bullet-size, 1.25em);
        color: var(--ts-bullet-color, currentColor);
        /* Lock line-height so the larger font doesn't stretch the baseline down */
        line-height: 1;
        /* Push it down slightly from the top of the li box to align with x-height */
        top: var(--ts-bullet-top, 0.05em);
        opacity: var(--ts-bullet-opacity, 0.8);
      }
    `;
    document.head.appendChild(style);
  }

  // Find ul elements and apply the refinement class
  if (element.tagName === 'UL') element.classList.add('ts-styled');
  element.querySelectorAll('ul').forEach(ul => ul.classList.add('ts-styled'));

  // Measure once for the whole element
  const measure = measureCh(element);

  // V2 compositor: full width-aware line shaping for pure-text blocks (headings
  // and simple paragraphs). Prevents orphans/widows by construction via the
  // beam search's orphan penalty. On success it renders frozen `.ts-line` spans
  // and we're done; otherwise fall through to the Phase-1 text-node path below.
  if (canCompose(element)) {
    if (composeElement(element, measure)) return;
  } else {
    element.dataset.tsOutcome = 'phase1:inline-markup';
  }

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const original = textNode.textContent;
    if (!original || original.trim().length < 10) continue;
    // Preserve leading/trailing whitespace (critical around inline elements like <strong>)
    const leadingSpace = original.match(/^\s*/)?.[0] || '';
    const trailingSpace = original.match(/\s*$/)?.[0] || '';
    const processed = typesetText(original.trim(), { measure });
    textNode.textContent = leadingSpace + processed + trailingSpace;
  }
}

/**
 * Apply typographic rules to all elements matching a selector.
 */
export function typesetAll(selector: string): void {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach(typeset);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPRECATED — POST-RENDER ANALYSIS (replaced by Compositor V2)
// ═══════════════════════════════════════════════════════════════════════════
//
// The functions below (fixRealOrphans, fixRag, smoothRag, optimizeBreaks, shapeRag)
// are DEPRECATED as of 2026-03-17. They are replaced by the token-aware compositor.
//
// Kept for reference only — DO NOT use in active pipeline.
// ═══════════════════════════════════════════════════════════════════════════

interface LineInfo {
  indices: number[];
  words: string[];
  width: number;
  fill: number;
}

interface LineAnalysis {
  lines: LineInfo[];
  words: string[];
  containerWidth: number;
}

/**
 * Detect actual rendered lines by wrapping words in measurement spans
 * and grouping by vertical position.
 *
 * IMPORTANT: This temporarily replaces innerHTML to measure, then restores it.
 * Must not be called inside a MutationObserver callback.
 */
function detectLines(el: HTMLElement): LineAnalysis | null {
  const text = el.textContent || '';
  if (!text.trim() || text.length < 20) return null;

  // Split on regular spaces only — preserve nbsp bindings as atoms
  const words = text.split(/ +/).filter(Boolean);
  if (words.length < 3) return null;

  const originalHTML = el.innerHTML;
  const originalWhiteSpace = el.style.whiteSpace;

  // Wrap each word in a measurement span
  el.innerHTML = words
    .map((w, i) => `<span data-lw="${i}">${w}</span>`)
    .join(' ');

  const spans = el.querySelectorAll<HTMLElement>('span[data-lw]');
  const cs = getComputedStyle(el);
  const containerWidth = el.clientWidth
    - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

  const lines: LineInfo[] = [];
  let currentTop = -1;
  let currentLine: number[] = [];

  spans.forEach((span, idx) => {
    const top = Math.round(span.getBoundingClientRect().top);
    if (currentTop === -1) {
      currentTop = top;
      currentLine = [idx];
    } else if (Math.abs(top - currentTop) > 3) {
      if (currentLine.length > 0) {
        const first = spans[currentLine[0]];
        const last = spans[currentLine[currentLine.length - 1]];
        const width = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
        lines.push({
          indices: currentLine,
          words: currentLine.map(i => words[i]),
          width,
          fill: width / containerWidth,
        });
      }
      currentTop = top;
      currentLine = [idx];
    } else {
      currentLine.push(idx);
    }
  });

  // Last line
  if (currentLine.length > 0) {
    const first = spans[currentLine[0]];
    const last = spans[currentLine[currentLine.length - 1]];
    const width = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
    lines.push({
      indices: currentLine,
      words: currentLine.map(i => words[i]),
      width,
      fill: width / containerWidth,
    });
  }

  // Restore
  el.innerHTML = originalHTML;
  el.style.whiteSpace = originalWhiteSpace;

  return { lines, words, containerWidth };
}

/**
 * Fix real orphans: only bind the last two words if the last line
 * actually contains a single word in the rendered layout.
 *
 * This is more accurate than the pre-render approach (which always binds
 * the last two words regardless of whether it's actually an orphan).
 */
export function fixRealOrphans(el: HTMLElement): boolean {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 2) return false;

  const lastLine = analysis.lines[analysis.lines.length - 1];

  // Only intervene if last line has exactly 1 word (a true rendered orphan)
  if (lastLine.words.length !== 1) return false;

  const prevLine = analysis.lines[analysis.lines.length - 2];
  if (prevLine.words.length < 2) return false;

  // Pull the last word of the previous line down by binding it to the orphan
  const pullWord = prevLine.words[prevLine.words.length - 1];
  const orphanWord = lastLine.words[0];

  const text = el.textContent || '';
  const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    escaped(pullWord) + '\\s+' + escaped(orphanWord) + '\\s*$'
  );
  const newText = text.replace(pattern, pullWord + NBSP + orphanWord);

  if (newText !== text) {
    el.textContent = newText;
    return true;
  }

  return false;
}

/**
 * Detect and fix lines with poor rag by applying targeted word-spacing
 * adjustments. Measures actual rendered line widths, computes a target,
 * and gently adjusts word-spacing per line to even out the right edge.
 *
 * This is a lighter version of smoothRag designed for all widths including mobile.
 * Uses smaller adjustment ranges on narrow screens.
 */
export function fixRag(el: HTMLElement): (() => void) | null {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 3) return null;

  const { lines, words, containerWidth } = analysis;
  const isNarrow = containerWidth < 350;

  // Compute target: median of non-last line widths
  const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
  const mid = Math.floor(nonLastWidths.length / 2);
  const target = nonLastWidths.length % 2 === 0
    ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2
    : nonLastWidths[mid];

  // Narrow screens: very subtle adjustments. Wide: more room.
  const MAX_EXPAND = isNarrow ? 0.5 : 1.8;
  const MAX_TIGHTEN = isNarrow ? 0.3 : 1.0;

  const baseWS = parseFloat(getComputedStyle(el).wordSpacing) || 0;
  const htmlParts: string[] = [];
  let anyAdjustment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.words.join(' ');
    const isLast = i === lines.length - 1;
    const spaces = line.words.length - 1;
    const gap = target - line.width;

    if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
      const rawDelta = gap / spaces;
      const wsDelta = rawDelta > 0
        ? Math.min(MAX_EXPAND, rawDelta * 0.7)
        : Math.max(-MAX_TIGHTEN, rawDelta * 0.5);

      if (Math.abs(wsDelta) > 0.05) {
        const finalWS = baseWS + wsDelta;
        htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
        anyAdjustment = true;
        continue;
      }
    }
    htmlParts.push(lineText);
  }

  if (!anyAdjustment) return null;

  const originalHTML = el.innerHTML;
  const originalWhiteSpace = el.style.whiteSpace;

  el.style.whiteSpace = 'pre-line';
  el.innerHTML = htmlParts.join('\n');

  // Return cleanup function
  return () => {
    el.innerHTML = originalHTML;
    el.style.whiteSpace = originalWhiteSpace;
  };
}

/**
 * Fix stranded sentence-start words: detect when the last word on a line
 * is a sentence-start word (preceded by . ! ? punctuation), then bind it
 * to the next word so they move to the next line together.
 *
 * This runs post-render so it measures actual line breaks, not guessing
 * from character counts.
 */
export function fixStrandedSentenceStarts(el: HTMLElement): boolean {
  const analysis = detectLines(el);
  if (!analysis || analysis.lines.length < 2) return false;

  const sentenceEndPattern = /[.!?]["'\u201D\u2019]?$/;
  let modified = false;
  const text = el.textContent || '';
  let newText = text;

  // Check each line except the last
  for (let i = 0; i < analysis.lines.length - 1; i++) {
    const line = analysis.lines[i];
    if (line.words.length === 0) continue;

    const lastWord = line.words[line.words.length - 1];

    // Check if this word itself ends with sentence-ending punctuation
    const wordEndsSentence = sentenceEndPattern.test(lastWord);

    // Or check if the previous word ended a sentence
    const prevWord = line.words.length > 1 ? line.words[line.words.length - 2] : null;
    const prevEndsSentence = prevWord && sentenceEndPattern.test(prevWord);

    if (wordEndsSentence || prevEndsSentence) {
      // This is a sentence-start word stranded at line end
      const nextLine = analysis.lines[i + 1];
      if (nextLine && nextLine.words.length > 0) {
        const nextWord = nextLine.words[0];

        // Bind lastWord to nextWord with nbsp
        const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          escaped(lastWord) + '\\s+' + escaped(nextWord),
          'g'
        );
        const replacement = lastWord + NBSP + nextWord;

        const before = newText;
        newText = newText.replace(pattern, replacement);
        if (newText !== before) modified = true;
      }
    }
  }

  if (modified) {
    el.textContent = newText;
    return true;
  }

  return false;
}

/**
 * Full post-render typography pass: runs after the browser has laid out text.
 * Detects and fixes actual rendered problems without pre-render guessing.
 *
 * Call this AFTER typeset() (which handles pre-render bindings).
 */
export function postRenderFix(element: HTMLElement): (() => void) | null {
  if (!element) return null;
  const text = element.textContent || '';
  if (text.length < 40) return null;

  // Step 1: Fix stranded sentence-start words
  fixStrandedSentenceStarts(element);

  // Step 2: Fix real orphans (only if actually orphaned in rendered layout)
  fixRealOrphans(element);

  // Step 3: Smooth rag with subtle word-spacing
  return fixRag(element);
}

/**
 * React hook: apply typeset to a ref on mount/update.
 * The ref is typed structurally ({ current }) so this file stays dependency-free
 * — a React RefObject satisfies it, but no `react` import is required to compile.
 */
export function useTypeset(ref: { readonly current: HTMLElement | null }, deps: any[] = []) {
  if (typeof window === 'undefined') return;

  // setTimeout, not rAF — rAF never fires in hidden tabs, so content that
  // mounted while backgrounded would never typeset (dogfood #7).
  const run = () => {
    setTimeout(() => {
      if (ref.current) typeset(ref.current);
    }, 0);
  };

  // MutationObserver approach for dynamic content
  if (ref.current) {
    run();
  }
}

/**
 * DEPRECATED: smoothRag v4 — DOM-measured Knuth-Plass optimal line breaking.
 *
 * ⚠️ REPLACED BY composeParagraph() + shapeExactLines() in Compositor V2 (2026-03-17)
 *
 * Uses actual DOM measurement (not canvas) for pixel-accurate word widths,
 * then applies Knuth-Plass dynamic programming to find globally optimal
 * break points that minimize rag variance.
 *
 * Two passes:
 *   1. Measure each word's rendered width using a hidden span in the same
 *      font context as the target element
 *   2. Run Knuth-Plass to find optimal breaks, insert <br> tags
 *   3. Apply subtle per-line word-spacing to polish
 *
 * Returns a cleanup function. Re-runs on resize via ResizeObserver.
 */
export interface SmoothRagOptions {
  /** If true, only adjust word-spacing on existing browser lines — never rewrite breaks */
  preserveBreaks?: boolean;
}

export function smoothRag(element: HTMLElement, options?: SmoothRagOptions): () => void {
  const originalHTML = element.innerHTML;
  const originalWhiteSpace = element.style.whiteSpace;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Light smooth mode — word-based line detection.
   * Wraps each word in a <span>, detects lines via offsetTop,
   * then applies per-line word-spacing. Never loses characters.
   */
  function applyLightSmooth(el: HTMLElement, containerWidth: number) {
    const text = el.textContent || '';
    if (!text.trim() || text.length < 40) return;

    // Get baseline word-spacing so we add our delta on top
    const baseWS = parseFloat(getComputedStyle(el).wordSpacing) || 0;

    // Split on regular spaces ONLY — preserve \u00A0 (nbsp) bindings from typesetText
    // so "worked\u00A0as" stays as one atomic unit, never split across lines
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return;

    // Phase 1: Wrap each word in a span to detect line positions
    el.innerHTML = words
      .map((w, i) => `<span data-w="${i}">${w}</span>`)
      .join(' ');

    // Phase 2: Group words into lines by their vertical position
    const wordSpans = el.querySelectorAll<HTMLElement>('span[data-w]');
    const lines: { wordIndices: number[]; width: number }[] = [];
    let currentLineTop = -1;
    let currentLine: number[] = [];

    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentLineTop === -1) {
        currentLineTop = top;
        currentLine = [idx];
      } else if (Math.abs(top - currentLineTop) > 3) {
        // New line — finalize previous
        if (currentLine.length > 0) {
          const firstSpan = wordSpans[currentLine[0]];
          const lastSpan = wordSpans[currentLine[currentLine.length - 1]];
          const lineWidth = lastSpan.getBoundingClientRect().right - firstSpan.getBoundingClientRect().left;
          lines.push({ wordIndices: currentLine, width: lineWidth });
        }
        currentLineTop = top;
        currentLine = [idx];
      } else {
        currentLine.push(idx);
      }
    });
    // Last line
    if (currentLine.length > 0) {
      const firstSpan = wordSpans[currentLine[0]];
      const lastSpan = wordSpans[currentLine[currentLine.length - 1]];
      const lineWidth = lastSpan.getBoundingClientRect().right - firstSpan.getBoundingClientRect().left;
      lines.push({ wordIndices: currentLine, width: lineWidth });
    }

    if (lines.length < 2) {
      // Not enough lines to smooth — restore plain text
      el.innerHTML = words.join(' ');
      return;
    }

    // Phase 3: Compute target (median of non-last line widths)
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const midIdx = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[midIdx - 1] + nonLastWidths[midIdx]) / 2
      : nonLastWidths[midIdx];

    // Phase 3b: Detect "near-justified + orphan last line" pattern.
    // If non-last lines all fill >88% and last line fills <60%,
    // shift target DOWN so we tighten all non-last lines, creating a
    // more natural rag instead of near-justified + stranded last line.
    const lastLineWidth = lines[lines.length - 1].width;
    const avgNonLastFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / containerWidth;
    const lastFill = lastLineWidth / containerWidth;
    if (avgNonLastFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      // Pull target down to ~80% of container to create visible rag
      target = Math.min(target, containerWidth * 0.82);
    }

    // Phase 4: Build HTML with per-line word-spacing
    // Narrow containers need much smaller adjustments — even 1px/gap
    // creates a justified appearance at ~6 words per line.
    const isNarrow = containerWidth < 350;
    const MAX_EXPAND = isNarrow ? 0.6 : 2.5;
    const MAX_TIGHTEN = isNarrow ? 0.4 : 1.5;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const lineWords = line.wordIndices.map(idx => words[idx]);
      const lineText = lineWords.join(' ');
      // Count ALL spaces (regular + nbsp inside atomic words) for word-spacing calc
      const spaces = (lineText.match(/[\s\u00A0]/g) || []).length;
      const gap = target - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        const rawDelta = gap / spaces;
        const wsDelta = rawDelta > 0
          ? Math.min(MAX_EXPAND, rawDelta * 0.8)
          : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);
        if (Math.abs(wsDelta) > 0.05) {
          const finalWS = baseWS + wsDelta;
          htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
          continue;
        }
      }
      htmlParts.push(lineText);
    }

    // Use \n with white-space:pre-line so textContent has real whitespace
    // (both <br> and display:block spans lose spaces in textContent)
    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
  }

  function apply() {
    // Reset
    element.innerHTML = originalHTML;

    const text = element.textContent || '';
    if (!text.trim() || text.length < 40) return;

    const cs = getComputedStyle(element);
    const containerWidth = element.clientWidth
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (containerWidth <= 0) return;

    const isNarrow = containerWidth < 400;

    // Very narrow containers (<250px): rag smoothing does more harm than good.
    // Let the browser handle it entirely.
    if (containerWidth < 250) return;

    // Light mode: accept browser breaks, just smooth word-spacing per line.
    // Used for narrow containers OR when preserveBreaks is requested.
    if (isNarrow || options?.preserveBreaks) {
      applyLightSmooth(element, containerWidth);
      return;
    }

    // Create a hidden measurement span inside the element (inherits all styles)
    const measurer = document.createElement('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
      'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
    element.style.position = element.style.position || 'relative';
    element.appendChild(measurer);

    const measureWord = (w: string): number => {
      measurer.textContent = w;
      return measurer.getBoundingClientRect().width;
    };

    const spaceWidth = measureWord('\u00A0'); // non-breaking space = true space width

    // Get baseline word-spacing so per-line deltas add on top, not replace
    const baseWS = parseFloat(cs.wordSpacing) || 0;

    // Split on regular spaces ONLY — preserve \u00A0 (nbsp) bindings from typesetText
    // so "typography\u00A0is\u00A0invisible." stays as one atomic unit
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 3) { element.removeChild(measurer); return; }

    // Measure all words (measurer must still be in DOM for getBoundingClientRect)
    const wordWidths = words.map(w => measureWord(w));
    element.removeChild(measurer);

    // Run Knuth-Plass to find optimal breakpoints
    const lineBreaks = knuthPlass(wordWidths, spaceWidth, containerWidth);

    if (lineBreaks.length < 2) return;

    // Build lines
    const lines: { words: string[]; width: number }[] = [];
    for (let i = 0; i < lineBreaks.length - 1; i++) {
      const start = lineBreaks[i];
      const end = lineBreaks[i + 1];
      const lineWords = words.slice(start, end);
      const w = lineWords.reduce((sum, word, j) => {
        return sum + wordWidths[start + j] + (j < lineWords.length - 1 ? spaceWidth : 0);
      }, 0);
      lines.push({ words: lineWords, width: w });
    }

    if (lines.length < 2) return;

    // Compute target: median of non-last line widths
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const midIdx = Math.floor(nonLastWidths.length / 2);
    let target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[midIdx - 1] + nonLastWidths[midIdx]) / 2
      : nonLastWidths[midIdx];

    // Detect "near-justified + orphan last line" — same logic as light smooth
    const lastWidth = lines[lines.length - 1].width;
    const avgFill = nonLastWidths.reduce((s, w) => s + w, 0) / nonLastWidths.length / containerWidth;
    const lastFill = lastWidth / containerWidth;
    if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
      target = Math.min(target, containerWidth * 0.82);
    }

    // Build HTML with per-line word-spacing (delta added to user's base)
    // Asymmetric: more expansion room than tightening
    const MAX_EXPAND = 2.5;
    const MAX_TIGHTEN = 1.5;
    const htmlParts: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Normalize nbsp → regular space so CSS word-spacing applies
      const lineText = line.words.join(' ').replace(/\u00A0/g, ' ');
      const isLast = i === lines.length - 1;
      const spaces = line.words.length - 1;
      const gap = target - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        const rawDelta = gap / spaces;
        const wsDelta = rawDelta > 0
          ? Math.min(MAX_EXPAND, rawDelta * 0.8)
          : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);
        if (Math.abs(wsDelta) > 0.05) {
          const finalWS = baseWS + wsDelta;
          htmlParts.push(`<span style="word-spacing:${finalWS.toFixed(2)}px">${lineText}</span>`);
          continue;
        }
      }
      htmlParts.push(lineText);
    }

    element.style.whiteSpace = 'pre-line';
    element.innerHTML = htmlParts.join('\n');
  }

  /**
   * Knuth-Plass line breaking for ragged-right.
   * Returns array of word indices where each line starts.
   */
  function knuthPlass(
    wordWidths: number[],
    spaceWidth: number,
    lineWidth: number,
  ): number[] {
    const n = wordWidths.length;
    const INF = 1e10;

    // dp[i] = minimum cost to break words[0..i-1], with line ending after word i-1
    const dp: number[] = new Array(n + 1).fill(INF);
    const from: number[] = new Array(n + 1).fill(-1);
    const lineWidthAt: number[] = new Array(n + 1).fill(0);
    dp[0] = 0;

    for (let j = 1; j <= n; j++) {
      // Try starting a line from word i to word j-1
      let w = 0;
      for (let i = j; i >= 1; i--) {
        // Width of words[i-1..j-1] with spaces between
        w += wordWidths[i - 1] + (i < j ? spaceWidth : 0);

        // Too wide? Stop looking further back
        if (w > lineWidth * 1.05 && i < j) break;

        if (dp[i - 1] >= INF) continue;

        // Compute badness
        const slack = lineWidth - w;
        const ratio = slack / lineWidth;
        const isLastLine = j === n;

        let badness: number;
        if (slack < -lineWidth * 0.03) {
          // Line is too long (beyond 3% tolerance)
          badness = Math.pow(Math.abs(ratio), 2) * 1000;
        } else if (isLastLine) {
          // Last line: penalize proportional to how short it is.
          // A line at 50% fill is acceptable, but anything under 35%
          // looks orphaned. Also consider how full previous lines are —
          // if they're all >90% fill and the last is <55%, the contrast
          // is jarring (looks like forced justification + orphan).
          const fill = w / lineWidth;
          if (fill < 0.35) {
            badness = Math.pow(0.35 - fill, 2) * 300;
          } else if (fill < 0.55) {
            // Check if prior lines are uniformly full (near-justified look)
            // Use lineWidthAt to estimate average prior fill
            let priorFillSum = 0;
            let priorCount = 0;
            for (let pi = 1; pi < j; pi++) {
              if (lineWidthAt[pi] > 0) {
                priorFillSum += lineWidthAt[pi] / lineWidth;
                priorCount++;
              }
            }
            const avgPriorFill = priorCount > 0 ? priorFillSum / priorCount : 0.8;
            if (avgPriorFill > 0.88) {
              // High contrast: near-justified lines + short last line
              badness = Math.pow(avgPriorFill - fill, 2) * 150;
            } else {
              badness = ratio > 0.5 ? Math.pow(ratio - 0.5, 2) * 20 : 0;
            }
          } else {
            badness = 0;
          }
        } else {
          // Normal line: penalize deviation from ~85% fill
          const ideal = lineWidth * 0.85;
          const dev = Math.abs(w - ideal) / lineWidth;
          badness = Math.pow(dev, 2) * 100;

          // Extra penalty for very short lines (<65% fill)
          if (w < lineWidth * 0.65) {
            badness += Math.pow((lineWidth * 0.65 - w) / lineWidth, 2) * 200;
          }
        }

        // Adjacent-line variance penalty
        if (i > 1 && lineWidthAt[i - 1] > 0) {
          const prevWidth = lineWidthAt[i - 1];
          const diff = Math.abs(w - prevWidth) / lineWidth;
          badness += Math.pow(diff, 2) * 30;
        }

        const cost = dp[i - 1] + badness;
        if (cost < dp[j]) {
          dp[j] = cost;
          from[j] = i - 1;
          lineWidthAt[j] = w;
        }
      }
    }

    // Trace back
    const breaks: number[] = [];
    let cur = n;
    while (cur > 0) {
      breaks.unshift(from[cur]);
      cur = from[cur];
    }
    breaks.push(n);

    return breaks;
  }

  apply();

  const observer = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 150); // no rAF — dead in hidden tabs
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    if (resizeTimer) clearTimeout(resizeTimer);
    element.innerHTML = originalHTML;
    element.style.whiteSpace = originalWhiteSpace;
  };
}

/**
 * smoothRagSpans — Non-destructive rag smoothing for word-wrapped content.
 *
 * Expects the container to hold words wrapped in <span data-w> elements
 * (with regular spaces between them in the DOM). Measures where the browser
 * placed each word, groups them into lines, and applies per-line word-spacing
 * adjustments to even out the right edge.
 *
 * Never rewrites innerHTML — only reads positions and sets inline styles.
 * Returns a cleanup function that removes the applied styles.
 *
 * Usage:
 *   // Render words as spans (React, vanilla JS, whatever)
 *   container.innerHTML = words.map((w, i) =>
 *     `<span data-w="${i}">${w}</span>`
 *   ).join(' ');
 *
 *   // Smooth the rag
 *   const cleanup = smoothRagSpans(container);
 *
 *   // Later, to reset:
 *   cleanup();
 */
export function smoothRagSpans(container: HTMLElement): () => void {
  const wordSpans = container.querySelectorAll<HTMLElement>('span[data-w]');
  if (wordSpans.length < 4) return () => {};

  const containerWidth = container.clientWidth;
  if (containerWidth < 250) return () => {};

  // Group spans into lines by vertical position
  const lines: HTMLElement[][] = [];
  let currentTop = -1;
  let currentLine: HTMLElement[] = [];

  wordSpans.forEach((span) => {
    const top = Math.round(span.getBoundingClientRect().top);
    if (currentTop === -1) {
      currentTop = top;
      currentLine = [span];
    } else if (Math.abs(top - currentTop) > 3) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentTop = top;
      currentLine = [span];
    } else {
      currentLine.push(span);
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  if (lines.length < 2) return () => {};

  // Measure each line's width (first span left → last span right)
  const lineWidths = lines.map((line) => {
    const first = line[0].getBoundingClientRect();
    const last = line[line.length - 1].getBoundingClientRect();
    return last.right - first.left;
  });

  // Target: median of non-last line widths
  const nonLast = lineWidths.slice(0, -1).sort((a, b) => a - b);
  const mid = Math.floor(nonLast.length / 2);
  const target = nonLast.length % 2 === 0
    ? (nonLast[mid - 1] + nonLast[mid]) / 2
    : nonLast[mid];

  // Asymmetric limits: short lines get more expansion room
  const isNarrow = containerWidth < 350;
  const MAX_EXPAND = isNarrow ? 1.5 : 2.5;   // px per word gap
  const MAX_TIGHTEN = isNarrow ? 0.75 : 1.5;

  const styledSpans: HTMLElement[] = [];

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    const spaces = line.length - 1;
    const gap = target - lineWidths[i];

    if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
      const rawDelta = gap / spaces;
      const wsDelta = rawDelta > 0
        ? Math.min(MAX_EXPAND, rawDelta * 0.8)    // expand short lines
        : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);  // tighten long lines
      if (Math.abs(wsDelta) > 0.05) {
        line.forEach((span) => {
          span.style.wordSpacing = `${wsDelta.toFixed(2)}px`;
          styledSpans.push(span);
        });
      }
    }
  });

  // Cleanup: remove word-spacing from all spans we touched
  return () => {
    styledSpans.forEach((span) => { span.style.wordSpacing = ''; });
  };
}

/**
 * DEPRECATED: optimizeBreaks — Production paragraph break optimizer.
 *
 * ⚠️ REPLACED BY composeParagraph() in Compositor V2 (2026-03-17)
 *
 * Applies Knuth-Plass dynamic programming with:
 *   - Break quality rules: no stranded prepositions, conjunctions, or articles
 *   - Sentence start protection: new sentences don't dangle at line ends
 *   - Stairstep demerits: penalizes consecutive lines differing >10% fill
 *   - Cubic badness: strongly prefers many small deviations over few large ones
 *   - Bringhurst measure diagnostic: logs warnings for narrow columns
 *
 * Does NOT adjust word-spacing or letter-spacing — only controls WHERE
 * lines break. This preserves the browser's natural spacing rhythm.
 *
 * Based on research from Tschichold, Bringhurst, Ruder, and Knuth-Plass.
 * See docs/RESEARCH.md for full methodology.
 *
 * Returns a cleanup function. Re-runs on resize via ResizeObserver.
 */

// Only bind the shortest, most visually problematic words.
// Binding too many creates rigid clusters that produce worse rag than the browser default.
// Rule: only bind words ≤2 characters that look stranded at line end.
const OPT_SHORT_BIND = new Set(
  'a an the of in to at by on or is it if no so as we do be'.split(' ')
);

function isOptSentenceEnd(w: string): boolean {
  return /[.!?]["'\u201D\u2019]?$/.test(w);
}

interface OptimizeBreaksOptions {
  /** Called after each apply (including resize re-runs). Use for Pass 2. */
  onApplied?: () => void;
}

export function optimizeBreaks(element: HTMLElement, opts?: OptimizeBreaksOptions): () => void {
  const originalHTML = element.innerHTML;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastWidth = -1;

  function apply() {
    // Restore original content before re-measuring
    element.innerHTML = originalHTML;

    const text = element.textContent || '';
    if (!text.trim() || text.length < 40) return;

    const cs = getComputedStyle(element);
    const containerWidth =
      element.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);

    if (containerWidth < 200) return;

    // Prevent resize observer loops
    if (Math.abs(containerWidth - lastWidth) < 2) return;
    lastWidth = containerWidth;

    // Create hidden measurer inheriting all font styles
    const measurer = document.createElement('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
      'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
    element.style.position = element.style.position || 'relative';
    element.appendChild(measurer);

    const measureWord = (w: string): number => {
      measurer.textContent = w;
      return measurer.getBoundingClientRect().width;
    };

    // Split on regular spaces only — preserve nbsp bindings from typesetText
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 3) {
      element.removeChild(measurer);
      return;
    }

    // Measure all words and space width
    const wordWidths = words.map(w => measureWord(w));
    const spaceWidth = (() => {
      measurer.innerHTML = 'a b';
      const ab = measurer.getBoundingClientRect().width;
      measurer.textContent = 'ab';
      return ab - measurer.getBoundingClientRect().width;
    })();

    element.removeChild(measurer);

    const n = words.length;
    const cw = containerWidth;

    // Build break-quality violation set — conservative.
    // Only bind short words (≤2-3 chars) that look bad stranded at line end.
    // Do NOT bind longer prepositions (from, with, beyond, between, etc.)
    // — they don't look stranded and over-binding worsens the rag.
    const noEndLine = new Set<number>();
    for (let i = 0; i < n - 1; i++) {
      const lower = words[i].toLowerCase().replace(/[.,;:!?'"\u201D\u2019]+$/, '');
      if (OPT_SHORT_BIND.has(lower)) noEndLine.add(i);
    }

    // Line width calculator
    function lineWidth(start: number, end: number): number {
      let w = 0;
      for (let i = start; i < end; i++) w += wordWidths[i];
      return w + (end - start - 1) * spaceWidth;
    }

    // Knuth-Plass DP with break quality + stairstep demerits
    interface DPEntry {
      cost: number;
      prev: number;
      fill: number | null;
    }

    function lineBadness(
      start: number,
      end: number,
      isLast: boolean,
      prevFill: number | null
    ): number {
      const lw = lineWidth(start, end);
      if (lw > cw * 1.005) return 1e9;
      const fill = lw / cw;
      const nw = end - start;
      let badness = 0;

      if (isLast) {
        // ORPHAN PREVENTION (built into optimizer):
        // A one-word last line receives massive penalty
        if (nw === 1) return 1e6;
        if (nw === 1 && fill < 0.25) return 150;
        if (fill < 0.15) return 100;
        return 0;
      }

      // Cubic badness (Knuth)
      const deviation = Math.abs(fill - 0.85);
      badness += Math.pow(deviation / 0.15, 3) * 100;

      // Stairstep demerits
      if (prevFill !== null) {
        const step = Math.abs(fill - prevFill);
        if (step > 0.15) badness += 200;
        else if (step > 0.10) badness += 80;
      }

      // Break quality
      if (noEndLine.has(end - 1)) badness += 500;

      // Short/thin line penalties
      if (nw <= 2 && fill < 0.55) badness += 150;
      if (fill < 0.40) badness += 300;

      return badness;
    }

    // Run DP
    const dp: DPEntry[] = new Array(n + 1).fill(null);
    dp[0] = { cost: 0, prev: -1, fill: null };

    for (let i = 1; i <= n; i++) {
      let best: DPEntry = { cost: 1e9, prev: -1, fill: 0 };
      for (let j = Math.max(0, i - 25); j < i; j++) {
        if (!dp[j] || dp[j].cost >= 1e9) continue;
        const isLast = i === n;
        const lw = lineWidth(j, i);
        const fill = lw / cw;
        const cost = dp[j].cost + lineBadness(j, i, isLast, dp[j].fill);
        if (cost < best.cost) {
          best = { cost, prev: j, fill };
        }
      }
      dp[i] = best;
    }

    // Reconstruct break points → set of word indices where lines START
    const lineStarts = new Set<number>();
    lineStarts.add(0);
    let pos = n;
    const breakStack: number[] = [];
    while (pos > 0) {
      breakStack.push(dp[pos].prev);
      pos = dp[pos].prev;
    }
    breakStack.reverse();
    for (const s of breakStack) lineStarts.add(s);

    // Determine which word gaps should be PREVENTED from breaking.
    // Strategy: only bind words that the DP says must stay together —
    // specifically, words flagged in noEndLine (prepositions, conjunctions,
    // articles, sentence starters) that the DP chose to keep on the same line.
    // All other spaces remain breakable so the browser can still wrap naturally.
    const preventBreakAfter = new Set<number>();

    // For each line the DP chose, check if any word in the line is in noEndLine
    // and is NOT the last word — those spaces should be nbsp
    let lineStart = 0;
    for (const s of breakStack) {
      if (s === 0) { lineStart = 0; continue; }
      // Line is words[lineStart..s) — not used here
      lineStart = s;
    }

    // Simpler: for every word in noEndLine, if the DP chose NOT to break
    // after it (i.e., word i and word i+1 are on the same line), bind them.
    for (const wordI of noEndLine) {
      // word wordI should not end a line.
      // If wordI+1 is NOT a lineStart, they're already on the same line — good, no action.
      // If wordI+1 IS a lineStart... the DP broke there anyway (couldn't avoid it).
      // Either way, bind wordI to wordI+1 with nbsp.
      if (wordI < n - 1) {
        preventBreakAfter.add(wordI);
      }
    }

    // Apply: walk innerHTML, replace spaces after flagged words with nbsp.
    // This preserves ALL HTML tags (strong, em, a, etc.)
    const html = originalHTML;
    let gapIndex = 0; // tracks inter-word gap position
    let inTag = false;
    let inWord = false;
    let result = '';

    for (let i = 0; i < html.length; i++) {
      const ch = html[i];

      if (ch === '<') {
        inTag = true;
        result += ch;
        continue;
      }
      if (ch === '>') {
        inTag = false;
        result += ch;
        continue;
      }
      if (inTag) {
        result += ch;
        continue;
      }

      // Text content
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
        if (inWord) {
          gapIndex++;
          inWord = false;
        }
        // gapIndex = gap after word (gapIndex-1), before word gapIndex
        // preventBreakAfter has word indices — gap after word i is gapIndex when gapIndex === i+1
        // Actually: gapIndex counts up each word boundary.
        // After word 0, gapIndex=1. After word 1, gapIndex=2. etc.
        // So the gap "after word i" corresponds to gapIndex === i+1
        // preventBreakAfter.has(i) means "don't break after word i" = gapIndex === i+1
        if (preventBreakAfter.has(gapIndex - 1)) {
          result += '\u00A0';
        } else {
          result += ' ';
        }
      } else if (ch === '\u00A0') {
        // Already nbsp — preserve
        result += '\u00A0';
      } else {
        if (!inWord) inWord = true;
        result += ch;
      }
    }

    element.innerHTML = result;
    opts?.onApplied?.();
  }

  apply();

  // Re-run on resize (debounced)
  const observer = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      lastWidth = -1; // Reset so apply() doesn't skip
      apply(); // no rAF — dead in hidden tabs
    }, 250);
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    if (resizeTimer) clearTimeout(resizeTimer);
    element.innerHTML = originalHTML;
  };
}

/**
 * DEPRECATED: shapeRag — Pass 2: Active rag coastline sculpting via per-line word-spacing + letter-spacing.
 *
 * ⚠️ REPLACED BY shapeExactLines() in Compositor V2 (2026-03-17)
 *
 * THE KEY DIFFERENTIATOR: This is OFFENSIVE, not defensive. We actively detect
 * "flat runs" (consecutive lines at similar fill percentages) and CREATE variation
 * to produce a coastline-like rag, not a fence-like justified appearance.
 *
 * Runs AFTER optimizeBreaks (Pass 1) has set nbsp bindings.
 * Measures actual rendered line widths, then:
 *   1. Detects flat runs (2+ consecutive non-last lines within ~5% fill)
 *   2. Actively reshapes them with targeted word-spacing adjustments
 *   3. Creates wave pattern: tighten→expand→tighten or expand→tighten→expand
 *   4. Respects Tschichold tolerances: word-spacing 80–133% of natural space
 *   5. Conservative letter-spacing: ±2% of em
 *   6. Line-height adaptive scaling: more room at higher leading
 *   7. Narrow column awareness: reduced adjustments at <24ch
 *
 * Does NOT change line breaks — only adjusts spacing within existing lines.
 */
export function shapeRag(element: HTMLElement): void {
    const text = element.textContent || '';
    if (!text.trim() || text.length < 60) return;

    const cs = getComputedStyle(element);
    const textAlign = cs.textAlign;

    // Skip centered text (auto-detect)
    if (textAlign === 'center') return;

    const containerWidth =
      element.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);

    if (containerWidth < 250) return;

    // Narrow column detection (using measureCh or estimate)
    const measure = measureCh(element);
    const isNarrow = measure < 24;

    // Very narrow containers: skip or heavily reduce shaping
    if (measure < 15) return;

    // --- Measure font metrics ---
    const fontSize = parseFloat(cs.fontSize) || 16;
    const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.5;
    const lhRatio = lineHeight / fontSize;

    // Line-height adaptive scaling: 1.0 at lh=1.5, ±10% per 0.1 deviation
    const lhScale = 1.0 + (lhRatio - 1.5);

    // Measure natural space width
    const measurer = document.createElement('span');
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
      'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
    element.style.position = element.style.position || 'relative';
    element.appendChild(measurer);

    measurer.innerHTML = 'a b';
    const abWidth = measurer.getBoundingClientRect().width;
    measurer.textContent = 'ab';
    const naturalSpace = abWidth - measurer.getBoundingClientRect().width;

    element.removeChild(measurer);

    if (naturalSpace < 1) return;

    // Tschichold tolerances: 80–133% of natural space
    // At narrow widths, use smaller adjustments
    const narrowScale = isNarrow ? 0.5 : 1.0;
    const maxTighten = naturalSpace * 0.20 * Math.max(0.5, lhScale) * narrowScale;  // tighten by up to 20%
    const maxExpand = naturalSpace * 0.33 * Math.max(0.5, lhScale) * narrowScale;   // expand by up to 33%
    // Letter-spacing: ±2% of em (very conservative)
    const maxLS = fontSize * 0.02 * Math.max(0.5, lhScale) * narrowScale;

    // --- Detect lines by wrapping words in spans ---
    // Split on regular spaces only — preserve nbsp bindings
    const words = text.split(/ +/).filter(Boolean);
    if (words.length < 4) return;

    element.innerHTML = words
      .map((w, i) => `<span data-sw="${i}">${w}</span>`)
      .join(' ');

    const wordSpans = element.querySelectorAll<HTMLElement>('span[data-sw]');
    const lines: { wordIndices: number[]; width: number }[] = [];
    let currentTop = -1;
    let currentLine: number[] = [];

    wordSpans.forEach((span, idx) => {
      const top = Math.round(span.getBoundingClientRect().top);
      if (currentTop === -1) {
        currentTop = top;
        currentLine = [idx];
      } else if (Math.abs(top - currentTop) > 3) {
        if (currentLine.length > 0) {
          const first = wordSpans[currentLine[0]];
          const last = wordSpans[currentLine[currentLine.length - 1]];
          lines.push({
            wordIndices: [...currentLine],
            width: last.getBoundingClientRect().right - first.getBoundingClientRect().left,
          });
        }
        currentTop = top;
        currentLine = [idx];
      } else {
        currentLine.push(idx);
      }
    });
    if (currentLine.length > 0) {
      const first = wordSpans[currentLine[0]];
      const last = wordSpans[currentLine[currentLine.length - 1]];
      lines.push({
        wordIndices: [...currentLine],
        width: last.getBoundingClientRect().right - first.getBoundingClientRect().left,
      });
    }

    if (lines.length < 3) return;

    // --- Compute fills for each line ---
    const fills = lines.map(l => l.width / containerWidth);

    // --- ACTIVE RAG SCULPTING: Detect flat runs ---
    // Flat run = 2+ consecutive non-last lines where fills are within 5% of each other
    interface FlatRun {
      start: number;
      end: number;   // exclusive
      avgFill: number;
    }
    const flatRuns: FlatRun[] = [];
    const FLAT_THRESHOLD = 0.05;

    for (let i = 0; i < lines.length - 2; i++) {  // -2 because we never include last line in flat runs
      const runStart = i;
      let runEnd = i + 1;
      const baseFill = fills[i];
      if (baseFill === undefined) continue;

      // Extend run while consecutive lines are within threshold
      while (runEnd < lines.length - 1) {
        const nextFill = fills[runEnd];
        if (nextFill === undefined) break;
        if (Math.abs(nextFill - baseFill) >= FLAT_THRESHOLD) break;
        runEnd++;
      }

      if (runEnd - runStart >= 2) {
        const runFills = fills.slice(runStart, runEnd);
        const avgFill = runFills.reduce((s, f) => s + f, 0) / runFills.length;
        flatRuns.push({ start: runStart, end: runEnd, avgFill });
        i = runEnd - 1;  // Skip to end of this run
      }
    }

    // --- Compute target: median of non-last line widths ---
    const nonLastWidths = lines.slice(0, -1).map(l => l.width).sort((a, b) => a - b);
    const midIdx = Math.floor(nonLastWidths.length / 2);
    const targetLeft = nonLastWidths[midIdx - 1];
    const targetMid = nonLastWidths[midIdx];
    if (targetLeft === undefined || targetMid === undefined) return;
    let target = nonLastWidths.length % 2 === 0
      ? (targetLeft + targetMid) / 2
      : targetMid;

    // Anti-justification guard: if all non-last fills > 92% AND within 4% of each other,
    // the text already looks near-justified. Scale back adjustments 50%.
    const nonLastFills = lines.slice(0, -1).map(l => l.width / containerWidth);
    const allAbove92 = nonLastFills.every(f => f > 0.92);
    const fillRange = Math.max(...nonLastFills) - Math.min(...nonLastFills);
    const nearJustified = allAbove92 && fillRange < 0.04;

    // Near-justified + orphan pattern: pull target down
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      const lastFill = lastLine.width / containerWidth;
      const avgFill = nonLastFills.reduce((s, f) => s + f, 0) / nonLastFills.length;
      if (avgFill > 0.88 && lastFill < 0.60 && lines.length > 2) {
        target = Math.min(target, containerWidth * 0.82);
      }
    }

    const baseWS = parseFloat(cs.wordSpacing) || 0;

    // --- Compute per-line adjustments with ACTIVE RESHAPING for flat runs ---
    interface LineAdj { wsPerGap: number; lsPerChar: number; direction: number; isFlatRun: boolean }
    const adjustments: LineAdj[] = [];

    // Mark which lines are in flat runs
    const inFlatRun = new Set<number>();
    for (const run of flatRuns) {
      for (let i = run.start; i < run.end; i++) {
        inFlatRun.add(i);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const isLast = i === lines.length - 1;
      const lineWords = line.wordIndices.map(idx => words[idx] || '').filter(Boolean);
      // Count gaps (spaces between words)
      const gaps = lineWords.length - 1;
      const totalChars = lineWords.join('').length;

      if (isLast || gaps === 0) {
        adjustments.push({ wsPerGap: 0, lsPerChar: 0, direction: 0, isFlatRun: false });
        continue;
      }

      // Check if this line is in a flat run
      const isInFlatRun = inFlatRun.has(i);
      let gap = target - line.width;

      // ACTIVE RESHAPING: If in a flat run, create wave pattern
      if (isInFlatRun) {
        // Find which flat run this belongs to
        const run = flatRuns.find(r => i >= r.start && i < r.end);
        if (run) {
          const posInRun = i - run.start;
          const runLength = run.end - run.start;

          // Create alternating wave: tighten→expand→tighten or expand→tighten→expand
          // Pattern depends on whether run starts with high or low fill
          const shouldTighten = posInRun % 2 === 0 ? run.avgFill > 0.85 : run.avgFill <= 0.85;

          if (shouldTighten) {
            // Pull to ~82% fill (create visible rag)
            gap = containerWidth * 0.82 - line.width;
          } else {
            // Push to ~92% fill (but not more than 95%)
            gap = Math.min(containerWidth * 0.92, containerWidth * 0.95) - line.width;
          }
        }
      }

      // Primary lever: word-spacing
      let wsPerGap = gap / gaps;
      wsPerGap = Math.max(-maxTighten, Math.min(maxExpand, wsPerGap));

      // Constraint: never make line shorter than 60% fill or longer than 95% fill
      const projectedWidth = line.width + wsPerGap * gaps;
      const projectedFill = projectedWidth / containerWidth;
      if (projectedFill < 0.60) {
        // Recalculate to hit 60% minimum
        const targetWidth = containerWidth * 0.60;
        wsPerGap = (targetWidth - line.width) / gaps;
        wsPerGap = Math.max(-maxTighten, Math.min(maxExpand, wsPerGap));
      } else if (projectedFill > 0.95) {
        // Recalculate to hit 95% maximum
        const targetWidth = containerWidth * 0.95;
        wsPerGap = (targetWidth - line.width) / gaps;
        wsPerGap = Math.max(-maxTighten, Math.min(maxExpand, wsPerGap));
      }

      // Secondary lever: letter-spacing for remaining gap
      const wsGain = wsPerGap * gaps;
      const remaining = gap - wsGain;
      let lsPerChar = 0;
      if (Math.abs(remaining) > 1 && totalChars > 0) {
        lsPerChar = remaining / totalChars;
        lsPerChar = Math.max(-maxLS * 0.5, Math.min(maxLS, lsPerChar));
      }

      const direction = gap > 0 ? 1 : gap < 0 ? -1 : 0;
      adjustments.push({ wsPerGap, lsPerChar, direction, isFlatRun: isInFlatRun });
    }

    // --- Asymmetric neighbor dampening ---
    // When adjacent lines move in opposite directions, dampen to avoid rivers
    for (let i = 1; i < adjustments.length - 1; i++) {
      const prev = adjustments[i - 1];
      const curr = adjustments[i];
      if (!prev || !curr) continue;
      if (prev.direction !== 0 && curr.direction !== 0 && prev.direction !== curr.direction) {
        if (curr.direction > 0) {
          // Expanding: lighter dampening (expansion matters more for readability)
          curr.wsPerGap *= 0.85;
          curr.lsPerChar *= 0.85;
        } else {
          // Contracting: heavier dampening
          curr.wsPerGap *= 0.65;
          curr.lsPerChar *= 0.65;
        }
      }
    }

    // Anti-justification scale-back
    if (nearJustified) {
      for (const adj of adjustments) {
        adj.wsPerGap *= 0.5;
        adj.lsPerChar *= 0.5;
      }
    }

    // --- Build output HTML ---
    const htmlParts: string[] = [];
    let anyAdjustment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const adj = adjustments[i];
      if (!line || !adj) continue;

      const lineWords = line.wordIndices.map(idx => words[idx] || '').filter(Boolean);
      const lineText = lineWords.join(' ');

      if (Math.abs(adj.wsPerGap) > 0.05 || Math.abs(adj.lsPerChar) > 0.01) {
        const finalWS = baseWS + adj.wsPerGap;
        let style = `word-spacing:${finalWS.toFixed(2)}px`;
        if (Math.abs(adj.lsPerChar) > 0.01) {
          style += `;letter-spacing:${adj.lsPerChar.toFixed(3)}px`;
        }
        htmlParts.push(`<span style="${style}">${lineText}</span>`);
        anyAdjustment = true;
      } else {
        htmlParts.push(lineText);
      }
    }

    if (!anyAdjustment) return;

    element.style.whiteSpace = 'pre-line';
    element.innerHTML = htmlParts.join('\n');
}

// Export compositor functions for GlobalTypeset
export { tokenize, composeParagraph, shapeExactLines, finalValidate, renderFrozenLines };
export type { Token, FrozenLine };

export default typeset;
