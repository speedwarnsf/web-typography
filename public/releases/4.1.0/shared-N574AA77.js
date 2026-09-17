// src/lib/v4/phrase-boundaries.ts
var determiners = /* @__PURE__ */ new Set(["a", "an", "the", "my", "your", "our", "their", "his", "her", "its"]);
var stops = /* @__PURE__ */ new Set(["a", "an", "the", "this", "that", "these", "those", "and", "or", "but", "nor", "so", "yet", "if", "as", "than", "of", "to", "in", "on", "at", "by", "for", "with", "from", "after", "before", "through", "into", "over", "under", "between", "without", "about", "around", "is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "can", "could", "will", "would", "should", "may", "might", "must", "which", "who", "how", "we", "you", "they", "it"]);
var modifiers = /* @__PURE__ */ new Set(["new", "old", "first", "last", "next", "previous", "second", "third", "small", "large", "little", "long", "short", "different", "same", "other", "final", "whole", "single"]);
var word = (text) => text.toLowerCase().replace(/^[("'“‘]+|[.,;:!?!)"'”’]+$/gu, "");
var ends = (text) => /[.,;:!?)]["'”’]*$/u.test(text);
var sentences = new Intl.Segmenter("en", { granularity: "sentence" });
var proseBoundary = (text) => /[.!?:]["'\u201D\u2019)\]]*$/u.test(text);
function strandedOpener(line) {
  const words = line.trim().split(/\s+/u);
  return words.length > 1 && proseBoundary(words.at(-2)) && /^["'\u201C\u2018(\[]*[A-Za-z][A-Za-z'\u2019-]*$/u.test(words.at(-1));
}
function retainSentenceLayout(source, before, chosenEnds) {
  if (before.overflow > 0.5 || before.lines.length < 2 || before.lines.some((l) => l.words < 2) || before.lines.some((l, i2) => l.width / before.width < (i2 === before.lines.length - 1 ? 0.35 : 0.65))) return false;
  const boundaries = Array.from(sentences.segment(source), (s) => s.index + s.segment.trimEnd().length);
  if (boundaries.length < 2) return false;
  const lineEnds = new Set(before.lines.map((l) => l.sourceEnd));
  return boundaries.every((end) => lineEnds.has(end)) && boundaries.some((end) => !chosenEnds.includes(end));
}
function englishPhraseGroups(texts, width, measure) {
  const words = texts.map(word);
  const lexical = (index) => /^[a-z]+(?:['’-][a-z]+)*$/u.test(words[index] || "") && !stops.has(words[index]);
  const modifier = (index) => modifiers.has(words[index]) || /(?:ed|ive|ous|ful|less)$/u.test(words[index] || "");
  const groups = [];
  for (let start = 0; start < words.length - 1; start++) {
    if (!determiners.has(words[start]) || ends(texts[start]) || !lexical(start + 1)) continue;
    let end = start + 2;
    if (!ends(texts[start + 1]) && modifier(start + 1) && lexical(start + 2)) end++;
    if (measure(start, end) <= width) groups.push({ start, end, kind: "nominal" });
    if (start >= 2 && words[start - 2] === "to" && lexical(start - 1) && !ends(texts[start - 2]) && !ends(texts[start - 1]) && measure(start - 2, end) <= width) {
      groups.push({ start: start - 2, end, kind: "infinitive" });
    }
  }
  return groups;
}
function phraseBreakCosts(texts, groups, title) {
  const costs = Array(texts.length + 1).fill(0);
  for (const group of groups) {
    if (title && group.kind === "nominal") costs[group.start + 1] = 480;
    if (!title && group.kind === "infinitive" && group.end === texts.length) {
      for (let end = group.start + 1; end < group.end; end++) costs[end] = Math.max(costs[end], 7e3);
    }
  }
  return costs;
}

// src/lib/v4/typeset.ts
var NBSP = "\xA0";
var NBHY = "\u2011";
var isInternalWrite = false;
var WEAK_END_WORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "no",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "from",
  "into",
  "upon",
  "about",
  "between",
  "through",
  "without",
  "during",
  "before",
  "after",
  "against",
  "among",
  "within",
  "beyond",
  "toward",
  "towards",
  "across",
  "along",
  "behind",
  "beneath",
  "beside",
  "besides",
  "despite",
  "except",
  "inside",
  "outside",
  "underneath",
  "until",
  "unlike",
  "and",
  "or",
  "but",
  "nor",
  "so",
  "as",
  "yet",
  "if",
  "than",
  "that"
]);
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
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "should",
  "shall",
  "may",
  "might",
  "must",
  "don\u2019t",
  "doesn\u2019t",
  "didn\u2019t",
  "won\u2019t",
  "wouldn\u2019t",
  "can\u2019t",
  "couldn\u2019t",
  "shouldn\u2019t",
  "isn\u2019t",
  "aren\u2019t",
  "wasn\u2019t",
  "weren\u2019t",
  "hasn\u2019t",
  "haven\u2019t",
  "hadn\u2019t",
  "mustn\u2019t",
  "don't",
  "doesn't",
  "didn't",
  "won't",
  "wouldn't",
  "can't",
  "couldn't",
  "shouldn't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "hasn't",
  "haven't",
  "hadn't",
  "mustn't"
]);
function isWeakEnding(word2) {
  const clean = word2.replace(/[^A-Za-z0-9\u2019']+$/g, "").toLowerCase();
  return WEAK_END_WORDS.has(clean) || LINKING_END_WORDS.has(clean);
}
var TOPONYM_OPEN = /* @__PURE__ */ new Set(["san", "santa"]);
var TOPONYM_CLOSED = {
  new: [
    "York",
    "Orleans",
    "Jersey",
    "Zealand",
    "Hampshire",
    "Mexico",
    "Delhi",
    "Haven",
    "Brunswick",
    "Guinea",
    "Caledonia",
    "England"
  ],
  los: ["Angeles", "Alamos", "Gatos"],
  las: ["Vegas", "Cruces", "Palmas"],
  fort: ["Worth", "Lauderdale", "Laramie", "Collins"],
  cape: ["Cod", "Town", "Horn", "Fear", "Canaveral"],
  rio: ["Grande", "Tinto"],
  mount: ["Vernon", "Sinai", "Rushmore", "Everest"],
  port: ["Louis", "Elizabeth", "Arthur", "Moresby"],
  el: ["Paso", "Dorado", "Salvador"],
  la: ["Paz", "Jolla", "Plata", "Rochelle"],
  saint: ["Louis", "Petersburg", "Paul", "John"],
  st: ["Louis", "Petersburg", "Paul", "John", "Andrews"]
};
var TOPONYM_CLOSED_MAP = new Map(
  Object.entries(TOPONYM_CLOSED).map(([k, v2]) => [k, new Set(v2)])
);
var ABBREV_PARTICLES = /* @__PURE__ */ new Set(["st", "mt"]);
var BIND_OPENER_SHAPE = /^\p{Lu}\p{Ll}+\.?$/u;
var BIND_FOLLOWER_SHAPE = /^\p{Lu}\p{Ll}/u;
var BIND_FOLLOWER_TRIM = /[^\p{L}]+$/u;
function bindOpenerOf(part) {
  if (!BIND_OPENER_SHAPE.test(part)) return void 0;
  const hasDot = part.charCodeAt(part.length - 1) === 46;
  const lc = (hasDot ? part.slice(0, -1) : part).toLowerCase();
  if (hasDot && !ABBREV_PARTICLES.has(lc)) return void 0;
  return TOPONYM_OPEN.has(lc) || TOPONYM_CLOSED_MAP.has(lc) ? lc : void 0;
}
var DEFAULT_BIND_WEIGHTS = { toponym: 1600 };
function bindWeights() {
  const o2 = globalThis.__TYPESET_BIND__;
  return o2 ? { ...DEFAULT_BIND_WEIGHTS, ...o2 } : DEFAULT_BIND_WEIGHTS;
}
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
function safeWrite(fn2) {
  isInternalWrite = true;
  fn2();
  setTimeout(() => {
    isInternalWrite = false;
  }, 0);
}
function shouldIgnoreMutation() {
  return isInternalWrite;
}
var isSentenceEnd = (word2) => /[.!?]$/.test(word2) || /[.!?]["'\u201D\u2019]$/.test(word2);
function classifyWord(part) {
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
  return {
    text: part,
    kind,
    stickyPrev,
    stickyNext,
    weakEnd,
    protectedCompound,
    emergencyBreakParts,
    bindOpener: kind === "word" ? bindOpenerOf(part) : void 0
  };
}
function tokenize(text, measurer) {
  if (!text || text.trim().length === 0) return [];
  const parts = text.split(/([^\S\u00a0\u202f]+)/);
  const tokens = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^[^\S\u00a0\u202f]+$/.test(part)) {
      tokens.push({
        text: part,
        kind: "space",
        width: measurer(" ")
      });
      continue;
    }
    tokens.push({ ...classifyWord(part), width: measurer(part) });
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
    maxWordSpacing: 0.018,
    tightCliff: 0.955,
    tightSoft: 0.93,
    candidateBar: 0.97,
    looseShift: 0,
    linkingEndPenalty: 1600
  };
  if (measureCh2 < 24) return {
    mainTarget: 0.82,
    lastTarget: 0.52,
    weakEndPenalty: 7600,
    orphanPenalty: 1e9,
    flatShelfPenalty: 200,
    snapPenalty: 140,
    maxWordSpacing: 0.025,
    tightCliff: 0.955,
    tightSoft: 0.93,
    candidateBar: 0.97,
    looseShift: 0,
    linkingEndPenalty: 1600
  };
  if (measureCh2 < 48) return {
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
    maxWordSpacing: 0.035,
    tightCliff: 0.955,
    tightSoft: 0.93,
    candidateBar: 0.97,
    looseShift: 0,
    linkingEndPenalty: 1600
  };
  return {
    mainTarget: 0.9,
    lastTarget: 0.48,
    weakEndPenalty: 7e3,
    orphanPenalty: 1e9,
    flatShelfPenalty: 160,
    snapPenalty: 100,
    maxWordSpacing: 0.035,
    tightCliff: 0.97,
    tightSoft: 0.95,
    candidateBar: 0.985,
    looseShift: 0.05,
    linkingEndPenalty: 3600
  };
}
function createParagraphProblem(tokens, measurePx, measureCh2, opts = {}) {
  if (tokens.length === 0) return null;
  const profile = profileForMeasure(measureCh2);
  const isHeading = opts.isHeading === true;
  const SENTENCE_END_BONUS = 1300;
  const DANGLING_START_PENALTY = 5200;
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
      for (let i2 = 0; i2 < lex.length - 1; i2++) {
        if (isSentenceEnd(lex[i2].text) && normWord(lex[i2].text) === lastNorm) {
          parallelCloser = lastNorm;
          break;
        }
      }
    }
  }
  const spaceToken = tokens.find((t) => t.kind === "space");
  const spaceWidth = spaceToken ? spaceToken.width : 0;
  const candidateBar = opts.candidateBar ?? profile.candidateBar;
  const prefixWidths = [0];
  for (const token of contentTokens) prefixWidths.push(prefixWidths[prefixWidths.length - 1] + token.width);
  const widthBetween = (start, end) => opts.measureRange?.(start, end) ?? prefixWidths[end] - prefixWidths[start] + Math.max(0, end - start - 1) * spaceWidth;
  const minRemaining = Array(contentTokens.length + 1).fill(Infinity);
  minRemaining[contentTokens.length] = 0;
  if (opts.maxLines) {
    for (let start = contentTokens.length - 1; start >= 0; start--) {
      for (let end = start + 1; end <= contentTokens.length; end++) {
        if (widthBetween(start, end) > measurePx * candidateBar) break;
        minRemaining[start] = Math.min(minRemaining[start], 1 + minRemaining[end]);
      }
    }
  }
  const isContent = (t) => t.kind !== "space";
  const isLexical = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  function firstContentToken(toks) {
    return toks.find(isContent) ?? null;
  }
  function lastContentToken(toks) {
    for (let i2 = toks.length - 1; i2 >= 0; i2--) {
      if (isContent(toks[i2])) return toks[i2];
    }
    return null;
  }
  function lastLexicalToken(toks) {
    for (let i2 = toks.length - 1; i2 >= 0; i2--) {
      if (isLexical(toks[i2])) return toks[i2];
    }
    return null;
  }
  function lexicalWordCount(toks) {
    let n = 0;
    for (const t of toks) {
      if (isLexical(t)) n += t.text.split(/\s+/u).filter(Boolean).length;
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
  function bindPenaltyAt(breakIndex) {
    if (breakIndex <= 0 || breakIndex >= contentTokens.length) return 0;
    const prev = contentTokens[breakIndex - 1];
    const key = prev?.bindOpener;
    if (!key) return 0;
    const weight = bindWeights().toponym;
    if (!weight) return 0;
    const next = contentTokens[breakIndex];
    if (!next) return 0;
    if (TOPONYM_OPEN.has(key)) {
      return BIND_FOLLOWER_SHAPE.test(next.text) ? weight : 0;
    }
    const partners = TOPONYM_CLOSED_MAP.get(key);
    if (!partners) return 0;
    const b2 = next.text.replace(BIND_FOLLOWER_TRIM, "").replace(/[’']s$/u, "");
    return partners.has(b2) ? weight : 0;
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
      } else if (isHeading || opts.allowOrphan) {
        penalty += 6e4;
      } else {
        return profile.orphanPenalty;
      }
    }
    if (!isLast && lexCount === 1 && fill < 0.85 && lastLexical?.kind !== "longSlug") {
      const isParallelCloser = !!parallelCloser && !!lastLexical && normWord(lastLexical.text) === parallelCloser;
      penalty += isParallelCloser ? 200 : 5e4;
    }
    if (!isLast && lexCount === 2 && fill < 0.5) {
      penalty += 5e3;
    }
    const target = isLast ? profile.lastTarget : profile.mainTarget;
    const deviation = fill - target;
    penalty += (deviation < 0 ? 3e3 : 1200) * deviation * deviation;
    const ls = profile.looseShift;
    if (!isLast && fill < 0.5 + ls) {
      penalty += 8e3;
    } else if (!isLast && fill < 0.6 + ls) {
      penalty += 4e3;
    } else if (!isLast && fill < 0.7 + ls) {
      penalty += 2e3;
    } else if (!isLast && fill < 0.75 + ls) {
      penalty += 800;
    }
    if (isLast && fill < 0.3 && lexCount <= 2) {
      penalty += 4e3;
    }
    if (!isLast && fill > profile.tightCliff) {
      penalty += 4e3;
    } else if (!isLast && fill > profile.tightSoft) {
      penalty += 1200;
    }
    if (firstContent && (firstContent.kind === "closePunct" || firstContent.kind === "dash" || firstContent.stickyPrev)) {
      penalty += 1e9;
    }
    if (lastContent && (lastContent.kind === "openPunct" || lastContent.stickyNext)) {
      penalty += 1e9;
    }
    if (!isLast && lastLexical?.weakEnd) {
      penalty += profile.weakEndPenalty;
    }
    if (opts.englishLexical !== false && !isLast && lastLexical && LINKING_END_WORDS.has(
      lastLexical.text.toLowerCase().replace(/[.,;:!?’'"”]+$/, "")
    )) {
      penalty += profile.linkingEndPenalty;
    }
    if (opts.englishLexical !== false && !isLast && lastLexical && /^[A-Za-z]$/.test(lastLexical.text)) {
      penalty += profile.weakEndPenalty * 1.5;
    }
    if (breaksProtectedCompoundAt(breakEnd)) {
      penalty += 7e3;
    }
    if (opts.englishLexical !== false && !isLast) {
      penalty += bindPenaltyAt(breakEnd);
    }
    if (opts.englishLexical !== false && !isLast && lastContent && !proseBoundary(lastContent.text)) {
      let wordsIntoSentence = -1;
      for (const t of lineTokens) {
        if (t === lastContent) break;
        if (t.kind === "space") continue;
        if (proseBoundary(t.text)) wordsIntoSentence = 0;
        else if (wordsIntoSentence >= 0) wordsIntoSentence++;
      }
      if (wordsIntoSentence === 0) {
        const openerLen = lastContent.text.replace(/[^A-Za-z0-9]/g, "").length;
        penalty += openerLen <= 4 ? 7e3 : DANGLING_START_PENALTY;
      } else if (wordsIntoSentence === 1) {
        penalty += 2600;
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
    const i2 = lines.length - 1;
    const currFill = lines[i2].fill;
    const prevFill = lines[i2 - 1].fill;
    const jump = Math.abs(currFill - prevFill);
    if (jump > 0.06) {
      penalty += Math.min(1800, 25e4 * (jump - 0.06) * (jump - 0.06));
    }
    if (lines.length >= 3) {
      const prevPrevFill = lines[i2 - 2].fill;
      const avg = (currFill + prevFill + prevPrevFill) / 3;
      if (avg > 0.9 && Math.abs(prevPrevFill - prevFill) < 0.04 && Math.abs(prevFill - currFill) < 0.04) {
        penalty += profile.flatShelfPenalty;
      }
    }
    return penalty;
  };
  return {
    tokens: contentTokens,
    beamWidth: tokens.length > 120 ? 80 : 48,
    measurePx,
    candidateBar,
    minRemaining,
    options: opts,
    widthBetween,
    scoreLine,
    scoreTransition
  };
}
function composeParagraph(tokens, measurePx, measureCh2, opts = {}) {
  const problem = createParagraphProblem(tokens, measurePx, measureCh2, opts);
  const search = problem && searchParagraph(problem);
  if (search && opts.onSearch) opts.onSearch(search.evidence);
  const winner = search?.winner;
  return winner ? winner.lines.map((line) => ({
    text: line.tokens.map((t) => t.text).join(" "),
    tokens: line.tokens,
    fill: line.fill,
    width: line.width,
    wordSpacingEm: 0
  })) : null;
}
function searchParagraph(problem, limits = {}) {
  const { tokens: contentTokens, candidateBar, minRemaining, widthBetween, scoreLine, scoreTransition } = problem;
  const { options: opts, measurePx, beamWidth: BEAM } = problem;
  const completes = [];
  let visited = 0;
  let completed = 0;
  const result = (method) => {
    const ranked = rankParagraphLayouts(completes, opts.contourWidths);
    return { method, visited, winner: ranked.winner, evidence: {
      method,
      completed,
      retained: completes.length,
      eligible: ranked.eligible,
      poolLimit: method === "beam" ? 200 : null,
      finished: !!opts.contourWidths,
      cheapestCost: completes[0]?.cost ?? null,
      selectedCost: ranked.winner?.cost ?? null,
      contourScore: ranked.score
    } };
  };
  if (opts.maxLines && minRemaining[0] > opts.maxLines) return result("exact");
  if (contentTokens.length <= (limits.exactTokens ?? 18)) {
    const stack = [{ tokenIndex: 0, lines: [], cost: 0 }];
    while (stack.length && visited < (limits.exactStates ?? 4096)) {
      const state = stack.pop();
      visited++;
      if (state.tokenIndex === contentTokens.length) {
        completes.push(state);
        completed++;
        continue;
      }
      if (opts.maxLines && state.lines.length >= opts.maxLines) continue;
      for (let end = contentTokens.length; end > state.tokenIndex; end--) {
        const width = widthBetween(state.tokenIndex, end);
        const fill = width / measurePx;
        const last = end === contentTokens.length;
        if (fill > (state.tokenIndex === 0 && last ? 1 : candidateBar)) continue;
        if (opts.maxLines && state.lines.length + 1 + minRemaining[end] > opts.maxLines) continue;
        const lineTokens = contentTokens.slice(state.tokenIndex, end);
        const lines = [...state.lines, { tokens: lineTokens, width, fill }];
        stack.push({ tokenIndex: end, lines, cost: state.cost + scoreLine(lineTokens, fill, last, end) + (last ? 0 : opts.breakPenalty?.(end) || 0) + scoreTransition(lines, last) });
      }
    }
    if (!stack.length) return result("exact");
  }
  completes.length = 0;
  completed = 0;
  let beam = [{ tokenIndex: 0, lines: [], cost: 0 }];
  let iterations = 0;
  const MAX_ITERATIONS = 500;
  while (beam.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const newBeam = [];
    for (const state of beam) {
      visited++;
      const start = state.tokenIndex;
      if (opts.maxLines && state.lines.length >= opts.maxLines) continue;
      for (let end = start + 1; end <= contentTokens.length; end++) {
        const lineTokens = contentTokens.slice(start, end);
        const width = widthBetween(start, end);
        const fill = width / measurePx;
        const isLast = end === contentTokens.length;
        if (fill > (start === 0 && isLast ? 1 : candidateBar)) break;
        if (opts.maxLines && state.lines.length + 1 + minRemaining[end] > opts.maxLines) continue;
        const linePenalty = scoreLine(lineTokens, fill, isLast, end) + (isLast ? 0 : opts.breakPenalty?.(end) || 0);
        const newLines = [...state.lines, { tokens: lineTokens, width, fill }];
        const transitionPenalty = scoreTransition(newLines, isLast);
        (isLast ? completes : newBeam).push({
          tokenIndex: end,
          lines: newLines,
          cost: state.cost + linePenalty + transitionPenalty
        });
        if (isLast) completed++;
      }
    }
    newBeam.sort((a, b2) => a.cost - b2.cost);
    beam = newBeam.slice(0, BEAM);
    completes.sort((a, b2) => a.cost - b2.cost || a.lines.length - b2.lines.length);
    if (completes.length > 200) completes.length = 200;
  }
  return result("beam");
}
function paragraphContour(widths) {
  const fills = widths.slice(0, -1);
  if (fills.length < 2) return 0;
  const spread = Math.max(...fills) - Math.min(...fills);
  let step = 0;
  for (let i2 = 1; i2 < fills.length; i2++) step = Math.max(step, Math.abs(fills[i2] - fills[i2 - 1]));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const half = Math.ceil(fills.length / 2);
  const shift = fills.length >= 4 ? Math.abs(mean(fills.slice(0, half)) - mean(fills.slice(half))) : 0;
  return 2 * spread + 3 * step + 1.5 * shift;
}
function rankParagraphLayouts(completes, widths) {
  if (completes.length === 0) return { winner: null, eligible: 0, score: null };
  completes.sort((a, b2) => a.cost - b2.cost || a.lines.length - b2.lines.length);
  let winner = completes[0];
  const isLong = winner.lines.length >= 10;
  const slack = Math.min(
    winner.cost * (isLong ? 0.2 : 0.15) + (isLong ? 1200 : 600),
    3200
  );
  const nearOptimal = completes.filter((s) => s.cost <= winner.cost + slack);
  const score = (state) => paragraphContour(widths ? widths(state.lines) : state.lines.map((line) => line.fill));
  let bestScore = score(winner);
  for (const candidate of nearOptimal.slice(1)) {
    const candidateScore = score(candidate);
    if (candidateScore < bestScore) {
      winner = candidate;
      bestScore = candidateScore;
    }
  }
  return { winner, eligible: nearOptimal.length, score: bestScore };
}
function spacingEnvelope(spaceEm, isHeading) {
  const s = spaceEm !== void 0 && Number.isFinite(spaceEm) && spaceEm > 0 ? spaceEm : 0;
  return isHeading ? { maxExpand: 0.12 * s, maxContract: 0.08 * s } : { maxExpand: 0.33 * s, maxContract: 0.2 * s };
}
function shapeExactLines(lines, measureCh2, measurePx, isHeading = false, spaceEm, fontSizePx) {
  const shapedLines = [];
  const { maxExpand, maxContract } = spacingEnvelope(spaceEm, isHeading);
  const nonLastFills = lines.slice(0, -1).map((l) => l.fill).sort((a, b2) => a - b2);
  const mid = Math.floor(nonLastFills.length / 2);
  const median = nonLastFills.length === 0 ? 0.85 : nonLastFills.length % 2 === 0 ? (nonLastFills[mid - 1] + nonLastFills[mid]) / 2 : nonLastFills[mid];
  for (let i2 = 0; i2 < lines.length; i2++) {
    const line = lines[i2];
    const isLast = i2 === lines.length - 1;
    if (isLast) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }
    const wordCount = line.tokens.reduce((count, token) => count + token.text.split(/\s+/u).filter(Boolean).length, 0);
    const gaps = Math.max(0, wordCount - 1);
    if (gaps === 0) {
      shapedLines.push({ ...line, wordSpacingEm: 0 });
      continue;
    }
    const neighbors = [];
    if (i2 > 0) neighbors.push(lines[i2 - 1].fill);
    if (i2 < lines.length - 2) neighbors.push(lines[i2 + 1].fill);
    const local = neighbors.length ? neighbors.reduce((a, b2) => a + b2, 0) / neighbors.length : median;
    let targetFill = 0.5 * local + 0.5 * median;
    targetFill = Math.max(0.7, Math.min(0.965, targetFill));
    const targetWidth = measurePx * targetFill;
    const delta = targetWidth - line.width;
    const spacingPx = delta / gaps;
    const spacingEm = fontSizePx && fontSizePx > 0 ? spacingPx / fontSizePx : 0;
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
function finalValidate(lines, measureCh2, isHeading = false, spaceEm, allowOrphan = false) {
  if (!lines.length) return false;
  const profile = profileForMeasure(measureCh2);
  const env = spacingEnvelope(spaceEm, isHeading);
  const expandBound = env.maxExpand * 1.03;
  const contractBound = env.maxContract * 1.1;
  const isContent = (t) => t.kind !== "space";
  const isLexical = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  for (let i2 = 0; i2 < lines.length; i2++) {
    const tokens = lines[i2].tokens;
    const isLast = i2 === lines.length - 1;
    let lexCount = 0;
    for (const t of tokens) {
      if (isLexical(t)) lexCount += t.text.split(/\s+/u).filter(Boolean).length;
    }
    if (isLast && lexCount === 1 && !isHeading && !allowOrphan) return false;
    const firstContent = tokens.find(isContent) ?? null;
    if (firstContent && (firstContent.kind === "closePunct" || firstContent.kind === "dash" || firstContent.stickyPrev)) {
      return false;
    }
    let lastContent = null;
    for (let j2 = tokens.length - 1; j2 >= 0; j2--) {
      if (isContent(tokens[j2])) {
        lastContent = tokens[j2];
        break;
      }
    }
    if (lastContent && (lastContent.kind === "openPunct" || lastContent.stickyNext)) {
      return false;
    }
    if (lines[i2].wordSpacingEm > expandBound || lines[i2].wordSpacingEm < -contractBound) {
      return false;
    }
  }
  return true;
}
function renderFrozenLines(p2, lines, runs) {
  const cs = getComputedStyle(p2);
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const measurer = makeMeasurer(p2);
  safeWrite(() => {
    p2.innerHTML = "";
    p2.dataset.typesetDone = "1";
    if (!runs) p2.setAttribute("role", "text");
    else if (p2.getAttribute("role") === "text") p2.removeAttribute("role");
    lines.forEach((line, i2) => {
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
      if (runs) {
        renderRichLineInto(span, line, runs);
      } else {
        span.textContent = line.text;
      }
      if (i2 > 0) p2.appendChild(document.createTextNode("\n"));
      p2.appendChild(span);
    });
  });
  measurer.cleanup?.();
}
function renderRichLineInto(span, line, runs) {
  const flat = [];
  for (const t of line.tokens) {
    const parts = t.parts ?? [{ text: t.text, runId: t.runId ?? null }];
    if (flat.length) {
      const prev = flat[flat.length - 1];
      const next = parts[0];
      flat.push({ text: " ", runId: prev.runId === next.runId ? next.runId : null });
    }
    flat.push(...parts);
  }
  const groups = [];
  for (const part of flat) {
    const last = groups[groups.length - 1];
    if (last && last.runId === part.runId) last.text += part.text;
    else groups.push({ runId: part.runId, text: part.text });
  }
  for (const g2 of groups) {
    if (g2.runId === null) {
      span.appendChild(document.createTextNode(g2.text));
      continue;
    }
    const run = runs[g2.runId];
    let outer = null;
    let inner = null;
    for (const orig of run.chain) {
      const clone = orig.cloneNode(false);
      if (inner) inner.appendChild(clone);
      else outer = clone;
      inner = clone;
    }
    if (inner && outer) {
      inner.textContent = g2.text;
      span.appendChild(outer);
    } else {
      span.appendChild(document.createTextNode(g2.text));
    }
  }
}
function typesetHeadingText(text) {
  if (!text || text.length < 5) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;
  const ARTICLES = /* @__PURE__ */ new Set(["a", "an", "the"]);
  const PREPS = /* @__PURE__ */ new Set(["to", "in", "on", "of", "at", "by", "for", "with", "from"]);
  const result = [];
  for (let i2 = 0; i2 < words.length; i2++) {
    let word2 = words[i2];
    if (word2.length <= 20 && word2.indexOf("-") > 0 && word2.indexOf("-") < word2.length - 1) {
      word2 = word2.replace(/-/g, NBHY);
      words[i2] = word2;
    }
    const nextWord = i2 < words.length - 1 ? words[i2 + 1] : null;
    if (ARTICLES.has(word2.toLowerCase()) && nextWord) {
      result.push(word2 + NBSP + words[i2 + 1]);
      i2++;
      continue;
    }
    if (PREPS.has(word2.toLowerCase()) && nextWord) {
      result.push(word2 + NBSP + words[i2 + 1]);
      i2++;
      continue;
    }
    result.push(word2);
  }
  return result.join(" ");
}
function typesetText(text, options) {
  const mode = options?.mode ?? "body";
  const educated = educateQuotes(text);
  if (mode === "heading") {
    return typesetHeadingText(educated);
  }
  return typesetBodyText(educated, options?.measure);
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
  for (let i2 = 0; i2 < words.length; i2++) {
    let word2 = words[i2];
    if (word2.length <= 20 && word2.indexOf("-") > 0 && word2.indexOf("-") < word2.length - 1) {
      word2 = word2.replace(/-/g, NBHY);
      words[i2] = word2;
    }
    const nextWord = i2 < words.length - 1 ? words[i2 + 1] : null;
    if (nextWord && /^[\(\[\{\u201C\u2018]$/.test(word2)) {
      result.push(word2 + NBSP + words[i2 + 1]);
      i2++;
      continue;
    }
    if (result.length > 0 && /^[\)\]\}\.,;:!?\u201D\u2019%]/.test(word2)) {
      const last = result.pop();
      result.push(last + NBSP + word2);
      continue;
    }
    if (nextWord && /^[\$£€¥]$/.test(word2)) {
      result.push(word2 + NBSP + words[i2 + 1]);
      i2++;
      continue;
    }
    if (nextWord) {
      const lc = word2.toLowerCase();
      if (lc === "a" || lc === "i") {
        result.push(word2 + NBSP + words[i2 + 1]);
        i2++;
        continue;
      }
    }
    if (nextWord) {
      const lc = word2.toLowerCase().replace(/[.,;:!?]+$/, "");
      const nextIsPunctOnly = /^[\)\]\}\.,;:!?\u201D\u2019%]+$/.test(nextWord);
      if (!nextIsPunctOnly && PHASE1_BIND_END_WORDS.has(lc)) {
        result.push(word2 + NBSP + words[i2 + 1]);
        i2++;
        continue;
      }
    }
    result.push(word2);
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
var _canvas = null;
function measureCh(element) {
  const elWidth = element.clientWidth || element.getBoundingClientRect().width;
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
      return ch2;
    }
  }
  const fsPx = parseFloat(cs.fontSize) || 16;
  const ch = Math.floor(containerPx / (fsPx * 0.6));
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
    const m3 = (text) => {
      ctx.font = font;
      if ("letterSpacing" in ctx) {
        ctx.letterSpacing = letterSpacing;
      }
      return ctx.measureText(text).width;
    };
    return m3;
  }
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;font:inherit;letter-spacing:inherit;word-spacing:inherit;";
  element.appendChild(probe);
  const m2 = (text) => {
    if (!probe.isConnected) return text.length * fallbackCh;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  };
  m2.cleanup = () => {
    if (probe.parentNode) probe.parentNode.removeChild(probe);
  };
  return m2;
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
function linesStarved(element, medianFloor = 0.62) {
  const cs = getComputedStyle(element);
  const left = element.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
  const width = element.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (width <= 0) return false;
  const spans = Array.from(element.querySelectorAll(".ts-line"));
  if (spans.length < 4) return false;
  const fills = [];
  for (let i2 = 0; i2 < spans.length - 1; i2++) {
    const r2 = document.createRange();
    r2.selectNodeContents(spans[i2]);
    fills.push((r2.getBoundingClientRect().right - left) / width);
  }
  fills.sort((a, b2) => a - b2);
  const median = fills[Math.floor(fills.length / 2)];
  return median < medianFloor;
}
var OPT_SHORT_BIND = new Set(
  "a an the of in to at by on or is it if no so as we do be".split(" ")
);

// src/lib/v4/inline-box.ts
function inlineBoxInsets(style) {
  const values = [
    style.paddingLeft,
    style.paddingRight,
    style.marginLeft,
    style.marginRight,
    style.borderLeftWidth,
    style.borderRightWidth
  ].map((value) => parseFloat(value) || 0);
  return {
    left: values[0] + values[2] + values[4],
    right: values[1] + values[3] + values[5],
    marginLeft: values[2],
    marginRight: values[3],
    supported: values.every((value) => value >= 0) && style.getPropertyValue("box-decoration-break") !== "clone" && style.getPropertyValue("-webkit-box-decoration-break") !== "clone"
  };
}

// src/lib/v4/layout-metrics.ts
function contentWidth(element) {
  const cs = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0"));
}
function measureLayout(element) {
  const cs = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const width = Math.max(0, box.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0"));
  const left = box.left + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.paddingLeft || "0");
  const right = left + width;
  const lines = [];
  if (cs.display !== "contents" && !element.getClientRects().length) {
    return { lines, width, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
  }
  const source = element.textContent || "";
  const lineEnds = /* @__PURE__ */ new Map();
  let sourceOffset = 0;
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = element.ownerDocument.createRange();
  if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE && source.trim() && !element.closest('script, style, [hidden], [aria-hidden="true"]')) {
    const start = source.search(/\S/u), end = source.trimEnd().length;
    range.setStart(element.firstChild, start);
    range.setEnd(element.firstChild, end);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 1) {
      const rect = rects[0], text = source.slice(start, end).replace(/\s+/gu, " ");
      return {
        width,
        lines: [{
          text,
          sourceStart: start,
          sourceEnd: end,
          words: text.split(" ").length,
          width: rect.width,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        }],
        overflow: Math.max(0, rect.right - right, left - rect.left),
        firstSingleton: false,
        lastSingleton: false,
        rag: 0
      };
    }
  }
  const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  let node;
  while (node = walker.nextNode()) {
    const nodeOffset = sourceOffset;
    sourceOffset += node.textContent?.length || 0;
    if (node.parentElement?.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
    for (const match of (node.textContent || "").matchAll(/\S+/gu)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = Array.from(range.getClientRects()).filter((r2) => r2.height > 0 && r2.width > 0);
      const fragments = rects.length < 2 ? rects.map((rect) => ({ text: match[0], rect })) : [];
      if (rects.length > 1) {
        for (const part of segmenter.segment(match[0])) {
          range.setStart(node, match.index + part.index);
          range.setEnd(node, match.index + part.index + part.segment.length);
          const rect = Array.from(range.getClientRects()).find((r2) => r2.width > 0 && r2.height > 0);
          if (!rect) continue;
          const previous = fragments.at(-1);
          if (previous && Math.min(previous.rect.bottom, rect.bottom) - Math.max(previous.rect.top, rect.top) > rect.height * 0.5) {
            previous.text += part.segment;
            const left2 = Math.min(previous.rect.left, rect.left);
            const top = Math.min(previous.rect.top, rect.top);
            previous.rect = new DOMRect(left2, top, Math.max(previous.rect.right, rect.right) - left2, Math.max(previous.rect.bottom, rect.bottom) - top);
          } else fragments.push({ text: part.segment, rect });
        }
      }
      let fragmentOffset = nodeOffset + match.index;
      for (const { rect, text } of fragments) {
        let line = lines.find((l) => Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top) > Math.min(l.bottom - l.top, rect.height) * 0.5);
        if (!line) {
          line = { text: "", sourceStart: fragmentOffset, sourceEnd: fragmentOffset, words: 0, width: 0, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          lines.push(line);
        }
        const previousEnd = lineEnds.get(line);
        const gap = previousEnd === void 0 ? "" : source.slice(previousEnd, fragmentOffset);
        line.text += (line.text && /\s/u.test(gap) ? " " : "") + text;
        fragmentOffset += text.length;
        line.sourceEnd = fragmentOffset;
        lineEnds.set(line, fragmentOffset);
        line.words = line.text.trim().split(/\s+/u).length;
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
        line.width = line.right - line.left;
      }
    }
  }
  for (const inline of element.querySelectorAll("*")) {
    if (inline.hasAttribute("data-ts-break") || inline.closest('[hidden], [aria-hidden="true"]')) continue;
    const style = getComputedStyle(inline);
    if (style.display !== "inline") continue;
    const insets = inlineBoxInsets(style);
    if (!insets.left && !insets.right) continue;
    const rects = Array.from(inline.getClientRects()).filter((rect) => rect.width && rect.height);
    for (const [index, rect] of rects.entries()) {
      const line = lines.reduce((best, candidate) => {
        const overlap = Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top);
        const bestOverlap = best ? Math.min(best.bottom, rect.bottom) - Math.max(best.top, rect.top) : 0;
        return overlap > bestOverlap ? candidate : best;
      }, void 0);
      if (!line) continue;
      line.left = Math.min(line.left, rect.left - (index === 0 ? insets.marginLeft : 0));
      line.right = Math.max(line.right, rect.right + (index === rects.length - 1 ? insets.marginRight : 0));
      line.width = line.right - line.left;
    }
  }
  lines.sort((a, b2) => a.top - b2.top);
  const fills = lines.map((l) => width > 0 ? l.width / width : 0);
  const hangs = Array.from(element.querySelectorAll(":scope > .ts-line")).map((el) => Math.min(0, parseFloat(getComputedStyle(el).textIndent) || 0));
  const optical = new Map(Array.from(element.querySelectorAll("[data-ts-break][data-ts-hang]")).filter((el) => getComputedStyle(el).display !== "none").map((el) => [Number(el.dataset.tsHang), Math.min(0, parseFloat(getComputedStyle(el).marginLeft) || 0)]));
  const mean = fills.reduce((a, b2) => a + b2, 0) / Math.max(1, fills.length);
  return {
    lines,
    width,
    // Old Typeset intentionally hangs punctuation/capitals into the margin.
    // Do not mislabel its documented optical indent as an A/B overflow win.
    overflow: Math.max(0, ...lines.flatMap((l, i2) => [l.right - right, left + (hangs[i2] || optical.get(l.sourceStart) || 0) - l.left])),
    firstSingleton: lines.length > 1 && lines[0].words === 1,
    lastSingleton: lines.length > 1 && lines[lines.length - 1].words === 1,
    rag: fills.reduce((sum, f) => sum + (f - mean) ** 2, 0) / Math.max(1, fills.length)
  };
}

// src/vendor/unicode-linebreak.js
var v = Uint8Array;
var U = Uint16Array;
var Te = Int32Array;
var kr = new v([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
var _r = new v([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
var Be = new v([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var $r = function(r2, e) {
  for (var n = new U(31), t = 0; t < 31; ++t) n[t] = e += 1 << r2[t - 1];
  for (var s = new Te(n[30]), t = 1; t < 30; ++t) for (var c = n[t]; c < n[t + 1]; ++c) s[c] = c - n[t] << 5 | t;
  return { b: n, r: s };
};
var re = $r(kr, 2);
var ee = re.b;
var ze = re.r;
ee[28] = 258, ze[258] = 28;
var ne = $r(_r, 0);
var Se = ne.b;
var ht = ne.r;
var Ir = new U(32768);
for (u = 0; u < 32768; ++u) B = (u & 43690) >> 1 | (u & 21845) << 1, B = (B & 52428) >> 2 | (B & 13107) << 2, B = (B & 61680) >> 4 | (B & 3855) << 4, Ir[u] = ((B & 65280) >> 8 | (B & 255) << 8) >> 1;
var B;
var u;
var $ = (function(r2, e, n) {
  for (var t = r2.length, s = 0, c = new U(e); s < t; ++s) r2[s] && ++c[r2[s] - 1];
  var l = new U(e);
  for (s = 1; s < e; ++s) l[s] = l[s - 1] + c[s - 1] << 1;
  var y;
  if (n) {
    y = new U(1 << e);
    var M = 15 - e;
    for (s = 0; s < t; ++s) if (r2[s]) for (var Y = s << 4 | r2[s], S = e - r2[s], f = l[r2[s] - 1]++ << S, a = f | (1 << S) - 1; f <= a; ++f) y[Ir[f] >> M] = Y;
  } else for (y = new U(t), s = 0; s < t; ++s) r2[s] && (y[s] = Ir[l[r2[s] - 1]++] >> 15 - r2[s]);
  return y;
});
var rr = new v(288);
for (u = 0; u < 144; ++u) rr[u] = 8;
var u;
for (u = 144; u < 256; ++u) rr[u] = 9;
var u;
for (u = 256; u < 280; ++u) rr[u] = 7;
var u;
for (u = 280; u < 288; ++u) rr[u] = 8;
var u;
var te = new v(32);
for (u = 0; u < 32; ++u) te[u] = 5;
var u;
var Pe = $(rr, 9, 1);
var De = $(te, 5, 1);
var Pr = function(r2) {
  for (var e = r2[0], n = 1; n < r2.length; ++n) r2[n] > e && (e = r2[n]);
  return e;
};
var m = function(r2, e, n) {
  var t = e / 8 | 0;
  return (r2[t] | r2[t + 1] << 8) >> (e & 7) & n;
};
var Dr = function(r2, e) {
  var n = e / 8 | 0;
  return (r2[n] | r2[n + 1] << 8 | r2[n + 2] << 16) >> (e & 7);
};
var Ie = function(r2) {
  return (r2 + 7) / 8 | 0;
};
var Ne = function(r2, e, n) {
  return (e == null || e < 0) && (e = 0), (n == null || n > r2.length) && (n = r2.length), new v(r2.subarray(e, n));
};
var Ee = ["unexpected EOF", "invalid block type", "invalid length/literal", "invalid distance", "stream finished", "no stream handler", , "no callback", "invalid UTF-8 data", "extra field too long", "date not in range 1980-2099", "filename too long", "stream finishing", "invalid zip data"];
var A = function(r2, e, n) {
  var t = new Error(e || Ee[r2]);
  if (t.code = r2, Error.captureStackTrace && Error.captureStackTrace(t, A), !n) throw t;
  return t;
};
var Fe = function(r2, e, n, t) {
  var s = r2.length, c = t ? t.length : 0;
  if (!s || e.f && !e.l) return n || new v(0);
  var l = !n, y = l || e.i != 2, M = e.i;
  l && (n = new v(s * 3));
  var Y = function(Yr) {
    var Wr = n.length;
    if (Yr > Wr) {
      var Qr = new v(Math.max(Wr * 2, Yr));
      Qr.set(n), n = Qr;
    }
  }, S = e.f || 0, f = e.p || 0, a = e.b || 0, N = e.l, ur = e.d, W = e.m, Q = e.n, yr = s * 8;
  do {
    if (!N) {
      S = m(r2, f, 1);
      var mr = m(r2, f + 1, 3);
      if (f += 3, mr) if (mr == 1) N = Pe, ur = De, W = 9, Q = 5;
      else if (mr == 2) {
        var dr = m(r2, f, 31) + 257, Vr = m(r2, f + 10, 15) + 4, Gr = dr + m(r2, f + 5, 31) + 1;
        f += 14;
        for (var k = new v(Gr), Tr = new v(19), x = 0; x < Vr; ++x) Tr[Be[x]] = m(r2, f + x * 3, 7);
        f += Vr * 3;
        for (var jr = Pr(Tr), ye = (1 << jr) - 1, me = $(Tr, jr, 1), x = 0; x < Gr; ) {
          var qr = me[m(r2, f, ye)];
          f += qr & 15;
          var d = qr >> 4;
          if (d < 16) k[x++] = d;
          else {
            var C = 0, ar = 0;
            for (d == 16 ? (ar = 3 + m(r2, f, 3), f += 2, C = k[x - 1]) : d == 17 ? (ar = 3 + m(r2, f, 7), f += 3) : d == 18 && (ar = 11 + m(r2, f, 127), f += 7); ar--; ) k[x++] = C;
          }
        }
        var Kr = k.subarray(0, dr), P = k.subarray(dr);
        W = Pr(Kr), Q = Pr(P), N = $(Kr, W, 1), ur = $(P, Q, 1);
      } else A(1);
      else {
        var d = Ie(f) + 4, Ar = r2[d - 4] | r2[d - 3] << 8, Lr = d + Ar;
        if (Lr > s) {
          M && A(0);
          break;
        }
        y && Y(a + Ar), n.set(r2.subarray(d, Lr), a), e.b = a += Ar, e.p = f = Lr * 8, e.f = S;
        continue;
      }
      if (f > yr) {
        M && A(0);
        break;
      }
    }
    y && Y(a + 131072);
    for (var Ae = (1 << W) - 1, Le = (1 << Q) - 1, Br = f; ; Br = f) {
      var C = N[Dr(r2, f) & Ae], O = C >> 4;
      if (f += C & 15, f > yr) {
        M && A(0);
        break;
      }
      if (C || A(2), O < 256) n[a++] = O;
      else if (O == 256) {
        Br = f, N = null;
        break;
      } else {
        var Zr = O - 254;
        if (O > 264) {
          var x = O - 257, _ = kr[x];
          Zr = m(r2, f, (1 << _) - 1) + ee[x], f += _;
        }
        var zr = ur[Dr(r2, f) & Le], Sr = zr >> 4;
        zr || A(3), f += zr & 15;
        var P = Se[Sr];
        if (Sr > 3) {
          var _ = _r[Sr];
          P += Dr(r2, f) & (1 << _) - 1, f += _;
        }
        if (f > yr) {
          M && A(0);
          break;
        }
        y && Y(a + 131072);
        var Jr = a + Zr;
        if (a < P) {
          var Rr = c - P, de = Math.min(P, Jr);
          for (Rr + a < 0 && A(3); a < de; ++a) n[a] = t[Rr + a];
        }
        for (; a < Jr; ++a) n[a] = n[a - P];
      }
    }
    e.l = N, e.p = Br, e.b = a, e.f = S, N && (S = 1, e.m = W, e.d = ur, e.n = Q);
  } while (!S);
  return a != n.length && l ? Ne(n, 0, a) : n.subarray(0, a);
};
var Xe = new v(0);
var Me = function(r2) {
  (r2[0] != 31 || r2[1] != 139 || r2[2] != 8) && A(6, "invalid gzip data");
  var e = r2[3], n = 10;
  e & 4 && (n += (r2[10] | r2[11] << 8) + 2);
  for (var t = (e >> 3 & 1) + (e >> 4 & 1); t > 0; t -= !r2[n++]) ;
  return n + (e & 2);
};
var Ce = function(r2) {
  var e = r2.length;
  return (r2[e - 4] | r2[e - 3] << 8 | r2[e - 2] << 16 | r2[e - 1] << 24) >>> 0;
};
function Nr(r2, e) {
  var n = Me(r2);
  return n + 8 > r2.length && A(6, "invalid gzip data"), Fe(r2.subarray(n, -8), { i: 2 }, e && e.out || new v(Ce(r2)), e && e.dictionary);
}
var Oe = typeof TextDecoder < "u" && new TextDecoder();
var Ue = 0;
try {
  Oe.decode(Xe, { stream: true }), Ue = 1;
} catch {
}
var He = new Uint8Array(new Uint32Array([305419896]).buffer)[0] === 18;
function be(r2) {
  let e = r2.length;
  for (let n = 0; n < e; n += 4) [r2[n], r2[n + 1], r2[n + 2], r2[n + 3]] = [r2[n + 3], r2[n + 2], r2[n + 1], r2[n]];
}
function Ve(r2) {
}
var ie = He ? be : Ve;
var Ye = new TextDecoder();
var H = class r {
  constructor(e) {
    if (e instanceof Uint8Array) {
      let n = 0, t = new DataView(e.buffer);
      if (this.highStart = t.getUint32(0, true), this.errorValue = t.getUint32(4, true), n = t.getUint32(8, true), n !== 4294967295) throw new Error("Trie created with old version of @cto.af/unicode-trie.");
      if (n = t.getUint32(12, true), 16 + n > e.byteLength) throw new RangeError("Invalid input length");
      let s = e.subarray(16 + n);
      this.values = s.length ? JSON.parse(Ye.decode(Nr(s))) : [], e = Nr(e.subarray(16, 16 + n)), ie(e), this.data = new Int32Array(e.buffer);
    } else ({ data: this.data, highStart: this.highStart, errorValue: this.errorValue, values: this.values = [] } = e);
  }
  static fromBase64(e) {
    return typeof Buffer == "function" ? new r(new Uint8Array(Buffer.from(e, "base64"))) : new r(new Uint8Array(atob(e).split("").map((n) => n.charCodeAt(0))));
  }
  get(e) {
    let n = this.errorValue;
    if (e < 0 || e > 1114111) n = this.errorValue;
    else if (e < 55296 || e > 56319 && e <= 65535) {
      let t = (this.data[e >> 5] << 2) + (e & 31);
      n = this.data[t];
    } else if (e <= 65535) {
      let t = (this.data[2048 + (e - 55296 >> 5)] << 2) + (e & 31);
      n = this.data[t];
    } else if (e < this.highStart) {
      let t = this.data[2080 + (e >> 11)];
      t = this.data[t + (e >> 5 & 63)], t = (t << 2) + (e & 31), n = this.data[t];
    } else n = this.data[this.data.length - 4];
    return n;
  }
  getString(e) {
    let n = this.get(e);
    return this.values[n] ?? n;
  }
};
var b = H.fromBase64(`AAgOAAEAAAD/////nRQAAB+LCAC4xcFoAgPtnQnwlkUdx1+URLxABcUUghTEEK8Cmwp0LJAa
   MRrFbBSPSXHSAUYNdFQoBWMKyQrUCo/EyMIjD3TIAxXJM5NBHBm0RDSPzDOVdAz7/nB/07bt
   s8/e+/zhfef9zD7HPs/e129/u8/yzVutVWANeBl079xq9QJ9wUCwDxjqYQ4DI8BoMBYcBY4D
   48FEw3NTwDTp/BxwAZgJLgaXgCvAAnADuA3cDe4Hj0rPLQerwLPgJfAaeBe8Az4EnT/Ram0D
   eoBdwe5gENgX0DsOhHkQGAlGgTHgaHACGA8mgilgGpgBLgJzweVgPlgIbgF3iPOl4BGwAqwG
   a8Er4C2wDnwEumzRanUDPUFv0B8MBgeAL4BDwNfAN8C3wIngO+A0cCZowd/nwrwA/Eic/wzm
   L8EMHM+HuRDcDP4g7t8Hk3hYmI8BCv+TwvwLTOZvglfBawKyQ7wrjv8Ns1OXVqsroPNuwuwJ
   szfoL86JwTgeIp3HYJj0vhE4Hg3GgnHgZMDhnYDjyWCqZP9CHM8Gc8S1y2BeBa4FvweLxPN3
   wVwq7Dwirp0KVuB4NVgLXgSvg/fA+6C1Jf6gO+gF+oI9wQa3YQ4FwwDlwREwR4Mj+L6GY3Dv
   eMN9OY7JPAV2Jwn7Z8E8F0wHs8AcMA9cA64Dt4I7wT3gQfA4eAI8DdaKd7wizLdgvg86dUWa
   g+1BL0D3+sIcAAaLc5X9xfUDYR4EDlUYJR2PAUeCY8FJ4DRwJjgXTAezwBwwD1wDrgO3gjuF
   G/fAfBA8Js5XwnwaPF/htypeFfbfhvm+w7OdtkL6Axe3thP2uSzuhPM+YICA6tZ9YA4FwwGV
   55F0XTBGOlY5GhwHxoOJYAqYBn4AfiyOLwVXgvnSc9dKxzeC28XxEoNbbdq0iQvXEe24aNOm
   TZs2bdq0aePC0ob55yFhPg5IHlI3Rl4Je8+I/vALMN+T7v3DMN5+B/c+BJ23hhwQ0LUeMM+G
   OQrshuM9AMkJ94b5WfBF8GVwKPg6+CYgOc7xME8BLFsiJuH8LPA9MFO8/yJhMnNxfjm4AlwJ
   rgK/AleD+e177Xvte+177XvR7/0O3ARuBSQzLcmd8ENJSoe/TZsmE9qfvR9l7FHwhNL3c+Ep
   zbPP4trz4FXwT/AB2Gyb/7WzJc67g16gLxgIBgOasxkCcxgoXf/c2+1jDu7ean0fLDbwDvjc
   9pi7Aj8H8r1V4vxlmLvtgLlCMBesBNvs+PG9g2GeBxaB5aB7j1brOczh9UN8nAiuBs8BGg8c
   BqgP/xOqI2n+VvAQzile53T6L6NwLts5G+eLwSpxfT3M4dtiTg0sAevB8O1wDuT35GZJA9yX
   461NmzZtNiXWow6cTrpKaCNGU3uhtPNjcW0cOEFq28fjeAI4HUwWz8iQbIvsrYM5VTw3HSbp
   Fs2EebG4dpnGPYL0hM4n3SfcXyDsLhTmzTBvA3eI86VKn6MK0lshfao/kt9x/pjk7ydFW7lG
   vIt0rl4W99+EuQ58BEh3jP3bBW1oVxHObjjeCfQB7B7bG8DXYJ5OelYwvwS+Ath9fuY0KT4O
   E88dKcxjYJIs8NswT5WeVSG/k/0zYOcccL54nuLvh+QHmD8V5jJA8fILnP8Lz10N87eAdMRu
   grlY9Bfo/AGYfwYrxPl9eOdqHK8l/+D47zDfFv76AOZmyFeTcLwVzB1AL9AXDAT7gSFgGBgB
   yH87ks4ZjseK86+CcdQ+a8JI90/GvQniPtufjPOp4vkLYc4Gc8Hl4NfgesP7Fin3OE3uwvVl
   4BGwQrKzGsd/BS+C18Hb4APhdif0J7sC1unbHsf83C7SMd3vh/O9yC4YCoaBQ8Aoyd4YHB8J
   jgUngVMBlQ8qG2dI9nScg/sXgJngYsnupTi+EvxG+DMnXI7UuCZuNPjn9pqwboxQOeXwc50Q
   gyUinh8wxPfDFfeW4/qqAvmmaVDb6PvsGiX+XvLM2/1Qb76xEZeLGOlEdTC1i+tEnNMx1Z8f
   ivPOGJtvDXYEJNfw9eeueL4uHLvDziBA/Rb5+gG4Rvq0n5feQTKJXHp8rlBfaiT8R7KcKnnV
   4Yb42BQ4wjL9joG9E8Apjul9uBL3TS+/kxC+74LzGpAvTHl7BvznUyYuwnM05iGoLM/F+Tzl
   XdyHqStbZM4S5/PxjoXgJvEuWqvAdkmuKIeL6hV5TET9e6r/qsJPazHIvBfveQgsF248BXMF
   1YcOcXGERXv4AslIPeNXhuL3TVFnroO5HmwB2WtT8j21Mdsa/NMT93qDDevFkJ79Fbsb1s7g
   2hDLMFE/cZh434iAeKD3jDY8T/fHGu5TuMfVuH+y8KeOCeJZPp+cIU1JD4fcmiq5NVvIIaqe
   oXJyIezPBpeAK8AC8Xxvi/5YXd1+A951C6C1R4uFeTdMurdMmC78Cc+sBM+ANdLzNF/xBlgH
   PpKud8G8xXagB9gZ9AF0fQ+Yg8QxcQCOh4rz4TBHimM5TQ/HNT5egHDQfdZFOkrcI/nEcTge
   Dyh+JsKcIt41TZgzYM5S3j9H8gsxD+dXSe4x10rXrleeyc2iwu6XhsJ/F8WBqMeJ/ysfBpaJ
   PNKReXzzThvYDKd1YFn0hscg/tsALZ21ec4GsTS0hWLZou4kDX9oaELHdI1EeiT24ntUtVGX
   g0yq7igpbCD7BL2HIXfl89RQWCgMHJ7ckPuUlpj63XBO8Y9pyE2aTf2nK5NQC4hWvuvoKfIl
   lXkqGwzlz50EfMx1BOVhztP8HNvdWXlWhp6Xz8ndlOWN/V6K0u43Dc4fch7gc9s4U/OU/Azn
   vZLkKrdNheqTKnzeVxff/FOvc19D/dW9SzZjkuKdMfPmxlrn5Ix3mzzWBKhs9NL4l9rxqj5J
   06HwcD6W8zQf01iDzLrfLhmpc1vNVza/qvGXnP7UZ2PUcZlLnHOcksk0KZ+nyGe2412KW13c
   p65rOQ3qwmCyo8afzi7bsY2PmPV4yfYqZl7qKO1F6nhyreNs6rvY+S9XnOjaai7TssxAHqfn
   8GuV/9XrVfZi5PVcZaXK367u636hfuP8bCtL8u3np+6vURhK9BObUPZjxm+scZ0810DkrFfV
   8uY6zgotWy5ygSq35DJYlyZqedWVX5s2UTeeqQqT6pZr+vJ4QRc/fF1uj6rCZYprU1hypG/d
   sRznpnS1Sd+6dKzLa3X5wzZ9dfWEa5/Mtfzq0qRE+vqWX10eqErfkL6tOubxLb8s1zG54RLO
   nPWzb/3pkl9z1J8ufcQqP9fl9ao6w9Re6cKsS7u6a3Xto2s81NWvpjxqW/5s5IEpxpncTtr2
   4XPWpbHGWa79Idv0NMWZKR5i1aemn+38oxwum2dKpm+M9jJm+pr6RrHSV9eH9dXnyN0XijEO
   i5GedX16VzluqvZXHr9UpY1P/9a1zSs176m2kbb+NY13qvKLjYwqtP1V/eLT//5kQ1B/1G8I
   eZ/LfA3LgUzxw8dVcZYiLuvcjB33IX7wybe6NKM+gox8jfRq+JjSi87l+ViGrut0buvaqdhy
   QPKj3MawSbqApBfLZoi81kcuXqV3XXc9VHbeBH0L+nF5N7W/Nm2NnBer+rasD9bEute1flTD
   lst9Ux1vK8PWjZFD+x27Fma3wvQujG/fMFQ/0iX/hD7f9PClnr9OHX8+Mh65PTS1Iyn9UULX
   M/b8vq9uKf9ID7KkjkvOtOe+om/8cxvu6meXubpY+jcuc0Wx3TeNBVOH33e+LKQ+rZM55pQd
   cNz3kc4578rygFhy7Fj1H4872f88FpD1hNV1Iy76tbnr35Dyn1v3yCT3KhEnJdpnG1mui46u
   ryzBNNaiH5eH0HFfbPlWqvouVX0ZKjdW65S68XQqfWC1nJSUO8eoj0OfjxGGUjI1V/erZGIh
   P507n8qIa7z1tXinLK/sZwnb/7TS7+drNtj43+Y9sttN00121aMOnR+wTb/UuIZ/d4FrfydV
   PSOXCRmf+jfl/E9KuUMpuVPMfnKMdQIucze69X6m8YPvngAl9yOwqWNt5Wsu+hSp9xRoytr0
   UN3tunhPHQ91brDsoqqOZSivyed7iDzXX8p/JJ8le2QSA4C8lwntkcP7bvGxfC7bJfaUIDd5
   j7CqsiCv/dYh+4HcIbkTYdpLgOWwbNdk31R/k/tqnKpy2oGB43o1H9js0cPhk/ebUfegsZVT
   h8pW5D2aVNQ9nFzQPStf4+MQN4jYfZ4Q+TDndzUNTfqAVfs7uazFtc03KfaP0u3LZYvP877u
   ++6zpf5SuOfiJ9+w6PylXtPdZ1Pdx80UZ1VxoYahLl/Y7tflUxbqwhyr7OjioCpuTOexymmM
   99vGWe5960LdoT5PrDlkNn39yrIdFzdTxKkqa0o9n5NyfjbFL6T9i03O9jTEjVT9CZt61qWe
   DAmTbX1rkw4ubWysflyu/Uh19Utdv8QUb/wevs/vlN3YK0J95hvGWP26FP0CXV0ix6XOfmi8
   lNw7tlSc284PqXnZlKf5umpfVx7Ue3K5q4onnT9079H5h8ubyX5VGZHfIVOiPynLz2RkPSTV
   /2p/0NZM2Ufw7dPm3tveJp46kn5prDC7miXDUCoOc7QdKeU9KeZZbNZTsw6ZKjPna6G6jLZ6
   v6Y9S0rqHMbaN8j3flUbVIdpnonTleaP+JsiapunntfVOer7WUdXNw+jCyvNYxE6P9Ix+7Mu
   TCa3uM3mb9JUmfLe1q59N19yulXnD5dfU/yRyn/8vR2Cr9H8JB/btsm29undfCw/56tbVmVX
   d53nXtV0+Iw4rjNTk8udOvdtwl13j1B1YuT5b04HMpsW/7HCr8t/dF0Of846J3W9HPtdNnUf
   x7UvpdsiV1mJjawiFLWODEm73G1mLF1J2/GB7X7UtvqhJeeTfPc4T7mPtLpuWqWJ66malIZV
   Oq6uerCp9Oh1dlzCzrpIudKf92/hsZbP+hIbHa0Q/fQYe/v4lmd5T5s6veq6vYViyzJT69KV
   2t/FlN451zKFrm3i9U0264J0fQOX9U5Vfe6S+xPRL8VaHJe8rK69qpNJqe92jX81XX3X2fr8
   XPaHsq1PdPWWa12Sag1GaXmwT98pZ/2vy8+h7e8gsHdGcrvn+ou5l5j6K7GfmPobXJiY4xLb
   d9C3GKnM2H7Xkd7j+z1I03X5ftWxjd9KwDLy0mNPV/fUtSCh4wyeF5DXS8nzWnSd9Jqrfrye
   UWfa3NP1O131E9TnTDItvs/rn9Qwm9y3lS/yuiSdDK2J32LmH61l4/l7DpMcFl0cy/HpKvNU
   5Z6yuzmgsPj4PZX78jydfMzx1BFk7Gr61smlU9yXf7w+UL7Pa5Fc9pe3lTntI+YJYvTvQ9Y9
   x9gbNOU66lxyYJPsuqPtBRpjvW7uX6n9Y3LpfMUe8+fYy6sJ+99x2QyVR1TJrEvlz9Lxmzq8
   Kct+jO8mpnIrV35pYv3rso+6j2w1RzkxpWeOslpV38Xey7lJ7XVVnDdFVyDn2o2m7A1s871r
   U3+hbp661LfjbL6l6vL9O5v5uiqdcd/9mG3sVrlrktHl3m+5Ln46Qply/f51rDq2afV3U92P
   9Z2CVPu71+kExf4uhm265Mpfcrjl9S+p/WGjb9FEeYmrHlhsXTLb772b2v3U8bKvoAk6VaQ3
   ZdqvWf2FytNd9g1W/c57VNf9+JuMuXT+ZJ1tnZ6T7U+un1PXpSm/BxKiZ+b6nUC5P+bybdoU
   3wWR9zP1WcOrrtc06dG7rA9gf6lzCCVlQKl1cKvW16r7MjdxPqHue3m55l5M6yRy1q8p6i+d
   GzbfR5Dtqeeu1D2rulVlp+67ulXfzlDPqS/AP52us+kb5aoetdp226wrqOtHuvxc9InlsMrX
   5HCkgvtULt80VtPB5tvHlLbU51R1leQ+nW0ftknjClM7Ktf7Pt9n161FKfULHbeU/P5brO/5
   8PeveZ2l+s31OpmmizxP5z/VrssvNP7Vb9XbUGr+LWSdWKr4c/lemct7U/1KfJcs5nfiXNcz
   Va3lCf2OXi75c+gaSd/4SyH/pmds+8G2fWCbvmwMeZapf6v2g9hU16vF7l/65K8cc6uh7bIs
   W8jdLyyxp4BPPOru6+Qx8rd8beIyhew8xjoMtU8l90dcyldseUOJPpPLevpc7ZnvL8f4oaRO
   ad34WVeefPYVSdG+27T7vPdESj0VV5leyvXoufQvffKZTpZmGy+27UNKfYCc5dWmj2fbp44Z
   P6G/WN9X1cl8beoieS7ad7+PGP14nz1ATO1q3Xx2jHnpWO1xR1uPovumYQndrFD9uyrdvpD4
   b9L8Yaz9wxl5bbVu/XlT9j2X/Rr6Hl7brYPd0V1jM5bOk+84oUn7xpeeH7IhVJ7j25+IrU9s
   ig+XOi7lGMtGj9pGB903/kuMQVPuORpjv7+c35AvvYYkNO1CviFvU4/HkF+qe2ZTG+VTn1bt
   fV7y5/PtqNR76oeuy4zlH3n/9ND3qPuxu7xb3cuj7heahiXq4ljrC1R5vm5M39HGFz7yzRLr
   k1PoMMfcPzeGvDPWPssxw6Rzo8QcXmp3XGSSHX2/Et08k67f5dtmuupKN2FvMpOsKObeDnVx
   k3ofp1h6VrFIVVdV7T2fYm9013l7k/5rbNlKaBuXso7LLV+K1d67uuWiJ19ShhcjvUP97FsO
   Q+V7pdfDpy5rtv2qEPkU7XFY0v3Q+Oc8FpqHdHV9Xf415XFbPTPfPk7qNWsufow9vkqlz6v+
   eA4udH9l3XxtiA5ZyN5XpvxSNzdetRdQlWnKjzbP695Xt9+WTz/bJk5y6tDVlYHUe0Crv9Bv
   vMf+bnzq79DHenfs/ZD3y4TO7b0S7vPM8Z5yL2mTG1XXKcyMLh5093OzvwbVfzr/1hHDby7u
   ufhH5z/Vrm1YZPsheUtn2pQh+RnfMmCqy3PN7aSeN0oRtrp8m6oONOXflHVfrnj0ccdU1lVS
   yYu7Ssjz96ZwxEgz13rX1c3Y+Sp2vJve7eN+zP3nYsojYunAhMq1cs2vM1X9J99+Q2g+d+1z
   5OznpXJD1zcKcc/U33KN39TzgCnr4lz95Fz1cW79kxT6SDF00UruT5ZDZ8Xl9x83MV0I0CwB
   AB+LCAC4xcFoAgMdjksWhCAMBO/CelYzJ4gMCqiI4t/n/a9hyk29JN3p5DL7bj7GTQrbKypR
   dDVVywyhZCz4xkUhnSIj5EExoFoQisIfbICE2WJOoAESSK7wecCscDJSxRXMbBAlfLCyIbTh
   T8tr5/YikvVFSYq3dURbKo/gf+Q3zBCELycCXW/uB2mPjCb8AAAA`);
var lr = Object.fromEntries(b.values.map((r2, e) => [r2, e]));
var { values: se } = b;
var { AI: We, AL: oe, CJ: Qe, CM: ke, NS: _e, SA: $e, SG: rn, SP: en, XX: nn } = lr;
var T = -1;
var V = -2;
function tn(r2) {
  switch (r2) {
    case null:
      return null;
    case T:
      return "sot";
    case V:
      return "eot";
    default:
      return se[r2];
  }
}
function fe(r2, e) {
  switch (r2) {
    case We:
    case rn:
    case nn:
      return oe;
    case $e:
      return /^[\p{gc=Mn}\p{gc=Mc}]$/u.test(e) ? ke : oe;
    case Qe:
      return _e;
    default:
  }
  return r2;
}
var D = class {
  cp = -1 / 0;
  cls = T;
  char = "";
  len = 0;
  ignored = false;
  constructor(e, n, t, s) {
    this.cls = e, this.cp = n, this.char = t, this.len = s;
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](e, n, t) {
    return `${tn(this.cls)}(${this.cp.toString(16).padStart(4, "0")}:${JSON.stringify(this.char)})${this.ignored ? "Ig" : ""}`;
  }
};
var hr = class {
  str = "";
  len = 0;
  prevChunk = 0;
  prev = new D(T, -1 / 0, "", 0);
  cur = new D(T, -1 / 0, "", 0);
  next = new D(T, -1 / 0, "", 0);
  LB8 = false;
  spaces = false;
  RI = 0;
  props = void 0;
  extra = {};
  constructor(e) {
    this.str = e, this.len = e.length;
  }
  push(e) {
    this.next.ignored ? this.cur.len = this.next.len : (this.prev = this.cur, this.cur = this.next), this.next = e;
  }
  pushEnd() {
    this.push(new D(V, 1 / 0, "", this.next.len));
  }
  *codePoints(e, n = true) {
    if (n) for (; e < this.len; ) if (e === this.cur.len && this.next.cls >= 0) yield this.next, e += this.next.char.length;
    else {
      let t = this.str.codePointAt(e), s = String.fromCodePoint(t), c = b.get(t);
      e += s.length, yield new D(fe(c, s), t, s, e);
    }
    else for (; e > 0; ) if (e === this.cur.len) yield this.cur, e -= this.cur.char.length;
    else if (e === this.prev.len) yield this.prev, e -= this.prev.char.length;
    else {
      let t = e - 1, s = this.str.charCodeAt(t);
      s >= 56320 && s <= 57343 && t--;
      let c = this.str.codePointAt(t), l = String.fromCodePoint(c), y = b.get(c);
      yield new D(fe(y, l), c, l, e), e = t;
    }
  }
  classAfterSpaces(e) {
    for (let { cls: n } of this.codePoints(e)) if (n !== en) return n;
    return V;
  }
  afterNext(e = 1) {
    for (let n of this.codePoints(this.next.len)) if (--e <= 0) return n;
    return null;
  }
  setProp(e, n) {
    this.props || (this.props = {}), this.props[e] = n;
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](e, n, t) {
    let s = `${t(this.prev)} => ${t(this.cur)} => ${t(this.next)}`;
    return this.LB8 && (s += " LB8"), this.spaces && (s += " spaces"), this.RI > 0 && (s += ` RI: ${this.RI}`), this.props && (s += ` ${JSON.stringify(this.props)}`), s;
  }
};
var er = class {
  string = void 0;
  props = void 0;
  constructor(e, n = false) {
    this.position = e, this.required = n;
  }
};
var z = H.fromBase64(`AAAEAAAAAAD/////wQIAAB+LCAC1xcFoAgPtmj1IHUEQxzd5FiaEkMLSKqQIViEQCEmTjyqk
   SUgR7OySTrHxdVoIYqUg2AgqFhYWFhYidpYqKDaClVZaqJWF2qj/xT1cjjtv772Z3T1uHvzY
   753d2b252ds3+1SpRbAMVkGSrlMo5LNjIfqoB/uEfR2Ao5yy4zb7PgUX4Brcgo6GUi9AF+gG
   r0EPeAc+AN3mM8KvJu6DH0bWb08yeyEneV77rHia/yjbMvEBxJum7mCqzQjSo1beuBWfRFy3
   1fHpR2QJgiAIgiAIgiAIQpoZc45c8HhGd2WJYUyy5oIgCP5oRPhuEQQh7vvPVuAe34q5x1lH
   uJFh15J7HRt9Z7MJ9iKwg1fP72kG4osqz3ynUlNPHjhC2i5/9UypX8DOa6bSa0hfAbsf33zE
   /EPLr7NtOYj4zlTfD+v7dG0r8uzhXM39qEPH9TtBvTNwUXK9dyv0frzE3DSxje8mZ0yNjuz8
   zlT+S6T1OnQh7M5oo+f+Bvk67EGY/OfiPeKfTL5+hr6ZuM13k/cT4R/QC86tMfdZbf4a2Un6
   H9L9OXNIGCoo12yDYdR7mzG+tP8yhjoTpt607tuh/6r7b1VG7yv5ya/OP7iZQXEdYyi9UNel
   WKM83YTQE/f8qftudz9y7G/OdWlXLxTPYRm9cu+ZMutMaYuK2tnjyqpb5jnPa8+xH7n3eJFO
   ivRGbTNC6su3PeHYM0V7OxZ/hUtWLP5ZFfzDmMYQSieU8qj78rF3fMsI+axX5fwWYvw+5t9u
   f0VnNR964yh31bdLOce8qfYb11ndVWeUvibHfCj8tZD2LNZvTRyyW/GfQr1/OM8gob/LcPn8
   If3iVmVT23Iu/69KaxHzOYn6XenTNw1551DW/3V5X7v6c9Tfh7jPX9TrFtqOhjgPttqeW28u
   33192kvqs2vW7w7BeyuJcEoAAB+LCAC1xcFoAgOLVvJT0lGKVIoFANHfAiwJAAAA`);
var zt = Object.fromEntries(z.values.map((r2, e) => [r2, e]));
var { values: St } = z;
var { AK: ue, AL: w, AP: sn, AS: on, B2: Mr, BA: ve, BB: fn, BK: K, CB: Cr, CL: tr, CM: Or, CP: Z, CR: J, EB: pe, EM: Ur, EX: xe, GL: ir, H2: vr, H3: pr, HH: xr, HL: p, HY: sr, ID: un, IN: an, IS: E, JL: gr, JT: nr, JV: or, LF: F, NU: g, OP: fr, NL: R, NS: ge, PO: G, PR: j, RI: Hr, SP: h, SY: wr, QU: L, VF: ae, VI: ce, WJ: br, ZW: X, ZWJ: we } = lr;
var cn = /* @__PURE__ */ new Set([w, p, g]);
var ln = /* @__PURE__ */ new Set([K, J, F, R, h, X]);
var le = /* @__PURE__ */ new Set([un, pe, Ur]);
var hn = /* @__PURE__ */ new Set([gr, or, vr, pr]);
var vn = /* @__PURE__ */ new Set([gr, or, nr, vr, pr]);
var pn = /* @__PURE__ */ new Set([or, nr]);
var xn = /* @__PURE__ */ new Set([h, ir, br, tr, L, Z, xe, E, wr, K, J, F, R, X]);
var gn = /* @__PURE__ */ new Set([T, K, J, F, R, fr, L, ir, h, X]);
var o = /* @__PURE__ */ Symbol("PASS");
var i = /* @__PURE__ */ Symbol("NO_BREAK");
var I = /* @__PURE__ */ Symbol("MAY_BREAK");
var q = /* @__PURE__ */ Symbol("MUST_BREAK");
function wn(r2) {
  return r2.cur.cls === T && r2.next.cls !== V ? i : o;
}
function yn(r2) {
  return r2.next.cls === V && (r2.cur.len === 0 || r2.cur.len !== r2.prevChunk) ? q : o;
}
function mn(r2) {
  return r2.cur.cls === K ? q : o;
}
function An(r2) {
  switch (r2.cur.cls) {
    case J:
      return r2.next.cls === F ? i : q;
    case F:
    case R:
      return q;
    default:
  }
  return o;
}
function Ln(r2) {
  switch (r2.next.cls) {
    case K:
    case J:
    case F:
    case R:
      return i;
    default:
  }
  return o;
}
function dn(r2) {
  return r2.cur.cls !== Hr && (r2.RI = 0), r2.spaces ? (r2.next.cls !== h && (r2.spaces = false), i) : o;
}
function Tn(r2) {
  if (r2.next.cls === X) return i;
  if (r2.next.cls === h) switch (r2.cur.cls) {
    case X:
    case fr:
    case L:
    case tr:
    case Z:
    case Mr:
      break;
    default:
      return i;
  }
  return o;
}
function Bn(r2) {
  return r2.LB8 ? (r2.LB8 = false, I) : r2.cur.cls === X ? r2.next.cls === h ? (r2.LB8 = true, i) : I : o;
}
function zn(r2) {
  return r2.cur.cls === we ? i : o;
}
function Sn(r2) {
  return !ln.has(r2.cur.cls) && (r2.next.cls === Or || r2.next.cls === we) ? (r2.next.ignored = true, i) : o;
}
function Pn(r2) {
  return r2.cur.cls === Or && (r2.cur.cls = w), r2.next.cls === Or && (r2.next.cls = w), o;
}
function Dn(r2) {
  return r2.next.cls === br || r2.cur.cls === br ? i : o;
}
function In(r2) {
  return r2.cur.cls === ir ? i : o;
}
function Nn(r2) {
  if (r2.next.cls === ir) switch (r2.cur.cls) {
    case h:
    case ve:
    case sr:
    case xr:
      return o;
    default:
      return i;
  }
  return o;
}
function En(r2) {
  switch (r2.next.cls) {
    case tr:
    case Z:
    case xe:
    case wr:
      return i;
    default:
  }
  return o;
}
function Fn(r2) {
  return r2.cur.cls === fr ? (r2.next.cls === h && (r2.spaces = true), i) : o;
}
function Xn(r2) {
  return gn.has(r2.prev.cls) && /^\p{Pi}$/u.test(r2.cur.char) && r2.cur.cls === L ? (r2.spaces = true, i) : o;
}
function Mn(r2) {
  if (/^\p{gc=Pf}$/u.test(r2.next.char) && r2.next.cls === L) {
    let e = r2.afterNext();
    if (!e || xn.has(e.cls)) return i;
  }
  return o;
}
function Cn(r2) {
  return r2.cur.cls === h && r2.next.cls === E && r2.afterNext()?.cls === g ? I : o;
}
function On(r2) {
  return r2.next.cls === E ? i : o;
}
function Un(r2) {
  if (r2.cur.cls === tr || r2.cur.cls === Z) {
    if (r2.classAfterSpaces(r2.cur.len) === ge) return r2.next.cls === h && (r2.spaces = true), i;
    if (r2.next.cls === h) return i;
  }
  return o;
}
function Hn(r2) {
  if (r2.cur.cls === Mr) {
    if (r2.classAfterSpaces(r2.cur.len) === Mr) return r2.next.cls !== h || (r2.spaces = true), i;
    if (r2.next.cls === h) return i;
  }
  return o;
}
function bn(r2) {
  return r2.cur.cls === h ? I : o;
}
function Vn(r2) {
  return r2.next.cls === L && !/^\p{Pi}$/u.test(r2.next.char) || r2.cur.cls === L && !/^\p{Pf}$/u.test(r2.cur.char) ? i : o;
}
function Gn(r2) {
  if (!z.get(r2.cur.cp) && r2.next.cls === L) return i;
  if (r2.next.cls === L) {
    let e = r2.afterNext();
    if (!e || !z.get(e.cp)) return i;
  }
  return r2.cur.cls === L && !z.get(r2.next.cp) || (r2.prev.cls === T || !z.get(r2.prev.cp)) && r2.cur.cls === L ? i : o;
}
function jn(r2) {
  return r2.cur.cls === Cr || r2.next.cls === Cr ? I : o;
}
var qn = /* @__PURE__ */ new Set([T, K, J, F, R, h, X, Cr, ir]);
function Kn(r2) {
  return qn.has(r2.prev.cls) && (r2.cur.cls === sr || r2.cur.cls === xr) && (r2.next.cls === w || r2.next.cls === p) ? i : o;
}
function Zn(r2) {
  if (r2.cur.cls === fn) return i;
  switch (r2.next.cls) {
    case ve:
    case xr:
    case sr:
    case ge:
      return i;
    default:
  }
  return o;
}
function Jn(r2) {
  return r2.prev.cls === p && (r2.cur.cls === sr || r2.cur.cls === xr) && r2.next.cls !== p ? i : o;
}
function Rn(r2) {
  return r2.cur.cls === wr && r2.next.cls === p ? i : o;
}
function Yn(r2) {
  return r2.next.cls === an ? i : o;
}
function Wn(r2) {
  switch (r2.cur.cls) {
    case w:
    case p:
      if (r2.next.cls === g) return i;
      break;
    case g:
      if (r2.next.cls === w || r2.next.cls === p) return i;
      break;
    default:
  }
  return o;
}
function Qn(r2) {
  return r2.cur.cls === j && le.has(r2.next.cls) || r2.next.cls === G && le.has(r2.cur.cls) ? i : o;
}
function kn(r2) {
  return (r2.cur.cls === j || r2.cur.cls === G) && (r2.next.cls === w || r2.next.cls === p) || (r2.cur.cls === w || r2.cur.cls === p) && (r2.next.cls === j || r2.next.cls === G) ? i : o;
}
var _n = /* @__PURE__ */ new Set([G, j]);
var $n = /* @__PURE__ */ new Set([tr, Z]);
function rt(r2) {
  let e = null;
  if (_n.has(r2.next.cls) ? $n.has(r2.cur.cls) ? e = r2.prev.len : e = r2.cur.len : r2.next.cls === g && (e = r2.cur.len), e !== null) r: for (let { cls: n } of r2.codePoints(e, false)) switch (n) {
    case wr:
    case E:
      continue;
    case g:
      return i;
    default:
      break r;
  }
  if (r2.cur.cls === G || r2.cur.cls === j) {
    if (r2.next.cls === fr) {
      let n = r2.afterNext();
      if (n) {
        if (n.cls === g) return i;
        if (n.cls === E && r2.afterNext(2)?.cls === g) return i;
      }
    } else if (r2.next.cls === g) return i;
  }
  return r2.cur.cls === sr && r2.next.cls === g || r2.cur.cls === E && r2.next.cls === g ? i : o;
}
function et(r2) {
  switch (r2.cur.cls) {
    case gr:
      if (hn.has(r2.next.cls)) return i;
      break;
    case or:
    case vr:
      if (pn.has(r2.next.cls)) return i;
      break;
    case nr:
    case pr:
      if (r2.next.cls === nr) return i;
      break;
    default:
  }
  return o;
}
function nt(r2) {
  switch (r2.cur.cls) {
    case gr:
    case or:
    case nr:
    case vr:
    case pr:
      if (r2.next.cls === G) return i;
      break;
    case j:
      if (vn.has(r2.next.cls)) return i;
      break;
    default:
  }
  return o;
}
function tt(r2) {
  return (r2.cur.cls === w || r2.cur.cls === p) && (r2.next.cls === w || r2.next.cls === p) ? i : o;
}
function it(r2) {
  let { prev: e, cur: n, next: t } = r2, s = "\u25CC";
  function c(l) {
    return l.cls === ue || l.char === s || l.cls === on;
  }
  return n.cls === sn && c(t) || c(n) && (t.cls === ae || t.cls === ce) || c(e) && n.cls === ce && (t.cls === ue || t.char === s) || c(n) && c(t) && r2.afterNext()?.cls === ae ? i : o;
}
function st(r2) {
  return r2.cur.cls === E && (r2.next.cls === w || r2.next.cls === p) ? i : o;
}
function ot(r2) {
  switch (r2.cur.cls) {
    case w:
    case p:
    case g:
      if (r2.next.cls === fr && !z.get(r2.next.cp)) return i;
      break;
    case Z:
      if (!z.get(r2.cur.cp) && cn.has(r2.next.cls)) return i;
      break;
    default:
  }
  return o;
}
function ft(r2) {
  if (r2.cur.cls === Hr) {
    if (r2.next.cls === Hr && ++r2.RI % 2 !== 0) return i;
  } else r2.RI = 0;
  return o;
}
function ut(r2) {
  return r2.cur.cls === pe && r2.next.cls === Ur || r2.next.cls === Ur && /^\p{ExtPict}$/u.test(r2.cur.char) && /^\p{gc=Cn}$/u.test(r2.cur.char) ? i : o;
}
function at() {
  return I;
}
var ct = [wn, yn, mn, An, Ln, dn, Tn, Bn, zn, Sn, Pn, Dn, In, Nn, En, Fn, Xn, Mn, Cn, On, Un, Hn, bn, Vn, Gn, jn, Kn, Jn, Zn, Rn, Yn, Wn, Qn, kn, rt, et, nt, tt, it, st, ot, ft, ut, at];
var he = class {
  #r;
  constructor(e = {}) {
    if (this.#r = { string: false, example7: false, verbose: false, ...e }, this.rules = [...ct], this.#r.example7) throw new Error("'example7' flag deprecated");
    this.#r.verbose && this.rules.unshift((n) => (console.log(n.cur.len, n), o));
  }
  removeRule(...e) {
    let n = [];
    return this.rules = this.rules.filter((t) => e.includes(t.name) ? (n.push(t), false) : true), n;
  }
  addRuleAfter(e, ...n) {
    let t = this.rules.findIndex((s) => s.name === e);
    if (t === -1) throw new Error(`Rule not found: "${e}"`);
    return this.rules.splice(t + 1, 0, ...n), t + 1;
  }
  addRuleBefore(e, ...n) {
    let t = this.rules.findIndex((s) => s.name === e);
    if (t === -1) throw new Error(`Rule not found: "${e}"`);
    return this.rules.splice(t, 0, ...n), t;
  }
  replaceRule(e, ...n) {
    let t = this.rules.findIndex((s) => s.name === e);
    if (t === -1) throw new Error(`Rule not found: "${e}"`);
    return this.rules.splice(t, 1, ...n);
  }
  #n(e) {
    for (let n of this.rules) {
      let t = n.call(this, e);
      switch (t) {
        case o:
          break;
        case i:
          return this.#r.verbose && console.log(`  ${n.name}: NO_BREAK`), null;
        case I:
          return this.#r.verbose && console.log(`  ${n.name}: MAY_BREAK`), new er(e.cur.len);
        case q:
          return this.#r.verbose && console.log(`  ${n.name}: MUST_BREAK`), new er(e.cur.len, true);
        default:
          throw new Error(`Invalid state: "${t}"`);
      }
    }
    return null;
  }
  *#e(e) {
    let n = this.#n(e);
    n && (this.#r.string && (n.string = e.str.slice(e.prevChunk, e.cur.len)), e.props && (n.props = e.props, e.props = void 0), yield n, e.prevChunk = e.cur.len);
  }
  *breaks(e) {
    let n = new hr(e);
    for (let t of n.codePoints(0)) n.push(t), yield* this.#e(n);
    n.pushEnd(), yield* this.#e(n);
  }
};

// src/lib/v4/break-opportunities.ts
var UNICODE_VERSION = "17.0.0";
var profiles = {
  fr: new Set("le la les un une des de du au aux et ou en pour avec sans sur sous".split(" ")),
  de: new Set("der die das den dem des ein eine einer einem einen und oder mit von zu im am an auf".split(" ")),
  es: new Set("el la los las un una unos unas de del al y o en por para con sin".split(" "))
};
function languageOf(tag) {
  if (!tag?.trim()) return "und";
  try {
    const locale = new Intl.Locale(tag);
    return locale.script && locale.script !== "Latn" ? "unsupported" : locale.language || "und";
  } catch {
    return "invalid";
  }
}
function languageWeakEnding(word2, language) {
  if (language === "en") return isWeakEnding(word2);
  if (!profiles[language]) return false;
  const normalized = word2.normalize("NFC").toLocaleLowerCase(language === "und" ? void 0 : language).replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  return profiles[language]?.has(normalized) ?? false;
}
function analyzeBreaks(source, options = {}) {
  const language = languageOf(options.language);
  const result = { unicode: UNICODE_VERSION, language, outcome: "supported", units: [], opportunities: [] };
  if (!["und", "en", "fr", "de", "es"].includes(language)) {
    result.outcome = "native:language";
    return result;
  }
  if ([...source].some((c) => !/[\p{Script_Extensions=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(c)) || /[\u202a-\u202e\u2066-\u2069]/u.test(source)) {
    result.outcome = "native:script";
    return result;
  }
  if (source.includes("\xAD")) {
    result.outcome = "native:soft-hyphen";
    return result;
  }
  if (/[\u000b\u000c\u0085\u2028\u2029]/u.test(source)) {
    result.outcome = "native:author-breaks";
    return result;
  }
  const normalized = source.replace(/[\t\r\n]/g, " ");
  const graphemes = /* @__PURE__ */ new Set([source.length, ...Array.from(new Intl.Segmenter(language, { granularity: "grapheme" }).segment(source), (g2) => g2.index)]);
  const positions = [...new he().breaks(normalized)].map((b2) => b2.position).filter((pos) => {
    if (!graphemes.has(pos)) return false;
    if (pos < source.length && /[\u00a0\u202f\u2060\ufeff\u2011]/u.test(source[pos - 1] + source[pos])) return false;
    if (options.hyphens === "none" && /[-\u2010]$/.test(source.slice(0, pos))) return false;
    return true;
  });
  let start = 0;
  for (const end of positions) {
    const slice = source.slice(start, end);
    const leading = slice.match(/^[ \t\r\n]*/u)[0].length;
    const text = slice.slice(leading).replace(/[ \t\r\n]+$/u, "");
    if (text && /^\s+$/u.test(text)) continue;
    if (text) result.units.push({ text, index: start + leading, hyphen: /[-\u2010]$/u.test(text) });
    start = end;
  }
  result.opportunities = result.units.slice(1).map((unit) => unit.index);
  return result;
}
function tokenForUnit(unit, language) {
  const parts = tokenize(unit.text, () => 0).filter((t) => t.kind !== "space");
  const first = parts[0];
  const last = parts.at(-1);
  return {
    ...first,
    text: unit.text,
    width: 0,
    kind: /[\p{L}\p{N}]/u.test(unit.text) ? "word" : first.kind,
    stickyPrev: first.stickyPrev,
    stickyNext: last.stickyNext,
    // The audit vocabulary includes auxiliaries, but the compositor charges
    // those separately. Unicode eligibility must not promote them to weak words.
    weakEnd: language === "en" ? last.weakEnd : languageWeakEnding(last.text, language),
    bindOpener: language === "en" ? last.bindOpener : void 0,
    protectedCompound: unit.hyphen ? false : first.protectedCompound
  };
}

// src/lib/v4/space-policy.ts
function finishTargets(widths, measure) {
  const fills = widths.slice(0, -1).map((width) => width / measure).sort((a, b2) => a - b2);
  const mid = Math.floor(fills.length / 2);
  const median = fills.length % 2 ? fills[mid] : (fills[mid - 1] + fills[mid]) / 2;
  return widths.map((width, index) => {
    if (index === widths.length - 1) return width;
    const neighbors = [widths[index - 1], index < widths.length - 2 ? widths[index + 1] : void 0].filter((value) => value !== void 0);
    const local = neighbors.length ? neighbors.reduce((sum, value) => sum + value / measure, 0) / neighbors.length : median;
    const target = Math.max(0.7, Math.min(0.965, 0.5 * local + 0.5 * median));
    return measure * target;
  });
}
function finishSpaceDeltas(widths, measure, spaces) {
  const targets = finishTargets(widths, measure);
  return widths.map((width, index) => {
    const gaps = spaces[index] || [];
    if (index === widths.length - 1 || !gaps.length) return gaps.map(() => 0);
    const desired = (targets[index] - width) / gaps.length;
    return gaps.map((natural) => Number.isFinite(natural) && natural > 0 && desired >= -0.4 * natural ? Math.max(-0.2 * natural, Math.min(0.33 * natural, desired)) : 0);
  });
}

// src/lib/v4/spacing-finish.ts
var fontProperties = [
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-stretch",
  "font-variant",
  "font-feature-settings",
  "font-variation-settings",
  "font-optical-sizing",
  "font-kerning",
  "font-size-adjust",
  "font-synthesis",
  "text-rendering",
  "text-transform"
];
function naturalSpace(element, style, text, cache) {
  const font = fontProperties.map((property) => style.getPropertyValue(property));
  const key = JSON.stringify([font, text]);
  const cached = cache.get(key);
  if (cached !== void 0) return cached;
  const probe = element.ownerDocument.createElement("span");
  probe.dataset.tsProbe = "1";
  probe.setAttribute("aria-hidden", "true");
  const declarations = {
    position: "fixed",
    display: "inline-block",
    width: "max-content",
    "min-width": "0",
    "max-width": "none",
    height: "auto",
    margin: "0",
    padding: "0",
    border: "0",
    "white-space": "pre",
    "word-spacing": "0",
    "letter-spacing": "0",
    visibility: "hidden",
    transform: "none",
    zoom: "1",
    "text-indent": "0",
    "text-size-adjust": "none"
  };
  for (const [property, value] of Object.entries(declarations)) probe.style.setProperty(property, value, "important");
  fontProperties.forEach((property, index) => probe.style.setProperty(property, font[index], "important"));
  probe.textContent = text.repeat(32);
  element.ownerDocument.body.append(probe);
  let width;
  try {
    width = probe.getBoundingClientRect().width / 32;
  } finally {
    probe.remove();
  }
  cache.set(key, width);
  return width;
}
function planSpacingFinish(element, layout) {
  const result = (outcome, adjustments2 = []) => ({ outcome, adjustments: adjustments2, before: layout });
  const cs = getComputedStyle(element);
  if (!["left", "start"].includes(cs.textAlign) || cs.direction !== "ltr" || cs.writingMode !== "horizontal-tb") return result("native:spacing-layout");
  if (layout.lines.length < 2 || !layout.width) return result("unchanged");
  const source = element.textContent || "";
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node, offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    runs.push({ node: text, start: offset, end: offset + text.length });
    offset += text.length;
  }
  const point = (at2, end = false) => runs.find((run) => end ? run.start < at2 && run.end >= at2 : run.start <= at2 && run.end > at2);
  const range = element.ownerDocument.createRange();
  const measuredSpaces = /* @__PURE__ */ new Map();
  const measured = [];
  for (const line of layout.lines.slice(0, -1)) {
    const spaces = Array.from(source.slice(line.sourceStart, line.sourceEnd).matchAll(/[\t\n\r \u00a0\u202f]+/gu));
    const gaps = [];
    for (const space of spaces) {
      const start = line.sourceStart + space.index, end = start + space[0].length;
      const a = point(start), b2 = point(end, true);
      if (!a || !b2 || !a.node.parentElement) return result("native:spacing-measurement");
      range.setStart(a.node, start - a.start);
      range.setEnd(b2.node, end - b2.start);
      const style = getComputedStyle(a.node.parentElement);
      const available = range.getBoundingClientRect().width;
      const natural = naturalSpace(element, style, space[0].replace(/[\t\n\r ]+/g, " "), measuredSpaces);
      if (!Number.isFinite(natural) || natural <= 0 || natural > parseFloat(style.fontSize) * space[0].length) return result("native:spacing-measurement");
      gaps.push({ offset: end, naturalPx: natural, available });
    }
    measured.push(gaps);
  }
  const deltas = finishSpaceDeltas(layout.lines.map((line) => line.width), layout.width, measured.map((gaps) => gaps.map((gap) => gap.naturalPx)));
  const adjustments = [];
  for (const [line, gaps] of measured.entries()) for (const [index, gap] of gaps.entries()) {
    const px = deltas[line][index];
    if (gap.available + px <= 0) return result("native:spacing-measurement");
    if (Math.abs(px) > 1e-3) adjustments.push({ offset: gap.offset, naturalPx: gap.naturalPx, px, line });
  }
  return result(adjustments.length ? "applied" : "unchanged", adjustments);
}
function spacingMarkerStyle(px) {
  return {
    display: "inline-block",
    position: "static",
    float: "none",
    width: "0px",
    height: "0px",
    minWidth: "0px",
    minHeight: "0px",
    margin: "0px",
    marginLeft: px + "px",
    padding: "0px",
    border: "0px",
    boxShadow: "none",
    outline: "none",
    transform: "none",
    fontSize: "0px",
    lineHeight: "0",
    verticalAlign: "baseline",
    pointerEvents: "none"
  };
}
function spacingVerified(element, plan, after) {
  for (const marker of element.querySelectorAll("[data-ts-space]")) {
    const box = marker.getBoundingClientRect();
    if (box.width > 0.01 || box.height > 0.01) return false;
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(marker, pseudo).content;
      if (content && !["none", "normal", '""'].includes(content)) return false;
    }
  }
  if (after.lines.length !== plan.before.lines.length || Math.abs(after.width - plan.before.width) > 0.5 || after.overflow > Math.max(0.5, plan.before.overflow)) return false;
  return after.lines.every((line, index) => {
    const before = plan.before.lines[index];
    const delta = plan.adjustments.filter((space) => space.line === index).reduce((sum, space) => sum + space.px, 0);
    return line.sourceStart === before.sourceStart && line.sourceEnd === before.sourceEnd && Math.abs(line.top - after.lines[0].top - (before.top - plan.before.lines[0].top)) <= 0.75 && Math.abs(line.width - before.width - delta) <= 0.75;
  });
}

// src/lib/v4/finished-contour.ts
function finishedContour(element, words, measure) {
  const source = element.textContent || "";
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node, offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    runs.push({ start: offset, end: offset + text.length, node: text });
    offset += text.length;
  }
  const cache = /* @__PURE__ */ new Map();
  const spaces = Array.from(source.matchAll(/[\t\n\r \u00a0\u202f]+/gu), (match) => {
    const run = runs.find((run2) => run2.start <= match.index && run2.end > match.index);
    const parent = run?.node.parentElement;
    const width = parent ? naturalSpace(element, getComputedStyle(parent), match[0].replace(/[\t\n\r ]+/g, " "), cache) : 0;
    return { start: match.index, end: match.index + match[0].length, width };
  });
  return (lines) => {
    let cursor = 0;
    const gaps = lines.map((line) => {
      const start = words[cursor].index;
      cursor += line.tokens.length;
      const last = words[cursor - 1], end = last.index + last.text.length;
      return spaces.filter((space) => space.start >= start && space.end <= end).map((space) => space.width);
    });
    const widths = lines.map((line) => line.width);
    const deltas = finishSpaceDeltas(widths, measure, gaps);
    return widths.map((width, index) => (width + deltas[index].reduce((sum, delta) => sum + delta, 0)) / measure);
  };
}

// src/lib/v4/title-layout.ts
var weakEnds = /* @__PURE__ */ new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "and", "or", "but"]);
function composeTitle(tokens, width, measure, policy = {}) {
  const words = tokens.filter((t) => t.kind !== "space");
  if (!words.length || words.length > 64 || width <= 0) return null;
  const n = words.length;
  const widths = Array.from({ length: n }, () => []);
  for (let start2 = 0; start2 < n; start2++) {
    for (let end = start2 + 1; end <= n; end++) {
      widths[start2][end] = policy.measureRange?.(start2, end) ?? measure(words.slice(start2, end).map((t) => t.text).join(" "));
    }
  }
  const minLines = Array(n + 1).fill(Infinity);
  minLines[n] = 0;
  for (let start2 = n - 1; start2 >= 0; start2--) {
    for (let end = start2 + 1; end <= n; end++) {
      if (widths[start2][end] <= width + 0.25) minLines[start2] = Math.min(minLines[start2], 1 + minLines[end]);
    }
  }
  const count = minLines[0];
  if (!Number.isFinite(count) || policy.maxLines && count > policy.maxLines) return null;
  const keepBreaks = /* @__PURE__ */ new Set();
  for (const phrase of policy.keep || []) {
    const parts = phrase.trim().split(/\s+/u);
    for (let i2 = 0; i2 <= n - parts.length; i2++) {
      if (parts.every((part, j2) => words[i2 + j2].text === part)) {
        for (let j2 = 1; j2 < parts.length; j2++) keepBreaks.add(i2 + j2);
      }
    }
  }
  const target = widths[0][n] / (count * width);
  const memo = /* @__PURE__ */ new Map();
  const solve = (start2, left) => {
    if (start2 === n) return left === 0 ? { cost: 0, breaks: [] } : null;
    if (!left || minLines[start2] > left) return null;
    const key = start2 + ":" + left;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (let end = start2 + 1; end <= n; end++) {
      const lineWidth = widths[start2][end];
      if (lineWidth > width + 0.25) continue;
      const rest = solve(end, left - 1);
      if (!rest) continue;
      const last = end === n;
      const wordCount = words.slice(start2, end).reduce((sum, t) => sum + t.text.split(/\s+/u).length, 0);
      let cost = rest.cost + 1e3 * (lineWidth / width - target) ** 2;
      if (count > 1 && wordCount === 1 && (start2 === 0 || last)) {
        cost += last ? 500 : 900 * Math.max(0, 0.65 - lineWidth / width) / 0.65;
      }
      if (!last && (policy.weakEnding?.(words[end - 1].text) ?? weakEnds.has(words[end - 1].text.toLowerCase()))) cost += 240;
      if (!last && keepBreaks.has(end)) cost += 1500;
      if (!last) cost += policy.breakPenalty?.(end) || 0;
      if (!last && (words[end - 1].stickyNext || words[end]?.stickyPrev)) cost += 1e4;
      if (!best || cost < best.cost) best = { cost, breaks: [end, ...rest.breaks] };
    }
    memo.set(key, best);
    return best;
  };
  const winner = solve(0, count);
  if (!winner) return null;
  let start = 0;
  return winner.breaks.map((end) => {
    const lineTokens = words.slice(start, end);
    const lineWidth = widths[start][end];
    start = end;
    return {
      tokens: lineTokens,
      text: lineTokens.map((t) => t.text).join(" "),
      width: lineWidth,
      fill: lineWidth / width,
      wordSpacingEm: 0
    };
  });
}

// src/lib/v4/paragraph-rhythm.ts
function retainParagraphRhythm(source, before, proposedWidths) {
  const { lines, width, overflow } = before;
  if (lines.slice(0, -1).some((line) => strandedOpener(line.text))) return false;
  if (!Number.isFinite(width) || width <= 0 || overflow > 0.5 || lines.length < 4 || proposedWidths.length !== lines.length || lines.some((l) => l.words < 2 || !Number.isFinite(l.width) || l.width < 0 || l.width > width + 0.5) || proposedWidths.some((w2) => !Number.isFinite(w2) || w2 < 0 || w2 > width + 0.5)) return false;
  const last = lines.at(-1);
  if (last.words < 3 || last.width / width < 0.4 || last.width / width > 0.8) return false;
  const native = lines.slice(0, -1).map((l) => l.width / width);
  const proposed = proposedWidths.slice(0, -1).map((w2) => w2 / width);
  const spread = (fills) => Math.max(...fills) - Math.min(...fills);
  if (Math.min(...native) < 0.88 || spread(native) > 0.1 || spread(proposed) - spread(native) < 0.12 || Math.min(...native) - Math.min(...proposed) < 0.12) return false;
  const sentences2 = new Intl.Segmenter("en", { granularity: "sentence" });
  for (const sentence of sentences2.segment(source)) {
    if (!sentence.index) continue;
    const line = lines.slice(0, -1).find((l) => l.sourceStart < sentence.index && l.sourceEnd > sentence.index);
    if (line && source.slice(sentence.index, line.sourceEnd).trim().split(/\s+/u).length < 3) return false;
  }
  return true;
}

// src/lib/v4/optical-ink.ts
function supportedFont(style) {
  const size = parseFloat(style.fontSize);
  return style.fontVariationSettings === "normal" && style.fontFeatureSettings === "normal" && style.fontVariant === "normal" && ["none", "normal", ""].includes(style.fontSizeAdjust) && Number.isFinite(size) && size > 0 && size <= 256;
}
function setCanvasFont(context, style) {
  if (!supportedFont(style)) return false;
  const size = parseFloat(style.fontSize);
  const stretches = {
    "50%": "ultra-condensed",
    "62.5%": "extra-condensed",
    "75%": "condensed",
    "87.5%": "semi-condensed",
    "100%": "normal",
    "112.5%": "semi-expanded",
    "125%": "expanded",
    "150%": "extra-expanded",
    "200%": "ultra-expanded"
  };
  const stretch = stretches[style.fontStretch] || Object.values(stretches).find((value) => value === style.fontStretch);
  if (!stretch) return false;
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  context.fontStretch = stretch;
  context.fontKerning = style.fontKerning;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  return true;
}
function opticalInkOverhang(doc, style, char, advance) {
  if (!supportedFont(style)) return null;
  const context = doc.createElement("canvas").getContext("2d");
  if (!context || !setCanvasFont(context, style)) return null;
  const metrics = context.measureText(char);
  if (Math.abs(metrics.width + (parseFloat(style.letterSpacing) || 0) - advance) > 1.01 || !Number.isFinite(metrics.actualBoundingBoxLeft)) return null;
  return Math.max(0, metrics.actualBoundingBoxLeft);
}
function opticalInkPull(doc, style, char, advance) {
  if (!supportedFont(style)) return null;
  const size = parseFloat(style.fontSize);
  if (!Number.isFinite(size) || size <= 0 || size > 256) return null;
  const scale = 4, pad = Math.ceil(size), side = Math.ceil(size * 4 * scale);
  const canvas = doc.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.scale(scale, scale);
  if (!setCanvasFont(context, style)) return null;
  const metrics = context.measureText(char);
  const tracking = parseFloat(style.letterSpacing) || 0;
  if (Math.abs(metrics.width + tracking - advance) > 1.01) return null;
  const edge = (glyph) => {
    context.clearRect(0, 0, side / scale, side / scale);
    context.fillText(glyph, pad, pad * 2);
    const data = context.getImageData(0, 0, side, side).data;
    const rows = [];
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) if (data[(y * side + x) * 4 + 3] >= 32) {
        rows.push((x + 0.5) / scale - pad);
        break;
      }
    }
    return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
  };
  try {
    const actual = edge(char), reference = edge("H");
    return actual === null || reference === null ? null : Math.max(0, Math.min(size * 0.08, actual - reference));
  } catch {
    return null;
  }
}

// src/lib/v4/geometry.ts
function preservesAdvances(style) {
  if (style.scale && !["none", "1", "1 1", "1 1 1"].includes(style.scale)) return false;
  if (style.rotate && !["none", "0deg"].includes(style.rotate)) return false;
  const translation = style.translate?.split(/\s+/u);
  if (translation?.length === 3 && parseFloat(translation[2]) !== 0) return false;
  if (!style.transform || style.transform === "none") return true;
  try {
    const matrix = new DOMMatrixReadOnly(style.transform);
    return matrix.is2D && matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1;
  } catch {
    return false;
  }
}

// src/lib/v4/clipping.ts
function hangingRoom(element) {
  const clips = [];
  for (let el = element; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (!preservesAdvances(style) || style.clipPath !== "none" || style.clip && style.clip !== "auto" || style.maskImage && style.maskImage !== "none") return { clips, supported: false };
    const paint = /\b(paint|strict|content)\b/u.test(style.contain);
    if (style.overflowX === "visible" && !paint) continue;
    const rect = el.getBoundingClientRect();
    const border = parseFloat(style.borderLeftWidth) || 0;
    let left = rect.left + Math.max(border, el.clientLeft);
    const top = rect.top + el.clientTop, bottom = top + el.clientHeight;
    const clipMargin = style.getPropertyValue("overflow-clip-margin").trim();
    if ((style.overflowX === "clip" || paint) && clipMargin) {
      const values = clipMargin.split(/\s+/u);
      const edge = values.find((value) => value.endsWith("-box")) || "padding-box";
      const length = values.find((value) => /^\d*\.?\d+px$/u.test(value));
      if (values.some((value) => value !== edge && value !== length)) return { clips, supported: false };
      if (edge === "content-box") left += parseFloat(style.paddingLeft) || 0;
      else if (edge === "border-box") left -= border;
      left -= parseFloat(length || "0");
    }
    const radius = (value) => {
      const parts = value.split(/\s+/u);
      return Math.max(...parts.map((part) => part.endsWith("%") ? parseFloat(part) / 100 * Math.max(rect.width, rect.height) : parseFloat(part) || 0));
    };
    clips.push({ left, top, bottom, topRadius: radius(style.borderTopLeftRadius), bottomRadius: radius(style.borderBottomLeftRadius) });
  }
  return { clips, supported: true };
}
function fitsHangingRoom(room, glyph, px, overhang = 0) {
  return room.supported && room.clips.every((clip) => {
    const corner = Math.max(
      glyph.top < clip.top + clip.topRadius ? clip.topRadius : 0,
      glyph.bottom > clip.bottom - clip.bottomRadius ? clip.bottomRadius : 0
    );
    return glyph.left - px - overhang >= clip.left + corner + 0.25;
  });
}

// src/lib/v4/optical-hanging.ts
var punctuation = /* @__PURE__ */ new Set(["\u201C", "\u2018", '"', "'", "(", "[", "{", "\xAB", "\xBF", "\xA1"]);
var opticalLetters = /^[A-Zoc]$/;
function planOpticalHanging(element, layout) {
  const cs = getComputedStyle(element);
  if (cs.direction !== "ltr" || cs.writingMode !== "horizontal-tb" || !["left", "start"].includes(cs.textAlign) || cs.textIndent !== "0px") return { outcome: "native:hanging-layout", hangs: [] };
  const room = hangingRoom(element);
  if (!room.supported) return { outcome: "native:hanging-clipped", hangs: [] };
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node;
  let offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    runs.push({ node: text, start: offset, end: offset + text.length });
    offset += text.length;
  }
  const range = element.ownerDocument.createRange();
  const cache = /* @__PURE__ */ new Map();
  let unmeasurable = false;
  let clipped = 0;
  const hangs = layout.lines.flatMap((line) => {
    const run = runs.find((r2) => r2.start <= line.sourceStart && r2.end > line.sourceStart);
    if (!run) return [];
    const local = line.sourceStart - run.start;
    const char = run.node.data[local];
    const style = getComputedStyle(run.node.parentElement);
    range.setStart(run.node, local);
    range.setEnd(run.node, local + 1);
    const glyph = range.getBoundingClientRect();
    const advance = glyph.width;
    const displayed = style.textTransform === "uppercase" ? char.toUpperCase() : style.textTransform === "lowercase" ? char.toLowerCase() : char;
    let px = punctuation.has(char) ? advance : 0;
    if (!punctuation.has(char) && opticalLetters.test(displayed)) {
      const key = JSON.stringify([
        style.font,
        style.fontFamily,
        style.fontSize,
        style.fontWeight,
        style.fontStretch,
        style.fontStyle,
        style.fontKerning,
        style.letterSpacing,
        style.fontFeatureSettings,
        style.fontVariationSettings,
        displayed,
        advance
      ]);
      if (!cache.has(key)) cache.set(key, opticalInkPull(element.ownerDocument, style, displayed, advance));
      const pull = cache.get(key);
      if (pull === null) unmeasurable = true;
      else px = pull;
    }
    if (!(px > 0 && Number.isFinite(px))) return [];
    const overhang = room.clips.length ? opticalInkOverhang(element.ownerDocument, style, displayed, advance) : 0;
    if (overhang === null) {
      unmeasurable = true;
      return [];
    }
    if (!fitsHangingRoom(room, glyph, px, overhang)) {
      clipped++;
      return [];
    }
    return [{ offset: line.sourceStart, px, overhang }];
  });
  return unmeasurable ? { outcome: "native:hanging-font", hangs: [] } : { outcome: hangs.length ? clipped ? "applied:partial" : "applied" : clipped ? "native:hanging-clipped" : "unchanged", hangs };
}
function opticalMarkerStyle(px) {
  return spacingMarkerStyle(-px);
}
function opticalVerified(element, before, after, hangs) {
  const markers = Array.from(element.querySelectorAll("[data-ts-hang]"));
  if (markers.length !== hangs.length || before.lines.length !== after.lines.length || after.overflow > 0.5) return false;
  if (markers.some((marker) => {
    const box = marker.getBoundingClientRect();
    const style = getComputedStyle(marker);
    return style.position !== "static" || style.float !== "none" || box.width > 0.01 || box.height > 0.01 || ["::before", "::after"].some((pseudo) => {
      const content = getComputedStyle(marker, pseudo).content;
      return content && !["none", "normal", '""'].includes(content);
    });
  })) return false;
  const room = hangingRoom(element);
  if (!room.supported || after.lines.some((line) => {
    const hang = hangs.find((hang2) => hang2.offset === line.sourceStart);
    return hang && !fitsHangingRoom(room, new DOMRect(line.left, line.top, line.width, line.bottom - line.top), 0, hang.overhang);
  })) return false;
  return after.lines.every((line, index) => {
    const previous = before.lines[index], hang = hangs.find((hang2) => hang2.offset === previous.sourceStart)?.px || 0;
    return line.sourceStart === previous.sourceStart && line.sourceEnd === previous.sourceEnd && Math.abs(line.width - previous.width) <= 0.75 && Math.abs(line.left + hang - previous.left) <= 0.75 && Math.abs(line.top - previous.top) <= 0.75;
  });
}

// src/lib/v4/rich-text.ts
var BREAK_ATTRIBUTE = "data-ts-break";
var inlineTags = /* @__PURE__ */ new Set(["A", "B", "STRONG", "EM", "I", "SPAN", "SMALL", "U", "S", "DEL", "MARK", "ABBR", "CITE", "CODE"]);
var wordPattern = /[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/gu;
function richLayoutVerified(plan, after) {
  const starts = [plan.source.search(/\S/u), ...plan.breaks];
  const ends2 = [...plan.breaks.map((at2) => plan.source.slice(0, at2).trimEnd().length), plan.source.trimEnd().length];
  return after.lines.length === plan.widths.length && after.overflow <= 0.5 && after.lines.every((line, index) => line.sourceStart === starts[index] && line.sourceEnd === ends2[index] && line.width <= after.width + 0.5);
}
function textRuns(element) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node;
  let offset = 0;
  while (node = walker.nextNode()) {
    const length = node.textContent?.length || 0;
    runs.push({ node, start: offset, end: offset + length });
    offset += length;
  }
  return runs;
}
function pointAt(runs, offset, end = false) {
  const run = runs.find((r2) => end ? r2.end >= offset && r2.start < offset : r2.start <= offset && r2.end > offset) || runs.at(-1);
  return run ? { node: run.node, offset: Math.max(0, Math.min(run.end - run.start, offset - run.start)) } : null;
}
function selectionBookmark(element) {
  const selection = element.ownerDocument.getSelection();
  if (!selection?.anchorNode || !selection.focusNode || !element.contains(selection.anchorNode) && !element.contains(selection.focusNode)) return () => {
  };
  const capture = (node, offset) => {
    if (!element.contains(node)) return { node, offset };
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.setEnd(node, offset);
    return range.toString().length;
  };
  const anchor = capture(selection.anchorNode, selection.anchorOffset);
  const focus = capture(selection.focusNode, selection.focusOffset);
  return () => {
    const runs = textRuns(element);
    const a = typeof anchor === "number" ? pointAt(runs, anchor) : anchor;
    const f = typeof focus === "number" ? pointAt(runs, focus) : focus;
    if (a?.node.isConnected && f?.node.isConnected) selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset);
  };
}
function override(element, properties) {
  const saved = element.getAttribute("style");
  for (const [key, value] of Object.entries(properties)) element.style.setProperty(key, value, "important");
  return () => {
    if (saved === null) {
      const attribute = element.getAttributeNode("style");
      if (attribute) element.removeAttributeNode(attribute);
    } else element.setAttribute("style", saved);
  };
}
function unsupported(element) {
  for (const el of [element, ...element.querySelectorAll("*")]) {
    if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
    if (el !== element && !inlineTags.has(el.tagName)) return "native:rich-element";
    if (el.matches('[hidden], [aria-hidden="true"], [contenteditable]:not([contenteditable="false"]), [data-no-typeset]')) return "native:rich-excluded";
    const cs = getComputedStyle(el);
    if (cs.direction !== "ltr" || cs.writingMode !== "horizontal-tb" || el !== element && cs.unicodeBidi !== "normal" || cs.visibility !== "visible") return "native:rich-direction";
    if (cs.whiteSpace !== "normal" || !preservesAdvances(cs) || cs.textIndent !== "0px") return "native:rich-whitespace";
    if (el !== element && (cs.display !== "inline" || cs.position !== "static" || cs.verticalAlign !== "baseline")) return "native:rich-layout";
    if (el !== element && !inlineBoxInsets(cs).supported) return "native:rich-box";
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== "none" && content !== "normal" && content !== '""') return "native:rich-decorated";
    }
  }
  return null;
}
function planRichText(element, options = {}, nativeLayout) {
  const source = element.textContent || "";
  const markers = Array.from(element.querySelectorAll("[" + BREAK_ATTRIBUTE + "]"));
  const restoreMarkers = markers.map((marker) => override(marker, { display: "none" }));
  const tracking = Array.from(element.querySelectorAll("[data-ts-track]"));
  restoreMarkers.push(...tracking.map((wrapper) => override(wrapper, { "letter-spacing": "inherit", "word-spacing": "inherit" })));
  try {
    const before = !markers.length && nativeLayout ? nativeLayout : measureLayout(element);
    const search = [];
    const result = (outcome, breaks2 = [], widths = [], constraint) => ({
      source,
      before,
      outcome,
      breaks: breaks2,
      widths,
      ...constraint && { constraint },
      styleSignature: outcome === "composed:rich" ? richFingerprint(element) : "",
      ...search.length && { search }
    });
    const lang = element.closest("[lang]")?.getAttribute("lang");
    if (source.length > 12e3) return result("native:budget");
    const unicode = options.lineBreaks === "unicode";
    const analysis = unicode ? analyzeBreaks(source, { language: lang, hyphens: getComputedStyle(element).hyphens }) : null;
    if (analysis && analysis.outcome !== "supported") return result(analysis.outcome);
    if (!unicode && (lang && !/^en(?:-|$)/i.test(lang) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return result("native:language");
    if (unicode) for (const el of [element, ...element.querySelectorAll("*")]) {
      if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
      if (languageOf(el.closest("[lang]")?.getAttribute("lang")) !== analysis.language) return result("native:mixed-language");
      const cs = getComputedStyle(el);
      if (cs.hyphens === "auto") return result("native:auto-hyphens");
      if (cs.wordBreak !== "normal" || !["auto", "normal"].includes(cs.lineBreak) || !["normal", "break-word"].includes(cs.overflowWrap)) return result("native:break-policy");
    }
    if (getComputedStyle(element).display === "inline") return result("native:inline");
    const reason = unsupported(element);
    if (reason) return result(reason);
    if (!before.width || !before.lines.length) return result("unmeasurable");
    if (before.lines.length === 1 && before.overflow <= 0.5) return result("native:fits");
    if (options.mode === "ui") return result("native:ui");
    const runs = textRuns(element);
    const words = analysis?.units || Array.from(source.matchAll(wordPattern)).flatMap((word2) => {
      if (/[\u00a0\u202f]/u.test(word2[0])) return [{ text: word2[0], index: word2.index, hyphen: false }];
      const parts = [];
      let cursor = 0;
      for (const match of word2[0].matchAll(/(?<=\p{L})[-\u2010\u2013\u2014](?=\p{L})/gu)) {
        const end = match.index + 1;
        const point = pointAt(runs, word2.index + end - 1);
        if (/[-\u2010]/u.test(match[0]) && point?.node.parentElement && getComputedStyle(point.node.parentElement).hyphens === "none") continue;
        parts.push({ text: word2[0].slice(cursor, end), index: word2.index + cursor, hyphen: true });
        cursor = end;
      }
      parts.push({ text: word2[0].slice(cursor), index: word2.index + cursor, hyphen: false });
      return parts;
    });
    if (words.length > 500 || source.length > 12e3) return result("native:budget");
    if (unicode) {
      for (let i2 = words.length - 2; i2 >= 0; i2--) {
        const point = pointAt(runs, words[i2].index + words[i2].text.length - 1);
        if (words[i2].hyphen && point?.node.parentElement && getComputedStyle(point.node.parentElement).hyphens === "none") {
          const next = words[i2 + 1];
          words[i2].text = source.slice(words[i2].index, next.index + next.text.length);
          words[i2].hyphen = next.hyphen;
          words.splice(i2 + 1, 1);
        }
      }
    }
    const range = element.ownerDocument.createRange();
    const leadingInsets = /* @__PURE__ */ new Map(), trailingInsets = /* @__PURE__ */ new Map();
    for (const el of element.querySelectorAll("*")) {
      if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
      const insets = inlineBoxInsets(getComputedStyle(el));
      if (!insets.left && !insets.right) continue;
      const children = runs.filter((run) => el.contains(run.node));
      if (!children.length) continue;
      const start = children[0].start, end = children.at(-1).end;
      leadingInsets.set(start, (leadingInsets.get(start) || 0) + insets.left);
      trailingInsets.set(end, (trailingInsets.get(end) || 0) + insets.right);
    }
    const restoreWhiteSpace = [element, ...element.querySelectorAll("*")].filter((el) => !el.hasAttribute(BREAK_ATTRIBUTE)).map((el) => override(el, { "white-space": "nowrap", "text-wrap": "nowrap" }));
    let edges;
    try {
      edges = words.map((word2) => {
        const a = pointAt(runs, word2.index);
        const b2 = pointAt(runs, word2.index + word2.text.length, true);
        if (!a || !b2) throw new Error("Unmapped rich text");
        range.setStart(a.node, a.offset);
        range.setEnd(b2.node, b2.offset);
        const rect = range.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
    } finally {
      restoreWhiteSpace.reverse().forEach((restore2) => restore2());
    }
    const tokens = words.map((word2) => {
      if (analysis) return tokenForUnit(word2, analysis.language);
      const token = tokenize(word2.text, () => 0)[0];
      if (word2.hyphen) token.protectedCompound = false;
      return token;
    });
    const content = tokens;
    if (content.length !== words.length || !edges.length) return result("native:rich-tokens");
    content.forEach((token, i2) => {
      token.width = edges[i2].right - edges[i2].left;
    });
    const nativeSpans = new Map(before.lines.map((line) => [line.sourceStart + ":" + line.sourceEnd, line]));
    const measureRange = (start, end) => {
      const last = words[end - 1];
      const width = edges[end - 1].right - edges[start].left + (leadingInsets.get(words[start].index) || 0) + (trailingInsets.get(last.index + last.text.length) || 0);
      if (width <= before.width || width > before.width + 0.5) return width;
      const witness = nativeSpans.get(words[start].index + ":" + (last.index + last.text.length));
      return witness && witness.width <= before.width + 0.5 && Math.abs(witness.width - width) <= 0.5 ? Math.min(before.width, witness.width) : width;
    };
    const breakPenalty = (end) => words[end - 1].hyphen ? 1600 : 0;
    const title = options.mode === "title" || options.mode === "heading" || !options.mode && /^H[1-6]$/.test(element.tagName);
    const clamp = parseInt(getComputedStyle(element).getPropertyValue("-webkit-line-clamp"), 10);
    const openerRepair = options.density !== "compact" && (!analysis || analysis.language === "en") && before.lines.slice(0, -1).some((line) => strandedOpener(line.text));
    const allowance = !title && (before.lastSingleton || options.density === "editorial" || openerRepair) ? 1 : 0;
    const maxLines = Math.min(options.maxLines || Infinity, clamp > 0 ? clamp : Infinity, before.lines.length + allowance);
    const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
    const contourWidths = !title && options.contour === "finished" && ["left", "start"].includes(getComputedStyle(element).textAlign) ? finishedContour(element, words, before.width) : void 0;
    const onSearch = (evidence) => {
      search.push(evidence);
    };
    let lines = title ? composeTitle(tokens, before.width, () => 0, {
      ...options,
      maxLines,
      measureRange,
      breakPenalty,
      ...analysis && analysis.language !== "en" && { weakEnding: (word2) => languageWeakEnding(word2, analysis.language) }
    }) : composeParagraph(tokens, before.width, before.width / (fontSize * 0.5), {
      maxLines,
      candidateBar: 1,
      measureRange,
      breakPenalty,
      englishLexical: !analysis || analysis.language === "en",
      contourWidths,
      onSearch,
      allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width)
    });
    if (analysis?.language === "en" && lines) {
      const texts = words.map((word2) => word2.text);
      const groups = englishPhraseGroups(texts, before.width, measureRange);
      const costs = phraseBreakCosts(texts, groups, title);
      const attachmentCost = (composition) => {
        let end2 = 0;
        return composition.slice(0, -1).reduce((sum, line) => {
          end2 += line.tokens.length;
          return sum + costs[end2];
        }, 0);
      };
      const originalCost = attachmentCost(lines);
      if (originalCost > 0) {
        const phrasedPenalty = (end2) => breakPenalty(end2) + costs[end2];
        const phrased = title ? composeTitle(tokens, before.width, () => 0, { ...options, maxLines, measureRange, breakPenalty: phrasedPenalty }) : composeParagraph(tokens, before.width, before.width / (fontSize * 0.5), {
          maxLines,
          candidateBar: 1,
          measureRange,
          breakPenalty: phrasedPenalty,
          englishLexical: true,
          contourWidths,
          onSearch,
          allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width)
        });
        const wordCounts = (composition) => {
          let end2 = 0;
          return composition.map((line) => {
            const start = end2;
            end2 += line.tokens.length;
            const last = words[end2 - 1];
            return source.slice(words[start].index, last.index + last.text.length).trim().split(/\s+/u).length;
          });
        };
        if (phrased && attachmentCost(phrased) < originalCost) {
          const originalWords = wordCounts(lines), proposedWords = wordCounts(phrased);
          const stranded = title && (proposedWords[0] === 1 && originalWords[0] > 1 || proposedWords.at(-1) === 1 && originalWords.at(-1) > 1 || proposedWords.filter((n) => n === 1).length > originalWords.filter((n) => n === 1).length);
          if (!stranded) lines = phrased;
        }
      }
      let end = 0;
      const chosenEnds = lines.map((line) => {
        end += line.tokens.length;
        return words[end - 1].index + words[end - 1].text.length;
      });
      if (!title && options.density !== "editorial" && !options.keep?.length && before.lines.length <= maxLines && retainSentenceLayout(source, before, chosenEnds)) return result("native:sentence-aligned");
      if (!title && options.density !== "editorial" && !options.keep?.length && before.lines.length <= maxLines && retainParagraphRhythm(source, before, lines.map((line) => line.width))) return result("native:paragraph-rhythm");
    }
    if (!lines) {
      const limit = before.width + (title ? 0.25 : 0);
      const requiredWidth = Math.max(...content.map((_, i2) => measureRange(i2, i2 + 1)));
      const minimum = Array(content.length + 1).fill(Infinity);
      minimum[content.length] = 0;
      for (let start = content.length - 1; start >= 0; start--) {
        for (let end = start + 1; end <= content.length; end++) {
          if (measureRange(start, end) <= limit) minimum[start] = Math.min(minimum[start], 1 + minimum[end]);
        }
      }
      return result("native:no-candidate", [], [], {
        kind: requiredWidth > limit ? "unbreakable-run" : minimum[0] > maxLines ? "line-budget" : "search",
        availableWidth: before.width,
        requiredWidth,
        minimumLines: Number.isFinite(minimum[0]) ? minimum[0] : null,
        maxLines: Number.isFinite(maxLines) ? maxLines : null
      });
    }
    let index = 0;
    const breaks = lines.slice(0, -1).map((line) => {
      index += line.tokens.length;
      return words[index].index;
    });
    return result("composed:rich", breaks, lines.map((line) => line.width));
  } finally {
    restoreMarkers.reverse().forEach((restore2) => restore2());
  }
}
function renderRichText(element, breaks, hangs = [], spaces = []) {
  const restoreSelection = selectionBookmark(element);
  const runs = textRuns(element);
  const markers = [];
  const splits = /* @__PURE__ */ new Map();
  const insertions = [
    ...breaks.map((offset) => ({ offset, px: 0, spacing: false })),
    ...hangs.map((hang) => ({ ...hang, spacing: false })),
    ...spaces.map((space) => ({ ...space, spacing: true }))
  ].sort((a, b2) => b2.offset - a.offset || b2.px - a.px);
  for (const { offset, px, spacing } of insertions) {
    const point = pointAt(runs, offset);
    if (!point) continue;
    const head = point.node;
    const marker = element.ownerDocument.createElement(px ? "span" : "br");
    marker.setAttribute(BREAK_ATTRIBUTE, "");
    marker.setAttribute("aria-hidden", "true");
    if (spacing) {
      marker.dataset.tsSpace = String(offset);
      Object.assign(marker.style, spacingMarkerStyle(px));
    } else if (px) {
      marker.dataset.tsHang = String(offset);
      Object.assign(marker.style, opticalMarkerStyle(px));
    } else marker.style.setProperty("display", "inline", "important");
    if (point.offset === 0) head.before(marker);
    else {
      const tail = head.splitText(point.offset);
      const split = splits.get(head) || { head, parts: [head] };
      split.parts.splice(1, 0, tail);
      splits.set(head, split);
      tail.before(marker);
    }
    markers.push(marker);
  }
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  return {
    nodes: [element, ...element.querySelectorAll("*"), ...textRuns(element).map((r2) => r2.node)],
    cleanup() {
      const restoreSelection2 = selectionBookmark(element);
      markers.forEach((marker) => marker.remove());
      if (spaces.length) element.querySelectorAll("[data-ts-break][data-ts-space]").forEach((marker) => marker.remove());
      if (breaks.length) element.querySelectorAll("[" + BREAK_ATTRIBUTE + "]").forEach((marker) => marker.remove());
      for (const { head, parts } of splits.values()) {
        if (!element.contains(head)) continue;
        for (const part of parts.slice(1)) {
          if (head.nextSibling !== part || part.parentNode !== head.parentNode) break;
          head.appendData(part.data);
          part.remove();
        }
      }
      releaseCopy();
      restoreSelection2();
    }
  };
}
var copyRoots = /* @__PURE__ */ new WeakMap();
function preserveRichCopy(element) {
  const doc = element.ownerDocument;
  let roots = copyRoots.get(doc);
  if (!roots) {
    roots = /* @__PURE__ */ new WeakMap();
    copyRoots.set(doc, roots);
    const registered = roots;
    doc.addEventListener("copy", (event) => {
      if (event.defaultPrevented || !event.clipboardData) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      const selection = doc.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return;
      const ranges = Array.from({ length: selection.rangeCount }, (_, i2) => selection.getRangeAt(i2));
      const containingRoot = (range) => {
        let root = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
        while (root && !(registered.has(root) && root.contains(range.endContainer))) root = root.parentElement;
        return root;
      };
      const affected = ranges.some((range) => {
        if (containingRoot(range)) return true;
        const common = range.commonAncestorContainer;
        const parent = common instanceof Element ? common : common.parentElement;
        return Array.from(parent?.querySelectorAll("*") || []).some((el) => registered.has(el) && range.intersectsNode(el));
      });
      if (!affected) return;
      const html = ranges.map((range) => {
        const fragment = range.cloneContents();
        fragment.querySelectorAll("[" + BREAK_ATTRIBUTE + "]").forEach((marker) => marker.remove());
        fragment.querySelectorAll("[data-ts-track]").forEach((wrapper) => wrapper.replaceWith(...wrapper.childNodes));
        for (const el of fragment.querySelectorAll("*")) {
          for (const attribute of ["data-ts-outcome", "data-typeset-done", "data-ts-quotes", "data-ts-hanging", "data-ts-spacing", "data-ts-tracking"]) el.removeAttribute(attribute);
          if (el instanceof HTMLAnchorElement && el.hasAttribute("href")) {
            try {
              el.href = new URL(el.getAttribute("href"), doc.baseURI).href;
            } catch {
            }
          }
        }
        const container = doc.createElement("div");
        container.append(fragment);
        return container.innerHTML;
      }).join("");
      let text;
      if (ranges.length === 1 && containingRoot(ranges[0])) text = ranges[0].toString();
      else {
        const restore2 = Array.from(doc.querySelectorAll("[" + BREAK_ATTRIBUTE + "]")).filter((marker) => ranges.some((range) => range.intersectsNode(marker))).map((marker) => override(marker, { display: "none" }));
        try {
          text = selection.toString();
        } finally {
          restore2.forEach((undo) => undo());
        }
      }
      event.clipboardData.setData("text/plain", text);
      event.clipboardData.setData("text/html", html);
      event.preventDefault();
    });
  }
  roots.set(element, (roots.get(element) || 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (roots.get(element) || 1) - 1;
    if (count) roots.set(element, count);
    else roots.delete(element);
  };
}
function richFingerprint(element) {
  return [element, ...element.querySelectorAll("*")].filter((el) => !el.hasAttribute(BREAK_ATTRIBUTE) && !el.hasAttribute("data-ts-track")).map((el) => {
    const cs = getComputedStyle(el);
    return [
      cs.font,
      cs.fontFeatureSettings,
      cs.fontVariationSettings,
      cs.fontOpticalSizing,
      cs.fontKerning,
      cs.fontVariant,
      cs.fontSizeAdjust,
      cs.fontSynthesis,
      cs.textRendering,
      cs.lineHeight,
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
      cs.transform,
      cs.visibility,
      cs.paddingInline,
      cs.marginInline,
      cs.borderInlineWidth,
      cs.color,
      cs.backgroundColor,
      cs.textDecoration,
      cs.textShadow,
      getComputedStyle(el, "::before").content,
      getComputedStyle(el, "::after").content
    ].join("|");
  }).join(";");
}

// src/lib/v4/smart-quotes.ts
function smartQuotes(text) {
  let doubleOpen = false;
  let singleOpen = false;
  return text.replace(/["'\u201c\u201d\u2018\u2019]/gu, (quote, index) => {
    if (quote === "\u201C") {
      doubleOpen = true;
      return quote;
    }
    if (quote === "\u201D") {
      doubleOpen = false;
      return quote;
    }
    if (quote === "\u2018") {
      singleOpen = true;
      return quote;
    }
    if (quote === "\u2019") return quote;
    const before = text[index - 1] || "";
    const after = text[index + 1] || "";
    const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
    if (quote === '"') {
      if (opening && after && !/\s/u.test(after)) {
        doubleOpen = true;
        return "\u201C";
      }
      if (/\d/u.test(before) && !doubleOpen) return quote;
      doubleOpen = false;
      return "\u201D";
    }
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) return "\u2019";
    if (opening && /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b)/iu.test(text.slice(index + 1))) return "\u2019";
    if (opening && after && !/\s/u.test(after)) {
      singleOpen = true;
      return "\u2018";
    }
    if (/\d/u.test(before) && !singleOpen) return quote;
    singleOpen = false;
    return "\u2019";
  });
}
function applySmartQuotes(element) {
  const skip = 'code, pre, kbd, samp, input, textarea, script, style, [data-no-typeset], [contenteditable]:not([contenteditable="false"])';
  const lang = element.closest("[lang]")?.getAttribute("lang");
  if (lang && !/^en(?:-|$)/i.test(lang) || element.matches(skip) || element.querySelector(skip) || [...element.querySelectorAll("[lang]")].some((el) => !/^en(?:-|$)/i.test(el.getAttribute("lang") || ""))) {
    return { outcome: "native:quotes-scope", restore: () => {
    } };
  }
  const source = element.textContent || "";
  const educated = smartQuotes(source);
  const edits = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  let offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    const output = educated.slice(offset, offset + text.length);
    offset += text.length;
    if (output !== text.data) {
      edits.push({ node: text, source: text.data, output });
      text.data = output;
    }
  }
  return { outcome: edits.length ? "applied" : "unchanged", restore: () => {
    for (const edit of edits) if (element.contains(edit.node) && edit.node.data === edit.output) edit.node.data = edit.source;
  } };
}

// src/lib/v4/tracking-finish.ts
var TRACK_ATTRIBUTE = "data-ts-track";
var MAX_TRACKING_EM = 0.01;
var resolvedSpacing = (value) => value === "normal" ? 0 : /^-?(?:\d+\.?\d*|\.\d+)px$/u.test(value) ? parseFloat(value) : NaN;
function textRuns2(element) {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node, offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    runs.push({ node: text, start: offset, end: offset + text.length });
    offset += text.length;
  }
  return runs;
}
function planTrackingFinish(element, layout, targets) {
  const result = (outcome, runs2 = []) => ({ outcome, runs: runs2, before: layout, targets });
  const style = getComputedStyle(element);
  if (style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || !["left", "start"].includes(style.textAlign)) return result("native:tracking-layout");
  const source = element.textContent || "", texts = textRuns2(element);
  const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  const runs = [];
  let unsupported2 = false;
  for (const [line, box] of layout.lines.slice(0, -1).entries()) {
    const desired = targets[line] - box.width;
    if (!Number.isFinite(desired) || Math.abs(desired) < 0.25) continue;
    if ([...box.text].some((char) => /\p{L}/u.test(char) && !/\p{Script=Latin}/u.test(char))) {
      unsupported2 = true;
      continue;
    }
    const pieces = [];
    for (const text of texts) {
      const start = Math.max(box.sourceStart, text.start), end = Math.min(box.sourceEnd, text.end);
      if (end <= start || text.node.parentElement?.closest("code, kbd, samp")) continue;
      const parent = text.node.parentElement;
      if (!parent) continue;
      const cs = getComputedStyle(parent), fontSize = parseFloat(cs.fontSize);
      const letterSpacing = resolvedSpacing(cs.letterSpacing), wordSpacing = resolvedSpacing(cs.wordSpacing);
      if (!(fontSize > 0) || !Number.isFinite(letterSpacing) || !Number.isFinite(wordSpacing)) return result("native:tracking-measurement");
      const count = [...segmenter.segment(source.slice(start, end))].filter((part) => !/^\s+$/u.test(part.segment)).length;
      const previous = pieces.at(-1);
      let adjacent = previous?.last.nextSibling || null;
      while (adjacent instanceof HTMLElement && adjacent.hasAttribute("data-ts-space")) adjacent = adjacent.nextSibling;
      if (previous && adjacent === text.node && previous.end === start) {
        previous.end = end;
        previous.count += count;
        previous.last = text.node;
      } else pieces.push({ start, end, line, px: 0, fontSize, letterSpacing, wordSpacing, last: text.node, count });
    }
    const capacity = pieces.reduce((sum, run) => sum + run.count * run.fontSize, 0);
    if (!capacity) continue;
    const em = Math.max(-MAX_TRACKING_EM, Math.min(MAX_TRACKING_EM, desired / capacity));
    for (const { last: _last, count, ...run } of pieces) if (count) runs.push({ ...run, px: run.fontSize * em });
  }
  if (runs.length > 256) return result("native:tracking-budget");
  return result(runs.length ? "applied" : unsupported2 ? "native:tracking-script" : "unchanged", runs);
}
function trackingStyle(run) {
  return {
    all: "unset",
    display: "inline",
    letterSpacing: run.letterSpacing + run.px + "px",
    // CSS tracking also affects spaces. Compensate so the word-space finish
    // retains its measured 80-133% envelope instead of paying for tracking twice.
    wordSpacing: run.wordSpacing - run.px + "px"
  };
}
function renderTracking(element, plan) {
  const restoreSelection = selectionBookmark(element), texts = textRuns2(element);
  const splits = /* @__PURE__ */ new Map();
  const split = (head, at2) => {
    const tail = head.splitText(at2), parts = splits.get(head) || [head];
    parts.splice(1, 0, tail);
    splits.set(head, parts);
    return tail;
  };
  for (const run of [...plan.runs].reverse()) {
    const a = texts.find((text) => text.start <= run.start && text.end > run.start);
    const b2 = texts.find((text) => text.start < run.end && text.end >= run.end);
    if (!a || !b2 || a.node.parentNode !== b2.node.parentNode) continue;
    const end = run.end - b2.start;
    if (end < b2.node.length) split(b2.node, end);
    const first = run.start > a.start ? split(a.node, run.start - a.start) : a.node;
    const last = a.node === b2.node ? first : b2.node;
    const wrapper = element.ownerDocument.createElement("span");
    wrapper.setAttribute(TRACK_ATTRIBUTE, String(run.start));
    Object.assign(wrapper.style, trackingStyle(run));
    first.before(wrapper);
    for (let node = first; node; ) {
      const next = node.nextSibling;
      wrapper.append(node);
      if (node === last) break;
      node = next;
    }
  }
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  return { nodes: [element], cleanup() {
    const restoreSelection2 = selectionBookmark(element);
    element.querySelectorAll("[" + TRACK_ATTRIBUTE + "]").forEach((wrapper) => wrapper.replaceWith(...wrapper.childNodes));
    for (const [head, parts] of splits) if (element.contains(head)) for (const part of parts.slice(1)) {
      if (head.nextSibling !== part) break;
      head.appendData(part.data);
      part.remove();
    }
    releaseCopy();
    restoreSelection2();
  } };
}
function trackingVerified(element, plan, after) {
  const wrappers = Array.from(element.querySelectorAll("[" + TRACK_ATTRIBUTE + "]"));
  if (wrappers.length !== plan.runs.length || after.lines.length !== plan.before.lines.length || Math.abs(after.width - plan.before.width) > 0.5 || after.overflow > Math.max(0.5, plan.before.overflow)) return false;
  if (wrappers.some((wrapper) => {
    const run = plan.runs.find((run2) => run2.start === Number(wrapper.getAttribute(TRACK_ATTRIBUTE)));
    const cs = getComputedStyle(wrapper);
    return !run || Math.abs(parseFloat(cs.letterSpacing) - run.letterSpacing - run.px) > 1e-3 || Math.abs(parseFloat(cs.wordSpacing) - run.wordSpacing + run.px) > 1e-3 || cs.display !== "inline" || cs.position !== "static" || cs.visibility !== "visible" || ["::before", "::after"].some((pseudo) => !["none", "normal", '""', ""].includes(getComputedStyle(wrapper, pseudo).content));
  })) return false;
  return after.lines.every((line, index) => {
    const before = plan.before.lines[index], adjusted = plan.runs.some((run) => run.line === index);
    return line.sourceStart === before.sourceStart && line.sourceEnd === before.sourceEnd && Math.abs(line.left - before.left) <= 0.5 && Math.abs(line.top - before.top) <= 0.5 && Math.abs(line.bottom - before.bottom) <= 0.5 && (adjusted ? Math.abs(plan.targets[index] - line.width) < Math.abs(plan.targets[index] - before.width) - 0.02 : Math.abs(line.width - before.width) <= 0.5);
  });
}

// src/lib/v4/typeset.next.ts
var VERSION = "4.1.0";
var states = /* @__PURE__ */ new WeakMap();
var measurements = /* @__PURE__ */ new WeakMap();
var fontVersions = /* @__PURE__ */ new WeakMap();
var fontIds = /* @__PURE__ */ new WeakMap();
var nextFontId = 0;
function fontVersion(doc) {
  let version = fontVersions.get(doc);
  if (!version) {
    version = { epoch: 0 };
    fontVersions.set(doc, version);
    const current = version;
    doc.fonts.addEventListener("loadingdone", () => {
      current.epoch++;
    });
  }
  const faces = [];
  doc.fonts.forEach((face) => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFontId);
    faces.push([fontIds.get(face), face.family, face.status, face.weight, face.style, face.stretch].join(":"));
  });
  return version.epoch + "|" + faces.join("|");
}
var excluded = '[data-no-typeset], pre, code, script, style, template, textarea, input, select, button, nav, [contenteditable]:not([contenteditable="false"])';
var defaults = "[data-typeset], p, blockquote, figcaption, h1, h2, h3, h4, h5, h6";
var emptyMetrics = () => ({ lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 });
function modeOf(el, options) {
  const mode = options.mode || el.dataset.typesetMode;
  if (mode === "heading" || mode === "title" || mode === "ui" || mode === "body") return mode;
  return el.closest("h1,h2,h3,h4,h5,h6") ? "title" : "body";
}
function signature(el, options) {
  const cs = getComputedStyle(el);
  const context = [];
  for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
    context.push(ancestor.id, ancestor.getAttribute("class"), ancestor.getAttribute("style"));
  }
  return JSON.stringify([
    el.innerHTML,
    fontVersion(el.ownerDocument),
    el.ownerDocument.fonts.status,
    contentWidth(el),
    el.parentElement && contentWidth(el.parentElement),
    cs.font,
    cs.fontFamily,
    cs.fontSize,
    cs.fontWeight,
    cs.fontStyle,
    cs.fontStretch,
    cs.fontFeatureSettings,
    cs.fontVariationSettings,
    cs.fontOpticalSizing,
    cs.fontVariant,
    cs.fontKerning,
    cs.fontSizeAdjust,
    cs.fontSynthesis,
    cs.textRendering,
    cs.letterSpacing,
    cs.wordSpacing,
    cs.lineHeight,
    cs.textTransform,
    cs.whiteSpace,
    cs.textAlign,
    cs.direction,
    cs.writingMode,
    cs.display,
    cs.textWrap,
    cs.hyphens,
    cs.wordBreak,
    cs.lineBreak,
    cs.overflowWrap,
    cs.getPropertyValue("-webkit-line-clamp"),
    el.closest("[lang]")?.getAttribute("lang"),
    el.dataset.typesetMode,
    options.mode,
    options.keep,
    options.maxLines,
    options.density,
    options.text,
    options.lineBreaks,
    options.smartQuotes,
    options.opticalHanging,
    options.spacing,
    options.tracking,
    options.contour,
    context,
    getComputedStyle(el, "::before").content,
    getComputedStyle(el, "::after").content,
    el.querySelector(":not([data-ts-break]):not(.ts-line)") ? richFingerprint(el) : ""
  ]);
}
function resetStyles(el, state) {
  if (el.style.textWrap === state.appliedStyles.textWrap && el.style.textWrap !== state.styles.textWrap) el.style.textWrap = state.styles.textWrap;
  if (el.style.inlineSize === state.appliedStyles.inlineSize && el.style.inlineSize !== state.styles.inlineSize) el.style.inlineSize = state.styles.inlineSize;
  if (el.style.maxInlineSize === state.appliedStyles.maxInlineSize && el.style.maxInlineSize !== state.styles.maxInlineSize) el.style.maxInlineSize = state.styles.maxInlineSize;
  if (!state.hadStyle && !el.style.length) {
    const attribute = el.getAttributeNode("style");
    if (attribute) el.removeAttributeNode(attribute);
  }
}
function ownsOutput(el, state) {
  return el.innerHTML === state.markup && el.childNodes.length === state.outputNodes.length && state.outputNodes.every((node, i2) => el.childNodes[i2] === node) && (!state.rich || state.rich.nodes.every((node) => node === el || el.contains(node)));
}
function restore(element) {
  const state = states.get(element);
  if (!state) return;
  const restoreSelection = selectionBookmark(element);
  state.optical?.cleanup();
  state.tracking?.cleanup();
  state.spacing?.cleanup();
  if (state.rich) state.rich.cleanup();
  else if (ownsOutput(element, state) && !state.nodes.every((node, i2) => element.childNodes[i2] === node)) element.replaceChildren(...state.nodes);
  resetStyles(element, state);
  state.quotes?.restore();
  restoreSelection();
  states.delete(element);
  delete element.dataset.tsOutcome;
  delete element.dataset.typesetDone;
  delete element.dataset.tsQuotes;
  delete element.dataset.tsHanging;
  delete element.dataset.tsSpacing;
  delete element.dataset.tsTracking;
}
function makeMeasurer2(element) {
  const cs = getComputedStyle(element);
  const styleKey = JSON.stringify([
    fontVersion(element.ownerDocument),
    element.ownerDocument.fonts.status,
    cs.fontFamily,
    cs.fontSize,
    cs.fontWeight,
    cs.fontStyle,
    cs.fontStretch,
    cs.fontVariant,
    cs.fontFeatureSettings,
    cs.fontVariationSettings,
    cs.fontOpticalSizing,
    cs.fontKerning,
    cs.fontSizeAdjust,
    cs.letterSpacing,
    cs.wordSpacing,
    cs.textTransform,
    cs.textRendering,
    cs.direction
  ]);
  let fonts = measurements.get(element.ownerDocument);
  if (!fonts) {
    fonts = /* @__PURE__ */ new Map();
    measurements.set(element.ownerDocument, fonts);
  }
  let cache = fonts.get(styleKey);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    fonts.set(styleKey, cache);
  }
  fonts.delete(styleKey);
  fonts.set(styleKey, cache);
  if (fonts.size > 8) fonts.delete(fonts.keys().next().value);
  const widths = cache;
  const remember = (text, width) => {
    if (widths.size >= 4096) widths.delete(widths.keys().next().value);
    widths.set(text, width);
  };
  const probe = element.ownerDocument.createElement("span");
  probe.dataset.tsProbe = "1";
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;inset:auto;display:inline-block;width:max-content;max-width:none;min-width:0;visibility:hidden;pointer-events:none;white-space:pre;font:inherit;letter-spacing:inherit;word-spacing:inherit;text-transform:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-optical-sizing:inherit;";
  return {
    prepare(texts) {
      const pending = [...new Set(texts)].filter((t) => !widths.has(t));
      if (!pending.length) return;
      if (!probe.isConnected) element.appendChild(probe);
      const spans = pending.map((text) => {
        const span = element.ownerDocument.createElement("span");
        span.style.cssText = "display:block;width:max-content;white-space:pre;font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-optical-sizing:inherit;letter-spacing:inherit;word-spacing:inherit;text-transform:inherit;";
        span.textContent = text;
        return span;
      });
      probe.replaceChildren(...spans);
      spans.forEach((span, i2) => remember(pending[i2], span.getBoundingClientRect().width));
      probe.replaceChildren();
    },
    measure(text) {
      const prior = widths.get(text);
      if (prior !== void 0) return prior;
      if (!probe.isConnected) element.appendChild(probe);
      probe.textContent = text;
      const width = probe.getBoundingClientRect().width;
      remember(text, width);
      return width;
    },
    dispose() {
      probe.remove();
    }
  };
}
function render(element, source, lines) {
  const words = Array.from(source.matchAll(/[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/gu));
  let word2 = 0;
  let cursor = 0;
  const fragment = element.ownerDocument.createDocumentFragment();
  for (const line of lines) {
    const count = line.tokens.length;
    const first = words[word2];
    const last = words[word2 + count - 1];
    if (!first || !last) throw new Error("Token/source mismatch");
    const end = last.index + last[0].length;
    if (first.index > cursor) fragment.append(source.slice(cursor, first.index));
    const span = element.ownerDocument.createElement("span");
    span.className = "ts-line";
    span.dataset.tsGenerated = "1";
    span.style.display = "block";
    span.style.whiteSpace = "normal";
    span.style.font = "inherit";
    span.style.fontFeatureSettings = "inherit";
    span.style.fontVariationSettings = "inherit";
    span.style.fontOpticalSizing = "inherit";
    span.style.letterSpacing = "inherit";
    if (line.wordSpacingEm) span.style.wordSpacing = line.wordSpacingEm + "em";
    span.textContent = source.slice(first.index, end);
    fragment.append(span);
    cursor = end;
    word2 += count;
  }
  fragment.append(source.slice(cursor));
  element.replaceChildren(fragment);
}
function typeset(element, options = {}) {
  const started = performance.now();
  const mode = modeOf(element, options);
  if (element.closest("[data-typeset-react-rich]")) return { outcome: "skipped:framework", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  if (element.closest(excluded) || element.closest("[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line")) {
    return { outcome: "skipped:excluded", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: 0 };
  }
  const prior = states.get(element);
  const sig = signature(element, options);
  if (prior?.signature === sig && ownsOutput(element, prior)) return { ...prior.result, changed: false, durationMs: performance.now() - started };
  if (prior) {
    const restoreSelection = selectionBookmark(element);
    const unchanged = ownsOutput(element, prior);
    prior.optical?.cleanup();
    prior.tracking?.cleanup();
    prior.spacing?.cleanup();
    resetStyles(element, prior);
    if (prior.rich) prior.rich.cleanup();
    else if (unchanged && !prior.nodes.every((node, i2) => element.childNodes[i2] === node)) element.replaceChildren(...prior.nodes);
    else if (element.querySelector("[data-ts-generated]")) {
      for (const node of prior.outputNodes) {
        if (node instanceof HTMLElement && node.parentNode === element && node.hasAttribute("data-ts-generated")) {
          node.replaceWith(...node.childNodes);
        }
      }
    }
    prior.quotes?.restore();
    restoreSelection();
  }
  if (options.text !== void 0 && element.textContent !== options.text) element.textContent = options.text;
  const rawMarkup = element.innerHTML;
  const restoreQuoteSelection = selectionBookmark(element);
  const quotes = options.smartQuotes === "en" ? applySmartQuotes(element) : void 0;
  restoreQuoteSelection();
  const source = element.textContent || "";
  const originalMarkup = element.innerHTML;
  const nodes = Array.from(element.childNodes);
  const hadStyle = element.hasAttribute("style");
  const styles = { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize };
  const before = measureLayout(element);
  let rich;
  let search;
  const finish = (outcome, constraint) => {
    let optical;
    let spacing;
    let tracking;
    let targets;
    const features = {
      quotes: quotes?.outcome || "off",
      hanging: options.opticalHanging ? "native:hanging-uncomposed" : "off",
      spacing: options.spacing === false ? "off" : mode !== "body" ? "native:spacing-mode" : "native:spacing-uncomposed",
      tracking: options.tracking === false || options.spacing === false ? "off" : mode !== "body" ? "native:tracking-mode" : "native:tracking-uncomposed"
    };
    if (options.spacing !== false && mode === "body" && outcome === "composed:rich") {
      const plan = planSpacingFinish(element, measureLayout(element));
      targets = finishTargets(plan.before.lines.map((line) => line.width), plan.before.width);
      const fingerprint = richFingerprint(element);
      features.spacing = plan.outcome;
      if (plan.adjustments.length) {
        spacing = renderRichText(element, [], [], plan.adjustments);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !spacingVerified(element, plan, measureLayout(element))) {
          spacing.cleanup();
          spacing = void 0;
          features.spacing = "native:spacing-verification";
        }
      }
    } else if (options.spacing !== false && mode === "body" && outcome === "composed") {
      features.spacing = Array.from(element.querySelectorAll(".ts-line")).some((line) => parseFloat(line.style.wordSpacing)) ? "applied" : "unchanged";
    }
    if (targets && options.tracking !== false && ["applied", "unchanged"].includes(features.spacing)) {
      const plan = planTrackingFinish(element, measureLayout(element), targets);
      const fingerprint = richFingerprint(element);
      features.tracking = plan.outcome;
      if (plan.runs.length) {
        tracking = renderTracking(element, plan);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !trackingVerified(element, plan, measureLayout(element))) {
          tracking.cleanup();
          tracking = void 0;
          features.tracking = "native:tracking-verification";
        }
      }
    }
    if (options.opticalHanging && (outcome === "composed:rich" || outcome === "native:fits")) {
      const layout = measureLayout(element);
      const fingerprint = richFingerprint(element);
      const plan = planOpticalHanging(element, layout);
      features.hanging = plan.outcome;
      if (plan.hangs.length) {
        optical = renderRichText(element, [], plan.hangs);
        const after2 = measureLayout(element);
        if (!opticalVerified(element, layout, after2, plan.hangs) || richFingerprint(element) !== fingerprint) {
          optical.cleanup();
          optical = void 0;
          features.hanging = "native:hanging-verification";
        }
      }
    }
    element.dataset.tsOutcome = outcome;
    element.dataset.typesetDone = "1";
    element.dataset.tsQuotes = features.quotes;
    element.dataset.tsHanging = features.hanging;
    element.dataset.tsSpacing = features.spacing;
    element.dataset.tsTracking = features.tracking;
    const result = { outcome, mode, before, after: measureLayout(element), changed: element.innerHTML !== rawMarkup, durationMs: performance.now() - started, ...constraint && { constraint }, ...search && { search }, features };
    states.set(element, {
      nodes,
      outputNodes: Array.from(element.childNodes),
      source,
      output: element.textContent || "",
      markup: element.innerHTML,
      styles,
      appliedStyles: { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize },
      signature: signature(element, options),
      result,
      rich,
      hadStyle,
      quotes,
      optical,
      spacing,
      tracking
    });
    return result;
  };
  if (!source.trim()) return finish("native:empty");
  const cs = getComputedStyle(element);
  const lang = element.closest("[lang]")?.getAttribute("lang");
  if (options.lineBreaks !== "unicode" && (lang && !/^en(?:-|$)/i.test(lang) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return finish("native:language");
  if (!before.width || !before.lines.length) return finish("unmeasurable");
  if (cs.writingMode !== "horizontal-tb" || cs.direction !== "ltr") return finish("native:direction");
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (!preservesAdvances(style) || style.zoom && style.zoom !== "1" && style.zoom !== "normal") return finish("native:transformed");
  }
  for (const pseudo of ["::before", "::after"]) {
    const content = getComputedStyle(element, pseudo).content;
    if (content && content !== "none" && content !== "normal" && content !== '""') return finish("native:decorated");
  }
  if (cs.whiteSpace !== "normal" && cs.whiteSpace !== "pre-line") return finish("native:whitespace");
  if (cs.whiteSpace === "pre-line" && /[\r\n]/.test(source)) return finish("native:author-breaks");
  const clamp = parseInt(cs.getPropertyValue("-webkit-line-clamp"), 10);
  if (cs.overflow !== "visible" && cs.textOverflow === "ellipsis") return finish("native:clamped");
  if (cs.display === "inline") return finish("native:inline");
  if (options.lineBreaks === "unicode" || options.opticalHanging || options.smartQuotes || element.children.length || nodes.some((node) => node.nodeType !== Node.TEXT_NODE)) {
    const plan = planRichText(element, { ...options, mode }, before);
    search = plan.search;
    if (plan.outcome !== "composed:rich") return finish(plan.outcome, plan.constraint);
    rich = renderRichText(element, plan.breaks);
    const after2 = measureLayout(element);
    if (!richLayoutVerified(plan, after2) || element.textContent !== source || richFingerprint(element) !== plan.styleSignature || !before.lastSingleton && after2.lastSingleton && mode === "body") {
      rich.cleanup();
      rich = void 0;
      return finish("native:verification");
    }
    return finish("composed:rich");
  }
  if (before.lines.length === 1 && before.overflow <= 0.5) return finish("native:fits");
  if (mode === "ui") return finish("native:ui");
  if (source.length > 12e3 || source.trim().split(/\s+/u).length > 500) return finish("native:budget");
  const measure = makeMeasurer2(element);
  let lines = null;
  try {
    const parts = source.trim().split(/[^\S\u00a0\u202f]+/u);
    const measurements2 = ["0", " ", ...parts];
    if ((mode === "title" || mode === "heading") && parts.length <= 64) {
      for (let i2 = 0; i2 < parts.length; i2++) {
        for (let j2 = i2 + 1; j2 <= parts.length; j2++) measurements2.push(parts.slice(i2, j2).join(" "));
      }
    }
    measure.prepare(measurements2);
    const tokens = tokenize(source, measure.measure);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const ch = before.width / Math.max(1, measure.measure("0"));
    if (mode === "title" || mode === "heading") {
      lines = composeTitle(tokens, before.width, measure.measure, { ...options, maxLines: options.maxLines || (clamp > 0 ? clamp : void 0) });
    } else {
      const maxLines = options.maxLines || before.lines.length + (before.lastSingleton || options.density === "editorial" ? 1 : 0);
      const tail = parts.slice(-2).join(" ");
      const unavoidableOrphan = before.lastSingleton && measure.measure(tail) > before.width;
      const composed = composeParagraph(tokens, before.width, ch, { maxLines, candidateBar: 1, allowOrphan: unavoidableOrphan });
      const spaceEm = measure.measure(" ") / fontSize;
      lines = composed && (options.spacing === false ? composed : shapeExactLines(composed, ch, before.width, false, spaceEm, fontSize));
      if (lines && !finalValidate(lines, ch, false, spaceEm, unavoidableOrphan)) lines = null;
    }
  } finally {
    measure.dispose();
  }
  if (!lines) return finish(clamp > 0 ? "native:clamped" : "native:no-candidate");
  if (options.maxLines && lines.length > options.maxLines) return finish("native:line-budget");
  const bodyAllowance = mode === "body" && (before.lastSingleton || options.density === "editorial") ? 1 : 0;
  if (lines.length > before.lines.length + bodyAllowance) return finish("native:line-budget");
  try {
    render(element, source, lines);
  } catch {
    element.replaceChildren(...nodes);
    return finish("native:render-failed");
  }
  if (cs.display === "inline-block") element.style.inlineSize = cs.boxSizing === "border-box" ? before.width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + "px" : before.width + "px";
  if (cs.display === "inline-block" && cs.maxInlineSize === "none") element.style.maxInlineSize = "100%";
  const after = measureLayout(element);
  if (after.overflow > 0.5 || element.textContent !== source || after.lines.length !== lines.length || clamp > 0 && after.lines.length > clamp) {
    element.replaceChildren(...nodes);
    element.style.inlineSize = styles.inlineSize;
    element.style.maxInlineSize = styles.maxInlineSize;
    return finish("native:verification");
  }
  if (!before.lastSingleton && after.lastSingleton && mode === "body") {
    element.replaceChildren(...nodes);
    element.style.inlineSize = styles.inlineSize;
    element.style.maxInlineSize = styles.maxInlineSize;
    return finish("native:quality");
  }
  return finish("composed");
}
function typesetAll(selector = defaults, options = {}) {
  return Array.from(document.querySelectorAll(selector), (el) => typeset(el, options));
}
function auditReport(selector = defaults) {
  const report = { examined: 0, outcomes: {}, features: { quotes: {}, hanging: {}, spacing: {}, tracking: {} }, issues: [] };
  for (const element of document.querySelectorAll(selector)) {
    if (element.closest("[data-ts-generated], [data-ts-probe]")) continue;
    report.examined++;
    const outcome = element.dataset.tsOutcome || (element.closest(excluded) ? "excluded" : "unprocessed");
    report.outcomes[outcome] = (report.outcomes[outcome] || 0) + 1;
    for (const [feature, value] of [["quotes", element.dataset.tsQuotes], ["hanging", element.dataset.tsHanging], ["spacing", element.dataset.tsSpacing], ["tracking", element.dataset.tsTracking]]) {
      const status = value || "off";
      report.features[feature][status] = (report.features[feature][status] || 0) + 1;
    }
    const layout = measureLayout(element);
    const add = (type, severity, detail) => report.issues.push({ element, type, severity, detail });
    if (layout.overflow > 0.75) add("overflow", "error", layout.overflow.toFixed(2) + "px outside content box");
    if (element.querySelector(".ts-line .ts-line")) add("nested-output", "error", "Generated lines contain generated lines");
    if (layout.lastSingleton) add("orphan", "review", "One word on the final line; may be unavoidable");
    if (layout.firstSingleton) add("first-singleton", "review", "One word on the first line; may be unavoidable");
    for (const [index, line] of layout.lines.slice(0, -1).entries()) {
      const word2 = line.text.trim().split(/\s+/u).at(-1) || "";
      const language = languageOf(element.closest("[lang]")?.getAttribute("lang"));
      if (language === "und" ? isWeakEnding(word2) : language !== "invalid" && languageWeakEnding(word2, language)) add("weak-line-end", "review", "Line " + (index + 1) + ' ends on "' + word2 + '"');
      if (["en", "und"].includes(language) && strandedOpener(line.text)) add("stranded-opener", "review", "Line " + (index + 1) + " leaves a sentence or clause opener at its end");
    }
    const state = states.get(element);
    if (state && state.output !== element.textContent) add("stale-output", "error", "Content changed since the last composition");
    if (outcome === "native:no-candidate") {
      const constraint = state?.output === element.textContent ? state.result.constraint : void 0;
      const detail = constraint?.kind === "unbreakable-run" ? "A run needs " + constraint.requiredWidth.toFixed(3) + "px in " + constraint.availableWidth.toFixed(3) + "px with the permitted breaks" : constraint?.kind === "line-budget" ? "At least " + constraint.minimumLines + " lines are required; the budget is " + constraint.maxLines : "No acceptable composition found; inspect permitted breaks, measurement, and search constraints";
      add("composition-constraint", "review", detail);
    }
    if (!layout.lines.length && (element.textContent || "").trim()) add("unmeasurable", "review", "No visible line boxes");
    if (outcome === "unprocessed") add("unprocessed", "review", "No engine decision recorded");
  }
  return report;
}
function audit(selector) {
  return auditReport(selector).issues;
}
function auditJSON(selector = defaults) {
  const report = auditReport(selector);
  const identify = (element) => {
    const path = [];
    for (let el = element; el; el = el.parentElement) {
      if (el.id) {
        path.unshift("#" + CSS.escape(el.id));
        break;
      }
      path.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + (Array.from(el.parentElement?.children || []).filter((sibling) => sibling.tagName === el.tagName).indexOf(el) + 1) + ")");
    }
    return path.join(" > ");
  };
  const errors = report.issues.filter((issue) => issue.severity === "error").length;
  const reviews = report.issues.filter((issue) => issue.severity === "review").length;
  const unprocessed = report.outcomes.unprocessed || 0;
  return {
    schemaVersion: 1,
    engineVersion: VERSION,
    examined: report.examined,
    pass: report.examined > 0 && errors === 0 && unprocessed === 0,
    errors,
    reviews,
    unprocessed,
    outcomes: report.outcomes,
    features: report.features,
    issues: report.issues.map(({ element, ...issue }) => ({ ...issue, target: identify(element) }))
  };
}
function mount(root = document, selector = defaults, options = {}) {
  const owned = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Set();
  const nearby = /* @__PURE__ */ new Set();
  let stopped = false;
  let fontsReady = false;
  let timer;
  let idle;
  const stats = { passes: 0, compositions: 0, maxBatchMs: 0 };
  let resolveReady = () => {
  };
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const select = (within = root) => {
    const scope = root instanceof HTMLElement && within instanceof Node && within.contains(root) ? root : within;
    const elements = Array.from(scope.querySelectorAll(selector));
    if (scope instanceof HTMLElement && scope.matches(selector)) elements.unshift(scope);
    return elements.filter((el) => (el === root || root.contains(el)) && !el.closest(excluded) && !el.closest("[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line"));
  };
  const viewport = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) nearby.add(el);
      else nearby.delete(el);
      viewport?.unobserve(el);
    }
  }, { rootMargin: "400px" });
  const discover = (within = root) => {
    for (const el of select(within)) {
      if (!pending.has(el)) viewport?.observe(el);
      pending.add(el);
    }
  };
  const schedule = () => {
    if (stopped || !fontsReady || timer !== void 0 || idle !== void 0 || !pending.size) return;
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(flush, { timeout: 200 });
    else timer = setTimeout(() => flush(), 16);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof HTMLElement ? record.target : record.target.parentElement;
      for (let el = target; el && (el === root || root.contains(el)); el = el.parentElement) {
        if (owned.has(el)) pending.add(el);
      }
      if (record.type === "attributes" && target) {
        discover(target);
        if (target.closest(excluded)) {
          for (const el of owned) if (target.contains(el)) pending.add(el);
        }
      }
      if (record.type === "childList") {
        for (const node of record.addedNodes) if (node instanceof HTMLElement) discover(node);
        if (target && !owned.has(target) && target.matches(selector) && !target.closest(excluded)) discover(target);
        for (const node of record.removedNodes) if (node instanceof Element && !root.contains(node)) for (const el of owned) {
          if (node.contains(el) && !root.contains(el)) {
            owned.delete(el);
            pending.delete(el);
            nearby.delete(el);
            viewport?.unobserve(el);
            unwatch(el);
          }
        }
      }
    }
    schedule();
  });
  const observedWidths = /* @__PURE__ */ new WeakMap();
  const watched = /* @__PURE__ */ new Map();
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
    for (const entry of entries) {
      const previous = observedWidths.get(entry.target);
      observedWidths.set(entry.target, entry.contentRect.width);
      if (previous !== void 0 && Math.abs(previous - entry.contentRect.width) <= 0.01) continue;
      for (const el of watched.get(entry.target) || []) pending.add(el);
    }
    if (pending.size) schedule();
  });
  const parents = /* @__PURE__ */ new Map();
  const watch = (el) => {
    parents.set(el, el.parentElement);
    for (const target of [el, el.parentElement]) {
      if (!target) continue;
      let dependents = watched.get(target);
      if (!dependents) {
        dependents = /* @__PURE__ */ new Set();
        watched.set(target, dependents);
        observedWidths.set(target, contentWidth(target));
        resize?.observe(target);
      }
      dependents.add(el);
    }
  };
  const unwatch = (el) => {
    if (!parents.has(el)) return;
    for (const target of [el, parents.get(el)]) {
      if (!target) continue;
      const dependents = watched.get(target);
      dependents?.delete(el);
      if (!dependents?.size) {
        resize?.unobserve(target);
        watched.delete(target);
      }
    }
    parents.delete(el);
  };
  function observe() {
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "lang", "data-no-typeset", "data-typeset", "data-typeset-mode"] });
    if (root instanceof HTMLElement) for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ["class", "style", "lang"] });
    }
  }
  function flush(deadline) {
    timer = void 0;
    idle = void 0;
    if (stopped) return;
    observer.disconnect();
    const start = performance.now();
    stats.passes++;
    function* work() {
      for (const el of nearby) if (pending.has(el)) yield el;
      yield* pending;
    }
    for (const el of work()) {
      pending.delete(el);
      nearby.delete(el);
      viewport?.unobserve(el);
      if (!(root === el || root.contains(el))) {
        owned.delete(el);
        nearby.delete(el);
        viewport?.unobserve(el);
        unwatch(el);
        continue;
      }
      if (el.closest(excluded)) {
        restore(el);
        owned.delete(el);
        nearby.delete(el);
        viewport?.unobserve(el);
        unwatch(el);
        continue;
      }
      if (owned.has(el) && parents.get(el) !== el.parentElement) {
        unwatch(el);
        watch(el);
      }
      const result = typeset(el, options);
      if (result.changed) stats.compositions++;
      if (!owned.has(el)) {
        owned.add(el);
        watch(el);
      }
      if (performance.now() - start >= 8 || deadline && deadline.timeRemaining() <= 1) break;
    }
    stats.maxBatchMs = Math.max(stats.maxBatchMs, performance.now() - start);
    observe();
    if (pending.size) schedule();
    else resolveReady();
  }
  const refresh = () => {
    if (stopped) return;
    discover();
    schedule();
  };
  const resized = () => {
    for (const el of owned) pending.add(el);
    schedule();
  };
  const fontsChanged = () => {
    for (const el of owned) {
      const state = states.get(el);
      if (state) state.signature = "";
    }
    refresh();
  };
  document.fonts.ready.then(() => {
    if (stopped) {
      resolveReady();
      return;
    }
    fontsReady = true;
    discover();
    schedule();
    if (!pending.size) resolveReady();
  });
  observe();
  document.fonts.addEventListener("loadingdone", fontsChanged);
  window.addEventListener("resize", resized);
  return {
    ready,
    refresh,
    stats,
    disconnect(restoreContent = true) {
      stopped = true;
      if (timer !== void 0) clearTimeout(timer);
      if (idle !== void 0) window.cancelIdleCallback(idle);
      observer.disconnect();
      resize?.disconnect();
      viewport?.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsChanged);
      window.removeEventListener("resize", resized);
      if (restoreContent) for (const el of owned) restore(el);
      owned.clear();
      pending.clear();
      nearby.clear();
      watched.clear();
      parents.clear();
      resolveReady();
    }
  };
}

export {
  safeWrite,
  shouldIgnoreMutation,
  tokenize,
  composeParagraph,
  shapeExactLines,
  finalValidate,
  renderFrozenLines,
  typesetText,
  typesetHeading,
  measureCh,
  linesOverflow,
  linesStarved,
  contentWidth,
  measureLayout,
  finishTargets,
  planSpacingFinish,
  spacingMarkerStyle,
  spacingVerified,
  UNICODE_VERSION,
  analyzeBreaks,
  planOpticalHanging,
  opticalMarkerStyle,
  opticalVerified,
  BREAK_ATTRIBUTE,
  richLayoutVerified,
  selectionBookmark,
  planRichText,
  preserveRichCopy,
  richFingerprint,
  smartQuotes,
  TRACK_ATTRIBUTE,
  planTrackingFinish,
  trackingStyle,
  trackingVerified,
  VERSION,
  restore,
  typeset,
  typesetAll,
  auditReport,
  audit,
  auditJSON,
  mount
};
//# sourceMappingURL=shared-N574AA77.js.map
