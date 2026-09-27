"use client";
import {
  BREAK_ATTRIBUTE,
  ENVIRONMENT_OUTCOME,
  TRACK_ATTRIBUTE,
  armFonts,
  breakReplacesSpace,
  canCompose,
  canMaintain,
  contentWidth,
  ensureLifecycleStyles,
  finishTargets,
  installLifecycleStyles,
  lifecycleStylesFor,
  linesExtent,
  liveText,
  markTranslated,
  measureLayout,
  mountOwners,
  movedOnly,
  nearObserver,
  opticalMarkerStyle,
  opticalVerified,
  planOpticalHanging,
  planRichText,
  planSpacingFinish,
  planTrackingFinish,
  preserveRichCopy,
  printing,
  releaseOwner,
  rendered,
  restore,
  richFingerprint,
  richLayoutVerified,
  selectionBookmark,
  smartQuotes,
  spacingMarkerStyle,
  spacingVerified,
  styleMutation,
  subscribe,
  trackingStyle,
  trackingVerified,
  translationActive,
  typeset
} from "./shared-65Y3KF6K.js";

// src/lib/v4/typeset.release.react.tsx
import { createElement as createElement3, forwardRef as forwardRef3 } from "react";

// src/lib/v4/typeset-react.tsx
import { createElement as createElement2, forwardRef as forwardRef2, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// src/lib/v4/adapter-keys.ts
import { Children, Fragment, isValidElement } from "react";
var json = (value) => {
  try {
    return JSON.stringify(value, (_key, item) => typeof item === "function" || typeof item === "symbol" || typeof Node === "function" && item instanceof Node ? void 0 : item) ?? "";
  } catch {
    return String(Math.random());
  }
};
function propsKey(props) {
  const { children: _children, ref: _ref, forwardedRef: _forwarded, ...rest } = props;
  return json(rest);
}
var typeIds = /* @__PURE__ */ new WeakMap();
var nextType = 0;
var typeName = (type) => {
  if (typeof type === "string") return type;
  if (type === Fragment) return "#fragment";
  if ((typeof type === "object" || typeof type === "function") && type) {
    if (!typeIds.has(type)) typeIds.set(type, ++nextType);
    return "#" + typeIds.get(type);
  }
  return "#" + String(type);
};
function childrenKey(children) {
  const parts = [];
  const visit = (nodes) => Children.forEach(nodes, (child) => {
    if (child === null || child === void 0 || typeof child === "boolean") parts.push("_");
    else if (typeof child === "string" || typeof child === "number") parts.push(json(String(child)));
    else if (isValidElement(child)) {
      const { children: nested, ...props } = child.props;
      parts.push("<" + typeName(child.type) + (child.key === null ? "" : "#" + json(child.key)) + json(props));
      visit(nested);
      parts.push(">");
    } else parts.push("?");
  });
  visit(children);
  return parts.join("");
}
var fontIds = /* @__PURE__ */ new WeakMap();
var fontsSeen = /* @__PURE__ */ new WeakMap();
var nextFont = 0;
function fontKey(doc) {
  const fonts = doc.fonts;
  if (!fonts) return "";
  const faces = [fonts.status], seen = [];
  fonts.forEach((face) => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFont);
    seen.push(face);
    faces.push(fontIds.get(face) + ":" + face.status);
  });
  fontsSeen.set(doc, seen);
  return faces.join("|");
}
function typeKey(element) {
  return [element, ...element.querySelectorAll("*")].map((el) => {
    const cs = getComputedStyle(el);
    if (el.hasAttribute(BREAK_ATTRIBUTE) || el.hasAttribute("data-ts-track")) {
      return [el.tagName, cs.display, cs.position, cs.visibility, cs.width, cs.marginInline, cs.paddingInline, cs.fontSize, cs.letterSpacing, cs.wordSpacing].join("|");
    }
    return [
      el.tagName,
      cs.font,
      cs.fontFeatureSettings,
      cs.fontVariationSettings,
      cs.fontOpticalSizing,
      cs.fontKerning,
      cs.fontVariant,
      cs.fontSizeAdjust,
      cs.fontSynthesis,
      cs.textRendering,
      cs.letterSpacing,
      cs.wordSpacing,
      cs.textTransform,
      cs.whiteSpace,
      cs.hyphens,
      cs.wordBreak,
      cs.lineBreak,
      cs.overflowWrap,
      el.getAttribute("lang"),
      cs.display,
      cs.direction,
      cs.unicodeBidi,
      cs.verticalAlign,
      cs.visibility,
      cs.paddingInline,
      cs.marginInline,
      cs.borderInlineWidth,
      getComputedStyle(el, "::before").content,
      getComputedStyle(el, "::after").content
    ].join("|");
  }).join(";");
}
function layoutWidth(element) {
  const cs = getComputedStyle(element);
  const width = parseFloat(cs.width);
  return cs.boxSizing === "border-box" ? width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0") : width;
}
function layoutKey(element, fonts = fontKey(element.ownerDocument)) {
  const cs = getComputedStyle(element);
  const parent = element.parentElement;
  return json([
    contentWidth(element),
    parent && contentWidth(parent),
    layoutWidth(element),
    parent && layoutWidth(parent),
    element.textContent,
    fonts,
    element.closest("[lang]")?.getAttribute("lang"),
    cs.textAlign,
    cs.textIndent,
    cs.textWrap,
    cs.getPropertyValue("-webkit-line-clamp"),
    cs.overflow,
    cs.textOverflow,
    cs.writingMode,
    typeKey(element)
  ]);
}
function transformOnly(a, b) {
  return a.slice(a.indexOf(",", a.indexOf(",") + 1)) === b.slice(b.indexOf(",", b.indexOf(",") + 1));
}
function assignRef(ref, node) {
  if (typeof ref === "function") {
    const cleanup = ref(node);
    return typeof cleanup === "function" ? cleanup : void 0;
  }
  if (ref) ref.current = node;
}

