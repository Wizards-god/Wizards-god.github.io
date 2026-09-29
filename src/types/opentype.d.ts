// opentype.js ships without TypeScript declarations; only the surface used by
// src/lib/og.ts is typed here (build scripts are plain .mjs).
declare module 'opentype.js' {
  interface Path {
    toPathData(decimalPlaces?: number): string;
  }
  interface RenderOptions {
    kerning?: boolean;
    letterSpacing?: number;
  }
  interface Glyph {
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }
  interface Font {
    unitsPerEm: number;
    stringToGlyphs(text: string): Glyph[];
    getKerningValue(left: Glyph, right: Glyph): number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path;
  }
  function parse(buffer: ArrayBuffer | ArrayBufferLike): Font;
  const opentype: { parse: typeof parse };
  export default opentype;
}
