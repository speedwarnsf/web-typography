/**
 * typeset.us/go.js v2.0.0
 * Universal typography drop-in script
 * https://typeset.us
 *
 * Measure-first approach: reads the actual rendered layout, then applies
 * targeted fixes. Bindings scale with container width so mobile doesn't
 * get worse than browser defaults.
 */
(function() {
  'use strict';

  var script = document.currentScript;
  var config = {
    selector: (script && script.getAttribute('data-typeset-selector')) ||
      'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt, label',
    disabled: ((script && script.getAttribute('data-typeset-disable')) || '')
      .split(',').map(function(s) { return s.trim(); }).filter(Boolean)
  };

  var skipTags = { PRE: 1, CODE: 1, TEXTAREA: 1, INPUT: 1, SCRIPT: 1, STYLE: 1 };
  var NBSP = '\u00A0';
  var SHY = '\u00AD';

  // Word lists for binding tiers
  var tinyWords = { a:1, i:1, an:1, as:1, at:1, be:1, by:1, 'do':1, go:1,
    'if':1, 'in':1, is:1, it:1, my:1, no:1, of:1, on:1, or:1, so:1, to:1,
    up:1, we:1 };
  var mediumWords = { the:1, and:1, but:1, 'for':1, nor:1, not:1, yet:1,
    its:1, our:1, has:1, was:1, are:1, can:1 };

  // ─── Measurement ───

  var _canvas = null;

  /**
   * Measure element width in ch units using Canvas (no DOM mutation).
   */
  function measureCh(el) {
    var cs = getComputedStyle(el);
    var containerPx = el.clientWidth
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (containerPx <= 0) return 65;

    if (!_canvas) {
      var c = document.createElement('canvas');
      _canvas = c.getContext('2d');
    }
    if (_canvas) {
      _canvas.font = cs.fontSize + ' ' + cs.fontFamily;
      var chPx = _canvas.measureText('0').width;
      if (chPx > 0) return Math.floor(containerPx / chPx);
    }

    // Fallback
    var fsPx = parseFloat(cs.fontSize) || 16;
    return Math.floor(containerPx / (fsPx * 0.6));
  }

  // ─── Sentence detection ───

  function isSentenceEnd(word) {
    return /[.!?]$/.test(word) || /[.!?]["'\u201D\u2019]$/.test(word);
  }

  // ─── Text processing (measure-aware) ───

  /**
   * Apply typographic bindings scaled to container width.
   * At narrow widths, only orphan prevention + numbers.
   * At wide widths, full rules.
   */
  function typesetText(text, measure) {
    if (!text || text.length < 10) return text;
    var words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3) return text;

    var m = measure || 65;
    var doOrphans = m >= 25 && !config.disabled.includes('orphans');
    var doNumbers = m >= 25;
    var doTinyBinding = m >= 45 && !config.disabled.includes('short-words');
    var doSentence = m >= 50 && !config.disabled.includes('sentence-start') &&
                     !config.disabled.includes('sentence-end');
    var doMediumBinding = m >= 55 && !config.disabled.includes('short-words');
    var doFullBinding = m >= 65 && !config.disabled.includes('short-words');

    var result = [];

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var prevWord = i > 0 ? words[i - 1] : null;
      var nextWord = i < words.length - 1 ? words[i + 1] : null;

      // Orphan prevention: bind last two words
      if (doOrphans && i === words.length - 2) {
        result.push(word + NBSP + words[i + 1]);
        break;
      }

      // Sentence-start protection
      if (doSentence && prevWord && isSentenceEnd(prevWord) && nextWord && !isSentenceEnd(word)) {
        var maxLen = m >= 45 ? 6 : 5;
        if (word.length <= maxLen) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
      }

      // Sentence-end protection
      if (doSentence) {
        if (/[.!?,;:]$/.test(word) && word.length <= 7 && result.length > 0) {
          var last = result.pop();
          result.push(last + NBSP + word);
          continue;
        }
        if (nextWord && /[.!?,;:]$/.test(nextWord) && nextWord.length <= 5 && i < words.length - 2) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
      }

      // Tiered word binding
      var lc = word.toLowerCase();
      if (nextWord && !/[,;:.!?]$/.test(word)) {
        // Numbers always bind forward
        if (doNumbers && /^\d{1,3}$/.test(word)) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
        if (doTinyBinding && tinyWords[lc]) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
        if (doMediumBinding && mediumWords[lc]) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
        if (doFullBinding && lc.length <= 2) {
          result.push(word + NBSP + words[i + 1]);
          i++;
          continue;
        }
      }

      result.push(word);
    }

    return result.join(' ');
  }

  /**
   * Heading mode: bind articles and prepositions to next word.
   */
  function typesetHeading(text) {
    if (!text || text.length < 5) return text;
    var words = text.split(/\s+/).filter(Boolean);
    if (words.length < 3) return text;

    var result = [];
    for (var i = 0; i < words.length; i++) {
      var lc = words[i].toLowerCase();
      var next = words[i + 1];
      if (next && (tinyWords[lc] || mediumWords[lc])) {
        result.push(words[i] + NBSP + next);
        i++;
      } else {
        result.push(words[i]);
      }
    }
    return result.join(' ');
  }

  // ─── Post-render analysis ───

  /**
   * Detect actual rendered lines by wrapping words in spans and
   * grouping by vertical position. Returns array of line objects.
   */
  function detectLines(el) {
    var text = el.textContent || '';
    if (!text.trim() || text.length < 20) return null;

    var words = text.split(/ +/).filter(Boolean);
    if (words.length < 3) return null;

    // Wrap words in measurement spans
    var originalHTML = el.innerHTML;
    el.innerHTML = words.map(function(w, i) {
      return '<span data-gw="' + i + '">' + w + '</span>';
    }).join(' ');

    var spans = el.querySelectorAll('span[data-gw]');
    var lines = [];
    var currentTop = -1;
    var currentLine = [];

    for (var i = 0; i < spans.length; i++) {
      var top = Math.round(spans[i].getBoundingClientRect().top);
      if (currentTop === -1) {
        currentTop = top;
        currentLine = [i];
      } else if (Math.abs(top - currentTop) > 3) {
        lines.push({ indices: currentLine, words: currentLine.map(function(idx) { return words[idx]; }) });
        currentTop = top;
        currentLine = [i];
      } else {
        currentLine.push(i);
      }
    }
    if (currentLine.length > 0) {
      lines.push({ indices: currentLine, words: currentLine.map(function(idx) { return words[idx]; }) });
    }

    // Measure line widths
    var containerWidth = el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight);
    for (var j = 0; j < lines.length; j++) {
      var first = spans[lines[j].indices[0]];
      var last = spans[lines[j].indices[lines[j].indices.length - 1]];
      lines[j].width = last.getBoundingClientRect().right - first.getBoundingClientRect().left;
      lines[j].fill = lines[j].width / containerWidth;
    }

    // Restore original
    el.innerHTML = originalHTML;

    return { lines: lines, words: words, containerWidth: containerWidth };
  }

  /**
   * Post-render orphan fix: only bind last two words if the last line
   * actually contains a single word in the rendered layout.
   */
  function fixRealOrphans(el) {
    var analysis = detectLines(el);
    if (!analysis || analysis.lines.length < 2) return;

    var lastLine = analysis.lines[analysis.lines.length - 1];

    // Only intervene if last line has exactly 1 word (a true orphan)
    if (lastLine.words.length === 1) {
      var prevLine = analysis.lines[analysis.lines.length - 2];
      if (prevLine.words.length >= 2) {
        // Pull the last word of the previous line down
        var pullWord = prevLine.words[prevLine.words.length - 1];
        var orphanWord = lastLine.words[0];

        var text = el.textContent || '';
        // Find the last occurrence of "pullWord orphanWord" and bind
        var pattern = new RegExp(
          escapeRegex(pullWord) + '\\s+' + escapeRegex(orphanWord) + '\\s*$'
        );
        var newText = text.replace(pattern, pullWord + NBSP + orphanWord);
        if (newText !== text) {
          // Apply via text nodes to preserve any existing structure
          setTextContent(el, newText);
        }
      }
    }
  }

  /**
   * Post-render rag analysis: detect lines that are significantly
   * shorter or longer than their neighbors and apply micro word-spacing.
   */
  function smoothRagLight(el) {
    var analysis = detectLines(el);
    if (!analysis || analysis.lines.length < 3) return;

    var lines = analysis.lines;
    var containerWidth = analysis.containerWidth;
    var isNarrow = containerWidth < 350;

    // Compute median width of non-last lines
    var nonLastWidths = lines.slice(0, -1).map(function(l) { return l.width; }).sort(function(a, b) { return a - b; });
    var mid = Math.floor(nonLastWidths.length / 2);
    var target = nonLastWidths.length % 2 === 0
      ? (nonLastWidths[mid - 1] + nonLastWidths[mid]) / 2
      : nonLastWidths[mid];

    var MAX_EXPAND = isNarrow ? 0.6 : 2.0;
    var MAX_TIGHTEN = isNarrow ? 0.4 : 1.2;

    var baseWS = parseFloat(getComputedStyle(el).wordSpacing) || 0;

    // Build per-line HTML with word-spacing adjustments
    var htmlParts = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var lineText = line.words.join(' ');
      var isLast = i === lines.length - 1;
      var spaces = line.words.length - 1;
      var gap = target - line.width;

      if (!isLast && spaces > 0 && Math.abs(gap) > 1) {
        var rawDelta = gap / spaces;
        var wsDelta = rawDelta > 0
          ? Math.min(MAX_EXPAND, rawDelta * 0.8)
          : Math.max(-MAX_TIGHTEN, rawDelta * 0.6);
        if (Math.abs(wsDelta) > 0.05) {
          var finalWS = baseWS + wsDelta;
          htmlParts.push('<span style="word-spacing:' + finalWS.toFixed(2) + 'px">' + lineText + '</span>');
          continue;
        }
      }
      htmlParts.push(lineText);
    }

    el.style.whiteSpace = 'pre-line';
    el.innerHTML = htmlParts.join('\n');
  }

  // ─── Helpers ───

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.hasAttribute('data-no-typeset')) return true;
    if (skipTags[el.tagName]) return true;
    var parent = el.parentElement;
    while (parent) {
      if (parent.hasAttribute('data-no-typeset')) return true;
      if (skipTags[parent.tagName]) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function isHeading(el) {
    return /^H[1-6]$/.test(el.tagName);
  }

  function setTextContent(el, text) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while (node = walker.nextNode()) nodes.push(node);
    if (nodes.length === 1) {
      nodes[0].textContent = text;
    } else {
      // Multiple text nodes — replace all with single
      el.textContent = text;
    }
  }

  // ─── Processing pipeline ───

  function applyCSS(el) {
    if (shouldSkip(el)) return;
    var isH = isHeading(el);

    if (!config.disabled.includes('text-wrap')) {
      el.style.textWrap = isH ? 'balance' : 'pretty';
    }
    if (!config.disabled.includes('hanging-punctuation') && el.tagName === 'P') {
      el.style.hangingPunctuation = 'first last';
    }
    if (!config.disabled.includes('font-features')) {
      el.style.fontFeatureSettings = '"liga" 1, "calt" 1, "kern" 1';
    }
  }

  function processElement(el) {
    if (shouldSkip(el)) return;

    // Phase 1: CSS enhancements
    applyCSS(el);

    // Phase 2: Measure-aware text bindings
    var measure = measureCh(el);
    var isH = isHeading(el);

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while (node = walker.nextNode()) textNodes.push(node);

    for (var i = 0; i < textNodes.length; i++) {
      var original = textNodes[i].textContent;
      if (!original || original.trim().length < 10) continue;
      var leading = (original.match(/^\s*/) || [''])[0];
      var trailing = (original.match(/\s*$/) || [''])[0];
      var processed = isH
        ? typesetHeading(original.trim())
        : typesetText(original.trim(), measure);
      textNodes[i].textContent = leading + processed + trailing;
    }

    // Phase 3: Post-render analysis (paragraphs with enough text)
    if (!isH && (el.textContent || '').length >= 80) {
      // Real-line orphan detection — only fix actual orphans
      fixRealOrphans(el);

      // Rag smoothing — subtle word-spacing per line
      if (!config.disabled.includes('rag-smoothing') && measure >= 25) {
        smoothRagLight(el);
      }
    }
  }

  function run(root) {
    root = root || document.body;
    if (!root) return;
    try {
      var elements = root.querySelectorAll(config.selector);
      for (var i = 0; i < elements.length; i++) {
        processElement(elements[i]);
      }
    } catch (e) {
      if (typeof console !== 'undefined') console.error('typeset.us:', e);
    }
  }

  // ─── Observer (careful, no double-processing) ───

  var observerPaused = false;

  function initObserver() {
    var observer = new MutationObserver(function(mutations) {
      if (observerPaused) return;
      observerPaused = true;

      var processed = new Set();
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (processed.has(node)) return;

          // Process the node itself if it matches
          if (node.matches && node.matches(config.selector)) {
            processElement(node);
            processed.add(node);
          }

          // Process matching children (but not ones already handled)
          var children = node.querySelectorAll ? node.querySelectorAll(config.selector) : [];
          for (var i = 0; i < children.length; i++) {
            if (!processed.has(children[i])) {
              processElement(children[i]);
              processed.add(children[i]);
            }
          }
        });
      });

      requestAnimationFrame(function() { observerPaused = false; });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Init ───

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        run();
        initObserver();
      });
    } else {
      run();
      initObserver();
    }
  }

  // Public API
  window.typeset = {
    run: run,
    text: function(str, measure) { return typesetText(str, measure || 65); },
    version: '2.0.0'
  };

  init();
})();
