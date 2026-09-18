"use client";
import {
  BREAK_ATTRIBUTE,
  TRACK_ATTRIBUTE,
  finishTargets,
  measureLayout,
  mount,
  opticalMarkerStyle,
  opticalVerified,
  planOpticalHanging,
  planRichText,
  planSpacingFinish,
  planTrackingFinish,
  preserveRichCopy,
  restore,
  richFingerprint,
  richLayoutVerified,
  selectionBookmark,
  smartQuotes,
  spacingMarkerStyle,
  spacingVerified,
  trackingStyle,
  trackingVerified,
  typeset
} from "./shared-S3WC6GW6.js";

// src/lib/v4/typeset.release.react.tsx
import { createElement as createElement3 } from "react";

// src/lib/v4/typeset-react.tsx
import { createElement as createElement2, useLayoutEffect, useRef, useState } from "react";

// src/lib/v4/typeset-rich-react.tsx
import { Children, Component, Fragment, cloneElement, createElement, createRef, isValidElement } from "react";
function quoteSource(children) {
  let source = "";
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") source += String(child);
    else if (isValidElement(child)) source += quoteSource(child.props.children);
  });
  return source;
}
function quoteTreeSupported(children) {
  let supported = true;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.props.lang && !/^en(?:-|$)/i.test(child.props.lang) || child.props["data-no-typeset"] !== void 0 || typeof child.type === "string" && !["a", "b", "strong", "em", "i", "span", "small", "u", "s", "del", "mark", "abbr", "cite"].includes(child.type) || !quoteTreeSupported(child.props.children)) supported = false;
  });
  return supported;
}
function trackingForTree(plan, children) {
  let offset = 0;
  const runs = [];
  const visit = (nodes) => Children.forEach(nodes, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const end = offset + String(child).length;
      for (const run of plan.runs) {
        const start = Math.max(offset, run.start), stop = Math.min(end, run.end);
        if (stop > start) runs.push({ ...run, start, end: stop });
      }
      offset = end;
    } else if (isValidElement(child)) visit(child.props.children);
  });
  visit(children);
  return { ...plan, runs };
}
function renderChildren(children, breaks, hangs, spaces, tracks, educate) {
  let offset = 0;
  const educated = educate ? smartQuotes(quoteSource(children)) : null;
  const optical = new Map(hangs.map((hang) => [hang.offset, hang.px]));
  const spacing = new Map(spaces.map((space) => [space.offset, space.px]));
  const visit = (nodes) => Children.map(nodes, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const raw = String(child);
      const text = educated === null ? raw : educated.slice(offset, offset + raw.length);
      const start = offset;
      offset += text.length;
      const stops = [.../* @__PURE__ */ new Set([...breaks, ...optical.keys(), ...spacing.keys(), ...tracks.flatMap((run) => [run.start, run.end])])].filter((at) => at >= start && at < offset).sort((a, b) => a - b);
      let cursor = 0;
      const pieces = [];
      let active;
      let tracked = [];
      const flush = () => {
        if (active && tracked.length) pieces.push(createElement("span", { key: "track-" + active.start, [TRACK_ATTRIBUTE]: String(active.start), style: trackingStyle(active) }, ...tracked));
        active = void 0;
        tracked = [];
      };
      const append = (piece, at, marker = false) => {
        if (piece === "") return;
        const run = tracks.find((run2) => run2.start <= at && at < run2.end);
        if (marker || run !== active) flush();
        active = marker ? void 0 : run;
        if (active) tracked.push(piece);
        else pieces.push(piece);
      };
      for (const stop of stops) {
        const local = stop - start;
        append(text.slice(cursor, local), start + cursor);
        if (breaks.has(stop)) append(createElement("br", { key: "break-" + stop, [BREAK_ATTRIBUTE]: "", "aria-hidden": true }), stop, true);
        if (optical.has(stop)) append(createElement("span", { key: "hang-" + stop, [BREAK_ATTRIBUTE]: "", "data-ts-hang": String(stop), "aria-hidden": true, style: opticalMarkerStyle(optical.get(stop)) }), stop, true);
        if (spacing.has(stop)) append(createElement("span", { key: "space-" + stop, [BREAK_ATTRIBUTE]: "", "data-ts-space": String(stop), "aria-hidden": true, style: spacingMarkerStyle(spacing.get(stop)) }), stop);
        cursor = local;
      }
      append(text.slice(cursor), start + cursor);
      flush();
      return pieces;
    }
    if (!isValidElement(child)) return child;
    return cloneElement(child, void 0, visit(child.props.children));
  });
  return visit(children);
}
function supportedTree(children) {
  let supported = true;
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (typeof child.type !== "string" && child.type !== Fragment) supported = false;
    if (!supportedTree(child.props.children)) supported = false;
  });
  return supported;
}
var TypesetRichText = class extends Component {
  constructor() {
    super(...arguments);
    this.state = { input: this.props.children, plan: null };
    this.host = createRef();
    this.frame = 0;
    this.mounted = false;
    this.observe = () => {
      if (this.host.current) this.observer?.observe(this.host.current, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "lang"] });
      for (let ancestor = this.host.current?.parentElement; ancestor; ancestor = ancestor.parentElement) {
        this.observer?.observe(ancestor, { attributes: true, attributeFilter: ["style", "class", "lang"] });
      }
    };
    this.bindHost = () => {
      this.releaseCopy?.();
      this.resize?.disconnect();
      const el = this.host.current;
      if (!el) return;
      this.releaseCopy = preserveRichCopy(el);
      this.resize?.observe(el);
      if (el.parentElement) this.resize?.observe(el.parentElement);
    };
    this.schedule = () => {
      if (!this.mounted || this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.recompose();
      });
    };
    this.recompose = () => {
      if (!this.mounted || !this.host.current) return;
      this.observer?.disconnect();
      const plan = planRichText(this.host.current, this.props);
      if (!supportedTree(this.props.children)) {
        plan.breaks = [];
        plan.outcome = "native:react-component";
      }
      if (JSON.stringify(plan) !== JSON.stringify(this.state.plan)) this.setState({ plan });
      else this.observe();
    };
  }
  static getDerivedStateFromProps(props, state) {
    return props.children !== state.input ? { input: props.children, plan: null } : null;
  }
  componentDidMount() {
    this.mounted = true;
    const el = this.host.current;
    this.observer = new MutationObserver(this.schedule);
    this.resize = new ResizeObserver(this.schedule);
    this.bindHost();
    el.ownerDocument.fonts.addEventListener("loadingdone", this.schedule);
    el.ownerDocument.defaultView?.addEventListener("resize", this.schedule);
    el.ownerDocument.fonts.ready.then(this.schedule);
    this.recompose();
  }
  getSnapshotBeforeUpdate() {
    this.observer?.disconnect();
    return this.host.current ? selectionBookmark(this.host.current) : null;
  }
  componentDidUpdate(previous, _state, restoreSelection) {
    restoreSelection?.();
    if (previous.as !== this.props.as) this.bindHost();
    if (previous !== this.props) this.recompose();
    else {
      const el = this.host.current;
      const plan = this.state.plan;
      if (plan && (plan.outcome === "composed:rich" || plan.outcome === "native:fits")) {
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
      }
      this.observe();
    }
  }
  componentWillUnmount() {
    this.mounted = false;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.resize?.disconnect();
    this.host.current?.ownerDocument.fonts.removeEventListener("loadingdone", this.schedule);
    this.host.current?.ownerDocument.defaultView?.removeEventListener("resize", this.schedule);
    this.releaseCopy?.();
  }
  render() {
    const { children, as = "p", mode: _mode, keep: _keep, maxLines: _maxLines, density: _density, lineBreaks: _lineBreaks, smartQuotes: quotes, opticalHanging: _optical, spacing: _spacing, tracking: _tracking, contour: _contour, ...attributes } = this.props;
    const plan = this.state.plan;
    const educate = quotes === "en" && /^en(?:-|$)/i.test(this.props.lang || "") && quoteTreeSupported(children);
    return createElement(
      as,
      {
        ...attributes,
        ref: this.host,
        "data-typeset-react-rich": "",
        "data-typeset-done": plan ? "1" : void 0,
        "data-ts-outcome": plan?.outcome,
        "data-ts-quotes": quotes ? educate ? "enabled" : "native:quotes-scope" : void 0,
        "data-ts-hanging": _optical ? plan?.hanging || "native:hanging-uncomposed" : void 0,
        "data-ts-spacing": _spacing === false ? "off" : plan?.spacing?.outcome || "native:spacing-uncomposed",
        "data-ts-tracking": _tracking === false || _spacing === false ? "off" : plan?.tracking?.outcome || "native:tracking-uncomposed"
      },
      supportedTree(children) ? renderChildren(children, new Set(plan?.breaks || []), plan?.hangs || [], plan?.spacing?.adjustments || [], plan?.tracking?.runs || [], educate) : children
    );
  }
};

