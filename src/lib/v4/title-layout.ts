import type { FrozenLine, Token } from './typeset';
import { keptPhrases } from './phrase-boundaries';

const weakEnds = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'and', 'or', 'but']);

export interface TitlePolicy {
  weakEnding?: (word: string) => boolean;
  keep?: readonly string[];
  maxLines?: number;
  /** Indexed measurement distinguishes identical words in different styles. */
  measureRange?: (start: number, end: number) => number;
  breakPenalty?: (end: number) => number;
}

/**
 * Short text uses exact dynamic programming, not paragraph fill economics.
 * Minimize line count first; then weigh phrase splits, isolated words, and
 * visual balance. Every constraint has a feasible fallback.
 */
export function composeTitle(
  tokens: Token[], width: number, measure: (text: string) => number, policy: TitlePolicy = {},
): FrozenLine[] | null {
  const words = tokens.filter(t => t.kind !== 'space');
  if (!words.length || words.length > 64 || width <= 0) return null;
  const n = words.length;
  const widths: number[][] = Array.from({ length: n }, () => []);
  for (let start = 0; start < n; start++) {
    for (let end = start + 1; end <= n; end++) {
      widths[start][end] = policy.measureRange?.(start, end) ?? measure(words.slice(start, end).map(t => t.text).join(' '));
    }
  }
  const minLines = Array<number>(n + 1).fill(Infinity);
  minLines[n] = 0;
  for (let start = n - 1; start >= 0; start--) {
    for (let end = start + 1; end <= n; end++) {
      if (widths[start][end] <= width + 0.25) minLines[start] = Math.min(minLines[start], 1 + minLines[end]);
    }
  }
  const count = minLines[0];
  if (!Number.isFinite(count) || (policy.maxLines && count > policy.maxLines)) return null;
  // A kept phrase that fits the measure stays whole unless no layout of the
  // minimum line count allows it; a longer one is split as little as possible.
  const keepCosts = new Map<number, number>();
  for (const { start, end } of keptPhrases(words.map(t => t.text), policy.keep)) {
    const cost = widths[start][end] <= width + 0.25 ? 1e6 : 1500;
    for (let at = start + 1; at < end; at++) keepCosts.set(at, Math.max(keepCosts.get(at) || 0, cost));
  }
  const target = widths[0][n] / (count * width);
  const memo = new Map<string, { cost: number; breaks: number[] } | null>();
  const solve = (start: number, left: number): { cost: number; breaks: number[] } | null => {
    if (start === n) return left === 0 ? { cost: 0, breaks: [] } : null;
    if (!left || minLines[start] > left) return null;
    const key = start + ':' + left;
    if (memo.has(key)) return memo.get(key)!;
    let best: { cost: number; breaks: number[] } | null = null;
    for (let end = start + 1; end <= n; end++) {
      const lineWidth = widths[start][end];
      if (lineWidth > width + 0.25) continue;
      const rest = solve(end, left - 1);
      if (!rest) continue;
      const last = end === n;
      const wordCount = words.slice(start, end).reduce((sum, t) => sum + t.text.split(/\s+/u).length, 0);
      let cost = rest.cost + 1000 * (lineWidth / width - target) ** 2;
      // A wide, substantial single word is not visually stranded. Score
      // short edge lines by their occupied width, not word count alone.
      if (count > 1 && wordCount === 1 && (start === 0 || last)) {
        cost += last ? 500 : 900 * Math.max(0, 0.65 - lineWidth / width) / 0.65;
      }
      if (!last && (policy.weakEnding?.(words[end - 1].text) ?? weakEnds.has(words[end - 1].text.toLowerCase()))) cost += 240;
      if (!last && keepCosts.has(end)) cost += keepCosts.get(end)!;
      if (!last) cost += policy.breakPenalty?.(end) || 0;
      if (!last && (words[end - 1].stickyNext || words[end]?.stickyPrev)) cost += 10000;
      if (!best || cost < best.cost) best = { cost, breaks: [end, ...rest.breaks] };
    }
    memo.set(key, best);
    return best;
  };
  const winner = solve(0, count);
  if (!winner) return null;
  let start = 0;
  return winner.breaks.map(end => {
    const lineTokens = words.slice(start, end);
    const lineWidth = widths[start][end];
    start = end;
    return {
      tokens: lineTokens, text: lineTokens.map(t => t.text).join(' '),
      width: lineWidth, fill: lineWidth / width, wordSpacingEm: 0,
    };
  });
}
