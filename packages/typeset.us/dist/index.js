/* typeset.us v3.2.0 — MIT © Dustin York. https://typeset.us */

// src/lib/typeset.ts
var NBSP = "\xA0";
var NBHY = "\u2011";
var canonicalText = /* @__PURE__ */ new WeakMap();
var isInternalWrite = false;
var WEAK_END_WORDS = /* @__PURE__ */ new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "and", "or", "but", "nor", "so", "as"]);
var LINKING_END_WORDS = /* @__PURE__ */ new Set([
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "am",
  "being",
  "has",
  "have",
  "had"
]);
var OPEN_PUNCT = /* @__PURE__ */ new Set(["(", "[", "{", "\u201C", "\u2018"]);
var CLOSE_PUNCT = /* @__PURE__ */ new Set([")", "]", "}", ".", ",", ";", ":", "!", "?", "\u201D", "\u2019", "%"]);
var DASHES = /* @__PURE__ */ new Set(["\u2014", "\u2013"]);
var HANG_OPEN = /* @__PURE__ */ new Set(["\u201C", "\u2018", '"', "'", "(", "[", "{", "\xAB", "\xBF", "\xA1"]);
var PULL_LETTERS = {
  T: 0.06,
  V: 0.06,
  W: 0.05,
  Y: 0.06,
  A: 0.04,
  J: 0.03,
  O: 0.03,
  C: 0.03,
  G: 0.03,
  Q: 0.03,
  o: 0.02,
  c: 0.02
};
function leadingOpticalIndentPx(text, measurer, fontSizePx) {
  const ch = text.charAt(0);
  if (!ch) return 0;
  if (HANG_OPEN.has(ch)) return measurer(ch);
  const pull = PULL_LETTERS[ch];
  if (pull) return fontSizePx * pull;
  return 0;
}
function safeWrite(fn) {
  isInternalWrite = true;
  fn();
  setTimeout(() => {
    isInternalWrite = false;
  }, 0);
}
function shouldIgnoreMutation() {
  return isInternalWrite;
}
var isSentenceEnd = (word) => /[.!?]$/.test(word) || /[.!?]["'\u201D\u2019]$/.test(word);
function tokenize(text, measurer) {
  if (!text || text.trim().length === 0) return [];
  const parts = text.split(/(\s+)/);
  const tokens = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push({
        text: part,
        kind: "space",
        width: measurer(part)
      });
      continue;
    }
    const lower = part.toLowerCase();
    const firstChar = part[0];
    const lastChar = part[part.length - 1];
    let kind = "word";
    let stickyPrev = false;
    let stickyNext = false;
    let weakEnd = false;
    let protectedCompound = false;
    let emergencyBreakParts;
    if (OPEN_PUNCT.has(firstChar) && part.length === 1) {
      kind = "openPunct";
      stickyNext = true;
    } else if (CLOSE_PUNCT.has(lastChar) && (part.length === 1 || CLOSE_PUNCT.has(part))) {
      kind = "closePunct";
      stickyPrev = true;
    } else if (DASHES.has(part)) {
      kind = "dash";
      stickyPrev = true;
    } else if (part.length <= 20 && part.indexOf("-") > 0 && part.indexOf("-") < part.length - 1) {
      kind = "compound";
      protectedCompound = true;
    } else if (part.length > 16 && !/\s/.test(part)) {
      kind = "longSlug";
      const camelParts = part.split(/(?<=[a-z])(?=[A-Z])/);
      if (camelParts.length > 1) {
        emergencyBreakParts = camelParts;
      } else {
        const delimParts = part.split(/[_\/]/);
        if (delimParts.length > 1) {
          emergencyBreakParts = delimParts;
        }
      }
    } else if (WEAK_END_WORDS.has(lower.replace(/[.,;:!?'"\u201D\u2019]+$/, ""))) {
      weakEnd = true;
    }
    tokens.push({
      text: part,
      kind,
      width: measurer(part),
      stickyPrev,
      stickyNext,
      weakEnd,
      protectedCompound,
      emergencyBreakParts
    });
  }
  return tokens;
}
function profileForMeasure(measureCh2) {
  if (measureCh2 < 18) return {
    mainTarget: 0.85,
    lastTarget: 0.55,
    weakEndPenalty: 8200,
    orphanPenalty: 1e9,
    flatShelfPenalty: 240,
    snapPenalty: 180,
    maxWordSpacing: 0.018
  };
  if (measureCh2 < 24) return {
    mainTarget: 0.82,
    lastTarget: 0.52,
    weakEndPenalty: 7600,
    orphanPenalty: 1e9,
    flatShelfPenalty: 200,
    snapPenalty: 140,
    maxWordSpacing: 0.025
  };
  return {
    // 0.85 is the documented design center (RESEARCH.md: "cubic badness
    // centered on 85% fill — the sweet spot for ragged-right"). At 0.80 the
    // compositor set ~20% looser than the browser and cost 2-3 extra lines
    // per paragraph at 375px with no rag improvement (measured on /proof).
    mainTarget: 0.85,
    lastTarget: 0.48,
    weakEndPenalty: 7e3,
    orphanPenalty: 1e9,
    flatShelfPenalty: 160,
    snapPenalty: 100,
    maxWordSpacing: 0.035
  };
}
function composeParagraph(tokens, measurePx, measureCh2, opts = {}) {
  if (tokens.length === 0) return null;
  const profile = profileForMeasure(measureCh2);
  const BEAM = tokens.length > 120 ? 80 : 48;
  const isHeading = opts.isHeading === true;
  const SENTENCE_END_BONUS = 1300;
  const DANGLING_START_PENALTY = 5200;
  const LINKING_END_PENALTY = 1600;
  const contentTokens = tokens.filter((t) => t.kind !== "space");
  if (contentTokens.length < 2) return null;
  const normWord = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isLexicalKind = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  let parallelCloser = "";
  if (isHeading) {
    const lex = contentTokens.filter(isLexicalKind);
    const lastLex = lex[lex.length - 1];
    if (lastLex && isSentenceEnd(lastLex.text)) {
      const lastNorm = normWord(lastLex.text);
      for (let i = 0; i < lex.length - 1; i++) {
        if (isSentenceEnd(lex[i].text) && normWord(lex[i].text) === lastNorm) {
          parallelCloser = lastNorm;
          break;
        }
      }
    }
  }
  const spaceToken = tokens.find((t) => t.kind === "space");
  const spaceWidth = spaceToken ? spaceToken.width : 0;
  const lineWidth = (lineTokens) => {
    const tokenWidths = lineTokens.reduce((sum, t) => sum + t.width, 0);
    const gaps = Math.max(0, lineTokens.length - 1);
    return tokenWidths + gaps * spaceWidth;
  };
  const isContent = (t) => t.kind !== "space";
  const isLexical = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  function firstContentToken(toks) {
    var _a;
    return (_a = toks.find(isContent)) != null ? _a : null;
  }
  function lastContentToken(toks) {
    for (let i = toks.length - 1; i >= 0; i--) {
      if (isContent(toks[i])) return toks[i];
    }
    return null;
  }
  function lastLexicalToken(toks) {
    for (let i = toks.length - 1; i >= 0; i--) {
      if (isLexical(toks[i])) return toks[i];
    }
    return null;
  }
  function lexicalWordCount(toks) {
    let n = 0;
    for (const t of toks) {
      if (isLexical(t)) n++;
    }
    return n;
  }
  function breaksProtectedCompoundAt(breakIndex) {
    if (breakIndex <= 0 || breakIndex >= contentTokens.length) return false;
    const prev = contentTokens[breakIndex - 1];
    const next = contentTokens[breakIndex];
    if (!prev || !next) return false;
    if (prev.compoundId && next.compoundId && prev.compoundId === next.compoundId) {
      return true;
    }
    if (prev.protectedCompound && prev.text.endsWith("-")) {
      return true;
    }
    return false;
  }
  const scoreLine = (lineTokens, fill, isLast, breakEnd) => {
    let penalty = 0;
    const lexCount = lexicalWordCount(lineTokens);
    const firstContent = firstContentToken(lineTokens);
    const lastContent = lastContentToken(lineTokens);
    const lastLexical = lastLexicalToken(lineTokens);
    if (isLast && lexCount === 1) {
      if (parallelCloser && lastLexical && normWord(lastLexical.text) === parallelCloser) {
        penalty += 200;
      } else if (isHeading) {
        penalty += 6e4;
      } else {
        return profile.orphanPenalty;
      }
    }
    if (!isLast && lexCount === 1 && fill < 0.85 && (lastLexical == null ? void 0 : lastLexical.kind) !== "longSlug") {
      const isParallelCloser = !!parallelCloser && !!lastLexical && normWord(lastLexical.text) === parallelCloser;
      penalty += isParallelCloser ? 200 : 5e4;
    }
    if (!isLast && lexCount === 2 && fill < 0.5) {
      penalty += 5e3;
    }
    const target = isLast ? profile.lastTarget : profile.mainTarget;
    const deviation = fill - target;
    penalty += (deviation < 0 ? 3e3 : 1200) * deviation * deviation;
    if (!isLast && fill < 0.5) {
      penalty += 8e3;
    } else if (!isLast && fill < 0.6) {
      penalty += 4e3;
    } else if (!isLast && fill < 0.7) {
      penalty += 2e3;
    } else if (!isLast && fill < 0.75) {
      penalty += 800;
    }
    if (isLast && fill < 0.3 && lexCount <= 2) {
      penalty += 4e3;
    }
    if (!isLast && fill > 0.955) {
      penalty += 4e3;
    } else if (!isLast && fill > 0.93) {
      penalty += 1200;
    }
    if (firstContent && (firstContent.kind === "closePunct" || firstContent.kind === "dash" || firstContent.stickyPrev)) {
      penalty += 1e9;
    }
    if (lastContent && (lastContent.kind === "openPunct" || lastContent.stickyNext)) {
      penalty += 1e9;
    }
    if (!isLast && (lastLexical == null ? void 0 : lastLexical.weakEnd)) {
      penalty += profile.weakEndPenalty;
    }
    if (!isLast && lastLexical && LINKING_END_WORDS.has(
      lastLexical.text.toLowerCase().replace(/[.,;:!?’'"”]+$/, "")
    )) {
      penalty += LINKING_END_PENALTY;
    }
    if (!isLast && lastLexical && /^[A-Za-z]$/.test(lastLexical.text)) {
      penalty += profile.weakEndPenalty * 1.5;
    }
    if (breaksProtectedCompoundAt(breakEnd)) {
      penalty += 7e3;
    }
    if (!isLast && lastContent && !isSentenceEnd(lastContent.text)) {
      let crossesBoundary = false;
      for (const t of lineTokens) {
        if (t === lastContent) break;
        if (t.kind !== "space" && isSentenceEnd(t.text)) {
          crossesBoundary = true;
          break;
        }
      }
      if (crossesBoundary) {
        const openerLen = lastContent.text.replace(/[^A-Za-z0-9]/g, "").length;
        penalty += openerLen <= 4 ? 7e3 : DANGLING_START_PENALTY;
      }
    }
    if (isHeading && lastContent && isSentenceEnd(lastContent.text)) {
      penalty -= SENTENCE_END_BONUS;
    }
    return penalty;
  };
  const scoreTransition = (lines, isLast) => {
    if (lines.length < 2 || isLast) return 0;
    let penalty = 0;
    const i = lines.length - 1;
    const currFill = lines[i].fill;
    const prevFill = lines[i - 1].fill;
    const jump = Math.abs(currFill - prevFill);
    if (jump > 0.06) {
      penalty += Math.min(1800, 25e4 * (jump - 0.06) * (jump - 0.06));
    }
    if (lines.length >= 3) {
      const prevPrevFill = lines[i - 2].fill;
      const avg = (currFill + prevFill + prevPrevFill) / 3;
      if (avg > 0.9 && Math.abs(prevPrevFill - prevFill) < 0.04 && Math.abs(prevFill - currFill) < 0.04) {
        penalty += profile.flatShelfPenalty;
      }
    }
    return penalty;
  };
  let beam = [{ tokenIndex: 0, lines: [], cost: 0 }];
  const completes = [];
  let iterations = 0;
  const MAX_ITERATIONS = 500;
  while (beam.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const newBeam = [];
    for (const state of beam) {
      const start = state.tokenIndex;
      if (start >= contentTokens.length) {
        if (completes.length < 200) completes.push(state);
        continue;
      }
      for (let end = start + 1; end <= Math.min(start + 25, contentTokens.length); end++) {
        const lineTokens = contentTokens.slice(start, end);
        const width = lineWidth(lineTokens);
        const fill = width / measurePx;
        const isLast = end === contentTokens.length;
        if (fill > 0.97) continue;
        const linePenalty = scoreLine(lineTokens, fill, isLast, end);
        const newLines = [...state.lines, { tokens: lineTokens, width, fill }];
        const transitionPenalty = scoreTransition(newLines, isLast);
        newBeam.push({
          tokenIndex: end,
          lines: newLines,
          cost: state.cost + linePenalty + transitionPenalty
        });
      }
    }
    newBeam.sort((a, b) => a.cost - b.cost);
    beam = newBeam.slice(0, BEAM);
  }
  if (completes.length === 0) return null;
  completes.sort((a, b) => a.cost - b.cost);
  let winner = completes[0];
  const isLong = winner.lines.length >= 10;
  const slack = Math.min(
    winner.cost * (isLong ? 0.2 : 0.15) + (isLong ? 1200 : 600),
    3200
  );
  const nearOptimal = completes.filter((s) => s.cost <= winner.cost + slack);
  if (nearOptimal.length > 1) {
    const contourScore = (s) => {
      const fills = s.lines.slice(0, -1).map((l) => l.fill);
      if (fills.length < 2) return 0;
      const spread = Math.max(...fills) - Math.min(...fills);
      let maxStep = 0;
      for (let i = 1; i < fills.length; i++) {
        maxStep = Math.max(maxStep, Math.abs(fills[i] - fills[i - 1]));
      }
      let registerShift = 0;
      if (fills.length >= 4) {
        const half = Math.ceil(fills.length / 2);
        const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        registerShift = Math.abs(mean(fills.slice(0, half)) - mean(fills.slice(half)));
      }
      return 2 * spread + 3 * maxStep + 1.5 * registerShift;
    };
    winner = nearOptimal.reduce(
      (best, s) => contourScore(s) < contourScore(best) ? s : best,
      nearOptimal[0]
    );
  }
  return winner.lines.map((line) => ({
    text: line.tokens.map((t) => t.text).join(" "),
    tokens: line.tokens,
    fill: line.fill,
    width: line.width,
    wordSpacingEm: 0
  }));
}
function shapeExactLines(lines, measureCh2, measurePx, isHeading = false) {
  const shapedLines = [];
  const maxExpand = isHeading ? 0.03 : 0.0825;
  const maxContract = isHeading ? 0.02 : 0.05;
  const nonLastFills = lines.slice(0, -1).map((l) => l.fill).sort((a, b) => a - b);
  const mid = Math.floor(nonLastFills.length / 2);
  const median = nonLastFills.length === 0 ? 0.85 : nonLastFills.length % 2 === 0 ? (nonLastFills[mid - 1] + nonLastFills[mid]) / 2 : nonLastFills[mid];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    if (isLast) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }
    const wordCount = line.tokens.length;
    const gaps = Math.max(0, wordCount - 1);
    if (gaps === 0) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }
    const neighbors = [];
    if (i > 0) neighbors.push(lines[i - 1].fill);
    if (i < lines.length - 2) neighbors.push(lines[i + 1].fill);
    const local = neighbors.length ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length : median;
    let targetFill = 0.5 * local + 0.5 * median;
    targetFill = Math.max(0.7, Math.min(0.965, targetFill));
    const targetWidth = measurePx * targetFill;
    const delta = targetWidth - line.width;
    const spacingPx = delta / gaps;
    const approxFontSize = measurePx / measureCh2;
    const spacingEm = spacingPx / approxFontSize;
    if (spacingEm > maxExpand) {
      shapedLines.push({ ...line, wordSpacingEm: maxExpand });
    } else if (spacingEm < -maxContract) {
      shapedLines.push({ ...line, wordSpacingEm: spacingEm < -maxContract * 2 ? 0 : -maxContract });
    } else {
      shapedLines.push({ ...line, wordSpacingEm: spacingEm });
    }
  }
  return shapedLines;
}
function finalValidate(lines, measureCh2, isHeading = false) {
  var _a;
  if (!lines.length) return false;
  const profile = profileForMeasure(measureCh2);
  const isContent = (t) => t.kind !== "space";
  const isLexical = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].tokens;
    const isLast = i === lines.length - 1;
    let lexCount = 0;
    for (const t of tokens) {
      if (isLexical(t)) lexCount++;
    }
    if (isLast && lexCount === 1 && !isHeading) return false;
    const firstContent = (_a = tokens.find(isContent)) != null ? _a : null;
    if (firstContent && (firstContent.kind === "closePunct" || firstContent.kind === "dash" || firstContent.stickyPrev)) {
      return false;
    }
    let lastContent = null;
    for (let j = tokens.length - 1; j >= 0; j--) {
      if (isContent(tokens[j])) {
        lastContent = tokens[j];
        break;
      }
    }
    if (lastContent && (lastContent.kind === "openPunct" || lastContent.stickyNext)) {
      return false;
    }
    if (lines[i].wordSpacingEm > 0.085 || lines[i].wordSpacingEm < -0.055) {
      return false;
    }
  }
  return true;
}
function renderFrozenLines(p, lines) {
  var _a;
  const cs = getComputedStyle(p);
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const measurer = makeMeasurer(p);
  safeWrite(() => {
    p.innerHTML = "";
    p.dataset.typesetDone = "1";
    p.setAttribute("role", "text");
    lines.forEach((line, i) => {
      const span = document.createElement("span");
      span.className = "ts-line";
      span.style.display = "block";
      span.style.whiteSpace = "pre";
      if (Math.abs(line.wordSpacingEm) > 5e-4) {
        span.style.wordSpacing = `${line.wordSpacingEm}em`;
      }
      const indentPx = leadingOpticalIndentPx(line.text, measurer, fontSizePx);
      if (indentPx > 0.25) {
        span.style.textIndent = `-${indentPx.toFixed(2)}px`;
      }
      span.textContent = line.text;
      if (i > 0) p.appendChild(document.createTextNode("\n"));
      p.appendChild(span);
    });
  });
  (_a = measurer.cleanup) == null ? void 0 : _a.call(measurer);
}
function typesetHeadingText(text) {
  if (!text || text.length < 5) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;
  const ARTICLES = /* @__PURE__ */ new Set(["a", "an", "the"]);
  const PREPS = /* @__PURE__ */ new Set(["to", "in", "on", "of", "at", "by", "for", "with", "from"]);
  const result = [];
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    if (word.length <= 20 && word.indexOf("-") > 0 && word.indexOf("-") < word.length - 1) {
      word = word.replace(/-/g, NBHY);
      words[i] = word;
    }
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    if (ARTICLES.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (PREPS.has(word.toLowerCase()) && nextWord) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }
    result.push(word);
  }
  return result.join(" ");
}
function typesetText(text, options) {
  var _a;
  const mode = (_a = options == null ? void 0 : options.mode) != null ? _a : "body";
  const educated = educateQuotes(text);
  if (mode === "heading") {
    return typesetHeadingText(educated);
  }
  return typesetBodyText(educated, options == null ? void 0 : options.measure);
}
function typesetHeading(text) {
  return typesetText(text, { mode: "heading" });
}
function typesetBodyText(text, measure) {
  if (!text || text.length < 10) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;
  void measure;
  const result = [];
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    if (word.length <= 20 && word.indexOf("-") > 0 && word.indexOf("-") < word.length - 1) {
      word = word.replace(/-/g, NBHY);
      words[i] = word;
    }
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    if (nextWord && /^[\(\[\{\u201C\u2018]$/.test(word)) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (result.length > 0 && /^[\)\]\}\.,;:!?\u201D\u2019%]/.test(word)) {
      const last = result.pop();
      result.push(last + NBSP + word);
      continue;
    }
    if (nextWord && /^[\$£€¥]$/.test(word)) {
      result.push(word + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (nextWord) {
      const lc = word.toLowerCase();
      if (lc === "a" || lc === "i") {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    if (nextWord) {
      const lc = word.toLowerCase().replace(/[.,;:!?]+$/, "");
      const nextIsPunctOnly = /^[\)\]\}\.,;:!?\u201D\u2019%]+$/.test(nextWord);
      if (!nextIsPunctOnly && PHASE1_BIND_END_WORDS.has(lc)) {
        result.push(word + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    result.push(word);
  }
  if (result.length >= 3) {
    const lastAtom = result.pop();
    const prevAtom = result.pop();
    result.push(prevAtom + NBSP + lastAtom);
  }
  return result.join(" ");
}
var PHASE1_BIND_END_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "and",
  "or",
  "but",
  "nor",
  "so",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been"
]);
var _chCache = /* @__PURE__ */ new WeakMap();
var _canvas = null;
function measureCh(element) {
  const cached = _chCache.get(element);
  const elWidth = element.clientWidth || element.getBoundingClientRect().width;
  if (cached && cached.width === elWidth) return cached.ch;
  const cs = getComputedStyle(element);
  const containerPx = elWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (containerPx <= 0) return 65;
  if (!_canvas) {
    const c = document.createElement("canvas");
    _canvas = c.getContext("2d");
  }
  if (_canvas) {
    _canvas.font = "7px serif";
    if ("letterSpacing" in _canvas) {
      _canvas.letterSpacing = "0px";
    }
    _canvas.font = canvasFontString(cs);
    const chPx = _canvas.font.includes(cs.fontSize) ? _canvas.measureText("0").width : 0;
    if (chPx > 0) {
      const ch2 = Math.floor(containerPx / chPx);
      _chCache.set(element, { width: elWidth, ch: ch2 });
      return ch2;
    }
  }
  const fsPx = parseFloat(cs.fontSize) || 16;
  const ch = Math.floor(containerPx / (fsPx * 0.6));
  _chCache.set(element, { width: elWidth, ch });
  return ch;
}
function educateQuotes(text) {
  if (!text) return text;
  let s = text;
  s = s.replace(/\s+--\s+/g, " \u2014 ");
  s = s.replace(/--/g, "\u2014");
  s = s.replace(/\.\.\./g, "\u2026");
  s = s.replace(/(^|[\s([{—–])"/g, "$1\u201C");
  s = s.replace(/"/g, "\u201D");
  s = s.replace(/'(?=\d)/g, "\u2019");
  s = s.replace(/(^|[\s([{—–])'(?=[A-Za-z])/g, "$1\u2018");
  s = s.replace(/([A-Za-z0-9])'(?=[A-Za-z])/g, "$1\u2019");
  s = s.replace(/'/g, "\u2019");
  return s;
}
function canvasFontString(cs) {
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded)$/i;
  const fams = cs.fontFamily.split(",").map((f) => {
    const t = f.trim();
    if (generic.test(t) || /^['"]/.test(t)) return t;
    return '"' + t.replace(/"/g, "") + '"';
  }).join(", ");
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${fams}`;
}
function makeMeasurer(element) {
  const cs = getComputedStyle(element);
  if (!_canvas) {
    const c = document.createElement("canvas");
    _canvas = c.getContext("2d");
  }
  const ctx = _canvas;
  const font = canvasFontString(cs);
  const letterSpacing = cs.letterSpacing && cs.letterSpacing !== "normal" ? cs.letterSpacing : "0px";
  const fallbackCh = (parseFloat(cs.fontSize) || 16) * 0.5;
  let canvasOk = false;
  if (ctx) {
    ctx.font = "7px serif";
    if ("letterSpacing" in ctx) {
      ctx.letterSpacing = "0px";
    }
    ctx.font = font;
    canvasOk = ctx.font.includes(cs.fontSize);
  }
  if (ctx && canvasOk) {
    const m2 = (text) => {
      ctx.font = font;
      if ("letterSpacing" in ctx) {
        ctx.letterSpacing = letterSpacing;
      }
      return ctx.measureText(text).width;
    };
    return m2;
  }
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;font:inherit;letter-spacing:inherit;word-spacing:inherit;";
  element.appendChild(probe);
  const m = (text) => {
    if (!probe.isConnected) return text.length * fallbackCh;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };
  m.cleanup = () => {
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  };
  return m;
}
function containerPxOf(element) {
  const cs = getComputedStyle(element);
  const base = element.clientWidth || element.getBoundingClientRect().width;
  return base - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}
function canCompose(element) {
  const tag = element.tagName;
  if (tag === "UL" || tag === "OL" || tag === "LI") return false;
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType !== 1) continue;
    const el = child;
    if (el.classList && el.classList.contains("ts-line")) continue;
    if (el.tagName === "BR") continue;
    return false;
  }
  return true;
}
function restorePlain(element, raw) {
  safeWrite(() => {
    element.textContent = raw;
  });
  return false;
}
function linesOverflow(element, tolerancePx = 0.75) {
  const cs = getComputedStyle(element);
  const rightEdge = element.getBoundingClientRect().right - parseFloat(cs.paddingRight);
  for (const span of Array.from(element.querySelectorAll(".ts-line"))) {
    const range = document.createRange();
    range.selectNodeContents(span);
    if (range.getBoundingClientRect().right - rightEdge > tolerancePx) return true;
  }
  return false;
}
function audit(selector = "p, li, blockquote, figcaption, h1, h2, h3, h4") {
  if (typeof document === "undefined") return [];
  const violations = [];
  document.querySelectorAll(selector).forEach((el) => {
    const lines = Array.from(el.querySelectorAll(":scope > .ts-line"));
    if (!lines.length) return;
    const cs = getComputedStyle(el);
    const rightEdge = el.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    lines.forEach((span, i) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      const over = range.getBoundingClientRect().right - rightEdge;
      if (over > 0.75) {
        violations.push({
          element: el,
          type: "overflow",
          detail: `line ${i + 1} exceeds the measure by ${over.toFixed(1)}px: "${(span.textContent || "").slice(0, 48)}"`
        });
      }
      if (i < lines.length - 1) {
        const lastWord = (span.textContent || "").trim().split(/\s+/).pop() || "";
        const clean = lastWord.replace(/[^A-Za-z0-9’']+$/g, "").toLowerCase();
        if (WEAK_END_WORDS.has(clean) || LINKING_END_WORDS.has(clean)) {
          violations.push({
            element: el,
            type: "weak-line-end",
            detail: `line ${i + 1} ends on "${lastWord}"`
          });
        }
      }
    });
    const last = lines[lines.length - 1];
    const words = (last.textContent || "").trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    if (lines.length > 1 && words.length === 1 && !/^H[1-6]$/.test(el.tagName)) {
      violations.push({
        element: el,
        type: "orphan",
        detail: `last line is a single word: "${(last.textContent || "").trim()}"`
      });
    }
  });
  return violations;
}
function linesStarved(element, medianFloor = 0.62) {
  const cs = getComputedStyle(element);
  const left = element.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
  const width = element.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (width <= 0) return false;
  const spans = Array.from(element.querySelectorAll(".ts-line"));
  if (spans.length < 4) return false;
  const fills = [];
  for (let i = 0; i < spans.length - 1; i++) {
    const r = document.createRange();
    r.selectNodeContents(spans[i]);
    fills.push((r.getBoundingClientRect().right - left) / width);
  }
  fills.sort((a, b) => a - b);
  const median = fills[Math.floor(fills.length / 2)];
  return median < medianFloor;
}
function composeElement(element, measure) {
  var _a, _b, _c, _d;
  let raw = (_b = (_a = element.dataset.tsRaw) != null ? _a : canonicalText.get(element)) != null ? _b : element.textContent || "";
  raw = educateQuotes(raw.trim());
  if (raw.length < 10) {
    element.dataset.tsOutcome = "skipped:short";
    return false;
  }
  canonicalText.set(element, raw);
  const measurePx = containerPxOf(element);
  if (measurePx <= 0) {
    element.dataset.tsOutcome = "unmeasurable";
    return false;
  }
  const measurer = makeMeasurer(element);
  const tokens = tokenize(raw, measurer);
  (_c = measurer.cleanup) == null ? void 0 : _c.call(measurer);
  const isHeading = /^H[1-6]$/.test(element.tagName) || !!element.closest("h1,h2,h3,h4,h5,h6");
  const composed = composeParagraph(tokens, measurePx, measure, { isHeading });
  if (!composed) {
    element.dataset.tsOutcome = "fallback:no-composition";
    return restorePlain(element, raw);
  }
  const shaped = (_d = shapeExactLines(composed, measure, measurePx, isHeading)) != null ? _d : composed;
  if (!finalValidate(shaped, measure, isHeading)) {
    element.dataset.tsOutcome = "fallback:validate";
    return restorePlain(element, raw);
  }
  renderFrozenLines(element, shaped);
  if (linesOverflow(element)) {
    element.dataset.tsOutcome = "fallback:overflow";
    return restorePlain(element, raw);
  }
  if (!isHeading && linesStarved(element)) {
    element.dataset.tsOutcome = "fallback:starved";
    return restorePlain(element, raw);
  }
  element.dataset.tsOutcome = "composed";
  return true;
}
function typeset(element) {
  var _a, _b;
  if (!element) return;
  if (typeof document !== "undefined" && !document.getElementById("ts-list-styles")) {
    const style = document.createElement("style");
    style.id = "ts-list-styles";
    style.textContent = `
      /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
         SILVER BULLET \u2014 hung list markers with optical left alignment.
         Add class="ts-styled" to any <ul> (typeset() also adds it for you).

         CUSTOMIZE THE BULLET by setting CSS variables on the list, a wrapper,
         or :root \u2014 no need to edit this file. All are optional; the defaults
         reproduce the classic hung "\u2022".

           --ts-bullet-content   the marker glyph        (default: "\u2022")
           --ts-bullet-color     marker color            (default: currentColor)
           --ts-bullet-size      marker font-size        (default: 1.25em)
           --ts-bullet-opacity   marker opacity          (default: 0.8)
           --ts-bullet-top       vertical nudge          (default: 0.05em)

         EXAMPLES
           Dash:    ul.notes        { --ts-bullet-content: "\u2013"; }
           Arrow:   ul.steps        { --ts-bullet-content: "\u2023"; --ts-bullet-color: #1D9E75; }
           Square:  ul.brand        { --ts-bullet-content: "\\25AA"; --ts-bullet-color: #1D9E75; }
           Hollow:  ul.subtle       { --ts-bullet-content: "\\25E6"; --ts-bullet-opacity: 1; }

         For a pixel-crisp box (rather than a glyph square), override the
         ::before in your own stylesheet:
           ul.brand > li::before {
             content: "" !important; background: #1D9E75 !important;
             width: .5em !important; height: .5em !important;
             font-size: inherit !important; top: .55em !important; left: -1.1em !important;
           }
         \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
      ul.ts-styled {
        list-style: none !important;
        padding-left: 1.25em !important;
      }
      ul.ts-styled > li {
        position: relative;
        margin-bottom: 1em !important;
        line-height: inherit !important;
      }
      ul.ts-styled > li:last-child {
        margin-bottom: 0 !important;
      }
      ul.ts-styled > li::before {
        content: var(--ts-bullet-content, "\u2022");
        position: absolute;
        left: -1.25em;
        width: 1.25em;
        /* Right-align the bullet within its box so it sits close to the text */
        text-align: right;
        padding-right: 0.28em;
        box-sizing: border-box;
        font-size: var(--ts-bullet-size, 1.25em);
        color: var(--ts-bullet-color, currentColor);
        /* Lock line-height so the larger font doesn't stretch the baseline down */
        line-height: 1;
        /* Push it down slightly from the top of the li box to align with x-height */
        top: var(--ts-bullet-top, 0.05em);
        opacity: var(--ts-bullet-opacity, 0.8);
      }
    `;
    document.head.appendChild(style);
  }
  if (element.tagName === "UL") element.classList.add("ts-styled");
  element.querySelectorAll("ul").forEach((ul) => ul.classList.add("ts-styled"));
  const measure = measureCh(element);
  if (canCompose(element)) {
    if (composeElement(element, measure)) return;
  } else {
    element.dataset.tsOutcome = "phase1:inline-markup";
  }
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  for (const textNode of textNodes) {
    const original = textNode.textContent;
    if (!original || original.trim().length < 10) continue;
    const leadingSpace = ((_a = original.match(/^\s*/)) == null ? void 0 : _a[0]) || "";
    const trailingSpace = ((_b = original.match(/\s*$/)) == null ? void 0 : _b[0]) || "";
    const processed = typesetText(original.trim(), { measure });
    textNode.textContent = leadingSpace + processed + trailingSpace;
  }
}
function typesetAll(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(typeset);
}
var OPT_SHORT_BIND = new Set(
  "a an the of in to at by on or is it if no so as we do be".split(" ")
);
export {
  audit,
  composeParagraph,
  finalValidate,
  linesOverflow,
  linesStarved,
  measureCh,
  renderFrozenLines,
  safeWrite,
  shapeExactLines,
  shouldIgnoreMutation,
  tokenize,
  typeset,
  typesetAll,
  typesetHeading,
  typesetText
};
