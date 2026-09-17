/** Translation preserves measured advances; scaling/rotation/perspective do not. */
export function preservesAdvances(style: CSSStyleDeclaration): boolean {
  if (style.scale && !['none', '1', '1 1', '1 1 1'].includes(style.scale)) return false;
  if (style.rotate && !['none', '0deg'].includes(style.rotate)) return false;
  const translation = style.translate?.split(/\s+/u);
  if (translation?.length === 3 && parseFloat(translation[2]) !== 0) return false;
  if (!style.transform || style.transform === 'none') return true;
  try {
    const matrix = new DOMMatrixReadOnly(style.transform);
    return matrix.is2D && matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1;
  } catch { return false; }
}
