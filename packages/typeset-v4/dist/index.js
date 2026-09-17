import {
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
} from "./shared-LVSUWHUP.js";

// src/lib/v4/prose-lists.ts
var owners = /* @__PURE__ */ new WeakMap();
function styleProseLists(root) {
  const lists = [...root.querySelectorAll("ul")];
  if (root instanceof HTMLUListElement) lists.unshift(root);
  const owned = [];
  let skipped = 0;
  for (const list of lists) {
    const cs = getComputedStyle(list);
    const items = [...list.children];
    if (list.closest('nav, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"], [data-no-typeset]') || cs.display !== "block" || cs.listStyleType === "none" || cs.listStyleImage !== "none" || !items.length || items.some((item) => !(item instanceof HTMLElement) || item.tagName !== "LI" || getComputedStyle(item).display !== "list-item")) {
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
function typeset2(element, options = {}) {
  return typeset(element, defaults(options));
}
function typesetAll2(selector, options = {}) {
  return typesetAll(selector, defaults(options));
}
function mount2(root, selector, options = {}) {
  return mount(root, selector, defaults(options));
}
function planRichText2(element, options = {}) {
  return planRichText(element, defaults(options));
}
export {
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
//# sourceMappingURL=index.js.map
