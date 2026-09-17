/** Locate the optical left contour from the actual rasterized font.
 * Compare to H in the same face so sidebearings and serifs are not guessed. */
export function opticalInkPull(doc: Document, style: CSSStyleDeclaration, char: string, advance: number): number | null {
  if (style.fontVariationSettings !== 'normal' || style.fontFeatureSettings !== 'normal'
    || style.fontVariant !== 'normal' || !['none', 'normal', ''].includes(style.fontSizeAdjust)) return null;
  const size = parseFloat(style.fontSize);
  if (!Number.isFinite(size) || size <= 0 || size > 256) return null;
  const stretches: Record<string, CanvasFontStretch> = {
    '50%': 'ultra-condensed', '62.5%': 'extra-condensed', '75%': 'condensed', '87.5%': 'semi-condensed',
    '100%': 'normal', '112.5%': 'semi-expanded', '125%': 'expanded', '150%': 'extra-expanded', '200%': 'ultra-expanded',
  };
  const stretch = stretches[style.fontStretch] || Object.values(stretches).find(value => value === style.fontStretch);
  if (!stretch) return null;
  const scale = 4, pad = Math.ceil(size), side = Math.ceil(size * 4 * scale);
  const canvas = doc.createElement('canvas'); canvas.width = side; canvas.height = side;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.scale(scale, scale);
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  context.fontStretch = stretch;
  context.fontKerning = style.fontKerning as CanvasFontKerning;
  context.textAlign = 'left'; context.textBaseline = 'alphabetic';
  const metrics = context.measureText(char);
  const tracking = parseFloat(style.letterSpacing) || 0;
  // Canvas does not expose every CSS shaping control. Never silently align
  // a different font/run: the actual DOM advance must agree first.
  // WebKit rounds the edges of a character Range to integer CSS pixels.
  if (Math.abs(metrics.width + tracking - advance) > 1.01) return null;
  const edge = (glyph: string): number | null => {
    context.clearRect(0, 0, side / scale, side / scale);
    context.fillText(glyph, pad, pad * 2);
    const data = context.getImageData(0, 0, side, side).data;
    const rows: number[] = [];
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) if (data[(y * side + x) * 4 + 3] >= 32) {
        rows.push((x + .5) / scale - pad); break;
      }
    }
    // Equal row weighting keeps a wide T bar or a serif from standing in
    // for the upright/curved body that establishes its perceived edge.
    return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
  };
  try {
    const actual = edge(char), reference = edge('H');
    return actual === null || reference === null ? null : Math.max(0, Math.min(size * .08, actual - reference));
  } catch { return null; }
}
