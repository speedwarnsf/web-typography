declare module "opentype.js" {
  interface Glyph {
    unicode: number | null | undefined;
    unicodes: number[];
    name: string;
  }

  interface GlyphSet {
    length: number;
    get(index: number): Glyph;
  }

  interface Font {
    names: Record<string, { en?: string } | undefined>;
    glyphs: GlyphSet;
    unitsPerEm: number;
    tables: Record<string, unknown>;
  }

  function parse(buffer: ArrayBuffer): Font;

  export default { parse };
  export { Font, Glyph, GlyphSet };
}