// src/lib/v4/adapter-registry.ts
var COMMIT_BUDGET_MS = 6;
var FRAME_BUDGET_MS = 12;
var VISIBLE_BUDGET_MS = 120;
var IDLE_SLICE_MS = 8;
var IDLE_TIMEOUT_MS = 1e3;
var LONG_IDLE_MS = 20;
var RESIZE_SETTLE_MS = 100;
var OBSERVED = ["class", "style", "lang", "hidden", "open", "_msttexthash", "_msthash"];
function contentSize(el) {
  const cs = getComputedStyle(el);
  const width = parseFloat(cs.width), height = parseFloat(cs.height);
  if (cs.boxSizing !== "border-box") return { w: width, h: height };
  return {
    w: width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0"),
    h: height - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0") - parseFloat(cs.borderTopWidth || "0") - parseFloat(cs.borderBottomWidth || "0")
  };
}
var registries = /* @__PURE__ */ new WeakMap();
function adapterRegistry(doc) {
  let registry = registries.get(doc);
  if (!registry) {
    registry = createRegistry(doc);
    registries.set(doc, registry);
  }
  return registry;
}
function createRegistry(doc) {
  const win = doc.defaultView;
  const identity = /* @__PURE__ */ Symbol("typeset-react");
  const entries = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const near = /* @__PURE__ */ new Set();
  const resizing = /* @__PURE__ */ new Set();
  const continuous = /* @__PURE__ */ new Set();
  const checked = /* @__PURE__ */ new WeakMap();
  const sizes = /* @__PURE__ */ new WeakMap();
  const watchers = /* @__PURE__ */ new Map();
  const parents = /* @__PURE__ */ new Map();
  const later = (fn, ms) => (win || globalThis).setTimeout(fn, ms);
  const frame = (fn) => {
    if (win?.requestAnimationFrame) win.requestAnimationFrame(fn);
    else later(fn, 16);
  };
  let commitStart = 0;
  let costPerChar = 0;
  let warm = false;
  let frameQueued = false, idleQueued = false, staleQueued = false;
  let idleSince = 0;
  let settle;
  let mutations = null, observer = null, viewport = null;
  let writingDepth = 0;
  let composedSince = false, triggeredSince = false;
  let started = false;
  let windowWidth = win?.innerWidth ?? 0;
  let unsubscribe;
  const supported = () => canMaintain(doc) && canCompose(doc);
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const height = win?.innerHeight ?? 0, width = win?.innerWidth ?? 0;
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
  };
  const observeDocument = () => mutations?.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: OBSERVED });
  function run(entry, reason, inCommit) {
    pending.delete(entry);
    near.delete(entry);
    viewport?.unobserve(entry.element);
    if (!entries.has(entry.element)) return 0;
    const begun = performance.now(), length = entry.element.textContent?.length || 1;
    writing(() => entry.compose(reason, inCommit));
    composedSince = true;
    const took = performance.now() - begun;
    let setup = 0;
    if (!warm && entry.element.dataset.tsOutcome?.startsWith("composed")) {
      warm = true;
      setup = took;
    } else costPerChar = costPerChar ? costPerChar * 0.8 + took / length * 0.2 : took / length;
    rebase(entry);
    if (entry.element.dataset.tsOutcome === "native:transformed") awaitTransforms(entry);
    return setup;
  }
  function rebase(entry) {
    for (const target of [entry.element, parents.get(entry)]) {
      const size = target ? sizes.get(target) : void 0;
      if (!target || !size?.w || !target.getClientRects().length) continue;
      const box = contentSize(target);
      if (!Number.isNaN(box.w) && box.w > 0) size.w = box.w;
      if (!Number.isNaN(box.h)) size.h = box.h;
    }
  }
  const animating = /* @__PURE__ */ new WeakMap();
  function awaitTransforms(entry) {
    for (const animation of doc.getAnimations?.() ?? []) {
      const target = animation.effect?.target;
      if (!target || animation.playState === "finished" || !(target === entry.element || target.contains(entry.element))) continue;
      if (animation.effect?.getComputedTiming().endTime === Infinity) continue;
      let waiting = animating.get(animation);
      if (!waiting) {
        const set = waiting = /* @__PURE__ */ new Set();
        animating.set(animation, set);
        const ended = () => {
          animating.delete(animation);
          for (const host of set) if (entries.get(host.element) === host) enqueue(host, "force");
        };
        animation.finished.then(ended, ended);
      }
      waiting.add(entry);
    }
  }
  const fits = (entry, start2, budget) => performance.now() - start2 + costPerChar * (entry.element.textContent?.length || 1) <= budget;
  function writing(write) {
    if (!writingDepth && mutations) {
      const records = mutations.takeRecords();
      if (records.length) mutated(records);
      mutations.disconnect();
    }
    writingDepth++;
    try {
      return write();
    } finally {
      if (!--writingDepth && mutations && entries.size) {
        observeDocument();
      }
    }
  }
  function enqueue(entry, reason) {
    const prior = pending.get(entry);
    if (!prior || prior === "check") pending.set(entry, reason);
    viewport?.observe(entry.element);
    schedule();
  }
  function schedule() {
    if (!pending.size) return;
    if (!frameQueued) {
      frameQueued = true;
      frame(flushFrame);
    }
    requestIdle();
  }
  function requestIdle() {
    if (idleQueued) return;
    idleQueued = true;
    if (!idleSince) idleSince = performance.now();
    if (win && typeof win.requestIdleCallback === "function") win.requestIdleCallback(flushIdle, { timeout: Math.max(1, IDLE_TIMEOUT_MS - (performance.now() - idleSince)) });
    else later(() => flushIdle(), 50);
  }
  function process2(entry, reason, fonts) {
    const drop = () => {
      pending.delete(entry);
      near.delete(entry);
      viewport?.unobserve(entry.element);
    };
    if (reason === "check") {
      if (resizing.has(entry)) {
        if (continuous.has(entry)) settleLater();
        drop();
        return 0;
      }
      if (!rendered(entry.element) || !entry.changed(fonts)) {
        drop();
        return 0;
      }
      const last = checked.get(entry);
      if (entry.widest() && last !== void 0 && last.fonts === fonts && performance.now() - last.at < RESIZE_SETTLE_MS) {
        writing(() => entry.stale());
        resizing.add(entry);
        continuous.add(entry);
        settleLater();
        drop();
        return 0;
      }
    }
    const setup = run(entry, reason, false);
    if (reason === "check") checked.set(entry, { at: performance.now(), fonts });
    else checked.delete(entry);
    return setup;
  }
  function settleLater() {
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  }
  function flushFrame() {
    frameQueued = false;
    if (!pending.size || printing(doc)) return;
    ensureLifecycleStyles(doc);
    let start2 = performance.now();
    const fonts = fontKey(doc);
    const queued = [...pending.keys()].map((entry) => ({ entry, rect: entry.element.getBoundingClientRect() }));
    const height = win?.innerHeight ?? 0, width = win?.innerWidth ?? 0;
    const onScreen = queued.filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width).sort((a, b) => a.rect.top - b.rect.top).map(({ entry }) => entry);
    const soon = [...onScreen, ...queued.map(({ entry }) => entry).filter((entry) => near.has(entry) && !onScreen.includes(entry))];
    let composed = 0;
    for (const entry of soon) {
      if (composed && !fits(entry, start2, onScreen.includes(entry) ? VISIBLE_BUDGET_MS : FRAME_BUDGET_MS)) {
        frameQueued = true;
        frame(flushFrame);
        break;
      }
      const reason = pending.get(entry);
      if (reason) {
        start2 += process2(entry, reason, fonts);
        composed++;
      }
    }
    if (composed) armFonts(doc);
  }
  function flushIdle(deadline) {
    idleQueued = false;
    if (!pending.size || printing(doc)) {
      idleSince = 0;
      return;
    }
    if (deadline && !deadline.didTimeout && deadline.timeRemaining() < LONG_IDLE_MS) {
      requestIdle();
      return;
    }
    idleSince = 0;
    const start2 = performance.now();
    const fonts = fontKey(doc);
    const order = [...pending.keys()].sort((a, b) => Number(near.has(b)) - Number(near.has(a)));
    for (const entry of order) {
      const reason = pending.get(entry);
      if (reason) process2(entry, reason, fonts);
      if (deadline?.didTimeout || performance.now() - start2 >= IDLE_SLICE_MS || deadline && deadline.timeRemaining() <= 1) break;
    }
    armFonts(doc);
    schedule();
  }
  function check(target) {
    triggeredSince = true;
    for (const entry of entries.values()) {
      if (target && target !== entry.element && !target.contains(entry.element)) continue;
      if (!pending.has(entry)) enqueue(entry, "check");
    }
  }
  function hostOf(node) {
    for (let el = node?.nodeType === 1 ? node : node?.parentElement ?? null; el; el = el.parentElement) {
      const entry = entries.get(el);
      if (entry) return entry;
    }
  }
  function mutated(records) {
    const targets = /* @__PURE__ */ new Set();
    let styles = false;
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (!target) continue;
      if (record.type === "attributes" && record.attributeName?.startsWith("_mst")) {
        markTranslated(doc);
        continue;
      }
      if (record.type === "attributes" && record.attributeName === "style" && movedOnly(record.oldValue, target.getAttribute("style"))) continue;
      const host = hostOf(target);
      if (host && !translationActive(doc) && [...record.addedNodes].some((node) => node.nodeName === "FONT")) {
        markTranslated(doc);
        continue;
      }
      if (host) {
        if (!pending.has(host)) enqueue(host, "check");
        continue;
      }
      triggeredSince = true;
      if (record.type === "attributes") targets.add(target);
      else if (target.closest("head") ? styleMutation(record) : target.localName === "style") styles = true;
    }
    if (styles) {
      check();
      return;
    }
    for (const target of targets) if (target.firstElementChild) check(target);
  }
  function watch(entry) {
    const parent = entry.element.parentElement;
    parents.set(entry, parent);
    for (const target of [entry.element, parent]) {
      if (!target) continue;
      let set = watchers.get(target);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        watchers.set(target, set);
        observer?.observe(target);
      }
      set.add(entry);
    }
  }
  function unwatch(entry) {
    for (const target of [entry.element, parents.get(entry)]) {
      if (!target) continue;
      const set = watchers.get(target);
      set?.delete(entry);
      if (set && !set.size) {
        watchers.delete(target);
        observer?.unobserve(target);
        sizes.delete(target);
      }
    }
    parents.delete(entry);
  }
  function resized(observations) {
    const revealed = /* @__PURE__ */ new Set();
    const own = composedSince && !triggeredSince;
    composedSince = triggeredSince = false;
    for (const observation of observations) {
      const { width, height } = observation.contentRect;
      const previous = sizes.get(observation.target);
      sizes.set(observation.target, { w: width, h: height });
      if (!previous) continue;
      if (Math.abs(previous.w - width) <= 0.01) {
        const entry = entries.get(observation.target);
        if (entry && width && Math.abs(previous.h - height) > 0.5 && !pending.has(entry)) enqueue(entry, "check");
        continue;
      }
      if (!width) continue;
      for (const entry of watchers.get(observation.target) || []) {
        if (previous.w === 0 && entry.element.isConnected && visible(entry.element)) {
          if (!revealed.has(entry)) {
            revealed.add(entry);
            resizing.delete(entry);
            reveal(entry);
          }
        } else if (!revealed.has(entry)) {
          if (own && entry.widest() && entry.widest() <= contentWidth(entry.element) + 0.5) continue;
          resizing.add(entry);
        }
      }
    }
    if (!resizing.size) return;
    if (!staleQueued) {
      staleQueued = true;
      frame(staleCheck);
    }
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  }
  function reveal(entry) {
    const el = entry.element;
    if (!entry.widest() && !printing(doc)) {
      const before = el.getBoundingClientRect().height;
      run(entry, "check", false);
      if (entries.has(el) && Math.abs(el.getBoundingClientRect().height - before) > 0.01) writing(() => entry.stale());
    }
    enqueue(entry, "check");
  }
  function staleCheck() {
    staleQueued = false;
    ensureLifecycleStyles(doc);
    const doomed = [...resizing].filter((entry) => entries.has(entry.element) && entry.widest() && (rendered(entry.element) ? entry.widest() > contentWidth(entry.element) + 0.5 : entry.element.isConnected));
    for (const entry of doomed) writing(() => entry.stale());
  }
  function settled() {
    settle = void 0;
    for (const entry of resizing) if (entries.has(entry.element)) {
      checked.delete(entry);
      enqueue(entry, "check");
    }
    resizing.clear();
    continuous.clear();
  }
  const fontsChanged = () => check();
  const metricsEnded = (target) => {
    triggeredSince = true;
    for (const entry of entries.values()) if (target.contains(entry.element) || entry.element.contains(target)) {
      if (!pending.has(entry)) enqueue(entry, "check");
    }
  };
  const translated = (active) => {
    triggeredSince = true;
    for (const entry of [...entries.values()]) writing(() => entry.translation?.(active));
  };
  const windowResized = () => {
    triggeredSince = true;
    for (const entry of entries.values()) resizing.add(entry);
    const width = win?.innerWidth ?? 0;
    if (width !== windowWidth) {
      windowWidth = width;
      if (!staleQueued) {
        staleQueued = true;
        frame(staleCheck);
      }
    }
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  };
  function start() {
    started = true;
    if (win && typeof win.MutationObserver === "function") {
      mutations = new win.MutationObserver(mutated);
      observeDocument();
    }
    if (win && typeof win.ResizeObserver === "function") {
      observer = new win.ResizeObserver(resized);
      for (const target of watchers.keys()) observer.observe(target);
    }
    viewport = nearObserver(doc, (observations) => {
      for (const observation of observations) {
        const entry = entries.get(observation.target);
        if (!entry) continue;
        if (observation.isIntersecting) {
          near.add(entry);
          schedule();
        } else near.delete(entry);
      }
    });
    installLifecycleStyles(doc);
    unsubscribe = subscribe(doc, {
      fonts: fontsChanged,
      resize: windowResized,
      metrics: metricsEnded,
      styles: () => check(),
      visibility: (target) => check(target),
      translation: translated
    });
    doc.fonts?.ready?.then(() => {
      if (entries.size) check();
    });
    armFonts(doc);
  }
  function stop() {
    started = false;
    mutations?.disconnect();
    observer?.disconnect();
    viewport?.disconnect();
    mutations = observer = viewport = null;
    unsubscribe?.();
    unsubscribe = void 0;
    clearTimeout(settle);
    settle = void 0;
    pending.clear();
    near.clear();
    resizing.clear();
    continuous.clear();
    idleSince = 0;
  }
  return {
    identity,
    entries,
    writing,
    composed(entry) {
      if (entries.get(entry.element) === entry) {
        composedSince = true;
        rebase(entry);
      }
    },
    add(entry) {
      entries.set(entry.element, entry);
      if (!started && supported()) start();
      lifecycleStylesFor(entry.element);
      if (!mountOwners.has(entry.element)) mountOwners.set(entry.element, identity);
      watch(entry);
    },
    remove(entry) {
      if (entries.get(entry.element) !== entry) return;
      entries.delete(entry.element);
      pending.delete(entry);
      near.delete(entry);
      resizing.delete(entry);
      continuous.delete(entry);
      viewport?.unobserve(entry.element);
      unwatch(entry);
      releaseOwner(entry.element, identity);
      if (!entries.size) stop();
    },
    request(entry, reason, inCommit) {
      if (!entries.has(entry.element)) return;
      if (!supported()) {
        entry.unsupported();
        return;
      }
      if (!started) start();
      if (entry.priority === "sync") {
        run(entry, reason, inCommit);
        return;
      }
      if (inCommit) {
        if (!commitStart) {
          commitStart = performance.now();
          queueMicrotask(() => {
            commitStart = 0;
          });
        }
        if ((reason === "force" || fits(entry, commitStart, COMMIT_BUDGET_MS)) && visible(entry.element)) {
          run(entry, reason, true);
          return;
        }
      }
      entry.deferred?.(reason);
      enqueue(entry, reason);
    }
  };
}

