import type { LayoutMetrics } from './layout-metrics';

/** Preserve an already even paragraph only when recomposition clearly disrupts it. */
export function retainParagraphRhythm(source: string, before: LayoutMetrics, proposedWidths: readonly number[]): boolean {
  const { lines, width, overflow } = before;
  if (!Number.isFinite(width) || width <= 0 || overflow > .5 || lines.length < 4
    || proposedWidths.length !== lines.length || lines.some(l => l.words < 2 || !Number.isFinite(l.width) || l.width < 0 || l.width > width + .5)
    || proposedWidths.some(w => !Number.isFinite(w) || w < 0 || w > width + .5)) return false;
  const last = lines.at(-1)!;
  if (last.words < 3 || last.width / width < .4 || last.width / width > .8) return false;
  const native = lines.slice(0, -1).map(l => l.width / width);
  const proposed = proposedWidths.slice(0, -1).map(w => w / width);
  const spread = (fills: readonly number[]) => Math.max(...fills) - Math.min(...fills);
  // These conservative geometry thresholds are an experimental policy, not
  // grammatical rules. The short closing line is intentionally excluded.
  if (Math.min(...native) < .88 || spread(native) > .1
    || spread(proposed) - spread(native) < .12
    || Math.min(...native) - Math.min(...proposed) < .12) return false;
  const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
  for (const sentence of sentences.segment(source)) {
    if (!sentence.index) continue;
    const line = lines.slice(0, -1).find(l => l.sourceStart < sentence.index && l.sourceEnd > sentence.index);
    if (line && source.slice(sentence.index, line.sourceEnd).trim().split(/\s+/u).length < 3) return false;
  }
  return true;
}
