// src/lib/v4/phrase-boundaries.ts
var determiners = /* @__PURE__ */ new Set(["a", "an", "the", "my", "your", "our", "their", "his", "her", "its"]);
var stops = /* @__PURE__ */ new Set(["a", "an", "the", "this", "that", "these", "those", "and", "or", "but", "nor", "so", "yet", "if", "as", "than", "of", "to", "in", "on", "at", "by", "for", "with", "from", "after", "before", "through", "into", "over", "under", "between", "without", "about", "around", "is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "can", "could", "will", "would", "should", "may", "might", "must", "which", "who", "how", "we", "you", "they", "it"]);
var modifiers = /* @__PURE__ */ new Set(["new", "old", "first", "last", "next", "previous", "second", "third", "small", "large", "little", "long", "short", "different", "same", "other", "final", "whole", "single"]);
var nameHeads = /* @__PURE__ */ new Set([
  "street",
  "avenue",
  "boulevard",
  "road",
  "lane",
  "drive",
  "court",
  "square",
  "parkway",
  "terrace",
  "cinema",
  "cinemas",
  "theater",
  "theaters",
  "theatre",
  "theatres",
  "gallery",
  "galleries",
  "museum",
  "library",
  "university",
  "college",
  "hospital",
  "hotel"
]);
var capitalized = (text) => /^[('"\u2018\u201c]*\p{Lu}[\p{L}'\u2019-]*[.,;:!?!)"'\u201d\u2019]*$/u.test(text);
var stripEnd = (text, chars) => {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return end === text.length ? text : text.slice(0, end);
};
var word = (text) => stripEnd(text.toLowerCase().replace(/^[("'“‘]+/u, ""), `.,;:!?)"'\u201D\u2019`);
var ends = (text) => /[.,;:!?)]["'”’]*$/u.test(text);
var sentenceSegmenter;
var sentences = () => sentenceSegmenter ??= new Intl.Segmenter("en", { granularity: "sentence" });
var abbreviations = /* @__PURE__ */ new Set([
  "Mr",
  "Mrs",
  "Ms",
  "Mx",
  "Dr",
  "Prof",
  "Rev",
  "St",
  "Mt",
  "Jr",
  "Sr",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "E.g",
  "I.e",
  "a.m",
  "p.m",
  "p",
  "pp",
  "Fig",
  "fig",
  "No",
  "Vol",
  "Ch",
  "Inc",
  "Ltd",
  "Co"
]);
var honorifics = /* @__PURE__ */ new Set(["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof", "Rev"]);
var abbreviatedLabels = /* @__PURE__ */ new Set(["Fig", "fig", "p", "pp", "No", "Vol", "Ch"]);
var labelWords = /* @__PURE__ */ new Set([
  "table",
  "figure",
  "chapter",
  "section",
  "page",
  "part",
  "step",
  "room",
  "level",
  "grade",
  "stage",
  "phase",
  "type",
  "class",
  "category",
  "tier",
  "zone",
  "appendix",
  "exhibit",
  "schedule",
  "version"
]);
var designatorHeads = /* @__PURE__ */ new Set([
  "type",
  "grade",
  "class",
  "size",
  "plan",
  "part",
  "vitamin",
  "hepatitis",
  "blood",
  "group",
  "section",
  "model",
  "exhibit",
  "appendix",
  "schedule",
  "title",
  "category",
  "level",
  "phase",
  "stage",
  "tier",
  "zone",
  "option",
  "list",
  "team"
]);
var romanHeads = /* @__PURE__ */ new Set([
  "war",
  "part",
  "title",
  "phase",
  "stage",
  "type",
  "class",
  "grade",
  "level",
  "tier",
  "chapter",
  "book",
  "act",
  "volume",
  "section",
  "schedule",
  "appendix",
  "bowl"
]);
var regnalTitles = /* @__PURE__ */ new Set([
  "king",
  "queen",
  "pope",
  "emperor",
  "empress",
  "tsar",
  "czar",
  "tsarina",
  "pharaoh",
  "kaiser",
  "prince",
  "princess",
  "duke",
  "sultan",
  "shah"
]);
var units = /* @__PURE__ */ new Set([
  "%",
  "\u2030",
  "\xB0",
  "\xB0C",
  "\xB0F",
  "K",
  "m",
  "km",
  "cm",
  "mm",
  "\xB5m",
  "\u03BCm",
  "nm",
  "g",
  "kg",
  "mg",
  "\xB5g",
  "\u03BCg",
  "mcg",
  "ng",
  "l",
  "L",
  "ml",
  "mL",
  "dl",
  "dL",
  "s",
  "ms",
  "min",
  "h",
  "hr",
  "hrs",
  "Hz",
  "kHz",
  "MHz",
  "GHz",
  "W",
  "kW",
  "MW",
  "kWh",
  "V",
  "mA",
  "J",
  "kJ",
  "cal",
  "kcal",
  "Pa",
  "kPa",
  "mmHg",
  "dB",
  "lb",
  "lbs",
  "oz",
  "ft",
  "yd",
  "mi",
  "mph",
  "km/h",
  "kph",
  "gal",
  "IU",
  "mol",
  "mmol",
  "bpm",
  "KB",
  "MB",
  "GB",
  "TB",
  "px",
  "pt",
  "a.m",
  "p.m",
  "am",
  "pm",
  "AM",
  "PM",
  "A.M",
  "P.M",
  "million",
  "billion",
  "trillion",
  "percent"
]);
var leading = (text) => text.replace(/^[("'\u201C\u2018[{]+/u, "");
var outer = (text) => stripEnd(leading(text), `"'\u201D\u2019)]}`);
var openingMarks = `("'\u201C\u2018[{`;
var closingMarks = `.,;:!?"'\u201D\u2019)]}\u2013\u2014`;
var trailing = (text) => stripEnd(text, closingMarks);
function isAbbreviation(text) {
  const core = outer(text);
  if (!core.endsWith(".")) return false;
  const stem = core.slice(0, -1);
  return abbreviations.has(stem) || /^(?:\p{Lu}\.){2,}$/u.test(core) || /^\p{Lu}$/u.test(stem) && stem !== "I" && stem !== "A";
}
var proseBoundary = (text) => /[.!?:]["'\u201D\u2019)\]]*$/u.test(text) && !isAbbreviation(text);
var openers = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "he",
  "she",
  "we",
  "they",
  "you",
  "i",
  "his",
  "her",
  "our",
  "their",
  "your",
  "my",
  "there",
  "here",
  "then",
  "now",
  "today",
  "in",
  "on",
  "at",
  "for",
  "as",
  "by",
  "with",
  "from",
  "but",
  "and",
  "or",
  "so",
  "yet",
  "if",
  "when",
  "while",
  "after",
  "before",
  "once",
  "since",
  "because",
  "although",
  "though",
  "what",
  "why",
  "how",
  "where",
  "who",
  "which",
  "most",
  "many",
  "more",
  "some",
  "all",
  "both",
  "each",
  "every",
  "one",
  "no",
  "nobody",
  "none",
  "everyone",
  "everything",
  "nothing",
  "someone",
  "something",
  "anyone",
  "also",
  "even",
  "only",
  "still",
  "please",
  "ask",
  "call",
  "take",
  "talk",
  "bring",
  "keep",
  "try",
  "do",
  "don't",
  "don\u2019t",
  "it's",
  "it\u2019s"
]);
var timeContext = /* @__PURE__ */ new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "mon",
  "tue",
  "tues",
  "wed",
  "thu",
  "thur",
  "thurs",
  "fri",
  "sat",
  "sun",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "jan",
  "feb",
  "mar",
  "apr",
  "jun",
  "jul",
  "aug",
  "sep",
  "sept",
  "oct",
  "nov",
  "dec",
  "et",
  "est",
  "edt",
  "ct",
  "cst",
  "cdt",
  "mt",
  "mst",
  "mdt",
  "pt",
  "pst",
  "pdt",
  "akst",
  "akdt",
  "hst",
  "gmt",
  "utc",
  "bst",
  "cet",
  "cest",
  "eastern",
  "central",
  "mountain",
  "pacific",
  "local",
  "daylight",
  "standard",
  "time"
]);
function boundaryBefore(text, next) {
  if (proseBoundary(text)) return true;
  const stem = outer(text).slice(0, -1);
  if (next === void 0 || !isAbbreviation(text) || honorifics.has(stem)) return false;
  const opener = stripEnd(outer(next), ".,;:!?");
  if (!/^\p{Lu}/u.test(opener)) return false;
  if (stem === "etc") return true;
  if (/^[ap]\.m$/iu.test(stem)) return !timeContext.has(opener.toLowerCase());
  if (stem === "No") return !/^[IVXLC]+$/u.test(opener);
  return openers.has(opener.toLowerCase());
}
function boundPair(previous, next, before) {
  const tail = trailing(next);
  if (/^[$€£¥]?\d[\d,.]*(?:[–-]\d[\d,.]*)?$/u.test(previous) && units.has(tail)) return "unit";
  const head = outer(previous);
  if (head.endsWith(".") && honorifics.has(head.slice(0, -1)) && /^["'\u201C\u2018(]*\p{Lu}/u.test(next)) return "honorific";
  if ((head.endsWith(".") && abbreviatedLabels.has(head.slice(0, -1)) || labelWords.has(head.toLowerCase())) && /^(?:\d[\p{L}\d.,–-]*|[IVX]{2,})$/u.test(tail)) return "label";
  if (/^\p{L}+$/u.test(previous) && /^\p{Lu}$/u.test(tail)) {
    if (tail === "A") return designatorHeads.has(previous.toLowerCase()) ? "designator" : null;
    if (tail === "I") return /^\p{Lu}/u.test(previous) && (romanHeads.has(previous.toLowerCase()) || before !== void 0 && regnalTitles.has(outer(before).toLowerCase())) ? "designator" : null;
    return "designator";
  }
  if (/^[B-HJ-Z]$/u.test(previous) && before !== void 0 && stops.has(word(before)) && /^\p{Ll}/u.test(next)) return "designator";
  return null;
}
var joins = (code) => code === 45 || code === 8208 || code === 8211 || code === 8212 || code === 47;
function keptPhrases(texts, keep) {
  const normalize = (text) => text.toLowerCase().replace(/[\s\u00A0\u202F]+/gu, " ").trim();
  const list2 = Array.isArray(keep) ? keep.filter((phrase) => typeof phrase === "string") : [];
  const phrases = [...new Set(list2.map((phrase) => trailing(leading(normalize(phrase)))).filter((phrase) => phrase.includes(" ") || /[-\u2010\u2013\u2014/]./u.test(phrase)))];
  const found = [];
  if (!phrases.length) return found;
  const root = { next: /* @__PURE__ */ new Map(), phrase: false };
  for (const phrase of phrases) {
    let node = root;
    for (let i = 0; i < phrase.length; i++) {
      let child = node.next.get(phrase.charCodeAt(i));
      if (!child) node.next.set(phrase.charCodeAt(i), child = { next: /* @__PURE__ */ new Map(), phrase: false });
      node = child;
    }
    node.phrase = true;
  }
  const walk = (node, text, from, to) => {
    for (let i = from; node && i < to; i++) node = node.next.get(text.charCodeAt(i)) ?? null;
    return node;
  };
  const units2 = texts.map((text) => {
    const unit = normalize(text);
    let open = 0, close = unit.length;
    while (open < unit.length && openingMarks.includes(unit[open])) open++;
    while (close > 0 && closingMarks.includes(unit[close - 1])) close--;
    return { unit, open, close };
  });
  for (let start2 = 0; start2 < units2.length; start2++) {
    let opened = false, at = root, ahead = root, last = -1;
    for (let end = start2 + 1; end <= units2.length; end++) {
      const { unit, open, close } = units2[end - 1];
      if (end > start2 + 1 && !joins(last)) {
        opened = true;
        at = walk(walk(ahead, " ", 0, 1), unit, 0, close);
        ahead = walk(at, unit, close, unit.length);
        last = unit.length ? unit.charCodeAt(unit.length - 1) : 32;
      } else {
        let from = 0;
        if (!opened) {
          from = open;
          opened = open < unit.length;
        }
        if (close > from) {
          at = walk(ahead, unit, from, close);
          ahead = walk(at, unit, close, unit.length);
        } else ahead = walk(ahead, unit, from, unit.length);
        if (unit.length) last = unit.charCodeAt(unit.length - 1);
      }
      if (end - start2 > 1 && at?.phrase) found.push({ start: start2, end });
      if (!ahead && !at?.phrase) break;
    }
  }
  return found;
}
function strandedOpener(line) {
  const words = line.trim().split(/\s+/u);
  return words.length > 1 && boundaryBefore(words.at(-2), words.at(-1)) && /^["'\u201C\u2018(\[]*[A-Za-z][A-Za-z'\u2019-]*$/u.test(words.at(-1));
}
function retainSentenceLayout(source, before, chosenEnds) {
  if (before.overflow > 0.5 || before.lines.length < 2 || before.lines.some((l) => l.words < 2) || before.lines.some((l, i) => l.width / before.width < (i === before.lines.length - 1 ? 0.35 : 0.65))) return false;
  const boundaries = Array.from(sentences().segment(source), (s) => s.index + s.segment.trimEnd().length);
  if (boundaries.length < 2) return false;
  const lineEnds = new Set(before.lines.map((l) => l.sourceEnd));
  return boundaries.every((end) => lineEnds.has(end)) && boundaries.some((end) => !chosenEnds.includes(end));
}
function englishPhraseGroups(texts, width, measure2) {
  const words = texts.map(word);
  const lexical = (index) => /^[a-z]+(?:['’-][a-z]+)*$/u.test(words[index] || "") && !stops.has(words[index]);
  const modifier = (index) => modifiers.has(words[index]) || /(?:ed|ive|ous|ful|less)$/u.test(words[index] || "");
  const groups = [];
  for (let start2 = 0; start2 < words.length - 1; start2++) {
    if (lexical(start2) && !ends(texts[start2]) && capitalized(texts[start2]) && capitalized(texts[start2 + 1]) && nameHeads.has(words[start2 + 1]) && measure2(start2, start2 + 2) <= width) {
      groups.push({ start: start2, end: start2 + 2, kind: "name" });
    }
  }
  for (let start2 = 0; start2 < words.length - 1; start2++) {
    if (!determiners.has(words[start2]) || ends(texts[start2]) || !lexical(start2 + 1)) continue;
    let end = start2 + 2;
    if (!ends(texts[start2 + 1]) && modifier(start2 + 1) && lexical(start2 + 2)) end++;
    if (measure2(start2, end) <= width) groups.push({ start: start2, end, kind: "nominal" });
    if (start2 >= 2 && words[start2 - 2] === "to" && lexical(start2 - 1) && !ends(texts[start2 - 2]) && !ends(texts[start2 - 1]) && measure2(start2 - 2, end) <= width) {
      groups.push({ start: start2 - 2, end, kind: "infinitive" });
    }
  }
  return groups;
}
function phraseBreakCosts(texts, groups, title) {
  const costs = Array(texts.length + 1).fill(0);
  for (const group of groups) {
    if (group.kind === "name") costs[group.start + 1] = Math.max(costs[group.start + 1], title ? 1800 : 7e3);
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
  if (proseBoundary(word2)) return false;
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
  Object.entries(TOPONYM_CLOSED).map(([k, v]) => [k, new Set(v)])
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
var DEFAULT_BIND_WEIGHTS = { toponym: 1600, pair: 1 };
var KEEP_UNSPLIT = 1e6;
function bindWeights() {
  const o = true ? void 0 : void 0;
  return o ? { ...DEFAULT_BIND_WEIGHTS, ...o } : DEFAULT_BIND_WEIGHTS;
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
  const candidateBar = opts.candidateBar ?? profile.candidateBar;
  const prefixWidths = [0];
  for (const token of contentTokens) prefixWidths.push(prefixWidths[prefixWidths.length - 1] + token.width);
  const widthRows = [];
  const widthBetween = (start2, end) => {
    const row = widthRows[start2] ??= [];
    let width = row[end - start2];
    if (width === void 0) {
      width = opts.measureRange?.(start2, end) ?? prefixWidths[end] - prefixWidths[start2] + Math.max(0, end - start2 - 1) * spaceWidth;
      row[end - start2] = width;
    }
    return width;
  };
  const minRemaining = Array(contentTokens.length + 1).fill(Infinity);
  minRemaining[contentTokens.length] = 0;
  if (opts.maxLines) {
    for (let start2 = contentTokens.length - 1; start2 >= 0; start2--) {
      for (let end = start2 + 1; end <= contentTokens.length; end++) {
        if (widthBetween(start2, end) > measurePx * candidateBar) break;
        minRemaining[start2] = Math.min(minRemaining[start2], 1 + minRemaining[end]);
      }
    }
  }
  const isLexical = (t) => t.kind === "word" || t.kind === "compound" || t.kind === "longSlug";
  const count = contentTokens.length;
  const lexicalPrefix = new Int32Array(count + 1);
  const lastLexicalAt = new Int32Array(count);
  const lastBoundaryAt = new Int32Array(count);
  const linkingEnd = [];
  const weakLetter = [];
  const designator = [];
  const boundary = [];
  const openerLength = [];
  for (let i = 0; i < count; i++) {
    const t = contentTokens[i];
    const lexical = isLexical(t);
    lexicalPrefix[i + 1] = lexicalPrefix[i] + (lexical ? t.text.split(/\s+/u).filter(Boolean).length : 0);
    lastLexicalAt[i] = lexical ? i : i ? lastLexicalAt[i - 1] : -1;
    linkingEnd[i] = LINKING_END_WORDS.has(stripEnd(t.text.toLowerCase(), `.,;:!?\u2019'"\u201D`));
    boundary[i] = boundaryBefore(t.text, contentTokens[i + 1]?.text);
    lastBoundaryAt[i] = boundary[i] ? i : i ? lastBoundaryAt[i - 1] : -1;
    openerLength[i] = t.text.replace(/[^A-Za-z0-9]/g, "").length;
  }
  const english = opts.englishLexical !== false;
  const pairCost = english ? new Float64Array(count + 1) : null;
  const pairWeight = profile.weakEndPenalty * bindWeights().pair;
  for (let i = 0; i < count; i++) {
    const kind = english && i > 0 ? boundPair(contentTokens[i - 1].text, contentTokens[i].text, i > 1 ? contentTokens[i - 2].text : void 0) : null;
    if (kind && pairCost) pairCost[i] = pairWeight;
    designator[i] = kind === "designator";
    weakLetter[i] = contentTokens[i].text === "a" || (contentTokens[i].text === "A" || contentTokens[i].text === "I") && !designator[i];
  }
  const keepCost = opts.keep?.length ? new Float64Array(count + 1) : null;
  if (keepCost) {
    for (const { start: start2, end } of keptPhrases(contentTokens.map((t) => t.text), opts.keep)) {
      const cost = widthBetween(start2, end) <= measurePx ? KEEP_UNSPLIT : profile.weakEndPenalty;
      for (let at = start2 + 1; at < end; at++) keepCost[at] = Math.max(keepCost[at], cost);
    }
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
    const b = next.text.replace(BIND_FOLLOWER_TRIM, "").replace(/[’']s$/u, "");
    return partners.has(b) ? weight : 0;
  }
  const scoreRange = (start2, fill, isLast, breakEnd) => {
    let penalty = 0;
    const lastIndex = breakEnd - 1;
    const lexCount = lexicalPrefix[breakEnd] - lexicalPrefix[start2];
    const firstContent = contentTokens[start2];
    const lastContent = contentTokens[lastIndex];
    const lastLexicalIndex = lastLexicalAt[lastIndex] >= start2 ? lastLexicalAt[lastIndex] : -1;
    const lastLexical = lastLexicalIndex >= 0 ? contentTokens[lastLexicalIndex] : null;
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
    if (!isLast && lastLexical?.weakEnd && !designator[lastLexicalIndex]) {
      penalty += profile.weakEndPenalty;
    }
    if (opts.englishLexical !== false && !isLast && lastLexical && linkingEnd[lastLexicalIndex]) {
      penalty += profile.linkingEndPenalty;
    }
    if (opts.englishLexical !== false && !isLast && lastLexical && weakLetter[lastLexicalIndex]) {
      penalty += profile.weakEndPenalty * 1.5;
    }
    if (breaksProtectedCompoundAt(breakEnd)) {
      penalty += 7e3;
    }
    if (opts.englishLexical !== false && !isLast) {
      penalty += bindPenaltyAt(breakEnd);
    }
    if (!isLast && pairCost) penalty += pairCost[breakEnd];
    if (!isLast && keepCost) penalty += keepCost[breakEnd];
    if (opts.englishLexical !== false && !isLast && lastContent && !boundary[lastIndex]) {
      const lastBoundary = lastIndex > start2 ? lastBoundaryAt[lastIndex - 1] : -1;
      const wordsIntoSentence = lastBoundary >= start2 ? lastIndex - 1 - lastBoundary : -1;
      if (wordsIntoSentence === 0) {
        const openerLen = openerLength[lastIndex];
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
  const transition = (lines, currFill, prevFill, prevPrevFill, isLast) => {
    if (lines < 2 || isLast) return 0;
    let penalty = 0;
    const jump = Math.abs(currFill - prevFill);
    if (jump > 0.06) {
      penalty += Math.min(1800, 25e4 * (jump - 0.06) * (jump - 0.06));
    }
    if (lines >= 3) {
      const avg = (currFill + prevFill + prevPrevFill) / 3;
      if (avg > 0.9 && Math.abs(prevPrevFill - prevFill) < 0.04 && Math.abs(prevFill - currFill) < 0.04) {
        penalty += profile.flatShelfPenalty;
      }
    }
    return penalty;
  };
  const scoreTransition = (lines, isLast) => {
    const i = lines.length - 1;
    return transition(lines.length, lines[i]?.fill ?? 0, lines[i - 1]?.fill ?? 0, lines[i - 2]?.fill ?? 0, isLast);
  };
  const scoreRows = [];
  const lineScore = (start2, end) => {
    const row = scoreRows[start2] ??= [];
    let score = row[end - start2];
    if (score === void 0) {
      score = scoreRange(start2, widthBetween(start2, end) / measurePx, end === count, end);
      row[end - start2] = score;
    }
    return score;
  };
  const breakCosts = [];
  const breakCost = (end) => {
    let cost = breakCosts[end];
    if (cost === void 0) breakCosts[end] = cost = opts.breakPenalty?.(end) || 0;
    return cost;
  };
  const scoreLine = (lineTokens, fill, isLast, breakEnd) => scoreRange(breakEnd - lineTokens.length, fill, isLast, breakEnd);
  return {
    tokens: contentTokens,
    beamWidth: tokens.length > 120 ? 80 : 48,
    measurePx,
    candidateBar,
    minRemaining,
    options: opts,
    widthBetween,
    scoreLine,
    scoreTransition,
    lineScore,
    breakCost,
    transition
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
  const { tokens: contentTokens, candidateBar, minRemaining, widthBetween, lineScore, breakCost, transition } = problem;
  const { options: opts, measurePx, beamWidth: BEAM } = problem;
  const n = contentTokens.length;
  const linesOf = (node) => {
    const lines = [];
    for (let at = node; at?.lines; at = at.parent) {
      lines.push({ tokens: contentTokens.slice(at.start, at.tokenIndex), width: at.width, fill: at.fill });
    }
    return lines.reverse();
  };
  const transitionAfter = (node, fill, last) => transition(node.lines + 1, fill, node.fill, node.parent ? node.parent.fill : 0, last);
  const child = (node, end, width, fill, cost) => ({ tokenIndex: end, cost, lines: node.lines + 1, start: node.tokenIndex, width, fill, parent: node });
  const root = () => ({ tokenIndex: 0, cost: 0, lines: 0, start: 0, width: 0, fill: 0, parent: null });
  const byCost = (a, b) => a.cost - b.cost || a.lines - b.lines;
  const completes = [];
  let visited = 0;
  let completed = 0;
  const result = (method) => {
    completes.sort(byCost);
    const cheapest = completes[0];
    const slack = cheapest ? rankingSlack(cheapest.cost, cheapest.lines) : 0;
    const pool = cheapest ? completes.filter((s) => s.cost <= cheapest.cost + slack).map((s) => ({ tokenIndex: s.tokenIndex, lines: linesOf(s), cost: s.cost })) : [];
    const ranked = rankParagraphLayouts(pool, opts.contourWidths);
    return { method, visited, winner: ranked.winner, evidence: {
      method,
      completed,
      retained: completes.length,
      eligible: ranked.eligible,
      poolLimit: method === "beam" ? 200 : null,
      finished: !!opts.contourWidths,
      cheapestCost: cheapest?.cost ?? null,
      selectedCost: ranked.winner?.cost ?? null,
      contourScore: ranked.score
    } };
  };
  if (opts.maxLines && minRemaining[0] > opts.maxLines) return result("exact");
  if (n <= (limits.exactTokens ?? 18)) {
    const stack = [root()];
    while (stack.length && visited < (limits.exactStates ?? 4096)) {
      const state = stack.pop();
      visited++;
      if (state.tokenIndex === n) {
        completes.push(state);
        completed++;
        continue;
      }
      if (opts.maxLines && state.lines >= opts.maxLines) continue;
      for (let end = n; end > state.tokenIndex; end--) {
        const width = widthBetween(state.tokenIndex, end);
        const fill = width / measurePx;
        const last = end === n;
        if (fill > (state.tokenIndex === 0 && last ? 1 : candidateBar)) continue;
        if (opts.maxLines && state.lines + 1 + minRemaining[end] > opts.maxLines) continue;
        stack.push(child(state, end, width, fill, state.cost + lineScore(state.tokenIndex, end) + (last ? 0 : breakCost(end)) + transitionAfter(state, fill, last)));
      }
    }
    if (!stack.length) return result("exact");
  }
  completes.length = 0;
  completed = 0;
  let beam = [root()];
  let iterations = 0;
  const MAX_ITERATIONS = 500;
  while (beam.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const newBeam = [];
    for (const state of beam) {
      visited++;
      const start2 = state.tokenIndex;
      if (opts.maxLines && state.lines >= opts.maxLines) continue;
      for (let end = start2 + 1; end <= n; end++) {
        const width = widthBetween(start2, end);
        const fill = width / measurePx;
        const isLast = end === n;
        if (fill > (start2 === 0 && isLast ? 1 : candidateBar)) break;
        if (opts.maxLines && state.lines + 1 + minRemaining[end] > opts.maxLines) continue;
        const linePenalty = lineScore(start2, end) + (isLast ? 0 : breakCost(end));
        const transitionPenalty = transitionAfter(state, fill, isLast);
        (isLast ? completes : newBeam).push(child(state, end, width, fill, state.cost + linePenalty + transitionPenalty));
        if (isLast) completed++;
      }
    }
    newBeam.sort((a, b) => a.cost - b.cost);
    beam = newBeam.slice(0, BEAM);
    completes.sort(byCost);
    if (completes.length > 200) completes.length = 200;
  }
  return result("beam");
}
function paragraphContour(widths) {
  const fills = widths.slice(0, -1);
  if (fills.length < 2) return 0;
  const spread = Math.max(...fills) - Math.min(...fills);
  let step = 0;
  for (let i = 1; i < fills.length; i++) step = Math.max(step, Math.abs(fills[i] - fills[i - 1]));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const half = Math.ceil(fills.length / 2);
  const shift = fills.length >= 4 ? Math.abs(mean(fills.slice(0, half)) - mean(fills.slice(half))) : 0;
  return 2 * spread + 3 * step + 1.5 * shift;
}
function rankingSlack(cheapestCost, lines) {
  const isLong = lines >= 10;
  return Math.min(
    cheapestCost * (isLong ? 0.2 : 0.15) + (isLong ? 1200 : 600),
    3200
  );
}
function rankParagraphLayouts(completes, widths) {
  if (completes.length === 0) return { winner: null, eligible: 0, score: null };
  completes.sort((a, b) => a.cost - b.cost || a.lines.length - b.lines.length);
  let winner = completes[0];
  const slack = rankingSlack(winner.cost, winner.lines.length);
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
    const wordCount = line.tokens.reduce((count, token) => count + token.text.split(/\s+/u).filter(Boolean).length, 0);
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
  for (let i = 0; i < lines.length; i++) {
    const tokens = lines[i].tokens;
    const isLast = i === lines.length - 1;
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
    for (let j = tokens.length - 1; j >= 0; j--) {
      if (isContent(tokens[j])) {
        lastContent = tokens[j];
        break;
      }
    }
    if (lastContent && (lastContent.kind === "openPunct" || lastContent.stickyNext)) {
      return false;
    }
    if (lines[i].wordSpacingEm > expandBound || lines[i].wordSpacingEm < -contractBound) {
      return false;
    }
  }
  return true;
}
function renderFrozenLines(p, lines, runs) {
  const cs = getComputedStyle(p);
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const measurer = makeMeasurer(p);
  safeWrite(() => {
    p.replaceChildren();
    p.dataset.typesetDone = "1";
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
      if (runs) {
        renderRichLineInto(span, line, runs);
      } else {
        span.textContent = line.text;
      }
      if (i > 0) p.appendChild(document.createTextNode("\n"));
      p.appendChild(span);
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
  for (const g of groups) {
    if (g.runId === null) {
      span.appendChild(document.createTextNode(g.text));
      continue;
    }
    const run = runs[g.runId];
    let outer2 = null;
    let inner = null;
    for (const orig of run.chain) {
      const clone = orig.cloneNode(false);
      if (inner) inner.appendChild(clone);
      else outer2 = clone;
      inner = clone;
    }
    if (inner && outer2) {
      inner.textContent = g.text;
      span.appendChild(outer2);
    } else {
      span.appendChild(document.createTextNode(g.text));
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
  for (let i = 0; i < words.length; i++) {
    let word2 = words[i];
    if (word2.length <= 20 && word2.indexOf("-") > 0 && word2.indexOf("-") < word2.length - 1) {
      word2 = word2.replace(/-/g, NBHY);
      words[i] = word2;
    }
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    if (ARTICLES.has(word2.toLowerCase()) && nextWord) {
      result.push(word2 + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (PREPS.has(word2.toLowerCase()) && nextWord) {
      result.push(word2 + NBSP + words[i + 1]);
      i++;
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
function typesetBodyText(text, measure2) {
  if (!text || text.length < 10) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;
  void measure2;
  const result = [];
  for (let i = 0; i < words.length; i++) {
    let word2 = words[i];
    if (word2.length <= 20 && word2.indexOf("-") > 0 && word2.indexOf("-") < word2.length - 1) {
      word2 = word2.replace(/-/g, NBHY);
      words[i] = word2;
    }
    const nextWord = i < words.length - 1 ? words[i + 1] : null;
    if (nextWord && /^[\(\[\{\u201C\u2018]$/.test(word2)) {
      result.push(word2 + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (result.length > 0 && /^[\)\]\}\.,;:!?\u201D\u2019%]/.test(word2)) {
      const last = result.pop();
      result.push(last + NBSP + word2);
      continue;
    }
    if (nextWord && /^[\$£€¥]$/.test(word2)) {
      result.push(word2 + NBSP + words[i + 1]);
      i++;
      continue;
    }
    if (nextWord) {
      const lc = word2.toLowerCase();
      if (lc === "a" || lc === "i") {
        result.push(word2 + NBSP + words[i + 1]);
        i++;
        continue;
      }
    }
    if (nextWord) {
      const lc = word2.toLowerCase().replace(/[.,;:!?]+$/, "");
      const nextIsPunctOnly = /^[\)\]\}\.,;:!?\u201D\u2019%]+$/.test(nextWord);
      if (!nextIsPunctOnly && PHASE1_BIND_END_WORDS.has(lc)) {
        result.push(word2 + NBSP + words[i + 1]);
        i++;
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
  for (let i = 0; i < spans.length - 1; i++) {
    const r = document.createRange();
    r.selectNodeContents(spans[i]);
    fills.push((r.getBoundingClientRect().right - left) / width);
  }
  fills.sort((a, b) => a - b);
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
var graphemeSegmenter;
var graphemes = () => graphemeSegmenter ??= new Intl.Segmenter(void 0, { granularity: "grapheme" });
function contentWidth(element) {
  const cs = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0"));
}
function linesExtent(element, lines) {
  if (!lines.length) return 0;
  const cs = getComputedStyle(element);
  const left = element.getBoundingClientRect().left + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.paddingLeft || "0");
  return Math.max(0, ...lines.map((line) => line.right - Math.max(line.left, left)));
}
function measureLayout(element) {
  return measure(element, false);
}
function measureForAudit(element) {
  return measure(element, true);
}
function measure(element, authorIndent) {
  const cs = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const width = Math.max(0, box.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0"));
  const left = box.left + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.paddingLeft || "0");
  const right = left + width;
  const indent = authorIndent && cs.direction !== "rtl" ? Math.min(0, cs.textIndent.endsWith("%") ? parseFloat(cs.textIndent) / 100 * width : parseFloat(cs.textIndent) || 0) : 0;
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
    const start2 = source.search(/\S/u), end = source.trimEnd().length;
    range.setStart(element.firstChild, start2);
    range.setEnd(element.firstChild, end);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 1) {
      const rect = rects[0], text = source.slice(start2, end).replace(/\s+/gu, " ");
      return {
        width,
        lines: [{
          text,
          sourceStart: start2,
          sourceEnd: end,
          words: text.split(" ").length,
          width: rect.width,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        }],
        overflow: Math.max(0, rect.right - right, left + indent - rect.left),
        firstSingleton: false,
        lastSingleton: false,
        rag: 0
      };
    }
  }
  let node;
  while (node = walker.nextNode()) {
    const nodeOffset = sourceOffset;
    sourceOffset += node.textContent?.length || 0;
    if (node.parentElement?.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
    for (const match of (node.textContent || "").matchAll(/\S+/gu)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.height > 0 && r.width > 0);
      const fragments = rects.length < 2 ? rects.map((rect) => ({ text: match[0], rect })) : [];
      if (rects.length > 1) {
        for (const part of graphemes().segment(match[0])) {
          range.setStart(node, match.index + part.index);
          range.setEnd(node, match.index + part.index + part.segment.length);
          const rect = Array.from(range.getClientRects()).find((r) => r.width > 0 && r.height > 0);
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
  lines.sort((a, b) => a.top - b.top);
  const fills = lines.map((l) => width > 0 ? l.width / width : 0);
  const hangs = Array.from(element.querySelectorAll(":scope > .ts-line")).map((el) => Math.min(0, parseFloat(getComputedStyle(el).textIndent) || 0));
  const optical = new Map(Array.from(element.querySelectorAll("[data-ts-break][data-ts-hang]")).filter((el) => getComputedStyle(el).display !== "none").map((el) => [Number(el.dataset.tsHang), Math.min(0, parseFloat(getComputedStyle(el).marginLeft) || 0)]));
  const mean = fills.reduce((a, b) => a + b, 0) / Math.max(1, fills.length);
  return {
    lines,
    width,
    // Old Typeset intentionally hangs punctuation/capitals into the margin.
    // Do not mislabel its documented optical indent as an A/B overflow win.
    overflow: Math.max(0, ...lines.flatMap((l, i) => [l.right - right, left + (hangs[i] || optical.get(l.sourceStart) || 0) + (i ? 0 : indent) - l.left])),
    firstSingleton: lines.length > 1 && lines[0].words === 1,
    lastSingleton: lines.length > 1 && lines[lines.length - 1].words === 1,
    rag: fills.reduce((sum, f) => sum + (f - mean) ** 2, 0) / Math.max(1, fills.length)
  };
}

// src/vendor/unicode-linebreak.js
var loaded;
function load() {
  if (loaded) return loaded;
  var v = Uint8Array, U = Uint16Array, Te = Int32Array, kr = new v([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]), _r = new v([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]), Be = new v([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), $r = function(r, e) {
    for (var n = new U(31), t = 0; t < 31; ++t) n[t] = e += 1 << r[t - 1];
    for (var s = new Te(n[30]), t = 1; t < 30; ++t) for (var c = n[t]; c < n[t + 1]; ++c) s[c] = c - n[t] << 5 | t;
    return { b: n, r: s };
  }, re = $r(kr, 2), ee = re.b, ze = re.r;
  ee[28] = 258, ze[258] = 28;
  var ne = $r(_r, 0), Se = ne.b, ht = ne.r, Ir = new U(32768);
  for (u = 0; u < 32768; ++u) B = (u & 43690) >> 1 | (u & 21845) << 1, B = (B & 52428) >> 2 | (B & 13107) << 2, B = (B & 61680) >> 4 | (B & 3855) << 4, Ir[u] = ((B & 65280) >> 8 | (B & 255) << 8) >> 1;
  var B, u, $ = (function(r, e, n) {
    for (var t = r.length, s = 0, c = new U(e); s < t; ++s) r[s] && ++c[r[s] - 1];
    var l = new U(e);
    for (s = 1; s < e; ++s) l[s] = l[s - 1] + c[s - 1] << 1;
    var y;
    if (n) {
      y = new U(1 << e);
      var M = 15 - e;
      for (s = 0; s < t; ++s) if (r[s]) for (var Y = s << 4 | r[s], S = e - r[s], f = l[r[s] - 1]++ << S, a = f | (1 << S) - 1; f <= a; ++f) y[Ir[f] >> M] = Y;
    } else for (y = new U(t), s = 0; s < t; ++s) r[s] && (y[s] = Ir[l[r[s] - 1]++] >> 15 - r[s]);
    return y;
  }), rr = new v(288);
  for (u = 0; u < 144; ++u) rr[u] = 8;
  var u;
  for (u = 144; u < 256; ++u) rr[u] = 9;
  var u;
  for (u = 256; u < 280; ++u) rr[u] = 7;
  var u;
  for (u = 280; u < 288; ++u) rr[u] = 8;
  var u, te = new v(32);
  for (u = 0; u < 32; ++u) te[u] = 5;
  var u;
  var Pe = $(rr, 9, 1);
  var De = $(te, 5, 1), Pr = function(r) {
    for (var e = r[0], n = 1; n < r.length; ++n) r[n] > e && (e = r[n]);
    return e;
  }, m = function(r, e, n) {
    var t = e / 8 | 0;
    return (r[t] | r[t + 1] << 8) >> (e & 7) & n;
  }, Dr = function(r, e) {
    var n = e / 8 | 0;
    return (r[n] | r[n + 1] << 8 | r[n + 2] << 16) >> (e & 7);
  }, Ie = function(r) {
    return (r + 7) / 8 | 0;
  }, Ne = function(r, e, n) {
    return (e == null || e < 0) && (e = 0), (n == null || n > r.length) && (n = r.length), new v(r.subarray(e, n));
  };
  var Ee = ["unexpected EOF", "invalid block type", "invalid length/literal", "invalid distance", "stream finished", "no stream handler", , "no callback", "invalid UTF-8 data", "extra field too long", "date not in range 1980-2099", "filename too long", "stream finishing", "invalid zip data"], A = function(r, e, n) {
    var t = new Error(e || Ee[r]);
    if (t.code = r, Error.captureStackTrace && Error.captureStackTrace(t, A), !n) throw t;
    return t;
  }, Fe = function(r, e, n, t) {
    var s = r.length, c = t ? t.length : 0;
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
        S = m(r, f, 1);
        var mr = m(r, f + 1, 3);
        if (f += 3, mr) if (mr == 1) N = Pe, ur = De, W = 9, Q = 5;
        else if (mr == 2) {
          var dr = m(r, f, 31) + 257, Vr = m(r, f + 10, 15) + 4, Gr = dr + m(r, f + 5, 31) + 1;
          f += 14;
          for (var k = new v(Gr), Tr = new v(19), x = 0; x < Vr; ++x) Tr[Be[x]] = m(r, f + x * 3, 7);
          f += Vr * 3;
          for (var jr = Pr(Tr), ye = (1 << jr) - 1, me = $(Tr, jr, 1), x = 0; x < Gr; ) {
            var qr = me[m(r, f, ye)];
            f += qr & 15;
            var d = qr >> 4;
            if (d < 16) k[x++] = d;
            else {
              var C = 0, ar = 0;
              for (d == 16 ? (ar = 3 + m(r, f, 3), f += 2, C = k[x - 1]) : d == 17 ? (ar = 3 + m(r, f, 7), f += 3) : d == 18 && (ar = 11 + m(r, f, 127), f += 7); ar--; ) k[x++] = C;
            }
          }
          var Kr = k.subarray(0, dr), P = k.subarray(dr);
          W = Pr(Kr), Q = Pr(P), N = $(Kr, W, 1), ur = $(P, Q, 1);
        } else A(1);
        else {
          var d = Ie(f) + 4, Ar = r[d - 4] | r[d - 3] << 8, Lr = d + Ar;
          if (Lr > s) {
            M && A(0);
            break;
          }
          y && Y(a + Ar), n.set(r.subarray(d, Lr), a), e.b = a += Ar, e.p = f = Lr * 8, e.f = S;
          continue;
        }
        if (f > yr) {
          M && A(0);
          break;
        }
      }
      y && Y(a + 131072);
      for (var Ae = (1 << W) - 1, Le = (1 << Q) - 1, Br = f; ; Br = f) {
        var C = N[Dr(r, f) & Ae], O = C >> 4;
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
            Zr = m(r, f, (1 << _) - 1) + ee[x], f += _;
          }
          var zr = ur[Dr(r, f) & Le], Sr = zr >> 4;
          zr || A(3), f += zr & 15;
          var P = Se[Sr];
          if (Sr > 3) {
            var _ = _r[Sr];
            P += Dr(r, f) & (1 << _) - 1, f += _;
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
  var Me = function(r) {
    (r[0] != 31 || r[1] != 139 || r[2] != 8) && A(6, "invalid gzip data");
    var e = r[3], n = 10;
    e & 4 && (n += (r[10] | r[11] << 8) + 2);
    for (var t = (e >> 3 & 1) + (e >> 4 & 1); t > 0; t -= !r[n++]) ;
    return n + (e & 2);
  }, Ce = function(r) {
    var e = r.length;
    return (r[e - 4] | r[e - 3] << 8 | r[e - 2] << 16 | r[e - 1] << 24) >>> 0;
  };
  function Nr(r, e) {
    var n = Me(r);
    return n + 8 > r.length && A(6, "invalid gzip data"), Fe(r.subarray(n, -8), { i: 2 }, e && e.out || new v(Ce(r)), e && e.dictionary);
  }
  var Oe = typeof TextDecoder < "u" && new TextDecoder(), Ue = 0;
  try {
    Oe.decode(Xe, { stream: true }), Ue = 1;
  } catch {
  }
  var He = new Uint8Array(new Uint32Array([305419896]).buffer)[0] === 18;
  function be(r) {
    let e = r.length;
    for (let n = 0; n < e; n += 4) [r[n], r[n + 1], r[n + 2], r[n + 3]] = [r[n + 3], r[n + 2], r[n + 1], r[n]];
  }
  function Ve(r) {
  }
  var ie = He ? be : Ve;
  var Ye = new TextDecoder(), H = class r {
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
   T8tr5/YikvVFSYq3dURbKo/gf+Q3zBCELycCXW/uB2mPjCb8AAAA`), lr = Object.fromEntries(b.values.map((r, e) => [r, e])), { values: se } = b;
  var { AI: We, AL: oe, CJ: Qe, CM: ke, NS: _e, SA: $e, SG: rn, SP: en, XX: nn } = lr, T = -1, V = -2;
  function tn(r) {
    switch (r) {
      case null:
        return null;
      case T:
        return "sot";
      case V:
        return "eot";
      default:
        return se[r];
    }
  }
  function fe(r, e) {
    switch (r) {
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
    return r;
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
  }, hr = class {
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
   33192kvqs2vW7w7BeyuJcEoAAB+LCAC1xcFoAgOLVvJT0lGKVIoFANHfAiwJAAAA`), zt = Object.fromEntries(z.values.map((r, e) => [r, e])), { values: St } = z;
  var { AK: ue, AL: w, AP: sn, AS: on, B2: Mr, BA: ve, BB: fn, BK: K, CB: Cr, CL: tr, CM: Or, CP: Z, CR: J, EB: pe, EM: Ur, EX: xe, GL: ir, H2: vr, H3: pr, HH: xr, HL: p, HY: sr, ID: un, IN: an, IS: E, JL: gr, JT: nr, JV: or, LF: F, NU: g, OP: fr, NL: R, NS: ge, PO: G, PR: j, RI: Hr, SP: h, SY: wr, QU: L, VF: ae, VI: ce, WJ: br, ZW: X, ZWJ: we } = lr, cn = /* @__PURE__ */ new Set([w, p, g]), ln = /* @__PURE__ */ new Set([K, J, F, R, h, X]), le = /* @__PURE__ */ new Set([un, pe, Ur]), hn = /* @__PURE__ */ new Set([gr, or, vr, pr]), vn = /* @__PURE__ */ new Set([gr, or, nr, vr, pr]), pn = /* @__PURE__ */ new Set([or, nr]), xn = /* @__PURE__ */ new Set([h, ir, br, tr, L, Z, xe, E, wr, K, J, F, R, X]), gn = /* @__PURE__ */ new Set([T, K, J, F, R, fr, L, ir, h, X]), o = /* @__PURE__ */ Symbol("PASS"), i = /* @__PURE__ */ Symbol("NO_BREAK"), I = /* @__PURE__ */ Symbol("MAY_BREAK"), q = /* @__PURE__ */ Symbol("MUST_BREAK"), Ft = { PASS: o, NO_BREAK: i, MAY_BREAK: I, MUST_BREAK: q };
  function wn(r) {
    return r.cur.cls === T && r.next.cls !== V ? i : o;
  }
  function yn(r) {
    return r.next.cls === V && (r.cur.len === 0 || r.cur.len !== r.prevChunk) ? q : o;
  }
  function mn(r) {
    return r.cur.cls === K ? q : o;
  }
  function An(r) {
    switch (r.cur.cls) {
      case J:
        return r.next.cls === F ? i : q;
      case F:
      case R:
        return q;
      default:
    }
    return o;
  }
  function Ln(r) {
    switch (r.next.cls) {
      case K:
      case J:
      case F:
      case R:
        return i;
      default:
    }
    return o;
  }
  function dn(r) {
    return r.cur.cls !== Hr && (r.RI = 0), r.spaces ? (r.next.cls !== h && (r.spaces = false), i) : o;
  }
  function Tn(r) {
    if (r.next.cls === X) return i;
    if (r.next.cls === h) switch (r.cur.cls) {
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
  function Bn(r) {
    return r.LB8 ? (r.LB8 = false, I) : r.cur.cls === X ? r.next.cls === h ? (r.LB8 = true, i) : I : o;
  }
  function zn(r) {
    return r.cur.cls === we ? i : o;
  }
  function Sn(r) {
    return !ln.has(r.cur.cls) && (r.next.cls === Or || r.next.cls === we) ? (r.next.ignored = true, i) : o;
  }
  function Pn(r) {
    return r.cur.cls === Or && (r.cur.cls = w), r.next.cls === Or && (r.next.cls = w), o;
  }
  function Dn(r) {
    return r.next.cls === br || r.cur.cls === br ? i : o;
  }
  function In(r) {
    return r.cur.cls === ir ? i : o;
  }
  function Nn(r) {
    if (r.next.cls === ir) switch (r.cur.cls) {
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
  function En(r) {
    switch (r.next.cls) {
      case tr:
      case Z:
      case xe:
      case wr:
        return i;
      default:
    }
    return o;
  }
  function Fn(r) {
    return r.cur.cls === fr ? (r.next.cls === h && (r.spaces = true), i) : o;
  }
  function Xn(r) {
    return gn.has(r.prev.cls) && /^\p{Pi}$/u.test(r.cur.char) && r.cur.cls === L ? (r.spaces = true, i) : o;
  }
  function Mn(r) {
    if (/^\p{gc=Pf}$/u.test(r.next.char) && r.next.cls === L) {
      let e = r.afterNext();
      if (!e || xn.has(e.cls)) return i;
    }
    return o;
  }
  function Cn(r) {
    return r.cur.cls === h && r.next.cls === E && r.afterNext()?.cls === g ? I : o;
  }
  function On(r) {
    return r.next.cls === E ? i : o;
  }
  function Un(r) {
    if (r.cur.cls === tr || r.cur.cls === Z) {
      if (r.classAfterSpaces(r.cur.len) === ge) return r.next.cls === h && (r.spaces = true), i;
      if (r.next.cls === h) return i;
    }
    return o;
  }
  function Hn(r) {
    if (r.cur.cls === Mr) {
      if (r.classAfterSpaces(r.cur.len) === Mr) return r.next.cls !== h || (r.spaces = true), i;
      if (r.next.cls === h) return i;
    }
    return o;
  }
  function bn(r) {
    return r.cur.cls === h ? I : o;
  }
  function Vn(r) {
    return r.next.cls === L && !/^\p{Pi}$/u.test(r.next.char) || r.cur.cls === L && !/^\p{Pf}$/u.test(r.cur.char) ? i : o;
  }
  function Gn(r) {
    if (!z.get(r.cur.cp) && r.next.cls === L) return i;
    if (r.next.cls === L) {
      let e = r.afterNext();
      if (!e || !z.get(e.cp)) return i;
    }
    return r.cur.cls === L && !z.get(r.next.cp) || (r.prev.cls === T || !z.get(r.prev.cp)) && r.cur.cls === L ? i : o;
  }
  function jn(r) {
    return r.cur.cls === Cr || r.next.cls === Cr ? I : o;
  }
  var qn = /* @__PURE__ */ new Set([T, K, J, F, R, h, X, Cr, ir]);
  function Kn(r) {
    return qn.has(r.prev.cls) && (r.cur.cls === sr || r.cur.cls === xr) && (r.next.cls === w || r.next.cls === p) ? i : o;
  }
  function Zn(r) {
    if (r.cur.cls === fn) return i;
    switch (r.next.cls) {
      case ve:
      case xr:
      case sr:
      case ge:
        return i;
      default:
    }
    return o;
  }
  function Jn(r) {
    return r.prev.cls === p && (r.cur.cls === sr || r.cur.cls === xr) && r.next.cls !== p ? i : o;
  }
  function Rn(r) {
    return r.cur.cls === wr && r.next.cls === p ? i : o;
  }
  function Yn(r) {
    return r.next.cls === an ? i : o;
  }
  function Wn(r) {
    switch (r.cur.cls) {
      case w:
      case p:
        if (r.next.cls === g) return i;
        break;
      case g:
        if (r.next.cls === w || r.next.cls === p) return i;
        break;
      default:
    }
    return o;
  }
  function Qn(r) {
    return r.cur.cls === j && le.has(r.next.cls) || r.next.cls === G && le.has(r.cur.cls) ? i : o;
  }
  function kn(r) {
    return (r.cur.cls === j || r.cur.cls === G) && (r.next.cls === w || r.next.cls === p) || (r.cur.cls === w || r.cur.cls === p) && (r.next.cls === j || r.next.cls === G) ? i : o;
  }
  var _n = /* @__PURE__ */ new Set([G, j]), $n = /* @__PURE__ */ new Set([tr, Z]);
  function rt(r) {
    let e = null;
    if (_n.has(r.next.cls) ? $n.has(r.cur.cls) ? e = r.prev.len : e = r.cur.len : r.next.cls === g && (e = r.cur.len), e !== null) r: for (let { cls: n } of r.codePoints(e, false)) switch (n) {
      case wr:
      case E:
        continue;
      case g:
        return i;
      default:
        break r;
    }
    if (r.cur.cls === G || r.cur.cls === j) {
      if (r.next.cls === fr) {
        let n = r.afterNext();
        if (n) {
          if (n.cls === g) return i;
          if (n.cls === E && r.afterNext(2)?.cls === g) return i;
        }
      } else if (r.next.cls === g) return i;
    }
    return r.cur.cls === sr && r.next.cls === g || r.cur.cls === E && r.next.cls === g ? i : o;
  }
  function et(r) {
    switch (r.cur.cls) {
      case gr:
        if (hn.has(r.next.cls)) return i;
        break;
      case or:
      case vr:
        if (pn.has(r.next.cls)) return i;
        break;
      case nr:
      case pr:
        if (r.next.cls === nr) return i;
        break;
      default:
    }
    return o;
  }
  function nt(r) {
    switch (r.cur.cls) {
      case gr:
      case or:
      case nr:
      case vr:
      case pr:
        if (r.next.cls === G) return i;
        break;
      case j:
        if (vn.has(r.next.cls)) return i;
        break;
      default:
    }
    return o;
  }
  function tt(r) {
    return (r.cur.cls === w || r.cur.cls === p) && (r.next.cls === w || r.next.cls === p) ? i : o;
  }
  function it(r) {
    let { prev: e, cur: n, next: t } = r, s = "\u25CC";
    function c(l) {
      return l.cls === ue || l.char === s || l.cls === on;
    }
    return n.cls === sn && c(t) || c(n) && (t.cls === ae || t.cls === ce) || c(e) && n.cls === ce && (t.cls === ue || t.char === s) || c(n) && c(t) && r.afterNext()?.cls === ae ? i : o;
  }
  function st(r) {
    return r.cur.cls === E && (r.next.cls === w || r.next.cls === p) ? i : o;
  }
  function ot(r) {
    switch (r.cur.cls) {
      case w:
      case p:
      case g:
        if (r.next.cls === fr && !z.get(r.next.cp)) return i;
        break;
      case Z:
        if (!z.get(r.cur.cp) && cn.has(r.next.cls)) return i;
        break;
      default:
    }
    return o;
  }
  function ft(r) {
    if (r.cur.cls === Hr) {
      if (r.next.cls === Hr && ++r.RI % 2 !== 0) return i;
    } else r.RI = 0;
    return o;
  }
  function ut(r) {
    return r.cur.cls === pe && r.next.cls === Ur || r.next.cls === Ur && /^\p{ExtPict}$/u.test(r.cur.char) && /^\p{gc=Cn}$/u.test(r.cur.char) ? i : o;
  }
  function at() {
    return I;
  }
  var ct = [wn, yn, mn, An, Ln, dn, Tn, Bn, zn, Sn, Pn, Dn, In, Nn, En, Fn, Xn, Mn, Cn, On, Un, Hn, bn, Vn, Gn, jn, Kn, Jn, Zn, Rn, Yn, Wn, Qn, kn, rt, et, nt, tt, it, st, ot, ft, ut, at], he = class {
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
  return loaded = { Rules: he };
}
var Rules = class {
  constructor(options) {
    return new (load()).Rules(options);
  }
};

// src/lib/v4/break-opportunities.ts
var UNICODE_VERSION = "17.0.0";
var profiles = {
  fr: new Set("le la les un une des de du au aux et ou en pour avec sans sur sous".split(" ")),
  de: new Set("der die das den dem des ein eine einer einem einen und oder mit von zu im am an auf".split(" ")),
  es: new Set("el la los las un una unos unas de del al y o en por para con sin".split(" "))
};
var segmenters = /* @__PURE__ */ new Map();
function graphemeSegmenter2(language) {
  let segmenter2 = segmenters.get(language);
  if (!segmenter2) segmenters.set(language, segmenter2 = new Intl.Segmenter(language, { granularity: "grapheme" }));
  return segmenter2;
}
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
  if (options.outcomeOnly) return result;
  const normalized = source.replace(/[\t\r\n]/g, " ");
  const graphemes3 = /* @__PURE__ */ new Set([source.length, ...Array.from(graphemeSegmenter2(language).segment(source), (g) => g.index)]);
  const positions = [...new Rules().breaks(normalized)].map((b) => b.position).filter((pos) => {
    if (!graphemes3.has(pos)) return false;
    if (pos < source.length && /[\u00a0\u202f\u2060\ufeff\u2011]/u.test(source[pos - 1] + source[pos])) return false;
    if (options.hyphens === "none" && /[-\u2010]$/.test(source.slice(0, pos))) return false;
    return true;
  });
  let start2 = 0;
  for (const end of positions) {
    const slice = source.slice(start2, end);
    const leading2 = slice.match(/^[ \t\r\n]*/u)[0].length;
    const text = slice.slice(leading2).replace(/[ \t\r\n]+$/u, "");
    if (text && /^\s+$/u.test(text)) continue;
    if (text) result.units.push({ text, index: start2 + leading2, hyphen: /[-\u2010]$/u.test(text) });
    start2 = end;
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
function finishTargets(widths, measure2) {
  const fills = widths.slice(0, -1).map((width) => width / measure2).sort((a, b) => a - b);
  const mid = Math.floor(fills.length / 2);
  const median = fills.length % 2 ? fills[mid] : (fills[mid - 1] + fills[mid]) / 2;
  return widths.map((width, index) => {
    if (index === widths.length - 1) return width;
    const neighbors = [widths[index - 1], index < widths.length - 2 ? widths[index + 1] : void 0].filter((value) => value !== void 0);
    const local = neighbors.length ? neighbors.reduce((sum, value) => sum + value / measure2, 0) / neighbors.length : median;
    const target = Math.max(0.7, Math.min(0.965, 0.5 * local + 0.5 * median));
    return measure2 * target;
  });
}
function finishSpaceDeltas(widths, measure2, spaces) {
  const targets = finishTargets(widths, measure2);
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
function planSpacingFinish(element, layout, measuredSpaces = /* @__PURE__ */ new Map()) {
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
  const point = (at, end = false) => runs.find((run) => end ? run.start < at && run.end >= at : run.start <= at && run.end > at);
  const range = element.ownerDocument.createRange();
  const measured = [];
  for (const line of layout.lines.slice(0, -1)) {
    const spaces = Array.from(source.slice(line.sourceStart, line.sourceEnd).matchAll(/[\t\n\r \u00a0\u202f]+/gu));
    const gaps = [];
    for (const space of spaces) {
      const start2 = line.sourceStart + space.index, end = start2 + space[0].length;
      const a = point(start2), b = point(end, true);
      if (!a || !b || !a.node.parentElement) return result("native:spacing-measurement");
      range.setStart(a.node, start2 - a.start);
      range.setEnd(b.node, end - b.start);
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
    display: "inline",
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
function finishedContour(element, words, measure2, cache = /* @__PURE__ */ new Map()) {
  const source = element.textContent || "";
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs = [];
  let node, offset = 0;
  while (node = walker.nextNode()) {
    const text = node;
    runs.push({ start: offset, end: offset + text.length, node: text });
    offset += text.length;
  }
  const spaces = Array.from(source.matchAll(/[\t\n\r \u00a0\u202f]+/gu), (match) => {
    const run = runs.find((run2) => run2.start <= match.index && run2.end > match.index);
    const parent = run?.node.parentElement;
    const width = parent ? naturalSpace(element, getComputedStyle(parent), match[0].replace(/[\t\n\r ]+/g, " "), cache) : 0;
    return { start: match.index, end: match.index + match[0].length, width };
  });
  return (lines) => {
    let cursor = 0;
    const gaps = lines.map((line) => {
      const start2 = words[cursor].index;
      cursor += line.tokens.length;
      const last = words[cursor - 1], end = last.index + last.text.length;
      return spaces.filter((space) => space.start >= start2 && space.end <= end).map((space) => space.width);
    });
    const widths = lines.map((line) => line.width);
    const deltas = finishSpaceDeltas(widths, measure2, gaps);
    return widths.map((width, index) => (width + deltas[index].reduce((sum, delta) => sum + delta, 0)) / measure2);
  };
}

// src/lib/v4/title-layout.ts
var weakEnds = /* @__PURE__ */ new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "and", "or", "but"]);
function composeTitle(tokens, width, measure2, policy = {}) {
  const words = tokens.filter((t) => t.kind !== "space");
  if (!words.length || words.length > 64 || width <= 0) return null;
  const n = words.length;
  const widths = Array.from({ length: n }, () => []);
  for (let start3 = 0; start3 < n; start3++) {
    for (let end = start3 + 1; end <= n; end++) {
      widths[start3][end] = policy.measureRange?.(start3, end) ?? measure2(words.slice(start3, end).map((t) => t.text).join(" "));
    }
  }
  const minLines = Array(n + 1).fill(Infinity);
  minLines[n] = 0;
  for (let start3 = n - 1; start3 >= 0; start3--) {
    for (let end = start3 + 1; end <= n; end++) {
      if (widths[start3][end] <= width + 0.25) minLines[start3] = Math.min(minLines[start3], 1 + minLines[end]);
    }
  }
  const count = minLines[0];
  if (!Number.isFinite(count) || policy.maxLines && count > policy.maxLines) return null;
  const keepCosts = /* @__PURE__ */ new Map();
  for (const { start: start3, end } of keptPhrases(words.map((t) => t.text), policy.keep)) {
    const cost = widths[start3][end] <= width + 0.25 ? 1e6 : 1500;
    for (let at = start3 + 1; at < end; at++) keepCosts.set(at, Math.max(keepCosts.get(at) || 0, cost));
  }
  const target = widths[0][n] / (count * width);
  const memo = /* @__PURE__ */ new Map();
  const solve = (start3, left) => {
    if (start3 === n) return left === 0 ? { cost: 0, breaks: [] } : null;
    if (!left || minLines[start3] > left) return null;
    const key = start3 + ":" + left;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (let end = start3 + 1; end <= n; end++) {
      const lineWidth = widths[start3][end];
      if (lineWidth > width + 0.25) continue;
      const rest = solve(end, left - 1);
      if (!rest) continue;
      const last = end === n;
      const wordCount = words.slice(start3, end).reduce((sum, t) => sum + t.text.split(/\s+/u).length, 0);
      let cost = rest.cost + 1e3 * (lineWidth / width - target) ** 2;
      if (count > 1 && wordCount === 1 && (start3 === 0 || last)) {
        cost += last ? 500 : 900 * Math.max(0, 0.65 - lineWidth / width) / 0.65;
      }
      if (!last && (policy.weakEnding?.(words[end - 1].text) ?? weakEnds.has(words[end - 1].text.toLowerCase()))) cost += 240;
      if (!last && keepCosts.has(end)) cost += keepCosts.get(end);
      if (!last) cost += policy.breakPenalty?.(end) || 0;
      if (!last && (words[end - 1].stickyNext || words[end]?.stickyPrev)) cost += 1e4;
      if (!best || cost < best.cost) best = { cost, breaks: [end, ...rest.breaks] };
    }
    memo.set(key, best);
    return best;
  };
  const winner = solve(0, count);
  if (!winner) return null;
  let start2 = 0;
  return winner.breaks.map((end) => {
    const lineTokens = words.slice(start2, end);
    const lineWidth = widths[start2][end];
    start2 = end;
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
  if (!Number.isFinite(width) || width <= 0 || overflow > 0.5 || lines.length < 4 || proposedWidths.length !== lines.length || lines.some((l) => l.words < 2 || !Number.isFinite(l.width) || l.width < 0 || l.width > width + 0.5) || proposedWidths.some((w) => !Number.isFinite(w) || w < 0 || w > width + 0.5)) return false;
  const last = lines.at(-1);
  if (last.words < 3 || last.width / width < 0.4 || last.width / width > 0.8) return false;
  const native = lines.slice(0, -1).map((l) => l.width / width);
  const proposed = proposedWidths.slice(0, -1).map((w) => w / width);
  const spread = (fills) => Math.max(...fills) - Math.min(...fills);
  if (Math.min(...native) < 0.88 || spread(native) > 0.1 || spread(proposed) - spread(native) < 0.12 || Math.min(...native) - Math.min(...proposed) < 0.12) return false;
  for (const sentence of sentences().segment(source)) {
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
function opticalInkOverhang(doc, style, char, advance, measuredContext) {
  if (!supportedFont(style)) return null;
  const context = doc.createElement("canvas").getContext("2d");
  if (!context || !setCanvasFont(context, style)) return null;
  const witness = measuredContext && !/\p{M}/u.test(measuredContext.text) ? measuredContext : { text: char, advance };
  const metrics = context.measureText(witness.text);
  if (Math.abs(metrics.width + (parseFloat(style.letterSpacing) || 0) * Array.from(witness.text).length - witness.advance) > 1.01 || !Number.isFinite(metrics.actualBoundingBoxLeft)) return null;
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
    const run = runs.find((r) => r.start <= line.sourceStart && r.end > line.sourceStart);
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
    let overhang = 0;
    if (room.clips.length) {
      const text = run.node.data.slice(local).match(/^\S{1,64}(?=\s|$)/u)?.[0] || char;
      range.setEnd(run.node, local + text.length);
      const contextualAdvance = range.getBoundingClientRect().width;
      const transformed = style.textTransform === "uppercase" ? text.toUpperCase() : style.textTransform === "lowercase" ? text.toLowerCase() : text;
      overhang = opticalInkOverhang(element.ownerDocument, style, displayed, advance, { text: transformed, advance: contextualAdvance });
    }
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

// src/lib/v4/environment.ts
var measurable = /* @__PURE__ */ new WeakSet();
var segmenter = () => typeof Intl === "object" && typeof Intl.Segmenter === "function";
var geometry = (view) => !!view && typeof view.Range?.prototype?.getClientRects === "function";
function canCompose(doc) {
  if (measurable.has(doc)) return true;
  if (!segmenter() || !geometry(doc.defaultView) || !doc.documentElement) return false;
  const box = doc.documentElement.getBoundingClientRect();
  if (!(box.width > 0 || box.height > 0)) return false;
  measurable.add(doc);
  return true;
}
function canMaintain(doc) {
  const view = doc.defaultView;
  return !!view && typeof view.MutationObserver === "function" && typeof view.ResizeObserver === "function" && segmenter() && geometry(view);
}
var ENVIRONMENT_OUTCOME = "native:environment";

// src/lib/v4/rich-text.ts
var BREAK_ATTRIBUTE = "data-ts-break";
var inlineTags = /* @__PURE__ */ new Set(["A", "B", "STRONG", "EM", "I", "SPAN", "SMALL", "U", "S", "DEL", "MARK", "ABBR", "CITE", "CODE"]);
var wordPattern = /[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/gu;
function richLayoutVerified(plan, after) {
  const starts = [plan.source.search(/\S/u), ...plan.breaks];
  const ends2 = [...plan.breaks.map((at) => plan.source.slice(0, at).trimEnd().length), plan.source.trimEnd().length];
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
  const run = runs.find((r) => end ? r.end >= offset && r.start < offset : r.start <= offset && r.end > offset) || runs.at(-1);
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
function inlineStyle(element) {
  const style = element.style, names = Array.from({ length: style.length }, (_, i) => style[i]);
  const mixed = new Set(names.map((name) => style.getPropertyPriority(name))).size > 1;
  return {
    hadAttribute: element.hasAttribute("style"),
    cssText: style.cssText,
    longhands: mixed ? new Map(names.map((name) => [name, [style.getPropertyValue(name), style.getPropertyPriority(name)]])) : null
  };
}
function restoreInlineStyle(element, saved) {
  const style = element.style;
  if (!saved.hadAttribute) removeStyleAttribute(element);
  else if (!saved.longhands) {
    if (style.cssText !== saved.cssText) style.cssText = saved.cssText;
  } else {
    for (const name of Array.from({ length: style.length }, (_, i) => style[i])) if (!saved.longhands.has(name)) style.removeProperty(name);
    for (const [name, [value, priority]] of saved.longhands) {
      if (style.getPropertyValue(name) !== value || style.getPropertyPriority(name) !== priority) style.setProperty(name, value, priority);
    }
  }
}
function removeStyleAttribute(element) {
  const attribute = element.getAttributeNode("style");
  if (attribute) element.removeAttributeNode(attribute);
}
function override(element, properties) {
  const saved = inlineStyle(element);
  for (const [key, value] of Object.entries(properties)) element.style.setProperty(key, value, "important");
  return () => restoreInlineStyle(element, saved);
}
function breaksChangeAlignment(style) {
  const side = (value) => value === "start" ? "left" : value === "end" ? "right" : value;
  const align = side(style.textAlign);
  if (align === "justify" || align === "justify-all") return true;
  const last = style.textAlignLast || "auto";
  return last !== "auto" && side(last) !== align;
}
function unsupported(element) {
  for (const el of [element, ...element.querySelectorAll("*")]) {
    if (el.hasAttribute(BREAK_ATTRIBUTE)) continue;
    if (el !== element && !inlineTags.has(el.tagName)) return "native:rich-element";
    if (el.matches('[hidden], [aria-hidden="true"], [contenteditable]:not([contenteditable="false"]), [data-no-typeset]')) return "native:rich-excluded";
    const cs = getComputedStyle(el);
    if (cs.direction !== "ltr" || cs.writingMode !== "horizontal-tb" || el !== element && cs.unicodeBidi !== "normal" || cs.visibility !== "visible") return "native:rich-direction";
    if (cs.whiteSpace !== "normal" && !(el !== element && cs.whiteSpace === "nowrap") || !preservesAdvances(cs) || cs.textIndent !== "0px") return "native:rich-whitespace";
    if (el !== element && (cs.display !== "inline" || cs.position !== "static" || cs.verticalAlign !== "baseline")) return "native:rich-layout";
    if (el !== element && !inlineBoxInsets(cs).supported) return "native:rich-box";
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (content && content !== "none" && content !== "normal" && content !== '""') return "native:rich-decorated";
    }
  }
  return null;
}
function planRichText(element, options = {}, nativeLayout, spaceWidths) {
  const source = element.textContent || "";
  if (!canCompose(element.ownerDocument)) {
    return { source, before: { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 }, outcome: ENVIRONMENT_OUTCOME, breaks: [], widths: [], styleSignature: "" };
  }
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
    const fits = before.lines.length === 1 && before.overflow <= 0.5;
    const analysis = unicode ? analyzeBreaks(source, { language: lang, hyphens: getComputedStyle(element).hyphens, outcomeOnly: fits }) : null;
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
    if (breaksChangeAlignment(getComputedStyle(element))) return result("native:justify");
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
    const noWrapRuns = [];
    for (const run of runs) {
      if (getComputedStyle(run.node.parentElement).whiteSpace !== "nowrap") continue;
      const previous = noWrapRuns.at(-1);
      if (previous?.end === run.start) previous.end = run.end;
      else noWrapRuns.push({ start: run.start, end: run.end });
    }
    for (let i = words.length - 2; i >= 0; i--) {
      const end = words[i].index + words[i].text.length;
      const next = words[i + 1];
      if (noWrapRuns.some((run) => run.start <= end && run.end > next.index)) {
        words[i].text = source.slice(words[i].index, next.index + next.text.length);
        words[i].hyphen = next.hyphen;
        words.splice(i + 1, 1);
      }
    }
    if (unicode) {
      for (let i = words.length - 2; i >= 0; i--) {
        const point = pointAt(runs, words[i].index + words[i].text.length - 1);
        if (words[i].hyphen && point?.node.parentElement && getComputedStyle(point.node.parentElement).hyphens === "none") {
          const next = words[i + 1];
          words[i].text = source.slice(words[i].index, next.index + next.text.length);
          words[i].hyphen = next.hyphen;
          words.splice(i + 1, 1);
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
      const start2 = children[0].start, end = children.at(-1).end;
      leadingInsets.set(start2, (leadingInsets.get(start2) || 0) + insets.left);
      trailingInsets.set(end, (trailingInsets.get(end) || 0) + insets.right);
    }
    const restoreWhiteSpace = [element, ...element.querySelectorAll("*")].filter((el) => !el.hasAttribute(BREAK_ATTRIBUTE)).map((el) => override(el, { "white-space": "nowrap", "text-wrap": "nowrap" }));
    let edges;
    try {
      edges = words.map((word2) => {
        const a = pointAt(runs, word2.index);
        const b = pointAt(runs, word2.index + word2.text.length, true);
        if (!a || !b) throw new Error("Unmapped rich text");
        range.setStart(a.node, a.offset);
        range.setEnd(b.node, b.offset);
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
    content.forEach((token, i) => {
      token.width = edges[i].right - edges[i].left;
    });
    const nativeSpans = new Map(before.lines.map((line) => [line.sourceStart + ":" + line.sourceEnd, line]));
    const measureRange = (start2, end) => {
      const last = words[end - 1];
      const width = edges[end - 1].right - edges[start2].left + (leadingInsets.get(words[start2].index) || 0) + (trailingInsets.get(last.index + last.text.length) || 0);
      if (width <= before.width || width > before.width + 0.5) return width;
      const witness = nativeSpans.get(words[start2].index + ":" + (last.index + last.text.length));
      return witness && witness.width <= before.width + 0.5 && Math.abs(witness.width - width) <= 0.5 ? Math.min(before.width, witness.width) : width;
    };
    const breakPenalty = (end) => words[end - 1].hyphen ? 1600 : 0;
    const title = options.mode === "title" || options.mode === "heading" || !options.mode && /^H[1-6]$/.test(element.tagName);
    const clamp = parseInt(getComputedStyle(element).getPropertyValue("-webkit-line-clamp"), 10);
    const openerRepair = options.density !== "compact" && (!analysis || analysis.language === "en") && before.lines.slice(0, -1).some((line) => strandedOpener(line.text));
    const keepSplit = keptPhrases(words.map((word2) => word2.text), options.keep).some(({ start: start2, end }) => {
      const from = words[start2].index, to = words[end - 1].index + words[end - 1].text.length;
      return before.lines.slice(0, -1).some((line) => line.sourceEnd > from && line.sourceEnd < to);
    });
    const allowance = !title && (before.lastSingleton || options.density === "editorial" || openerRepair || keepSplit && options.density !== "compact") ? 1 : 0;
    const maxLines = Math.min(options.maxLines || Infinity, clamp > 0 ? clamp : Infinity, before.lines.length + allowance);
    const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
    const contourWidths = !title && options.contour === "finished" && ["left", "start"].includes(getComputedStyle(element).textAlign) ? finishedContour(element, words, before.width, spaceWidths) : void 0;
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
      allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width),
      keep: options.keep
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
          allowOrphan: before.lastSingleton && (words.length < 2 || measureRange(words.length - 2, words.length) > before.width),
          keep: options.keep
        });
        const wordCounts = (composition) => {
          let end2 = 0;
          return composition.map((line) => {
            const start2 = end2;
            end2 += line.tokens.length;
            const last = words[end2 - 1];
            return source.slice(words[start2].index, last.index + last.text.length).trim().split(/\s+/u).length;
          });
        };
        if (phrased && attachmentCost(phrased) < originalCost) {
          const originalWords = wordCounts(lines), proposedWords = wordCounts(phrased);
          let originalEnd = 0;
          const repairsName = lines.slice(0, -1).some((line) => {
            originalEnd += line.tokens.length;
            return groups.some((group) => group.kind === "name" && group.start < originalEnd && group.end > originalEnd);
          });
          const nameTail = repairsName && proposedWords.at(-1) === 1 && phrased.at(-1).width >= before.width * 0.4;
          const stranded = title && (proposedWords[0] === 1 && originalWords[0] > 1 || !nameTail && proposedWords.at(-1) === 1 && originalWords.at(-1) > 1 || !nameTail && proposedWords.filter((n) => n === 1).length > originalWords.filter((n) => n === 1).length);
          if (!stranded) lines = phrased;
        }
      }
      let end = 0;
      const chosenEnds = lines.map((line) => {
        end += line.tokens.length;
        return words[end - 1].index + words[end - 1].text.length;
      });
      if (!title && options.density !== "editorial" && !keepSplit && before.lines.length <= maxLines && retainSentenceLayout(source, before, chosenEnds)) return result("native:sentence-aligned");
      if (!title && options.density !== "editorial" && !keepSplit && before.lines.length <= maxLines && retainParagraphRhythm(source, before, lines.map((line) => line.width))) return result("native:paragraph-rhythm");
    }
    if (!lines) {
      const limit = before.width + (title ? 0.25 : 0);
      const requiredWidth = Math.max(...content.map((_, i) => measureRange(i, i + 1)));
      const minimum = Array(content.length + 1).fill(Infinity);
      minimum[content.length] = 0;
      for (let start2 = content.length - 1; start2 >= 0; start2--) {
        for (let end = start2 + 1; end <= content.length; end++) {
          if (measureRange(start2, end) <= limit) minimum[start2] = Math.min(minimum[start2], 1 + minimum[end]);
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
var liveRoles = '[role~="status" i], [role~="alert" i], [role~="log" i], [role~="marquee" i], [role~="timer" i], output';
var regions = '[aria-live], [role~="status" i], [role~="alert" i], [role~="log" i], [role~="marquee" i], [role~="timer" i], output';
function flatParent(element) {
  const slot = element.assignedSlot;
  if (slot) return slot;
  if (element.parentElement) return element.parentElement;
  const root = element.parentNode;
  return root?.nodeType === Node.DOCUMENT_FRAGMENT_NODE && root.host ? root.host : null;
}
function inLiveRegion(element) {
  for (let region = element; region; region = flatParent(region)) {
    const live = region.getAttribute("aria-live")?.trim().toLowerCase();
    if (live) return live !== "off";
    if ((region.hasAttribute("role") || region.localName === "output") && region.matches(liveRoles)) return true;
  }
  return false;
}
function liveText(element) {
  if (inLiveRegion(element)) return true;
  for (const region of element.querySelectorAll(regions)) if (inLiveRegion(region)) return true;
  for (const host of element.querySelectorAll("*")) {
    const shadow = host.shadowRoot;
    if (shadow) {
      for (const slot of shadow.querySelectorAll("slot")) if (inLiveRegion(slot)) return true;
    }
  }
  return false;
}
function breakReplacesSpace(source, offset) {
  return offset > 0 && /\s/u.test(source[offset - 1]);
}
var engineText = /* @__PURE__ */ new WeakSet();
function shieldWhitespace(element) {
  const shields = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const spaces = [];
  while (walker.nextNode()) if (walker.currentNode.length && !/\S/u.test(walker.currentNode.data)) spaces.push(walker.currentNode);
  const emptyBeside = (node, forward) => {
    let at = node;
    for (let steps = 0; steps < 16; steps++) {
      const sibling = forward ? at.nextSibling : at.previousSibling;
      if (!sibling) {
        if (!at.parentNode || at.parentNode === element) return false;
        at = at.parentNode;
        continue;
      }
      at = sibling;
      if (sibling.nodeType === Node.COMMENT_NODE || sibling.nodeType === Node.ELEMENT_NODE && !sibling.firstChild && !["BR", "WBR", "IMG", "INPUT"].includes(sibling.tagName) && getComputedStyle(sibling).display === "inline") continue;
      return sibling.nodeType === Node.TEXT_NODE && !sibling.length;
    }
    return false;
  };
  for (const space of spaces) {
    for (const forward of [false, true]) {
      if (!emptyBeside(space, forward)) continue;
      const shield = element.ownerDocument.createElement("wbr");
      shield.setAttribute(BREAK_ATTRIBUTE, "");
      shield.setAttribute("aria-hidden", "true");
      shield.dataset.tsShield = "";
      if (forward) space.after(shield);
      else space.before(shield);
      shields.push(shield);
    }
  }
  return shields;
}
function positional(node) {
  const before = node.previousSibling;
  return !before || before.nodeType === Node.COMMENT_NODE && before.data.startsWith("?lit$");
}
function afterComment(node) {
  return node.previousSibling?.nodeType === Node.COMMENT_NODE && !positional(node);
}
function reactOwned(node) {
  return Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
}
function releaseSplits(element, splits, written) {
  for (const { head, parts, expected } of splits) {
    const edited = !element.contains(head) || head.data !== expected[0] || !!written?.has(head);
    for (const tail of parts.slice(1)) {
      if (!element.contains(tail)) continue;
      if (!edited) head.appendData(tail.data);
      tail.remove();
    }
  }
}
function rejoinSplits(element, splits) {
  for (const { head, parts, expected } of splits) {
    if (parts.length < 2 || !parts.every((part, i) => part.parentNode === head.parentNode && element.contains(part) && part.data === expected[i])) continue;
    let adjacent = true;
    for (let i = 1; i < parts.length && adjacent; i++) {
      let node = parts[i - 1].nextSibling;
      while (node && node !== parts[i] && node.nodeType === Node.TEXT_NODE && !node.length) node = node.nextSibling;
      adjacent = node === parts[i];
    }
    if (!adjacent) continue;
    head.data = expected.join("");
    for (const tail of parts.slice(1)) tail.remove();
  }
}
function elementStartingAt(host, text) {
  let outer2 = text, found = null;
  for (let parent = text.parentNode; parent && parent !== host && parent.nodeType === Node.ELEMENT_NODE; parent = parent.parentNode) {
    let before = outer2.previousSibling;
    while (before && (before.nodeType === Node.COMMENT_NODE || before.nodeType === Node.TEXT_NODE && !before.length)) before = before.previousSibling;
    if (before) break;
    outer2 = found = parent;
  }
  return found;
}
var wrapOverrides = /* @__PURE__ */ new WeakMap();
function renderRichText(element, breaks, hangs = [], spaces = []) {
  const restoreSelection = selectionBookmark(element);
  const hadStyle = element.hasAttribute("style");
  const wrapStyle = element.style.getPropertyValue("text-wrap-style");
  const wrapPriority = element.style.getPropertyPriority("text-wrap-style");
  if (breaks.length) {
    element.style.setProperty("text-wrap-style", "auto", "important");
    wrapOverrides.set(element, { value: wrapStyle, priority: wrapPriority });
  }
  const runs = textRuns(element);
  const source = element.textContent || "";
  const markers = [];
  const splits = /* @__PURE__ */ new Map();
  const insertions = [
    ...breaks.map((offset) => ({ offset, px: 0, spacing: false })),
    ...hangs.map((hang) => ({ ...hang, spacing: false })),
    ...spaces.map((space) => ({ ...space, spacing: true }))
  ].sort((a, b) => b.offset - a.offset || b.px - a.px);
  for (const { offset, px, spacing } of insertions) {
    const point = pointAt(runs, offset);
    if (!point) continue;
    const head = point.node;
    if (spacing && point.offset && head.previousSibling?.nodeType === Node.COMMENT_NODE && !/\S/u.test(head.data.slice(0, point.offset))) point.offset = 0;
    const marker = element.ownerDocument.createElement(px ? "span" : "br");
    marker.setAttribute(BREAK_ATTRIBUTE, "");
    if (px || !breakReplacesSpace(source, offset)) marker.setAttribute("aria-hidden", "true");
    if (spacing) {
      marker.dataset.tsSpace = String(offset);
      Object.assign(marker.style, spacingMarkerStyle(px));
    } else if (px) {
      marker.dataset.tsHang = String(offset);
      Object.assign(marker.style, opticalMarkerStyle(px));
    } else marker.style.setProperty("display", "var(--ts-break-display, inline)", "important");
    const opening = !px && !spacing && point.offset === 0 && !engineText.has(head) ? elementStartingAt(element, head) : null;
    if (opening) opening.before(marker);
    else if (point.offset === 0 && !engineText.has(head) && afterComment(head)) head.previousSibling.before(marker);
    else if (point.offset === 0 && (engineText.has(head) || !positional(head))) head.before(marker);
    else {
      const tail = head.splitText(point.offset);
      engineText.add(tail);
      const split = splits.get(head) || { head, parts: [head], expected: [] };
      split.parts.splice(1, 0, tail);
      splits.set(head, split);
      tail.before(marker);
    }
    markers.push(marker);
  }
  for (const split of splits.values()) split.expected = split.parts.map((part) => part.data);
  if (splits.size) markers.push(...shieldWhitespace(element));
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  let released = false;
  return {
    nodes: [element, ...element.querySelectorAll("*"), ...textRuns(element).map((r) => r.node)],
    heads: new Set(splits.keys()),
    cleanup(written) {
      if (released) return;
      released = true;
      const restoreSelection2 = selectionBookmark(element);
      markers.forEach((marker) => marker.remove());
      if (spaces.length) element.querySelectorAll("[data-ts-break][data-ts-space]").forEach((marker) => marker.remove());
      if (breaks.length) element.querySelectorAll("[" + BREAK_ATTRIBUTE + "]").forEach((marker) => marker.remove());
      releaseSplits(element, splits.values(), written);
      if (breaks.length) wrapOverrides.delete(element);
      if (breaks.length && element.style.getPropertyValue("text-wrap-style") === "auto" && element.style.getPropertyPriority("text-wrap-style") === "important") {
        if (!hadStyle && element.style.length === 1) removeStyleAttribute(element);
        else if (wrapStyle) element.style.setProperty("text-wrap-style", wrapStyle, wrapPriority);
        else element.style.removeProperty("text-wrap-style");
        if (!hadStyle && !element.style.length) removeStyleAttribute(element);
      }
      releaseCopy();
      restoreSelection2();
    },
    rejoin() {
      if (released) return;
      released = true;
      rejoinSplits(element, splits.values());
      if (breaks.length) wrapOverrides.delete(element);
      releaseCopy();
    }
  };
}
var unrendered = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
function hiddenFromCopy(element) {
  if (unrendered.has(element.tagName) || element.tagName === "INPUT" && element.type === "hidden") return true;
  const rendered2 = typeof element.checkVisibility === "function" ? element.checkVisibility() : element.getClientRects().length > 0;
  return !rendered2 && getComputedStyle(element).display !== "contents";
}
function visibleContents(range, each) {
  const fragment = range.cloneContents();
  const root = range.commonAncestorContainer;
  const visibility = /* @__PURE__ */ new Map();
  const visibleText = (text) => {
    const parent = text.parentElement;
    if (!parent) return true;
    if (!visibility.has(parent)) {
      const cs = getComputedStyle(parent);
      visibility.set(parent, cs.visibility === "visible" && cs.getPropertyValue("content-visibility") !== "hidden");
    }
    return visibility.get(parent);
  };
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    if (!visibleText(root)) fragment.replaceChildren();
    return fragment;
  }
  const doc = range.startContainer.ownerDocument;
  const sources = [];
  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_ALL,
    { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
  );
  while (walker.nextNode()) sources.push(walker.currentNode);
  const clones = [];
  const cloneWalker = doc.createTreeWalker(fragment, NodeFilter.SHOW_ALL);
  while (cloneWalker.nextNode()) clones.push(cloneWalker.currentNode);
  if (sources.length !== clones.length) return null;
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i], clone = clones[i];
    if (source.nodeType !== clone.nodeType || source.nodeName !== clone.nodeName) return null;
    const hidden = source.nodeType === Node.ELEMENT_NODE ? hiddenFromCopy(source) : source.nodeType === Node.TEXT_NODE && !visibleText(source);
    if (!hidden) {
      if (each && source.nodeType === Node.ELEMENT_NODE) each(source, clone);
      continue;
    }
    clone.remove();
    while (i + 1 < sources.length && source.contains(sources[i + 1])) i++;
  }
  return fragment;
}
function renderedText(source, range, root) {
  const blank = (start2) => {
    const outside = root.ownerDocument.createRange();
    outside.selectNodeContents(root);
    if (start2) outside.setEnd(range.startContainer, range.startOffset);
    else outside.setStart(range.endContainer, range.endOffset);
    return !/[^ \t\n\r\f]/.test(outside.toString());
  };
  let text = source.replace(/[ \t\n\r\f]+/g, " ");
  if (text.startsWith(" ") && blank(true)) text = text.slice(1);
  if (text.endsWith(" ") && blank(false)) text = text.slice(0, -1);
  return text.replace(/\u00a0/g, " ");
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
      const target = event.target;
      if (target?.nodeType === Node.ELEMENT_NODE && target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      const selection = doc.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return;
      const ranges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i));
      const containingRoot = (range) => {
        let root = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
        while (root && !(registered.has(root) && root.contains(range.endContainer))) root = root.parentElement;
        return root;
      };
      const affected = ranges.some((range) => {
        if (containingRoot(range)) return true;
        const common = range.commonAncestorContainer;
        const parent = common.nodeType === Node.ELEMENT_NODE ? common : common.parentElement;
        return Array.from(parent?.querySelectorAll("*") || []).some((el) => registered.has(el) && range.intersectsNode(el));
      });
      if (!affected) return;
      const fragments = ranges.map((range) => visibleContents(range, (source, clone) => {
        const saved = wrapOverrides.get(source), style = clone.style;
        if (!saved || !style || style.getPropertyValue("text-wrap-style") !== "auto" || style.getPropertyPriority("text-wrap-style") !== "important") return;
        if (saved.value) style.setProperty("text-wrap-style", saved.value, saved.priority);
        else style.removeProperty("text-wrap-style");
        if (!style.length) clone.removeAttribute("style");
      }));
      const sourceText = fragments[0]?.textContent ?? null;
      const html = fragments.some((fragment) => !fragment) ? "" : fragments.map((fragment) => {
        fragment.querySelectorAll("[" + BREAK_ATTRIBUTE + "]").forEach((marker) => marker.remove());
        fragment.querySelectorAll("[data-ts-track]").forEach((wrapper) => wrapper.replaceWith(...wrapper.childNodes));
        for (const el of fragment.querySelectorAll("*")) {
          for (const attribute of ["data-ts-outcome", "data-typeset-done", "data-ts-quotes", "data-ts-hanging", "data-ts-spacing", "data-ts-tracking", "data-ts-stale", "data-typeset-react", "data-typeset-react-rich"]) el.removeAttribute(attribute);
          if (el.localName === "a" && el.namespaceURI === "http://www.w3.org/1999/xhtml" && el.hasAttribute("href")) {
            try {
              el.setAttribute("href", new URL(el.getAttribute("href"), doc.baseURI).href);
            } catch {
            }
          }
        }
        const container = doc.createElement("div");
        container.append(fragment);
        return container.innerHTML;
      }).join("");
      let text;
      const single = ranges.length === 1 ? containingRoot(ranges[0]) : null;
      if (single && sourceText !== null) text = renderedText(sourceText, ranges[0], single);
      else {
        const restore2 = Array.from(doc.querySelectorAll("[" + BREAK_ATTRIBUTE + "]")).filter((marker) => ranges.some((range) => range.intersectsNode(marker))).map((marker) => override(marker, { display: "none" }));
        try {
          text = selection.toString().replace(/\u00a0/g, " ");
        } finally {
          restore2.forEach((undo) => undo());
        }
      }
      event.clipboardData.setData("text/plain", text);
      if (html) event.clipboardData.setData("text/html", html);
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
var elision = /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b)/iu;
var loose = /^(?:bout|round|nuff)\b/iu;
var nPairs = /* @__PURE__ */ new Set([
  "rock",
  "rhythm",
  "fish",
  "salt",
  "pick",
  "shake",
  "surf",
  "drag",
  "grab",
  "meet",
  "stop",
  "park",
  "cash",
  "wash",
  "rip",
  "plug",
  "spick",
  "bump",
  "nip",
  "scratch",
  "peel",
  "lock",
  "snack",
  "bread",
  "mix"
]);
var nPairLongest = Math.max(...[...nPairs].map((word2) => word2.length));
function pairWordBefore(text, index) {
  let end = index;
  while (end > 0 && /\s/u.test(text[end - 1])) end--;
  let start2 = end;
  while (start2 > 0 && end - start2 <= nPairLongest) {
    const low = text.charCodeAt(start2 - 1);
    if (low >= 56320 && low <= 57343 && start2 > 1 && /^\p{L}$/u.test(text.slice(start2 - 2, start2))) start2 -= 2;
    else if (/\p{L}/u.test(text[start2 - 1])) start2--;
    else break;
  }
  return start2 < end && end - start2 <= nPairLongest && nPairs.has(text.slice(start2, end).toLowerCase());
}
var sentenceEnd = /[.!?](?:\s|$)/gu;
var closer = /[\p{L}\p{N}.,!?]['\u2019](?![\p{L}\p{N}])/gu;
function laterCloser(text) {
  let end = -1, close = -1, quote = 0;
  return (index) => {
    if (end <= index) {
      sentenceEnd.lastIndex = index + 1;
      end = sentenceEnd.exec(text)?.index ?? text.length;
    }
    if (close <= index) {
      closer.lastIndex = index + 1;
      close = closer.exec(text)?.index ?? text.length;
      quote = closer.lastIndex ? closer.lastIndex - 1 : close;
    }
    return quote < end;
  };
}
function smartQuotes(text) {
  let doubleOpen = false;
  let singleOpen = false;
  let out = "";
  let before = "";
  const closesLater = laterCloser(text);
  const put = (char) => {
    out += char;
    before = char;
  };
  for (let index = 0; index < text.length; index++) {
    const quote = text[index];
    if (!/["'\u201c\u201d\u2018\u2019]/u.test(quote)) {
      put(quote);
      continue;
    }
    if (quote === "\u201C") doubleOpen = true;
    else if (quote === "\u201D") doubleOpen = false;
    else if (quote === "\u2018") singleOpen = true;
    if (quote !== '"' && quote !== "'") {
      put(quote);
      continue;
    }
    const after = text[index + 1] || "";
    const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
    if (quote === '"') {
      if (opening && after && !/\s/u.test(after)) {
        doubleOpen = true;
        put("\u201C");
      } else if (/\d/u.test(before) && !doubleOpen) put(quote);
      else {
        doubleOpen = false;
        put("\u201D");
      }
      continue;
    }
    const rest = text.slice(index + 1);
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) put("\u2019");
    else if (opening && (elision.test(rest) || loose.test(rest) && !closesLater(index) || /^n(?=['\u2019]?(?:\s|$))/iu.test(rest) && pairWordBefore(text, index))) put("\u2019");
    else if (opening && after && !/\s/u.test(after)) {
      singleOpen = true;
      put("\u2018");
    } else if (/\d/u.test(before) && !singleOpen) put(quote);
    else {
      singleOpen = false;
      put("\u2019");
    }
  }
  return out;
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

// src/lib/v4/validate.ts
var warned = /* @__PURE__ */ new Set();
function describe(value) {
  if (value === null || value === void 0) return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "an array";
  if (typeof value === "function") return "a function";
  if (value.nodeType !== void 0) return "a " + (value.nodeName || "node").toLowerCase() + " node";
  return "an object";
}
function warn(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn("[typeset] " + message);
}
var choices = {
  lineBreaks: ["unicode", "legacy"],
  smartQuotes: ["en", false],
  contour: ["finished", "natural"],
  mode: ["body", "heading", "title", "ui"],
  density: ["compact", "editorial"]
};
var booleans = ["opticalHanging", "spacing", "tracking"];
var list = (values) => values.map((value) => typeof value === "string" ? JSON.stringify(value) : String(value)).join(" or ").replace(/ or (?=.* or )/g, ", ");
function checkOptions(api, options) {
  if (options === void 0) return;
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    warn(api + " options must be an object (received " + describe(options) + ")");
    return;
  }
  for (const [key, value] of Object.entries(options)) {
    if (value === void 0) continue;
    if (Object.prototype.hasOwnProperty.call(choices, key)) {
      if (!choices[key].includes(value)) warn(key + " must be " + list(choices[key]) + " (received " + describe(value) + ")");
    } else if (booleans.includes(key)) {
      if (typeof value !== "boolean") warn(key + " must be true or false (received " + describe(value) + ")");
    } else if (key === "maxLines") {
      if (!Number.isInteger(value) || value < 1) warn("maxLines must be a positive integer (received " + describe(value) + ")");
    } else if (key === "keep") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) warn("keep must be an array of strings (received " + describe(value) + ")");
    } else if (key === "text") {
      if (typeof value !== "string") warn("text must be a string (received " + describe(value) + ")");
    } else warn(api + " has no option " + JSON.stringify(key) + "; it is ignored");
  }
}
function checkSelector(api, selector) {
  if (selector !== void 0 && typeof selector !== "string") warn(api + " selector must be a string (received " + describe(selector) + ")");
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
var graphemeSegmenter3;
var graphemes2 = () => graphemeSegmenter3 ??= new Intl.Segmenter(void 0, { granularity: "grapheme" });
function planTrackingFinish(element, layout, targets) {
  const result = (outcome, runs2 = []) => ({ outcome, runs: runs2, before: layout, targets });
  const style = getComputedStyle(element);
  if (style.direction !== "ltr" || style.writingMode !== "horizontal-tb" || !["left", "start"].includes(style.textAlign)) return result("native:tracking-layout");
  const source = element.textContent || "", texts = textRuns2(element);
  const segmenter2 = graphemes2();
  const runs = [];
  let unsupported2 = false, held = false;
  for (const [line, box] of layout.lines.slice(0, -1).entries()) {
    const desired = targets[line] - box.width;
    if (!Number.isFinite(desired) || Math.abs(desired) < 0.25) continue;
    if ([...box.text].some((char) => /\p{L}/u.test(char) && !/\p{Script=Latin}/u.test(char))) {
      unsupported2 = true;
      continue;
    }
    if (texts.some((text) => text.start < box.sourceEnd && text.end > box.sourceStart && heldAfterComment(text.node))) {
      held = true;
      continue;
    }
    const pieces = [];
    for (const text of texts) {
      const start2 = Math.max(box.sourceStart, text.start), end = Math.min(box.sourceEnd, text.end);
      if (end <= start2 || text.node.parentElement?.closest("code, kbd, samp")) continue;
      const parent = text.node.parentElement;
      if (!parent) continue;
      const cs = getComputedStyle(parent), fontSize = parseFloat(cs.fontSize);
      const letterSpacing = resolvedSpacing(cs.letterSpacing), wordSpacing = resolvedSpacing(cs.wordSpacing);
      if (!(fontSize > 0) || !Number.isFinite(letterSpacing) || !Number.isFinite(wordSpacing)) return result("native:tracking-measurement");
      const count = [...segmenter2.segment(source.slice(start2, end))].filter((part) => !/^\s+$/u.test(part.segment)).length;
      const previous = pieces.at(-1);
      let adjacent = previous?.last.nextSibling || null;
      while (adjacent?.nodeType === Node.ELEMENT_NODE && (adjacent.hasAttribute("data-ts-space") || adjacent.hasAttribute("data-ts-shield")) || adjacent?.nodeType === Node.TEXT_NODE && !adjacent.length) adjacent = adjacent.nextSibling;
      if (previous && adjacent === text.node && previous.end === start2) {
        previous.end = end;
        previous.count += count;
        previous.last = text.node;
      } else pieces.push({ start: start2, end, line, px: 0, fontSize, letterSpacing, wordSpacing, last: text.node, count });
    }
    const capacity = pieces.reduce((sum, run) => sum + run.count * run.fontSize, 0);
    if (!capacity) continue;
    const em = Math.max(-MAX_TRACKING_EM, Math.min(MAX_TRACKING_EM, desired / capacity));
    for (const { last: _last, count, ...run } of pieces) if (count) runs.push({ ...run, px: run.fontSize * em });
  }
  if (runs.length > 256) return result("native:tracking-budget");
  return result(runs.length ? "applied" : unsupported2 ? "native:tracking-script" : held ? "native:tracking-comment" : "unchanged", runs);
}
var heldAfterComment = (node) => node.length > 0 && !engineText.has(node) && afterComment(node) && !reactOwned(node);
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
  const split = (head, at) => {
    const tail = head.splitText(at);
    engineText.add(tail);
    const record = splits.get(head) || { head, parts: [head], expected: [] };
    record.parts.splice(1, 0, tail);
    splits.set(head, record);
    return tail;
  };
  for (const run of [...plan.runs].reverse()) {
    const a = texts.find((text) => text.start <= run.start && text.end > run.start);
    const b = texts.find((text) => text.start < run.end && text.end >= run.end);
    if (!a || !b || a.node.parentNode !== b.node.parentNode) continue;
    const end = run.end - b.start;
    if (end < b.node.length) split(b.node, end);
    const first = run.start > a.start ? split(a.node, run.start - a.start) : a.node;
    const last = a.node === b.node ? first : b.node;
    const nodes = [];
    for (let node = first; node; node = node.nextSibling) {
      nodes.push(node);
      if (node === last) break;
    }
    let wrapper = null;
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE && !engineText.has(node) && (!node.length || afterComment(node) || positional(node) || reactOwned(node))) {
        if (!node.length || heldAfterComment(node)) {
          wrapper = null;
          continue;
        }
        const piece = split(node, 0);
        if (!wrapper || wrapper.nextSibling !== piece) {
          wrapper = trackingWrapper(element, run);
          piece.before(wrapper);
        }
        wrapper.append(piece);
        continue;
      }
      if (!wrapper || wrapper.nextSibling !== node) {
        wrapper = trackingWrapper(element, run);
        node.before(wrapper);
      }
      wrapper.append(node);
    }
  }
  for (const record of splits.values()) record.expected = record.parts.map((part) => part.data);
  const shields = splits.size ? shieldWhitespace(element) : [];
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  let released = false;
  return { nodes: [element], heads: new Set(splits.keys()), cleanup(written) {
    if (released) return;
    released = true;
    const restoreSelection2 = selectionBookmark(element);
    shields.forEach((shield) => shield.remove());
    element.querySelectorAll("[" + TRACK_ATTRIBUTE + "]").forEach((wrapper) => wrapper.replaceWith(...wrapper.childNodes));
    releaseSplits(element, splits.values(), written);
    releaseCopy();
    restoreSelection2();
  }, rejoin() {
    if (released) return;
    released = true;
    rejoinSplits(element, splits.values());
    releaseCopy();
  } };
}
function trackingWrapper(element, run) {
  const wrapper = element.ownerDocument.createElement("span");
  wrapper.setAttribute(TRACK_ATTRIBUTE, String(run.start));
  Object.assign(wrapper.style, trackingStyle(run));
  return wrapper;
}
function trackingVerified(element, plan, after) {
  const wrappers = Array.from(element.querySelectorAll("[" + TRACK_ATTRIBUTE + "]"));
  if (new Set(wrappers.map((wrapper) => wrapper.getAttribute(TRACK_ATTRIBUTE))).size !== plan.runs.length || after.lines.length !== plan.before.lines.length || Math.abs(after.width - plan.before.width) > 0.5 || after.overflow > Math.max(0.5, plan.before.overflow)) return false;
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

// src/lib/v4/lifecycle.ts
var hubs = /* @__PURE__ */ new WeakMap();
var LATCH = /* @__PURE__ */ Symbol.for("typeset.us:translated");
var latched = {
  has: (doc) => !!doc[LATCH],
  add: (doc) => {
    doc[LATCH] = true;
  },
  delete: (doc) => {
    delete doc[LATCH];
  }
};
function translatedClass(doc) {
  const list2 = doc.documentElement?.classList;
  return !!list2 && (list2.contains("translated-ltr") || list2.contains("translated-rtl"));
}
function translationActive(doc) {
  return latched.has(doc) || translatedClass(doc);
}
var metric = /^(?:font|letter-spacing|word-spacing|line-height|text-transform|text-indent|tab-size|transform$|scale$|rotate$|zoom$)/u;
function sheetNode(node, holding = false) {
  if (node?.nodeType !== 1) return false;
  const el = node;
  return el.localName === "style" || el.localName === "link" && /(?:^|\s)stylesheet(?:\s|$)/iu.test(el.getAttribute("rel") || "") || holding && !!el.querySelector?.('style, link[rel~="stylesheet" i]');
}
function styleMutation(record) {
  if (record.type === "characterData") return record.target.parentElement?.localName === "style";
  if (record.type === "childList") return sheetNode(record.target) || [...record.addedNodes, ...record.removedNodes].some((node) => sheetNode(node, true));
  return sheetNode(record.target) || record.attributeName === "rel" && /(?:^|\s)stylesheet(?:\s|$)/iu.test(record.oldValue || "");
}
function notify(hub, call) {
  for (const client of [...hub.clients]) call(client);
}
function markTranslated(doc) {
  if (latched.has(doc)) return;
  latched.add(doc);
  const hub = hubs.get(doc);
  if (hub && !hub.translated) {
    hub.translated = true;
    notify(hub, (client) => client.translation?.(true));
  }
}
function movedOnly(before, after) {
  const declarations = (text) => new Map((text || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const at = part.indexOf(":");
    return at < 0 ? [part, ""] : [part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()];
  }));
  const a = declarations(before), b = declarations(after);
  for (const name of /* @__PURE__ */ new Set([...a.keys(), ...b.keys()])) {
    if (a.get(name) === b.get(name) || name === "opacity" || name === "translate") continue;
    if (name === "transform" && [a.get(name), b.get(name)].every((value) => value === void 0 || /^(?:none|(?:translate(?:3d|x|y|z)?\([^()]*\)\s*)+)$/iu.test(value))) continue;
    return false;
  }
  return true;
}
var prints = /* @__PURE__ */ new WeakMap();
function printing(doc) {
  if (!prints.has(doc)) prints.set(doc, doc.defaultView?.matchMedia?.("print"));
  return !!prints.get(doc)?.matches;
}
function rendered(element) {
  if (!element.getClientRects().length) return getComputedStyle(element).display === "contents";
  const check = element.checkVisibility;
  return typeof check !== "function" || check.call(element, { contentVisibilityAuto: true });
}
function nearObserver(doc, callback) {
  const view = doc.defaultView;
  if (!view || typeof view.IntersectionObserver !== "function") return null;
  const observers = /* @__PURE__ */ new Map();
  const roots = /* @__PURE__ */ new WeakMap();
  const scrollport = (element) => {
    for (let node = element.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      const cs = view.getComputedStyle(node);
      if (/^(?:auto|scroll|overlay)$/u.test(cs.overflowY) || /^(?:auto|scroll|overlay)$/u.test(cs.overflowX)) return node;
    }
    return null;
  };
  return {
    observe(element) {
      let root = roots.get(element);
      if (root === void 0) {
        root = scrollport(element);
        roots.set(element, root);
      }
      let entry = observers.get(root);
      if (!entry) {
        entry = { observer: new view.IntersectionObserver(callback, { root, rootMargin: "100% 0px" }), targets: /* @__PURE__ */ new Set() };
        observers.set(root, entry);
      }
      entry.observer.observe(element);
      entry.targets.add(element);
    },
    unobserve(element) {
      const root = roots.get(element);
      const entry = root === void 0 ? void 0 : observers.get(root);
      if (!entry) return;
      entry.observer.unobserve(element);
      entry.targets.delete(element);
      if (root && !entry.targets.size) {
        entry.observer.disconnect();
        observers.delete(root);
      }
    },
    disconnect() {
      for (const entry of observers.values()) entry.observer.disconnect();
      observers.clear();
    }
  };
}
function armFonts(doc) {
  const hub = hubs.get(doc);
  if (!hub) return;
  const settled = () => {
    if (hubs.get(doc) === hub) notify(hub, (client) => client.fonts?.());
  };
  const fonts = doc.fonts;
  if (!fonts) return;
  if (fonts.status === "loading" && !hub.ready) {
    hub.ready = true;
    fonts.ready.then(() => {
      hub.ready = false;
      settled();
    });
  }
  fonts.forEach((face) => {
    if (face.status !== "loading" || hub.faces.has(face)) return;
    hub.faces.add(face);
    face.loaded.then(settled, settled);
  });
}
function start(doc) {
  const view = doc.defaultView;
  const hub = { clients: /* @__PURE__ */ new Set(), faces: /* @__PURE__ */ new WeakSet(), ready: false, translated: translationActive(doc), classed: translatedClass(doc), stop: () => {
  } };
  const resize = () => notify(hub, (client) => client.resize?.());
  const fonts = () => {
    notify(hub, (client) => client.fonts?.());
    armFonts(doc);
  };
  const loading = () => armFonts(doc);
  const ended = (event) => {
    const target = event.target;
    if (target?.nodeType !== 1) return;
    if (event.type === "animationend" || metric.test(event.propertyName || "")) notify(hub, (client) => client.metrics?.(target));
  };
  const visibility = (event) => {
    const target = event.target;
    if (target?.nodeType === 1 && !event.skipped) notify(hub, (client) => client.visibility?.(target));
  };
  const observer = new MutationObserver((records) => {
    let styles = false, rootClass = false;
    for (const record of records) {
      if (record.target === doc.documentElement && record.type === "attributes") rootClass = true;
      else if (styleMutation(record)) styles = true;
    }
    if (rootClass) {
      const classed = translatedClass(doc);
      if (hub.classed && !classed) latched.delete(doc);
      hub.classed = classed;
      const now = translationActive(doc);
      if (now !== hub.translated) {
        hub.translated = now;
        notify(hub, (client) => client.translation?.(now));
      }
    }
    if (styles) {
      notify(hub, (client) => client.styles?.());
      armFonts(doc);
    }
  });
  if (doc.documentElement) observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["class"] });
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: ["media", "disabled", "href", "rel"] });
  const faces = doc.fonts;
  faces?.addEventListener?.("loadingdone", fonts);
  faces?.addEventListener?.("loading", loading);
  doc.addEventListener("transitionend", ended, true);
  doc.addEventListener("animationend", ended, true);
  doc.addEventListener("contentvisibilityautostatechange", visibility, true);
  view?.addEventListener("resize", resize);
  const print = view?.matchMedia?.("print");
  const printed = () => {
    if (print?.matches) ensureLifecycleStyles(doc);
    else resize();
  };
  print?.addEventListener?.("change", printed);
  hub.stop = () => {
    view?.removeEventListener("resize", resize);
    print?.removeEventListener?.("change", printed);
    observer.disconnect();
    faces?.removeEventListener?.("loadingdone", fonts);
    faces?.removeEventListener?.("loading", loading);
    doc.removeEventListener("transitionend", ended, true);
    doc.removeEventListener("animationend", ended, true);
    doc.removeEventListener("contentvisibilityautostatechange", visibility, true);
  };
  return hub;
}
function subscribe(doc, client) {
  let hub = hubs.get(doc);
  if (!hub) {
    hub = start(doc);
    hubs.set(doc, hub);
  }
  const current = hub;
  current.clients.add(client);
  return () => {
    current.clients.delete(client);
    if (!current.clients.size && hubs.get(doc) === current) {
      current.stop();
      hubs.delete(doc);
    }
  };
}
var LIFECYCLE_CSS = "[data-ts-stale]{--ts-break-display:none}[data-ts-stale] :is([data-ts-space],[data-ts-hang])[data-ts-break]{margin-left:0!important}[data-ts-stale] [data-ts-track]{letter-spacing:inherit!important;word-spacing:inherit!important}[data-ts-stale]>.ts-line[data-ts-generated]{display:inline!important;word-spacing:inherit!important}@media print{:root{--ts-break-display:none}:is([data-ts-space],[data-ts-hang])[data-ts-break]{margin-left:0!important}[data-ts-track]{letter-spacing:inherit!important;word-spacing:inherit!important}.ts-line[data-ts-generated]{display:inline!important;word-spacing:inherit!important}}";
var sheets = /* @__PURE__ */ new WeakMap();
function installLifecycleStyles(doc, element) {
  const known = sheets.get(doc);
  if (known === null) return;
  if (known) ensureLifecycleStyles(doc);
  else try {
    const Sheet = doc.defaultView?.CSSStyleSheet;
    if (!Sheet || !("adoptedStyleSheets" in doc)) {
      sheets.set(doc, null);
      return;
    }
    const sheet = new Sheet();
    sheet.replaceSync(LIFECYCLE_CSS);
    sheets.set(doc, sheet);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch {
    sheets.set(doc, null);
    return;
  }
  if (element) lifecycleStylesFor(element);
}
function lifecycleStylesFor(element) {
  const root = element.getRootNode();
  const sheet = root.nodeType === 11 && root.host ? sheets.get(element.ownerDocument) : null;
  if (!sheet) return;
  try {
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
  }
}
function ensureLifecycleStyles(doc) {
  const sheet = sheets.get(doc);
  if (!sheet) return;
  try {
    if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch {
  }
}

// src/lib/v4/ownership.ts
var mountOwners = /* @__PURE__ */ new WeakMap();
var mountWaiters = /* @__PURE__ */ new WeakMap();
function releaseOwner(element, identity) {
  if (mountOwners.get(element) !== identity) return;
  mountOwners.delete(element);
  const waiters = mountWaiters.get(element);
  mountWaiters.delete(element);
  for (const wake of waiters || []) wake();
}

// src/lib/v4/typeset.next.ts
var VERSION = "4.3.0";
var states = /* @__PURE__ */ new WeakMap();
function staleSplit(element, state, record, written) {
  if (record.type === "characterData") {
    const composed = state.heads.get(record.target);
    if (composed === void 0 || record.target.data === composed && record.oldValue !== composed) return false;
    written.add(record.target);
    return true;
  }
  return record.type === "childList" && Array.from(record.removedNodes).some((node) => state.heads.has(node) && !element.contains(node));
}
function releaseOutput(element, state, written) {
  const restoreSelection = selectionBookmark(element);
  state.optical?.cleanup(written);
  state.tracking?.cleanup(written);
  state.spacing?.cleanup(written);
  state.rich?.cleanup(written);
  state.signature = "";
  restoreSelection();
}
var authorTexts = /* @__PURE__ */ new WeakMap();
var measurements = /* @__PURE__ */ new WeakMap();
var fontVersions = /* @__PURE__ */ new WeakMap();
var fontIds = /* @__PURE__ */ new WeakMap();
var fontsSeen = /* @__PURE__ */ new WeakMap();
var nextFontId = 0;
function fontVersion(doc) {
  let version = fontVersions.get(doc);
  if (!version) {
    version = { epoch: 0 };
    fontVersions.set(doc, version);
    const current = version;
    doc.fonts?.addEventListener?.("loadingdone", () => {
      current.epoch++;
    });
  }
  const faces = [], seen = [];
  doc.fonts?.forEach((face) => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFontId);
    seen.push(face);
    faces.push([fontIds.get(face), face.family, face.status, face.weight, face.style, face.stretch].join(":"));
  });
  fontsSeen.set(doc, seen);
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
function layoutKey(el) {
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const inset = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0") + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.borderRightWidth || "0");
  const used = parseFloat(cs.width);
  const layout = cs.boxSizing === "border-box" ? used : used + inset;
  const scale = layout > 0 ? Math.round(box.width / layout * 1e3) / 1e3 : 1;
  const zoom = el.currentCSSZoom ?? 1;
  return JSON.stringify([
    Math.max(0, box.width - inset),
    scale,
    layout,
    fontVersion(el.ownerDocument),
    el.ownerDocument.fonts?.status,
    zoom,
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
    cs.textAlignLast,
    cs.direction,
    cs.writingMode,
    cs.display,
    cs.textWrap,
    cs.hyphens,
    cs.wordBreak,
    cs.lineBreak,
    cs.overflowWrap,
    cs.getPropertyValue("-webkit-line-clamp"),
    cs.overflow,
    cs.textOverflow,
    cs.textIndent,
    cs.boxSizing,
    cs.maxInlineSize,
    // A shrink-to-fit block is pinned to its composed width; its parent's width decides.
    cs.display === "inline-block" && el.parentElement ? contentWidth(el.parentElement) : null,
    el.closest("[lang]")?.getAttribute("lang"),
    el.dataset.typesetMode,
    getComputedStyle(el, "::before").content,
    getComputedStyle(el, "::after").content,
    // Author descendants only: the engine's own tracking spans need no fingerprint.
    el.querySelector(":not([data-ts-break]):not(.ts-line):not([data-ts-track])") ? richFingerprint(el) : ""
  ]);
}
function transformOnly(a, b) {
  return a.slice(a.indexOf(",", a.indexOf(",") + 1)) === b.slice(b.indexOf(",", b.indexOf(",") + 1));
}
function optionsKey(options) {
  return JSON.stringify([options.mode, options.keep, options.maxLines, options.density, options.text, options.lineBreaks, options.smartQuotes, options.opticalHanging, options.spacing, options.tracking, options.contour]);
}
function signature(el, options, layout = layoutKey(el)) {
  return el.innerHTML + "\0" + layout + "\0" + optionsKey(options);
}
function layoutIntact(el) {
  const outcome = el.dataset.tsOutcome;
  if (outcome !== "composed:rich" && outcome !== "composed") return true;
  const lines = measureLayout(el).lines.length;
  return outcome === "composed" ? lines === el.querySelectorAll(":scope > .ts-line").length : lines === el.querySelectorAll("br[data-ts-break]").length + 1;
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
  return el.innerHTML === state.markup && el.childNodes.length === state.outputNodes.length && state.outputNodes.every((node, i) => el.childNodes[i] === node) && (!state.rich || state.rich.nodes.every((node) => node === el || el.contains(node)));
}
function restore(element) {
  settleTranslation(element);
  const state = states.get(element);
  if (!state) {
    if (element.dataset.tsOutcome === "native:translated") delete element.dataset.tsOutcome;
    return;
  }
  const restoreSelection = selectionBookmark(element);
  state.optical?.cleanup();
  state.tracking?.cleanup();
  state.spacing?.cleanup();
  if (state.rich) state.rich.cleanup();
  else if (ownsOutput(element, state) && !state.nodes.every((node, i) => element.childNodes[i] === node)) element.replaceChildren(...state.nodes);
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
  element.removeAttribute("data-ts-stale");
}
var translated = /* @__PURE__ */ new WeakMap();
function yieldToTranslation(element) {
  const state = states.get(element);
  const spaces = /* @__PURE__ */ new Set();
  const beside = (node) => {
    for (const sibling of [node.previousSibling, node.nextSibling]) if (sibling?.nodeType === Node.TEXT_NODE && sibling.length && !/\S/u.test(sibling.data)) spaces.add(sibling);
  };
  for (const marker of element.querySelectorAll("[data-ts-break]")) {
    beside(marker);
    marker.remove();
  }
  for (const wrapper of element.querySelectorAll("[data-ts-track], .ts-line[data-ts-generated]")) {
    beside(wrapper);
    wrapper.replaceWith(...wrapper.childNodes);
  }
  for (const space of spaces) if (space.parentNode && element.contains(space)) space.parentNode.insertBefore(space, space.nextSibling);
  if (state && !translated.has(element)) translated.set(element, state);
  if (state) {
    resetStyles(element, state);
    if (element.style.getPropertyPriority("text-wrap-style") === "important" && element.style.getPropertyValue("text-wrap-style") === "auto") element.style.removeProperty("text-wrap-style");
    if (!state.hadStyle && !element.style.length) element.removeAttribute("style");
  }
  states.delete(element);
  for (const name of ["typesetDone", "tsQuotes", "tsHanging", "tsSpacing", "tsTracking"]) delete element.dataset[name];
  element.removeAttribute("data-ts-stale");
}
function settleTranslation(element) {
  const state = translated.get(element);
  if (!state || translationActive(element.ownerDocument)) return;
  translated.delete(element);
  const restoreSelection = selectionBookmark(element);
  for (const output of [state.optical, state.tracking, state.spacing, state.rich]) output?.rejoin();
  state.quotes?.restore();
  restoreSelection();
}
function makeMeasurer2(element) {
  const cs = getComputedStyle(element);
  const styleKey = JSON.stringify([
    fontVersion(element.ownerDocument),
    element.ownerDocument.fonts?.status,
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
      spans.forEach((span, i) => remember(pending[i], span.getBoundingClientRect().width));
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
  if (element?.nodeType !== 1) {
    throw new TypeError("[typeset] typeset() expects an HTMLElement (received " + describe(element) + (typeof element === "string" ? "; typesetAll() and mount() take selectors" : "") + ")");
  }
  const started = performance.now();
  const mode = modeOf(element, options);
  if (element.closest("[data-typeset-react-rich]")) return { outcome: "skipped:framework", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  if (element.closest(excluded) || element.closest("[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line")) {
    return { outcome: "skipped:excluded", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: 0 };
  }
  if (!canCompose(element.ownerDocument)) {
    element.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
    return { outcome: ENVIRONMENT_OUTCOME, mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  if (translationActive(element.ownerDocument)) {
    if (states.has(element) || element.querySelector("[data-ts-break], [data-ts-track]")) yieldToTranslation(element);
    if (options.text !== void 0 && authorTexts.get(element) !== options.text) {
      element.textContent = options.text;
      authorTexts.set(element, options.text);
    }
    element.dataset.tsOutcome = "native:translated";
    return { outcome: "native:translated", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  settleTranslation(element);
  if (liveText(element)) {
    if (states.has(element)) restore(element);
    if (options.text !== void 0) {
      const curled = options.smartQuotes === "en" ? smartQuotes(options.text) : options.text;
      const lang2 = element.closest("[lang]")?.getAttribute("lang");
      if (element.textContent !== options.text && element.textContent !== curled) element.textContent = !lang2 || /^en(?:-|$)/i.test(lang2) ? curled : options.text;
      authorTexts.set(element, options.text);
    }
    return { outcome: "native:live-region", mode, before: emptyMetrics(), after: emptyMetrics(), changed: false, durationMs: performance.now() - started };
  }
  const prior = states.get(element);
  const visible = rendered(element);
  if (prior && !visible && prior.options === optionsKey(options) && ownsOutput(element, prior)) return { ...prior.result, changed: false, durationMs: performance.now() - started };
  if (prior && prior.signature === signature(element, options) && ownsOutput(element, prior)) {
    element.removeAttribute("data-ts-stale");
    return { ...prior.result, changed: false, durationMs: performance.now() - started };
  }
  element.removeAttribute("data-ts-stale");
  if (prior) {
    const restoreSelection = selectionBookmark(element);
    const unchanged = ownsOutput(element, prior);
    prior.optical?.cleanup();
    prior.tracking?.cleanup();
    prior.spacing?.cleanup();
    resetStyles(element, prior);
    if (prior.rich) prior.rich.cleanup();
    else if (unchanged && !prior.nodes.every((node, i) => element.childNodes[i] === node)) element.replaceChildren(...prior.nodes);
    else if (element.querySelector("[data-ts-generated]")) {
      for (const node of prior.outputNodes) {
        if (node.nodeType === 1 && node.parentNode === element && node.hasAttribute("data-ts-generated")) {
          node.replaceWith(...node.childNodes);
        }
      }
    }
    prior.quotes?.restore();
    restoreSelection();
  }
  if (options.text !== void 0) {
    if (element.textContent !== options.text) element.textContent = options.text;
    authorTexts.set(element, options.text);
  }
  const rawMarkup = element.innerHTML;
  const restoreQuoteSelection = selectionBookmark(element);
  const quotes = options.smartQuotes === "en" ? applySmartQuotes(element) : void 0;
  restoreQuoteSelection();
  const source = element.textContent || "";
  const originalMarkup = element.innerHTML;
  const nodes = Array.from(element.childNodes);
  const hadStyle = element.hasAttribute("style");
  const styles = { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize };
  const before = visible ? measureLayout(element) : emptyMetrics();
  let rich;
  let search;
  let fingerprinted;
  const spaceWidths = /* @__PURE__ */ new Map();
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
      const plan = planSpacingFinish(element, measureLayout(element), spaceWidths);
      targets = finishTargets(plan.before.lines.map((line) => line.width), plan.before.width);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      features.spacing = plan.outcome;
      if (plan.adjustments.length) {
        spacing = renderRichText(element, [], [], plan.adjustments);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !spacingVerified(element, plan, measureLayout(element))) {
          spacing.cleanup();
          spacing = void 0;
          features.spacing = "native:spacing-verification";
        }
      }
      fingerprinted = spacing || !plan.adjustments.length ? fingerprint : void 0;
    } else if (options.spacing !== false && mode === "body" && outcome === "composed") {
      features.spacing = Array.from(element.querySelectorAll(".ts-line")).some((line) => parseFloat(line.style.wordSpacing)) ? "applied" : "unchanged";
    }
    if (targets && options.tracking !== false && ["applied", "unchanged"].includes(features.spacing)) {
      const plan = planTrackingFinish(element, measureLayout(element), targets);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      features.tracking = plan.outcome;
      if (plan.runs.length) {
        tracking = renderTracking(element, plan);
        if (element.textContent !== source || richFingerprint(element) !== fingerprint || !trackingVerified(element, plan, measureLayout(element))) {
          tracking.cleanup();
          tracking = void 0;
          features.tracking = "native:tracking-verification";
        }
      }
      fingerprinted = tracking || !plan.runs.length ? fingerprint : void 0;
    }
    if (options.opticalHanging && (outcome === "composed:rich" || outcome === "native:fits")) {
      const layout2 = measureLayout(element);
      const fingerprint = fingerprinted ?? richFingerprint(element);
      const plan = planOpticalHanging(element, layout2);
      features.hanging = plan.outcome;
      if (plan.hangs.length) {
        optical = renderRichText(element, [], plan.hangs);
        const after3 = measureLayout(element);
        if (!opticalVerified(element, layout2, after3, plan.hangs) || richFingerprint(element) !== fingerprint) {
          optical.cleanup();
          optical = void 0;
          features.hanging = "native:hanging-verification";
        }
      }
    }
    const after2 = visible ? measureLayout(element) : emptyMetrics();
    let widest = 0;
    if (outcome.startsWith("composed") && after2.lines.length) {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      const left = box.left + parseFloat(style.borderLeftWidth || "0") + parseFloat(style.paddingLeft || "0");
      widest = Math.max(...after2.lines.map((line) => line.right - left));
      installLifecycleStyles(element.ownerDocument, element);
    }
    element.dataset.tsOutcome = outcome;
    element.dataset.typesetDone = "1";
    element.dataset.tsQuotes = features.quotes;
    element.dataset.tsHanging = features.hanging;
    element.dataset.tsSpacing = features.spacing;
    element.dataset.tsTracking = features.tracking;
    const result = { outcome, mode, before, after: after2, changed: element.innerHTML !== rawMarkup, durationMs: performance.now() - started, ...constraint && { constraint }, ...search && { search }, features };
    const layout = layoutKey(element);
    const heads = /* @__PURE__ */ new Map();
    for (const output of [rich, spacing, tracking, optical]) for (const head of output?.heads || []) heads.set(head, head.data);
    states.set(element, {
      nodes,
      outputNodes: Array.from(element.childNodes),
      source,
      output: element.textContent || "",
      markup: element.innerHTML,
      styles,
      appliedStyles: { textWrap: element.style.textWrap, inlineSize: element.style.inlineSize, maxInlineSize: element.style.maxInlineSize },
      // Never cache a decision made without measurement: the next call decides again.
      signature: outcome === "unmeasurable" ? "" : signature(element, options, layout),
      layout,
      options: optionsKey(options),
      widest,
      result,
      rich,
      hadStyle,
      quotes,
      optical,
      spacing,
      tracking,
      heads,
      english: options.lineBreaks !== "unicode" || languageOf(element.closest("[lang]")?.getAttribute("lang")) === "en"
    });
    return result;
  };
  if (!source.trim()) return finish("native:empty");
  const cs = getComputedStyle(element);
  const lang = element.closest("[lang]")?.getAttribute("lang");
  if (options.lineBreaks !== "unicode" && (lang && !/^en(?:-|$)/i.test(lang) || /[\u0400-\u052f\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff]/u.test(source))) return finish("native:language");
  if (!visible || !before.width || !before.lines.length) return finish("unmeasurable");
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
    const plan = planRichText(element, { ...options, mode }, before, spaceWidths);
    search = plan.search;
    if (plan.outcome !== "composed:rich") return finish(plan.outcome, plan.constraint);
    rich = renderRichText(element, plan.breaks);
    const after2 = measureLayout(element);
    if (!richLayoutVerified(plan, after2) || element.textContent !== source || richFingerprint(element) !== plan.styleSignature || !before.lastSingleton && after2.lastSingleton && mode === "body") {
      rich.cleanup();
      rich = void 0;
      return finish("native:verification");
    }
    fingerprinted = plan.styleSignature;
    return finish("composed:rich");
  }
  if (before.lines.length === 1 && before.overflow <= 0.5) return finish("native:fits");
  if (breaksChangeAlignment(cs)) return finish("native:justify");
  if (mode === "ui") return finish("native:ui");
  if (source.length > 12e3 || source.trim().split(/\s+/u).length > 500) return finish("native:budget");
  const measure2 = makeMeasurer2(element);
  let lines = null;
  try {
    const parts = source.trim().split(/[^\S\u00a0\u202f]+/u);
    const measurements2 = ["0", " ", ...parts];
    if ((mode === "title" || mode === "heading") && parts.length <= 64) {
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j <= parts.length; j++) measurements2.push(parts.slice(i, j).join(" "));
      }
    }
    measure2.prepare(measurements2);
    const tokens = tokenize(source, measure2.measure);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const ch = before.width / Math.max(1, measure2.measure("0"));
    if (mode === "title" || mode === "heading") {
      lines = composeTitle(tokens, before.width, measure2.measure, { ...options, maxLines: options.maxLines || (clamp > 0 ? clamp : void 0) });
    } else {
      const maxLines = options.maxLines || before.lines.length + (before.lastSingleton || options.density === "editorial" ? 1 : 0);
      const tail = parts.slice(-2).join(" ");
      const unavoidableOrphan = before.lastSingleton && measure2.measure(tail) > before.width;
      const composed = composeParagraph(tokens, before.width, ch, { maxLines, candidateBar: 1, allowOrphan: unavoidableOrphan, keep: options.keep });
      const spaceEm = measure2.measure(" ") / fontSize;
      lines = composed && (options.spacing === false ? composed : shapeExactLines(composed, ch, before.width, false, spaceEm, fontSize));
      if (lines && !finalValidate(lines, ch, false, spaceEm, unavoidableOrphan)) lines = null;
    }
  } finally {
    measure2.dispose();
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
var isElement = (node) => node?.nodeType === 1;
function typesetAll(selector = defaults, options = {}) {
  return Array.from(document.querySelectorAll(selector), (el) => typeset(el, options));
}
function lineReview(layout, language, english) {
  const review = [];
  const add = (type, detail) => review.push({ type, detail });
  if (layout.lastSingleton) add("orphan", "One word on the final line; may be unavoidable");
  if (layout.firstSingleton) add("first-singleton", "One word on the first line; may be unavoidable");
  for (const [index, line] of layout.lines.slice(0, -1).entries()) {
    const words = line.text.trim().split(/\s+/u);
    const word2 = words.at(-1) || "", previous = words.at(-2), earlier = words.at(-3);
    const first = layout.lines[index + 1].text.trim().split(/\s+/u)[0] || "";
    const at = "Line " + (index + 1);
    const designated = previous !== void 0 && boundPair(previous, word2, earlier) === "designator";
    const weak = !boundaryBefore(word2, first) && !designated && (english ? isWeakEnding(word2) : language !== "und" && language !== "en" && language !== "invalid" && languageWeakEnding(word2, language));
    if (weak) add("weak-line-end", at + ' ends on "' + word2 + '"');
    if (english && strandedOpener(line.text)) add("stranded-opener", at + " leaves a sentence or clause opener at its end");
    const pair = english ? boundPair(word2, first, previous) : null;
    if (pair) add("bound-split", at + ' separates "' + word2 + '" from "' + first + '" (' + { unit: "number and unit", honorific: "honorific and name", label: "label and number", designator: "word and letter designator" }[pair] + ")");
    if (/^\./u.test(first)) add("split-ellipsis", "Line " + (index + 2) + " begins with the rest of a split ellipsis");
    else if (/^[\u2013\u2014,;:!?)\]}\u201D\u2019\u00BB]/u.test(first) && !/^\u2019[\p{L}\p{N}]/u.test(first)) add("line-initial-punctuation", "Line " + (index + 2) + ' begins with "' + first[0] + '"');
  }
  return review;
}
function auditReport(selector = defaults) {
  const report = { examined: 0, outcomes: {}, features: { quotes: {}, hanging: {}, spacing: {}, tracking: {} }, issues: [] };
  for (const element of document.querySelectorAll(selector)) {
    if (element.closest("[data-ts-generated], [data-ts-probe]")) continue;
    report.examined++;
    const outcome = element.dataset.tsOutcome || (element.closest(excluded) ? "excluded" : liveText(element) ? "native:live-region" : "unprocessed");
    report.outcomes[outcome] = (report.outcomes[outcome] || 0) + 1;
    for (const [feature, value] of [["quotes", element.dataset.tsQuotes], ["hanging", element.dataset.tsHanging], ["spacing", element.dataset.tsSpacing], ["tracking", element.dataset.tsTracking]]) {
      const status = value || "off";
      report.features[feature][status] = (report.features[feature][status] || 0) + 1;
    }
    const layout = measureForAudit(element);
    const add = (type, severity, detail) => report.issues.push({ element, type, severity, detail });
    if (layout.overflow > 0.75) add("overflow", "error", layout.overflow.toFixed(2) + "px outside content box");
    if (element.querySelector(".ts-line .ts-line")) add("nested-output", "error", "Generated lines contain generated lines");
    const style = getComputedStyle(element);
    if (outcome.startsWith("composed") && breaksChangeAlignment(style)) {
      add("alignment-lost", "error", "text-align: " + style.textAlign + (style.textAlignLast && style.textAlignLast !== "auto" ? ", text-align-last: " + style.textAlignLast : "") + " cannot apply to composed lines, which each end in a generated break");
    }
    let hiddenBreaks = 0;
    for (const br of element.querySelectorAll('br[data-ts-break][aria-hidden="true" i]')) {
      const range = element.ownerDocument.createRange();
      range.setStart(element, 0);
      range.setEndBefore(br);
      const before = range.toString();
      range.setStartAfter(br);
      range.setEnd(element, element.childNodes.length);
      if (/\s$/u.test(before) || /^\s/u.test(range.toString())) hiddenBreaks++;
    }
    if (hiddenBreaks) add("hidden-break", "error", hiddenBreaks + " generated line break" + (hiddenBreaks === 1 ? " is" : "s are") + " hidden from assistive technology where " + (hiddenBreaks === 1 ? "it replaces" : "they replace") + " a space; the words on either side are read as one");
    let isolatedSpaces = 0;
    for (const marker of element.querySelectorAll("[data-ts-break]:not(br)")) {
      if (["inline", "none", "contents"].includes(getComputedStyle(marker).display)) continue;
      for (const sibling of [marker.previousSibling, marker.nextSibling]) if (sibling?.nodeType === 3 && /^\s+$/.test(sibling.data)) isolatedSpaces++;
    }
    if (isolatedSpaces) add("isolated-space", "error", isolatedSpaces + " word space" + (isolatedSpaces === 1 ? " stands" : "s stand") + " alone beside inline-block engine markers; Chromium drops " + (isolatedSpaces === 1 ? "it" : "them") + " from the accessibility tree");
    if ((outcome === "composed:rich" || outcome === "composed") && !element.hasAttribute("data-ts-stale")) {
      const expected = outcome === "composed" ? element.querySelectorAll(":scope > .ts-line").length : element.querySelectorAll("br[data-ts-break]").length + 1;
      if (layout.lines.length !== expected) add("stale-layout", "error", layout.lines.length + " rendered lines where the composition has " + expected + "; text metrics changed after it was composed");
    }
    const state = states.get(element);
    const language = languageOf(element.closest("[lang]")?.getAttribute("lang"));
    const english = language === "en" || language === "und" && !!state?.english;
    const review = lineReview(layout, language, english);
    for (const item of review) add(item.type, "review", item.detail);
    const current = !!state && state.output === element.textContent;
    if (state && !current) add("stale-output", "error", "Content changed since the last composition");
    if (current && outcome.startsWith("composed")) {
      const native = lineReview(state.result.before, language, english).length;
      if (review.length > native) add("regressed-vs-native", "review", review.length + " line review items after composition; the native layout had " + native);
    }
    if (outcome === "native:no-candidate") {
      const constraint = current ? state.result.constraint : void 0;
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
    const doc = element.ownerDocument;
    for (let el = element; el; el = el.parentElement) {
      const id = el.id && (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(el.id) : el.id.replace(/[^\w-]/gu, (c) => "\\" + c));
      if (id && doc.querySelectorAll("#" + id).length === 1) {
        path.unshift("#" + id);
        break;
      }
      if (el === doc.documentElement) {
        path.unshift(":root");
        break;
      }
      if (el === doc.body) {
        path.unshift("body");
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
var CONTENT = 1;
var KEY = 2;
var VERIFY = 4;
var RELEASE = 8;
var RESIZE_SETTLE_MS = 100;
var REVEAL_BUDGET_MS = 24;
function mount(target = document, selectorOrOptions, maybeOptions = {}) {
  const byString = typeof target === "string";
  const root = byString ? document : target;
  const selector = byString ? target : typeof selectorOrOptions === "string" ? selectorOrOptions : defaults;
  const options = (byString && selectorOrOptions && typeof selectorOrOptions === "object" ? selectorOrOptions : maybeOptions) || {};
  if (![1, 9, 11].includes(root?.nodeType)) {
    throw new TypeError("[typeset] mount() expects a Document, an Element or a selector string (received " + describe(root) + ")");
  }
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const view = doc.defaultView;
  if (!canMaintain(doc)) {
    const scope = Array.from(root.querySelectorAll(selector));
    if (isElement(root) && root.matches(selector)) scope.unshift(root);
    for (const el of scope) if (!el.closest(excluded)) el.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
    return { ready: Promise.resolve(), refresh() {
    }, disconnect() {
    }, stats: { passes: 0, compositions: 0, maxBatchMs: 0, overlappingTargets: 0 } };
  }
  const identity = /* @__PURE__ */ Symbol("typeset-mount");
  const claimed = /* @__PURE__ */ new Set();
  const blocked = /* @__PURE__ */ new Map();
  const owned = /* @__PURE__ */ new Set();
  const pending = /* @__PURE__ */ new Map();
  const nearby = /* @__PURE__ */ new Set();
  const hidden = /* @__PURE__ */ new Set();
  const resizing = /* @__PURE__ */ new Set();
  const deferred = /* @__PURE__ */ new Set();
  let settleTimer;
  let guardFrame = 0;
  const shownNow = /* @__PURE__ */ new Set();
  let shownFrame = 0;
  let windowWidth = view?.innerWidth ?? 0;
  let composedSince = false, triggeredSince = false;
  let stopped = false;
  let fontsReady = false;
  let timer;
  let idle;
  const stats = { passes: 0, compositions: 0, maxBatchMs: 0, get overlappingTargets() {
    return blocked.size;
  } };
  let resolveReady = () => {
  };
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const within = (el) => el === root || root.contains(el);
  const eligible = (el) => within(el) && el.matches(selector) && !el.closest(excluded) && !liveText(el);
  const stopWaiting = (el) => {
    const wake = blocked.get(el);
    if (!wake) return;
    const waiters = mountWaiters.get(el);
    waiters?.delete(wake);
    if (!waiters?.size) mountWaiters.delete(el);
    blocked.delete(el);
  };
  const claim = (el) => {
    const owner = mountOwners.get(el);
    if (owner && owner !== identity) {
      if (!blocked.has(el)) {
        const wake = () => {
          blocked.delete(el);
          if (!stopped && eligible(el)) {
            enqueue(el);
            schedule();
          }
        };
        blocked.set(el, wake);
        let waiters = mountWaiters.get(el);
        if (!waiters) {
          waiters = /* @__PURE__ */ new Set();
          mountWaiters.set(el, waiters);
        }
        waiters.add(wake);
      }
      return false;
    }
    stopWaiting(el);
    mountOwners.set(el, identity);
    claimed.add(el);
    return true;
  };
  const release = (el) => {
    claimed.delete(el);
    if (mountOwners.get(el) !== identity) return;
    mountOwners.delete(el);
    const waiters = mountWaiters.get(el);
    mountWaiters.delete(el);
    for (const wake of waiters || []) wake();
  };
  const select = (scope = root) => {
    if (isElement(root) && scope.contains(root)) scope = root;
    const elements = Array.from(scope.querySelectorAll(selector));
    if (isElement(scope) && scope.matches(selector)) elements.unshift(scope);
    return elements.filter((el) => within(el) && !el.closest(excluded) && !el.closest("[data-ts-generated], [data-ts-probe], [data-ts-track], .ts-line") && !liveText(el));
  };
  const viewport = nearObserver(doc, (entries) => {
    let near = false;
    for (const entry of entries) {
      const el = entry.target;
      if (entry.isIntersecting) nearby.add(el);
      else nearby.delete(el);
      if (deferred.has(el)) {
        if (!entry.isIntersecting) continue;
        deferred.delete(el);
        enqueue(el, KEY, true);
      }
      viewport?.unobserve(el);
      if (entry.isIntersecting && pending.has(el)) near = true;
    }
    if (near) schedule();
  });
  const enqueue = (el, job = CONTENT, near = false) => {
    if (!claim(el)) return;
    const queued = pending.get(el);
    if (near) nearby.add(el);
    else if (queued === void 0 && job & CONTENT && !nearby.has(el)) viewport?.observe(el);
    if (job & CONTENT) deferred.delete(el);
    pending.set(el, (queued || 0) | job);
  };
  const recheck = (el, job) => enqueue(el, job, onScreen(el));
  const revealed = (el, job) => {
    hidden.delete(el);
    const box = el.getBoundingClientRect(), height = view?.innerHeight ?? 0;
    if (!viewport || box.bottom > -height && box.top < 2 * height) enqueue(el, job, true);
    else {
      deferred.add(el);
      viewport.observe(el);
    }
  };
  const animating = /* @__PURE__ */ new WeakMap();
  const awaitTransforms = (el) => {
    for (const animation of doc.getAnimations?.() ?? []) {
      const target2 = animation.effect?.target;
      if (!target2 || animation.playState === "finished" || !(target2 === el || target2.contains(el))) continue;
      if (animation.effect?.getComputedTiming().endTime === Infinity) continue;
      let waiting = animating.get(animation);
      if (!waiting) {
        const set = waiting = /* @__PURE__ */ new Set();
        animating.set(animation, set);
        const ended = () => {
          animating.delete(animation);
          if (stopped) return;
          for (const block of set) if (owned.has(block)) recheck(block, KEY);
          schedule();
        };
        animation.finished.then(ended, ended);
      }
      waiting.add(el);
    }
  };
  const discover = (scope = root) => {
    for (const el of select(scope)) if (!owned.has(el)) enqueue(el);
  };
  const ownedWithin = (node) => {
    const found = [];
    for (const el of owned) if (node === el || node.contains(el)) found.push(el);
    return found;
  };
  const drop = (el) => {
    owned.delete(el);
    pending.delete(el);
    nearby.delete(el);
    hidden.delete(el);
    deferred.delete(el);
    viewport?.unobserve(el);
    unwatch(el);
    release(el);
  };
  const onScreen = (el) => {
    const box = el.getBoundingClientRect();
    return box.bottom > 0 && box.top < (view?.innerHeight ?? 0) && box.right > 0 && box.left < (view?.innerWidth ?? 0);
  };
  const composeNow = (elements) => {
    const start2 = performance.now(), later = [];
    observer.disconnect();
    for (const el of elements) {
      if (performance.now() - start2 > REVEAL_BUDGET_MS) {
        later.push(el);
        continue;
      }
      pending.delete(el);
      process(el, KEY);
    }
    guard(later);
    for (const el of later) enqueue(el, KEY, true);
    observe();
  };
  const guard = (elements) => {
    if (printing(doc)) return;
    ensureLifecycleStyles(doc);
    const stale = [];
    for (const el of elements) {
      const widest = states.get(el)?.widest;
      if (!widest || el.hasAttribute("data-ts-stale")) continue;
      const width = boxOf(el).w;
      if (width > 0 && width < widest - 0.01) stale.push(el);
    }
    for (const el of stale) {
      lifecycleStylesFor(el);
      el.setAttribute("data-ts-stale", "");
    }
  };
  const settle = () => {
    settleTimer = void 0;
    if (stopped) return;
    const height = view?.innerHeight ?? 0;
    for (const el of resizing) {
      if (!owned.has(el)) continue;
      const box = el.getBoundingClientRect();
      if (!viewport || box.bottom > -height && box.top < 2 * height) enqueue(el, KEY, true);
      else {
        deferred.add(el);
        viewport.observe(el);
        if (el.hasAttribute("data-ts-stale")) enqueue(el, RELEASE);
      }
    }
    resizing.clear();
    schedule();
  };
  const releaseWaiting = (el) => {
    const state = states.get(el);
    if (state?.signature && el.hasAttribute("data-ts-stale") && !resizing.has(el) && (deferred.has(el) || hidden.has(el))) releaseOutput(el, state, /* @__PURE__ */ new Set());
  };
  const settleLater = () => {
    if (settleTimer !== void 0) clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, RESIZE_SETTLE_MS);
  };
  const resizeStarted = (el) => {
    resizing.add(el);
    if (deferred.delete(el)) viewport?.unobserve(el);
    if (!guardFrame && view) guardFrame = view.requestAnimationFrame(function frame() {
      guardFrame = 0;
      if (stopped || !resizing.size) return;
      guard(resizing);
      guardFrame = view.requestAnimationFrame(frame);
    });
  };
  const widthChanged = (elements) => {
    const changed = [];
    for (const el of elements) {
      const last = sizes.get(el), width = boxOf(el).w;
      if (last?.w && width && Math.abs(last.w - width) > 0.01) changed.push(el);
    }
    return changed;
  };
  const schedule = () => {
    if (stopped || !fontsReady || !pending.size) return;
    let near = false;
    for (const el of nearby) if (pending.has(el)) {
      near = true;
      break;
    }
    if (near) {
      if (timer !== void 0) return;
      if (idle !== void 0) {
        cancelIdleCallback(idle);
        idle = void 0;
      }
      timer = setTimeout(() => flush(), 0);
      return;
    }
    if (timer !== void 0 || idle !== void 0) return;
    if (typeof requestIdleCallback === "function") idle = requestIdleCallback(flush, { timeout: 200 });
    else timer = setTimeout(() => flush(), 16);
  };
  const attributesChanged = (target2, newMatches) => {
    const affected = ownedWithin(target2);
    const resized2 = fontsReady && affected.length ? widthChanged(affected) : [];
    if (resized2.length) {
      guard(resized2);
      for (const el of resized2) resizeStarted(el);
      settleLater();
    }
    const shown = [];
    const revealing = fontsReady && hidden.size > 0 && !printing(doc);
    for (const el of affected) {
      if (resizing.has(el)) continue;
      if (revealing && hidden.has(el) && rendered(el)) {
        if (onScreen(el)) shown.push(el);
        else revealed(el, KEY);
      } else recheck(el, KEY);
    }
    if (shown.length) composeNow(shown);
    for (let el = target2.parentElement; el && within(el); el = el.parentElement) if (owned.has(el)) enqueue(el, CONTENT);
    if (newMatches) discover(target2);
  };
  const observer = new MutationObserver((records) => {
    const restyled = /* @__PURE__ */ new Set(), matching = /* @__PURE__ */ new Set();
    const stale = /* @__PURE__ */ new Set(), written = /* @__PURE__ */ new Set();
    const live = /* @__PURE__ */ new Set();
    for (const record of records) {
      const target2 = isElement(record.target) ? record.target : record.target.parentElement;
      if (!target2) continue;
      if (record.type === "attributes" && record.attributeName?.startsWith("_mst")) {
        triggeredSince = true;
        markTranslated(doc);
        continue;
      }
      if (record.type === "childList" && !translationActive(doc) && [...record.addedNodes].some((node) => node.nodeName === "FONT")) {
        for (let el = target2; el && within(el); el = el.parentElement) if (owned.has(el)) {
          markTranslated(doc);
          break;
        }
      }
      if (record.type === "attributes") {
        if (record.attributeName === "style" && movedOnly(record.oldValue, target2.getAttribute("style"))) continue;
        triggeredSince = true;
        restyled.add(target2);
        if (record.attributeName !== "style") matching.add(target2);
        if (record.attributeName === "aria-live" || record.attributeName === "role") for (const el of ownedWithin(target2)) live.add(el);
        continue;
      }
      triggeredSince = true;
      for (let el = target2; el && within(el); el = el.parentElement) {
        if (!owned.has(el)) continue;
        enqueue(el, CONTENT);
        if (record.type === "childList") live.add(el);
        const state = states.get(el);
        if (state?.heads.size && staleSplit(el, state, record, written)) stale.add(el);
      }
      if (record.type === "childList") {
        for (const node of record.addedNodes) if (isElement(node)) {
          discover(node);
          if (inLiveRegion(node)) for (const el of ownedWithin(node)) live.add(el);
        }
        if (!owned.has(target2) && target2.matches(selector) && !target2.closest(excluded)) discover(target2);
        for (const node of record.removedNodes) {
          if (!isElement(node) || within(node)) continue;
          if (claimed.has(node)) drop(node);
          if (node.firstElementChild) {
            for (const el of node.getElementsByTagName("*")) if (claimed.has(el)) drop(el);
          }
          if (blocked.size) {
            for (const el of blocked.keys()) if (node.contains(el) && !within(el)) stopWaiting(el);
          }
        }
      }
    }
    const released = [...live].filter((el) => owned.has(el) && liveText(el));
    if (stale.size || released.length) {
      observer.disconnect();
      for (const el of stale) {
        const state = states.get(el);
        if (state) releaseOutput(el, state, written);
      }
      for (const el of released) {
        restore(el);
        drop(el);
      }
      observe();
    }
    for (const target2 of restyled) attributesChanged(target2, matching.has(target2));
    schedule();
  });
  const sizes = /* @__PURE__ */ new WeakMap();
  const boxOf = (el) => {
    const cs = getComputedStyle(el);
    let w = parseFloat(cs.width), h = parseFloat(cs.height);
    if (Number.isNaN(w) || Number.isNaN(h)) {
      const rect = el.getBoundingClientRect();
      w = rect.width - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0") - parseFloat(cs.borderLeftWidth || "0") - parseFloat(cs.borderRightWidth || "0");
      h = rect.height - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0") - parseFloat(cs.borderTopWidth || "0") - parseFloat(cs.borderBottomWidth || "0");
    } else if (cs.boxSizing === "border-box") {
      w -= parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0") + parseFloat(cs.borderLeftWidth || "0") + parseFloat(cs.borderRightWidth || "0");
      h -= parseFloat(cs.paddingTop || "0") + parseFloat(cs.paddingBottom || "0") + parseFloat(cs.borderTopWidth || "0") + parseFloat(cs.borderBottomWidth || "0");
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  };
  const keeps = (el) => {
    const state = states.get(el);
    if (!state?.widest || !state.signature || !state.result.outcome.startsWith("composed") || el.hasAttribute("data-ts-stale")) return false;
    if (state.widest > boxOf(el).w + 0.5) return false;
    state.layout = layoutKey(el);
    return true;
  };
  const watched = /* @__PURE__ */ new Map();
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
    let widened = false;
    const own = composedSince && !triggeredSince;
    composedSince = triggeredSince = false;
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const previous = sizes.get(entry.target);
      sizes.set(entry.target, { w: width, h: height });
      if (!previous) continue;
      if (!width) {
        if (owned.has(entry.target)) hidden.add(entry.target);
        continue;
      }
      if (Math.abs(previous.w - width) > 0.01) {
        for (const el of watched.get(entry.target) || []) {
          if (!previous.w || hidden.has(el)) {
            revealed(el, VERIFY);
            shownNow.add(el);
          } else if (entry.target === el || (states.get(el)?.appliedStyles.inlineSize ?? "") !== (states.get(el)?.styles.inlineSize ?? "")) {
            if (own && keeps(el)) continue;
            resizeStarted(el);
            widened = true;
          }
        }
      } else if (Math.abs(previous.h - height) > 0.5 && owned.has(entry.target)) {
        recheck(entry.target, VERIFY);
      }
    }
    if (widened) settleLater();
    if (shownNow.size && !shownFrame && view) shownFrame = view.requestAnimationFrame(() => {
      shownFrame = 0;
      if (!stopped) guard(shownNow);
      shownNow.clear();
    });
    if (pending.size) schedule();
  });
  const parents = /* @__PURE__ */ new Map();
  const watch = (el) => {
    parents.set(el, el.parentElement);
    for (const target2 of [el, el.parentElement]) {
      if (!target2) continue;
      let dependents = watched.get(target2);
      if (!dependents) {
        dependents = /* @__PURE__ */ new Set();
        watched.set(target2, dependents);
        sizes.set(target2, boxOf(target2));
        resize?.observe(target2);
      }
      dependents.add(el);
    }
  };
  const unwatch = (el) => {
    if (!parents.has(el)) return;
    for (const target2 of [el, parents.get(el)]) {
      if (!target2) continue;
      const dependents = watched.get(target2);
      dependents?.delete(el);
      if (!dependents?.size) {
        resize?.unobserve(target2);
        watched.delete(target2);
      }
    }
    parents.delete(el);
  };
  function observe() {
    observer.observe(root, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true, attributeFilter: ["class", "style", "lang", "hidden", "open", "data-no-typeset", "data-typeset", "data-typeset-mode", "aria-live", "role", "_msttexthash", "_msthash"] });
    if (isElement(root)) for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeOldValue: true, attributeFilter: ["class", "style", "lang", "hidden", "open", "aria-live", "role"] });
    }
  }
  const process = (el, job) => {
    if (!within(el)) {
      drop(el);
      return;
    }
    if (!eligible(el)) {
      restore(el);
      drop(el);
      return;
    }
    if (owned.has(el) && parents.get(el) !== el.parentElement) {
      unwatch(el);
      watch(el);
    }
    const state = states.get(el);
    if (!(job & CONTENT) && state && owned.has(el) && !rendered(el)) {
      hidden.add(el);
      return;
    }
    hidden.delete(el);
    const key = !(job & CONTENT) && state?.signature && owned.has(el) ? layoutKey(el) : "";
    if (key && state && key === state.layout) {
      if (el.hasAttribute("data-ts-stale")) {
        el.removeAttribute("data-ts-stale");
        job |= VERIFY;
      }
      if (!(job & VERIFY) || layoutIntact(el)) return;
      state.signature = "";
    } else if (key && state && state.result.outcome.startsWith("composed") && !el.hasAttribute("data-ts-stale") && transformOnly(key, state.layout)) {
      state.layout = key;
      return;
    }
    const result = typeset(el, options);
    if (result.changed) {
      stats.compositions++;
      composedSince = true;
    }
    if (result.outcome === "unmeasurable") hidden.add(el);
    if (result.outcome === "native:transformed") awaitTransforms(el);
    if (!owned.has(el)) {
      owned.add(el);
      watch(el);
    } else if (result.changed) {
      const box = boxOf(el);
      sizes.set(el, { w: sizes.get(el)?.w ?? box.w, h: box.h });
    }
  };
  function flush(deadline) {
    timer = void 0;
    idle = void 0;
    if (stopped || printing(doc)) return;
    observer.disconnect();
    ensureLifecycleStyles(doc);
    const start2 = performance.now();
    stats.passes++;
    const fontsLoading = doc.fonts?.status === "loading";
    if (fontsLoading) armFonts(doc);
    function* work() {
      for (const el of nearby) if (pending.has(el)) yield el;
      yield* pending.keys();
    }
    for (const el of work()) {
      const job = pending.get(el);
      if (job === void 0) continue;
      pending.delete(el);
      if (job & RELEASE) releaseWaiting(el);
      if ((resizing.has(el) || deferred.has(el) || fontsLoading && !nearby.has(el)) && !(job & CONTENT)) continue;
      if (job & (CONTENT | KEY | VERIFY)) {
        nearby.delete(el);
        viewport?.unobserve(el);
        process(el, job);
      }
      if (performance.now() - start2 >= 8 || deadline && !deadline.didTimeout && deadline.timeRemaining() <= 1) break;
    }
    stats.maxBatchMs = Math.max(stats.maxBatchMs, performance.now() - start2);
    observe();
    armFonts(doc);
    if (pending.size) schedule();
    else resolveReady();
  }
  const refresh = () => {
    if (stopped) return;
    triggeredSince = true;
    discover();
    for (const el of owned) recheck(el, KEY | VERIFY);
    schedule();
  };
  const resized = () => {
    triggeredSince = true;
    if (stopped || !fontsReady) return;
    const width = view?.innerWidth ?? 0;
    if (width !== windowWidth) {
      windowWidth = width;
      for (const el of hidden) if (states.get(el)?.widest && !rendered(el)) {
        lifecycleStylesFor(el);
        el.setAttribute("data-ts-stale", "");
        enqueue(el, RELEASE);
      }
    }
    const visible = [];
    for (const el of owned) if (states.get(el)?.widest && onScreen(el)) visible.push(el);
    const changed = widthChanged(visible);
    guard(changed);
    for (const el of changed) resizeStarted(el);
    if (changed.length) settleLater();
    for (const el of owned) if (!resizing.has(el)) enqueue(el, KEY, visible.includes(el));
    schedule();
  };
  const fontsChanged = () => {
    triggeredSince = true;
    if (stopped) return;
    discover();
    for (const el of owned) recheck(el, KEY | VERIFY);
    schedule();
  };
  const metricsChanged = (target2) => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of ownedWithin(target2)) recheck(el, KEY);
    for (let el = target2.parentElement; el && within(el); el = el.parentElement) if (owned.has(el)) recheck(el, KEY);
    schedule();
  };
  const stylesChanged = () => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of owned) recheck(el, KEY);
    schedule();
  };
  const translationChanged = (active) => {
    triggeredSince = true;
    if (stopped) return;
    if (active) {
      observer.disconnect();
      for (const el of owned) typeset(el, options);
      observe();
    } else for (const el of owned) enqueue(el, CONTENT);
    schedule();
  };
  const visibilityChanged = (target2) => {
    triggeredSince = true;
    if (stopped) return;
    for (const el of ownedWithin(target2)) recheck(el, KEY);
    schedule();
  };
  (doc.fonts?.ready ?? Promise.resolve()).then(() => {
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
  const unsubscribe = subscribe(doc, { fonts: fontsChanged, metrics: metricsChanged, styles: stylesChanged, visibility: visibilityChanged, resize: resized, translation: translationChanged });
  return {
    ready,
    refresh,
    stats,
    disconnect(restoreContent = true) {
      stopped = true;
      if (timer !== void 0) clearTimeout(timer);
      if (idle !== void 0) cancelIdleCallback(idle);
      observer.disconnect();
      resize?.disconnect();
      viewport?.disconnect();
      unsubscribe();
      if (settleTimer !== void 0) clearTimeout(settleTimer);
      if (guardFrame) view?.cancelAnimationFrame(guardFrame);
      if (shownFrame) view?.cancelAnimationFrame(shownFrame);
      if (restoreContent) for (const el of owned) restore(el);
      owned.clear();
      pending.clear();
      nearby.clear();
      hidden.clear();
      resizing.clear();
      deferred.clear();
      shownNow.clear();
      watched.clear();
      parents.clear();
      for (const el of blocked.keys()) stopWaiting(el);
      for (const el of claimed) release(el);
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
  linesExtent,
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
  canCompose,
  canMaintain,
  ENVIRONMENT_OUTCOME,
  BREAK_ATTRIBUTE,
  richLayoutVerified,
  selectionBookmark,
  planRichText,
  liveText,
  breakReplacesSpace,
  preserveRichCopy,
  richFingerprint,
  smartQuotes,
  TRACK_ATTRIBUTE,
  planTrackingFinish,
  trackingStyle,
  trackingVerified,
  translationActive,
  styleMutation,
  markTranslated,
  movedOnly,
  printing,
  rendered,
  nearObserver,
  armFonts,
  subscribe,
  installLifecycleStyles,
  lifecycleStylesFor,
  ensureLifecycleStyles,
  checkOptions,
  checkSelector,
  mountOwners,
  releaseOwner,
  VERSION,
  restore,
  typeset,
  typesetAll,
  auditReport,
  audit,
  auditJSON,
  mount
};
/*! @license @cto.af/linebreak 4.0.3 (c) 2023-present Joe Hildebrand, MIT */
/*! @license @cto.af/unicode-trie-runtime (c) 2023, from foliojs/unicode-trie, MIT */
/*! @license fflate (c) 2026 Arjun Barrett, MIT */
/*! @license Unicode 17.0.0 line-break data (c) 1991-2026 Unicode, Inc., Unicode-3.0 */
