/**
 * Untrusted HTML (a page fetched for /audit or /dna, or HTML pasted by a
 * visitor) must never run on typeset.us. DOMParser builds a document in which
 * nothing executes; this removes everything that could execute or navigate
 * once that document is attached or rendered: scripts, frames, plugins,
 * <base>, refresh <meta>, non-stylesheet <link>s, event-handler attributes and
 * script-bearing URLs. Stylesheets, inline styles, text and images stay, so
 * the result still renders the way the page is styled.
 */

const REMOVE = 'script, noscript, iframe, frame, frameset, object, embed, applet, portal, base, meta, template, link:not([rel~="stylesheet" i])';
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'background', 'data', 'ping', 'srcset'];
const SCRIPT_URL = /^\s*(?:javascript|vbscript|data\s*:\s*text\/html)/i;

/** Parse untrusted HTML into an inert document with executable content removed. */
export function inertDocument(html: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(REMOVE).forEach(node => node.remove());
  // SVG animation can set an href to a javascript: URL after sanitizing.
  doc.querySelectorAll('animate, set, animateMotion, animateTransform').forEach(node => {
    if (/href/i.test(node.getAttribute('attributeName') || '') || node.localName === 'animateMotion') node.remove();
  });
  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction'
        || (URL_ATTRIBUTES.includes(name) && SCRIPT_URL.test(attribute.value))) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return doc;
}

/** The inert document serialized, for an iframe's srcdoc. */
export function inertHTML(html: string): string {
  return '<!doctype html>' + inertDocument(html).documentElement.outerHTML;
}
