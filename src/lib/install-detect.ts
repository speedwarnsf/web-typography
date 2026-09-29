/**
 * Finds a Typeset loader in a page's served HTML, for /fix.
 *
 * A script counts when its src is a typeset.us file (go.js, go@x.y.z.js,
 * typeset*.js), the npm package through jsDelivr or unpkg, or a self-hosted
 * dist/auto.js or typeset.min.js. A script from typeset.us, jsDelivr or unpkg
 * is flagged when it can change under the page: the moving go.js or
 * go@<major>.js, or any such file without an integrity hash. A file the site
 * serves itself is its own to pin.
 */
export type InstallCheck = {
  installed: boolean;
  /** 'moving': go.js or go@4.js. 'no-integrity': a hosted file with no hash. */
  unpinned: 'moving' | 'no-integrity' | null;
};

const TYPESET_SRC = /typeset\.us\/go(?:@[\d.]+)?\.js|typeset\.min\.js|typeset\.us\/typeset|cdn\.jsdelivr\.net\/npm\/typeset\.us\b|unpkg\.com\/typeset\.us\b|\/dist\/auto\.js/i;
const HOSTED = /^(?:https?:)?\/\/(?:typeset\.us|cdn\.jsdelivr\.net|unpkg\.com)\//i;
const MOVING = /typeset\.us\/go(?:@\d+)?\.js(?:[?#]|$)/i;

export function detectInstall(html: string): InstallCheck {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => ({
    tag,
    src: /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)?.slice(1).find(v => v !== undefined) ?? '',
  })).filter(({ src }) => TYPESET_SRC.test(src));
  const hosted = scripts.filter(({ src }) => HOSTED.test(src));
  return {
    installed: scripts.length > 0,
    unpinned: hosted.some(({ src }) => MOVING.test(src)) ? 'moving'
      : hosted.some(({ tag }) => !/\sintegrity\s*=/i.test(tag)) ? 'no-integrity'
      : null,
  };
}
