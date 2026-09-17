import { readFile } from 'node:fs/promises';

export const fixtureFont = await readFile('lab/fraunces-latin-variable.woff2');

// Geometry assertions need an actual font, not a platform-specific missing-font alias.
export async function installFixtureFont(page) {
  await page.evaluate(async bytes => {
    const face = new FontFace('TypesetFixture', 'url(data:font/woff2;base64,' + bytes + ')', { weight: '100 900' });
    document.fonts.add(face);
    await face.load();
    await document.fonts.ready;
  }, fixtureFont.toString('base64'));
}
