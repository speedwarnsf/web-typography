import {
  UNICODE_VERSION,
  VERSION,
  analyzeBreaks,
  audit,
  auditJSON,
  auditReport,
  checkOptions,
  checkSelector,
  composeParagraph,
  contentWidth,
  finalValidate,
  linesOverflow,
  linesStarved,
  measureCh,
  measureLayout,
  mount,
  planRichText,
  renderFrozenLines,
  restore,
  safeWrite,
  shapeExactLines,
  shouldIgnoreMutation,
  smartQuotes,
  tokenize,
  typeset,
  typesetAll,
  typesetHeading,
  typesetText
} from "./shared-MOZFMLSI.js";

// src/lib/v4/outcomes.ts
var OUTCOMES = [
  // Composed: Typeset chose the breaks.
  "composed",
  "composed:rich",
  // Left as the browser set it, because there was nothing to improve.
  "native:fits",
  "native:empty",
  "native:sentence-aligned",
  "native:paragraph-rhythm",
  // Left as the browser set it: content or styling Typeset does not handle.
  "native:language",
  "native:mixed-language",
  "native:script",
  "native:direction",
  "native:transformed",
  "native:decorated",
  "native:whitespace",
  "native:author-breaks",
  "native:soft-hyphen",
  "native:auto-hyphens",
  "native:break-policy",
  "native:clamped",
  "native:inline",
  "native:ui",
  "native:justify",
  "native:live-region",
  "native:rich-element",
  "native:rich-excluded",
  "native:rich-direction",
  "native:rich-whitespace",
  "native:rich-layout",
  "native:rich-box",
  "native:rich-decorated",
  "native:rich-tokens",
  "native:react-component",
  // Left as the browser set it: Typeset could not improve it safely.
  "native:budget",
  "native:no-candidate",
  "native:line-budget",
  "native:quality",
  "native:render-failed",
  "native:verification",
  // Not processed.
  "skipped:excluded",
  "skipped:framework",
  "unmeasurable",
  "native:translated",
  "native:environment"
];

// src/lib/v4/prose-lists.ts
var owners = /* @__PURE__ */ new WeakMap();
function styleProseLists(root) {
  const lists = [...root.querySelectorAll("ul")];
  if (root.nodeType === 1 && root.localName === "ul" && root.namespaceURI === "http://www.w3.org/1999/xhtml") lists.unshift(root);
  const owned = [];
  let skipped = 0;
  for (const list of lists) {
    const cs = getComputedStyle(list);
    const items = [...list.children];
    if (list.closest('nav, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"], [data-no-typeset]') || cs.display !== "block" || cs.listStyleType === "none" || cs.listStyleImage !== "none" || !items.length || items.some((item) => item.namespaceURI !== "http://www.w3.org/1999/xhtml" || item.tagName !== "LI" || getComputedStyle(item).display !== "list-item")) {
      skipped++;
      continue;
    }
    const owner = owners.get(list) || { count: 0, hadClass: list.classList.contains("ts-styled"), hadAttribute: list.hasAttribute("class") };
    owner.count++;
    owners.set(list, owner);
    list.classList.add("ts-styled");
    owned.push(list);
  }
  let released = false;
  return { styled: owned.length, skipped, restore() {
    if (released) return;
    released = true;
    for (const list of owned) {
      const owner = owners.get(list);
      if (--owner.count === 0) {
        if (!owner.hadClass) {
          list.classList.remove("ts-styled");
          if (!list.className && !owner.hadAttribute) list.removeAttribute("class");
        }
        owners.delete(list);
      }
    }
  } };
}

// src/lib/v4/typeset.release.ts
var defaults = (options) => ({ ...options, lineBreaks: options.lineBreaks ?? "unicode", contour: options.contour ?? "finished" });
var check = (api, options, selector) => {
  try {
    if (process.env.NODE_ENV !== "production") {
      checkSelector(api, selector);
      checkOptions(api, options);
    }
  } catch {
  }
};
function typeset2(element, options = {}) {
  check("typeset()", options);
  return typeset(element, defaults(options));
}
function typesetAll2(selector, options = {}) {
  check("typesetAll()", options, selector);
  return typesetAll(selector, defaults(options));
}
function mount2(root, selector, options = {}) {
  if (typeof root === "string") {
    const given = selector !== void 0 && typeof selector === "object" ? selector : options;
    check("mount()", given);
    return mount(root, defaults(given ?? {}));
  }
  check("mount()", options, selector);
  return mount(root, selector, defaults(options));
}
function planRichText2(element, options = {}) {
  check("planRichText()", options);
  return planRichText(element, defaults(options));
}
export {
  OUTCOMES,
  UNICODE_VERSION,
  VERSION,
  analyzeBreaks,
  audit,
  auditJSON,
  auditReport,
  composeParagraph,
  contentWidth,
  finalValidate,
  linesOverflow,
  linesStarved,
  measureCh,
  measureLayout,
  mount2 as mount,
  planRichText2 as planRichText,
  renderFrozenLines,
  restore,
  safeWrite,
  shapeExactLines,
  shouldIgnoreMutation,
  smartQuotes,
  styleProseLists,
  tokenize,
  typeset2 as typeset,
  typesetAll2 as typesetAll,
  typesetHeading,
  typesetText
};