// src/lib/v4/typeset-react.tsx
function TypesetText({ text, as = "p", mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour, ...attributes }) {
  const ref = useRef(null);
  const [initialText] = useState(text);
  const options = useRef({ text, mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour });
  options.current = { text, mode, keep, maxLines, density, lineBreaks, smartQuotes: smartQuotes2, opticalHanging, spacing, tracking, contour };
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const controller = mount(element, "[data-typeset-react]", options.current);
    return () => controller.disconnect();
  }, [as, text, mode, keep, maxLines, density, lineBreaks, smartQuotes2, opticalHanging, spacing, tracking, contour]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) typeset(element, options.current);
    return () => {
      if (element) restore(element);
    };
  }, [as, text, mode, keep, maxLines, density, lineBreaks, smartQuotes2, opticalHanging, spacing, tracking, contour]);
  return createElement2(as, { ...attributes, ref, "data-typeset-react": "" }, initialText);
}

// src/lib/v4/typeset.release.react.tsx
function TypesetText2(props) {
  return createElement3(TypesetText, { ...props, lineBreaks: props.lineBreaks ?? "unicode", contour: props.contour ?? "finished" });
}
function TypesetRichText2(props) {
  return createElement3(TypesetRichText, { ...props, lineBreaks: props.lineBreaks ?? "unicode", contour: props.contour ?? "finished" });
}
export {
  TypesetRichText2 as TypesetRichText,
  TypesetText2 as TypesetText
};
//# sourceMappingURL=react.js.map