// src/lib/v4/typeset-rich-react.tsx
import { Children as Children2, Component, Fragment as Fragment2, cloneElement, createElement, forwardRef, isValidElement as isValidElement2 } from "react";
import { flushSync } from "react-dom";
function quoteSource(children) {
  let source = "";
  Children2.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") source += String(child);
    else if (isValidElement2(child)) source += quoteSource(child.props.children);
  });
  return source;
}
function quoteTreeSupported(children) {
  let supported = true;
  Children2.forEach(children, (child) => {
    if (!isValidElement2(child)) return;
    if (child.props.lang && !/^en(?:-|$)/i.test(child.props.lang) || child.props["data-no-typeset"] !== void 0 || typeof child.type === "string" && !["a", "b", "strong", "em", "i", "span", "small", "u", "s", "del", "mark", "abbr", "cite"].includes(child.type) || !quoteTreeSupported(child.props.children)) supported = false;
  });
  return supported;
}
function trackingForTree(plan, children) {
  let offset = 0;
  const runs = [];
  const visit = (nodes) => Children2.forEach(nodes, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const end = offset + String(child).length;
      for (const run of plan.runs) {
        const start = Math.max(offset, run.start), stop = Math.min(end, run.end);
        if (stop > start) runs.push({ ...run, start, end: stop });
      }
      offset = end;
    } else if (isValidElement2(child)) visit(child.props.children);
  });
  visit(children);
  return { ...plan, runs };
}
function renderChildren(children, breaks, hangs, spaces, tracks, educate) {
  let offset = 0;
  const source = quoteSource(children);
  const educated = educate ? smartQuotes(source) : null;
  const optical = new Map(hangs.map((hang) => [hang.offset, hang.px]));
  const spacing = new Map(spaces.map((space) => [space.offset, space.px]));
  const moved = /* @__PURE__ */ new Set(), atTextEnd = /* @__PURE__ */ new Set();
  const paired = /* @__PURE__ */ new Set();
  {
    let at = 0, index = 0;
    const starts = /* @__PURE__ */ new Set();
    const scan = (nodes) => {
      let afterText = false;
      Children2.forEach(nodes, (child) => {
        if (typeof child === "string" || typeof child === "number") {
          at += String(child).length;
          afterText = String(child).length > 0;
          return;
        }
        if (isValidElement2(child)) {
          const element = index++;
          if (at > 0 && !starts.has(at) && quoteSource(child.props.children)) {
            starts.add(at);
            if (!afterText) paired.add(element);
            if (breaks.has(at)) {
              moved.add(at);
              if (afterText) atTextEnd.add(at);
            }
          }
          scan(child.props.children);
        }
        afterText = false;
      });
    };
    scan(children);
  }
  let elements = 0;
  const visit = (nodes) => Children2.map(nodes, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const raw = String(child);
      const text = educated === null ? raw : educated.slice(offset, offset + raw.length);
      const start = offset;
      offset += text.length;
      const stops = [.../* @__PURE__ */ new Set([...breaks, ...optical.keys(), ...spacing.keys(), ...tracks.flatMap((run) => [run.start, run.end])])].filter((at2) => at2 >= start && at2 < offset);
      if (atTextEnd.has(offset) && offset > start) stops.push(offset);
      stops.sort((a, b) => a - b);
      let cursor = 0;
      const pieces = [];
      let active;
      let tracked = [];
      const flush = () => {
        if (active && tracked.length) pieces.push(createElement("span", { key: "track-" + active.start, [TRACK_ATTRIBUTE]: String(active.start), style: trackingStyle(active) }, ...tracked));
        active = void 0;
        tracked = [];
      };
      const append = (piece, at2, marker = false) => {
        if (piece === "") return;
        const run = tracks.find((run2) => run2.start <= at2 && at2 < run2.end);
        if (marker || run !== active) flush();
        active = marker ? void 0 : run;
        if (active) tracked.push(piece);
        else pieces.push(piece);
      };
      for (const stop of stops) {
        const local = stop - start;
        append(text.slice(cursor, local), start + cursor);
        if (breaks.has(stop) && (stop === offset || !moved.has(stop))) append(createElement("br", { key: "break-" + stop, [BREAK_ATTRIBUTE]: "", "aria-hidden": breakReplacesSpace(source, stop) ? void 0 : true, style: breakStyle }), stop, true);
        if (stop === offset) {
          cursor = local;
          continue;
        }
        if (optical.has(stop)) append(createElement("span", { key: "hang-" + stop, [BREAK_ATTRIBUTE]: "", "data-ts-hang": String(stop), "aria-hidden": true, style: opticalMarkerStyle(optical.get(stop)) }), stop, true);
        if (spacing.has(stop)) append(createElement("span", { key: "space-" + stop, [BREAK_ATTRIBUTE]: "", "data-ts-space": String(stop), "aria-hidden": true, style: spacingMarkerStyle(spacing.get(stop)) }), stop);
        cursor = local;
      }
      append(text.slice(cursor), start + cursor);
      flush();
      return pieces;
    }
    if (!isValidElement2(child)) return child;
    const element = elements++, at = offset;
    const rendered2 = cloneElement(child, void 0, visit(child.props.children));
    if (!paired.has(element)) return rendered2;
    return [
      breaks.has(at) ? createElement("br", { key: "break", [BREAK_ATTRIBUTE]: "", "aria-hidden": breakReplacesSpace(source, at) ? void 0 : true, style: breakStyle }) : null,
      cloneElement(rendered2, { key: "element" })
    ];
  });
  return visit(children);
}
var warnedQuotesLang = false;
var warnedComponent = false;
function development() {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}
var breakStyle = { display: "var(--ts-break-display, inline)" };
function educateNodes(nodes, educated, at) {
  if (typeof nodes === "string") {
    const text = educated.slice(at.offset, at.offset + nodes.length);
    at.offset += nodes.length;
    return text;
  }
  if (typeof nodes === "number") {
    at.offset += String(nodes).length;
    return nodes;
  }
  if (Array.isArray(nodes)) return nodes.map((node) => educateNodes(node, educated, at));
  if (!isValidElement2(nodes)) return nodes;
  const inner = nodes.props.children;
  if (typeof inner !== "string" && typeof inner !== "number" && !Array.isArray(inner) && !isValidElement2(inner)) {
    at.offset += quoteSource(inner).length;
    return nodes;
  }
  const next = educateNodes(inner, educated, at);
  return next === inner ? nodes : Array.isArray(next) ? cloneElement(nodes, void 0, ...next) : cloneElement(nodes, void 0, next);
}
function supportedTree(children) {
  let supported = true;
  Children2.forEach(children, (child) => {
    if (!isValidElement2(child)) return;
    if (typeof child.type !== "string" && child.type !== Fragment2) supported = false;
    if (!supportedTree(child.props.children)) supported = false;
  });
  return supported;
}
var planKey = (plan, props) => JSON.stringify([
  plan.outcome,
  plan.source,
  plan.breaks,
  plan.widths.map((width) => Math.round(width * 4) / 4),
  Math.round(plan.before.width * 4) / 4,
  plan.styleSignature,
  props.spacing,
  props.tracking,
  props.opticalHanging,
  props.smartQuotes,
  props.mode,
  props.lang
]);
var healthy = (plan) => ![plan.outcome, plan.hanging, plan.spacing?.outcome, plan.tracking?.outcome].some((status) => status?.endsWith("verification"));
var RichText = class extends Component {
  constructor() {
    super(...arguments);
    this.state = { children: childrenKey(this.props.children), plan: null, stale: false };
    this.host = { current: null };
    /** The caller's ref gets the host element, like any host component. */
    this.setHost = (node) => {
      this.host.current = node;
      if (node) this.refCleanup = assignRef(this.props.forwardedRef, node);
      else {
        if (this.refCleanup) this.refCleanup();
        else assignRef(this.props.forwardedRef, null);
        this.refCleanup = void 0;
      }
    };
    /** Set when a composition starts; the result is reported once it settles. */
    this.reporting = 0;
    this.mounted = false;
    /** Props (by value) the current plan was made for. */
    this.planned = "";
    /** planKey of the current plan; an equal new plan is carried forward. */
    this.base = "";
    /** layoutKey of the settled composition; triggers that leave it equal do nothing. */
    this.layout = "";
    /** The widest rendered line of the settled composition. */
    this.widest = 0;
    /** Machine translation is rewriting this subtree: no replans. React output
     * stays as it is, since a re-render would write into Text nodes the
     * translator is filling. Unlike mount(), the adapter cannot remove the
     * breaks it rendered. */
    this.frozen = false;
    this.recompose = () => {
      const el = this.host.current;
      if (!this.mounted || !el || this.frozen) return;
      if (this.state.plan && (!rendered(el) || printing(el.ownerDocument))) return;
      this.reporting = performance.now();
      this.planned = propsKey(this.props);
      const none = { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
      const plan = liveText(el) ? { source: el.textContent || "", breaks: [], widths: [], outcome: "native:live-region", styleSignature: "", before: none } : !rendered(el) ? { source: el.textContent || "", breaks: [], widths: [], outcome: "unmeasurable", styleSignature: "", before: none } : planRichText(el, this.props);
      if (!supportedTree(this.props.children)) {
        plan.breaks = [];
        plan.outcome = "native:react-component";
        if (!warnedComponent && development()) {
          warnedComponent = true;
          console.warn("TypesetRichText: a component child (next/link's <Link>, a router link, any function or class component) keeps the paragraph native (native:react-component). Use host elements such as <a>, <strong> and <em> inside it, or compose the rendered HTML with mount().");
        }
      }
      const base = planKey(plan, this.props);
      if (this.state.plan && base === this.base && healthy(this.state.plan)) {
        if (this.state.stale) this.setState({ stale: false });
        else this.settle();
        return;
      }
      this.base = base;
      this.setState({ plan, stale: false });
    };
  }
  static getDerivedStateFromProps(props, state) {
    const key = childrenKey(props.children);
    return key !== state.children ? { children: key, plan: null, stale: false } : null;
  }
  componentDidMount() {
    this.mounted = true;
    this.bind();
  }
  /** Register the current host element with the document's adapter registry. */
  bind() {
    const el = this.host.current;
    if (!el || this.entry?.element === el) return;
    this.unbind();
    this.releaseCopy = preserveRichCopy(el);
    const entry = {
      element: el,
      priority: this.props.priority ?? "auto",
      // Outside a commit the whole plan-and-finish chain runs synchronously
      // too, so a frame never paints half of it.
      compose: (_reason, inCommit) => {
        if (inCommit) this.recompose();
        else flushSync(this.recompose);
      },
      changed: (fonts) => {
        if (this.state.stale) return true;
        const now = layoutKey(el, fonts);
        if (now === this.layout) return false;
        if (this.layout && this.state.plan?.breaks.length && transformOnly(now, this.layout)) {
          this.layout = now;
          return false;
        }
        return true;
      },
      // Frozen, nothing may re-render: a narrower container must not pick
      // this host for stale mode.
      widest: () => this.frozen || this.state.stale || !this.state.plan?.breaks.length ? 0 : this.widest,
      // Every state update outside a commit is refused while frozen. React
      // would remove Text nodes the translator already replaced and, with no
      // error boundary, unmount the whole root.
      stale: () => {
        if (!this.frozen) flushSync(() => this.setState({ stale: true }));
      },
      translation: (active) => {
        this.frozen = active;
        if (!active) adapterRegistry(el.ownerDocument).request(entry, "force", false);
      },
      unsupported: () => {
        if (this.frozen) return;
        this.reporting = performance.now();
        this.planned = propsKey(this.props);
        this.setState({ plan: {
          source: el.textContent || "",
          before: { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 },
          outcome: ENVIRONMENT_OUTCOME,
          breaks: [],
          widths: [],
          styleSignature: ""
        }, stale: false });
      }
    };
    this.entry = entry;
    const registry = adapterRegistry(el.ownerDocument);
    registry.add(entry);
    registry.request(entry, "mount", true);
  }
  unbind() {
    if (this.entry) adapterRegistry(this.entry.element.ownerDocument).remove(this.entry);
    this.entry = void 0;
    this.releaseCopy?.();
    this.releaseCopy = void 0;
  }
  rendering(previous, before) {
    return before.plan !== this.state.plan || before.stale !== this.state.stale || before.children !== this.state.children || previous.as !== this.props.as || propsKey(previous) !== propsKey(this.props);
  }
  getSnapshotBeforeUpdate(previous, before) {
    if (!this.rendering(previous, before)) return null;
    return this.host.current ? selectionBookmark(this.host.current) : () => {
    };
  }
  componentDidUpdate(previous, before, restoreSelection) {
    if (previous.forwardedRef !== this.props.forwardedRef && this.host.current) {
      if (this.refCleanup) this.refCleanup();
      else assignRef(previous.forwardedRef, null);
      this.refCleanup = assignRef(this.props.forwardedRef, this.host.current);
    }
    if (!restoreSelection) return;
    restoreSelection();
    if (this.frozen) return;
    if (this.entry) this.entry.priority = this.props.priority ?? "auto";
    if (previous.as !== this.props.as) {
      this.bind();
      return;
    }
    if (!this.state.plan || propsKey(this.props) !== this.planned) {
      if (this.entry) adapterRegistry(this.entry.element.ownerDocument).request(this.entry, "force", true);
      return;
    }
    if (before.plan === this.state.plan && before.stale === this.state.stale) return;
    this.settle();
  }
  /** Verify what is rendered, then take the next finishing step (spacing,
   * tracking, hanging), one commit each, or roll back to native. Settled, the
   * layout key is recorded so later triggers that leave it equal do nothing. */
  settle() {
    const el = this.host.current;
    const plan = this.state.plan;
    if (plan && !this.state.stale && (plan.outcome === "composed:rich" || plan.outcome === "native:fits")) {
      const after = measureLayout(el);
      const title = this.props.mode === "title" || this.props.mode === "heading" || !this.props.mode && /^H[1-6]$/.test(el.tagName);
      if (plan.beforeHanging && plan.hangs?.length && !opticalVerified(el, plan.beforeHanging, after, plan.hangs)) {
        this.setState({ plan: { ...plan, hangs: [], hanging: "native:hanging-verification" } });
        return;
      }
      const invalid = el.textContent !== plan.source || after.overflow > 0.5 || plan.outcome === "composed:rich" && (!plan.spacing && !richLayoutVerified(plan, after) || after.lines.length !== plan.widths.length || richFingerprint(el) !== plan.styleSignature) || !title && !plan.before.lastSingleton && after.lastSingleton;
      if (plan.spacing?.adjustments.length && (invalid || !spacingVerified(el, plan.spacing, plan.tracking?.before || plan.beforeHanging || after))) {
        this.setState({ plan: { ...plan, tracking: void 0, spacing: { ...plan.spacing, outcome: "native:spacing-verification", adjustments: [] } } });
        return;
      }
      if (invalid) {
        this.setState({ plan: { ...plan, breaks: [], hangs: [], spacing: void 0, tracking: void 0, hanging: "native:hanging-verification", outcome: "native:verification" } });
        return;
      }
      if (!plan.spacing && this.props.spacing !== false && !title && plan.outcome === "composed:rich") {
        this.setState({ plan: { ...plan, spacing: planSpacingFinish(el, after) } });
        return;
      }
      if (plan.tracking?.runs.length && !trackingVerified(el, plan.tracking, plan.beforeHanging || after)) {
        this.setState({ plan: { ...plan, tracking: { ...plan.tracking, outcome: "native:tracking-verification", runs: [] }, hangs: [], hanging: void 0, beforeHanging: void 0 } });
        return;
      }
      if (!plan.tracking && this.props.tracking !== false && plan.spacing && ["applied", "unchanged"].includes(plan.spacing.outcome)) {
        const targets = finishTargets(plan.spacing.before.lines.map((line) => line.width), plan.spacing.before.width);
        this.setState({ plan: { ...plan, tracking: trackingForTree(planTrackingFinish(el, after, targets), this.props.children) } });
        return;
      }
      if (this.props.opticalHanging && !plan.hanging) {
        const optical = planOpticalHanging(el, after);
        this.setState({ plan: { ...plan, hangs: optical.hangs, hanging: optical.outcome, beforeHanging: after } });
        return;
      }
      this.widest = linesExtent(el, after.lines);
    }
    if (!this.state.stale) {
      if (plan?.outcome !== ENVIRONMENT_OUTCOME) {
        this.layout = plan?.outcome !== "unmeasurable" && rendered(el) ? layoutKey(el) : "";
        if (this.entry) adapterRegistry(el.ownerDocument).composed(this.entry);
      }
      if (this.reporting) this.report(el, plan);
    }
  }
  /** onResult, in the engine's Result shape, once a composition has settled. */
  report(el, plan) {
    const started = this.reporting;
    this.reporting = 0;
    const callback = this.props.onResult;
    if (!callback || !plan) return;
    const props = this.props;
    const mode = props.mode || el.dataset.typesetMode || (el.closest("h1,h2,h3,h4,h5,h6") ? "title" : "body");
    const educate = props.smartQuotes === "en" && /^en(?:-|$)/i.test(props.lang || "") && quoteTreeSupported(props.children);
    const result = {
      outcome: plan.outcome,
      mode,
      before: plan.before,
      after: plan.outcome === ENVIRONMENT_OUTCOME ? plan.before : measureLayout(el),
      changed: !!(plan.breaks.length || plan.hangs?.length || plan.spacing?.adjustments.length || plan.tracking?.runs.length),
      durationMs: performance.now() - started,
      ...plan.constraint && { constraint: plan.constraint },
      ...plan.search && { search: plan.search },
      features: {
        quotes: props.smartQuotes ? educate ? "enabled" : "native:quotes-scope" : "off",
        hanging: props.opticalHanging ? plan.hanging || "native:hanging-uncomposed" : "off",
        spacing: props.spacing === false ? "off" : plan.spacing?.outcome || "native:spacing-uncomposed",
        tracking: props.tracking === false || props.spacing === false ? "off" : plan.tracking?.outcome || "native:tracking-uncomposed"
      }
    };
    queueMicrotask(() => callback(result));
  }
  componentWillUnmount() {
    this.mounted = false;
    this.unbind();
  }
  render() {
    const { children, as = "p", mode: _mode, keep: _keep, maxLines: _maxLines, density: _density, lineBreaks: _lineBreaks, smartQuotes: quotes, opticalHanging: _optical, spacing: _spacing, tracking: _tracking, contour: _contour, priority: _priority, onResult: _onResult, forwardedRef: _ref, ...attributes } = this.props;
    const plan = this.state.plan;
    const shown = this.state.stale ? null : plan;
    const educate = quotes === "en" && /^en(?:-|$)/i.test(this.props.lang || "") && quoteTreeSupported(children);
    if (quotes === "en" && !this.props.lang && !warnedQuotesLang && development()) {
      warnedQuotesLang = true;
      console.warn('TypesetRichText: smartQuotes="en" needs lang="en" (or en-*) on the component itself; quotes are left as written.');
    }
    const props = {
      ...attributes,
      ref: this.setHost,
      "data-typeset-react-rich": "",
      "data-typeset-done": plan ? "1" : void 0,
      "data-ts-outcome": plan?.outcome,
      "data-ts-stale": this.state.stale ? "" : void 0,
      "data-ts-quotes": quotes ? educate ? "enabled" : "native:quotes-scope" : void 0,
      "data-ts-hanging": _optical ? plan?.hanging || "native:hanging-uncomposed" : void 0,
      "data-ts-spacing": _spacing === false ? "off" : plan?.spacing?.outcome || "native:spacing-uncomposed",
      "data-ts-tracking": _tracking === false || _spacing === false ? "off" : plan?.tracking?.outcome || "native:tracking-uncomposed"
    };
    if (supportedTree(children)) return createElement(as, props, renderChildren(children, new Set(shown?.breaks || []), shown?.hangs || [], shown?.spacing?.adjustments || [], shown?.tracking?.runs || [], educate));
    if (!educate) return createElement(as, props, children);
    const educated = educateNodes(children, smartQuotes(quoteSource(children)), { offset: 0 });
    return Array.isArray(educated) ? createElement(as, props, ...educated) : createElement(as, props, educated);
  }
};
var TypesetRichText = /* @__PURE__ */ forwardRef(function TypesetRichText2(props, ref) {
  return createElement(RichText, { ...props, forwardedRef: ref });
});

// src/lib/v4/typeset-react.tsx
var useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;
var TypesetText = /* @__PURE__ */ forwardRef2(function TypesetText2({ text, as = "p", mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour, priority = "auto", onResult, ...attributes }, forwarded) {
  const ref = useRef(null);
  const refCleanup = useRef(void 0);
  const setHost = useCallback((node) => {
    ref.current = node;
    if (node) refCleanup.current = assignRef(forwarded, node);
    else {
      if (refCleanup.current) refCleanup.current();
      else assignRef(forwarded, null);
      refCleanup.current = void 0;
    }
  }, [forwarded]);
  const [initialText] = useState(text);
  const options = useRef({ text, mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour });
  options.current = { text, mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour };
  const report = useRef(onResult);
  report.current = onResult;
  const curled = smartQuotes2 === "en" && (!attributes.lang || /^en(?:-|$)/i.test(attributes.lang));
  const native = useRef("");
  native.current = curled ? smartQuotes(text) : text;
  const entry = useRef(null);
  const keepKey = keep?.join("\0");
  useClientLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const registry = adapterRegistry(element.ownerDocument);
    let key = "", widest = 0;
    const current = {
      element,
      priority,
      compose() {
        const result = typeset(element, options.current);
        widest = result.outcome.startsWith("composed") ? linesExtent(element, result.after.lines) : 0;
        delete element.dataset.tsStale;
        key = rendered(element) ? layoutKey(element) : "";
        const callback = report.current;
        if (callback) queueMicrotask(() => callback(result));
      },
      changed: (fonts) => {
        const now = layoutKey(element, fonts);
        if (now === key) return false;
        if (widest && transformOnly(now, key)) {
          key = now;
          return false;
        }
        return true;
      },
      widest: () => widest,
      stale() {
        const shown = element.textContent;
        restore(element);
        if (element.textContent !== shown) {
          const reselect = selectionBookmark(element);
          element.textContent = shown;
          reselect();
        }
        element.dataset.tsStale = "";
        widest = 0;
      },
      translation(active) {
        if (active) {
          typeset(element, options.current);
          widest = 0;
        } else registry.request(current, "force", false);
      },
      deferred() {
        if (element.textContent !== native.current) {
          restore(element);
          element.textContent = native.current;
          widest = 0;
        }
      },
      unsupported() {
        if (element.textContent !== native.current) element.textContent = native.current;
        element.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
        const callback = report.current;
        const none = { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
        if (callback) queueMicrotask(() => callback({ outcome: ENVIRONMENT_OUTCOME, mode: options.current.mode || (/^H[1-6]$/.test(element.tagName) ? "title" : "body"), before: none, after: none, changed: false, durationMs: 0 }));
      }
    };
    entry.current = current;
    registry.add(current);
    registry.request(current, "mount", true);
    return () => {
      registry.remove(current);
      entry.current = null;
    };
  }, [as]);
  useClientLayoutEffect(() => {
    if (entry.current) entry.current.priority = priority;
  }, [priority]);
  const first = useRef(true);
  useClientLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const current = entry.current;
    if (current) adapterRegistry(current.element.ownerDocument).request(current, "force", true);
  }, [text, mode, keepKey, maxLines, density, lineBreaks, smartQuotes2, opticalHanging, spacing, tracking, contour]);
  return createElement2(as, { ...attributes, ref: setHost, "data-typeset-react": "" }, curled ? smartQuotes(initialText) : initialText);
});

// src/lib/v4/typeset.release.react.tsx
var TypesetText3 = /* @__PURE__ */ forwardRef3(function TypesetText4(props, ref) {
  return createElement3(TypesetText, { ...props, ref, lineBreaks: props.lineBreaks ?? "unicode", contour: props.contour ?? "finished" });
});
var TypesetRichText3 = /* @__PURE__ */ forwardRef3(function TypesetRichText4(props, ref) {
  return createElement3(TypesetRichText, { ...props, ref, lineBreaks: props.lineBreaks ?? "unicode", contour: props.contour ?? "finished" });
});
export {
  TypesetRichText3 as TypesetRichText,
  TypesetText3 as TypesetText
};
