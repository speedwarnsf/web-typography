/** Shared by contour prediction and the verified rendering pass. */
export function finishSpaceDeltas(widths: readonly number[], measure: number, spaces: readonly (readonly number[])[]): number[][] {
  const fills = widths.slice(0, -1).map(width => width / measure).sort((a, b) => a - b);
  const mid = Math.floor(fills.length / 2);
  const median = fills.length % 2 ? fills[mid] : (fills[mid - 1] + fills[mid]) / 2;
  return widths.map((width, index) => {
    const gaps = spaces[index] || [];
    if (index === widths.length - 1 || !gaps.length) return gaps.map(() => 0);
    const neighbors = [widths[index - 1], index < widths.length - 2 ? widths[index + 1] : undefined]
      .filter((value): value is number => value !== undefined);
    const local = neighbors.length ? neighbors.reduce((sum, value) => sum + value / measure, 0) / neighbors.length : median;
    const target = Math.max(.70, Math.min(.965, .5 * local + .5 * median));
    const desired = (measure * target - width) / gaps.length;
    return gaps.map(natural => Number.isFinite(natural) && natural > 0 && desired >= -.40 * natural
      ? Math.max(-.20 * natural, Math.min(.33 * natural, desired)) : 0);
  });
}
