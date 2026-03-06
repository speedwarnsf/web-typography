/**
 * typeset.us/go.js v1.0.0
 * Universal typography drop-in script
 * https://typeset.us
 */
(function() {
  'use strict';

  // Configuration
  const script = document.currentScript;
  const config = {
    selector: script?.getAttribute('data-typeset-selector') || 'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt, label',
    disabled: (script?.getAttribute('data-typeset-disable') || '').split(',').map(s => s.trim()).filter(Boolean)
  };

  const skipTags = new Set(['PRE', 'CODE', 'TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE']);
  const nbsp = '\u00A0';

  // Short words that should bind to the next word
  const shortWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'by', 'of', 'or', 'is', 'it', 'as', 'if', 'vs', 'vs.']);

  // Sentence-ending punctuation
  const sentenceEnd = /[.!?]\s+/g;

  /**
   * Check if an element should be skipped
   */
  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.hasAttribute('data-no-typeset')) return true;
    if (skipTags.has(el.tagName)) return true;

    // Check if any parent has data-no-typeset
    let parent = el.parentElement;
    while (parent) {
      if (parent.hasAttribute('data-no-typeset')) return true;
      if (skipTags.has(parent.tagName)) return true;
      parent = parent.parentElement;
    }

    return false;
  }

  /**
   * Check if element is a heading
   */
  function isHeading(el) {
    return /^H[1-6]$/.test(el.tagName);
  }

  /**
   * Process text content with typographic rules
   */
  function processText(text) {
    if (!text || text.length < 3) return text;

    let result = text;

    // Rule B: Bind short words to next word
    if (!config.disabled.includes('short-words')) {
      shortWords.forEach(word => {
        // Match word boundary + short word + space + next word's first char
        const regex = new RegExp(`\\b${word}\\s+(?=\\S)`, 'gi');
        result = result.replace(regex, match => {
          return match.trimEnd() + nbsp;
        });
      });
    }

    // Rule C: Sentence-start protection (bind first two words after sentence punctuation)
    if (!config.disabled.includes('sentence-start')) {
      result = result.replace(/([.!?])\s+(\S+)\s+(\S+)/g, (match, punct, word1, word2) => {
        return punct + ' ' + word1 + nbsp + word2;
      });
    }

    // Rule D: Sentence-end protection (bind short words before punctuation)
    if (!config.disabled.includes('sentence-end')) {
      result = result.replace(/\s+(\S{1,3})([.!?,;:])/g, (match, word, punct) => {
        return nbsp + word + punct;
      });
    }

    // Rule A: Orphan prevention (bind last two words)
    if (!config.disabled.includes('orphans')) {
      // Find last space and replace with nbsp
      const words = result.split(/\s+/);
      if (words.length >= 2) {
        const lastWord = words.pop();
        const secondLast = words.pop();
        result = words.join(' ') + (words.length > 0 ? ' ' : '') + secondLast + nbsp + lastWord;
      }
    }

    return result;
  }

  /**
   * Process a single text node
   */
  function processTextNode(node) {
    if (!node || node.nodeType !== 3) return;

    const text = node.textContent;
    if (!text || !text.trim()) return;

    const processed = processText(text);
    if (processed !== text) {
      node.textContent = processed;
    }
  }

  /**
   * Apply CSS styles to element
   */
  function applyStyles(el) {
    if (shouldSkip(el)) return;

    const isH = isHeading(el);

    // Rule E: text-wrap
    if (!config.disabled.includes('text-wrap')) {
      el.style.textWrap = isH ? 'balance' : 'pretty';
    }

    // Rule F: hanging-punctuation (paragraphs only)
    if (!config.disabled.includes('hanging-punctuation') && el.tagName === 'P') {
      el.style.hangingPunctuation = 'first last';
    }

    // Rule G: font-feature-settings
    if (!config.disabled.includes('font-features')) {
      el.style.fontFeatureSettings = '"liga" 1, "calt" 1, "kern" 1';
    }
  }

  /**
   * Process an element's text nodes
   */
  function processElement(el) {
    if (shouldSkip(el)) return;

    // Apply CSS styles
    applyStyles(el);

    // Process text nodes
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent || shouldSkip(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(processTextNode);
  }

  /**
   * Run typesetting on all matching elements
   */
  function run(root = document.body) {
    if (!root) return;

    try {
      const elements = root.querySelectorAll(config.selector);
      elements.forEach(processElement);
    } catch (e) {
      console.error('typeset.us error:', e);
    }
  }

  /**
   * Process a string of text (for API use)
   */
  function processString(str) {
    return processText(str);
  }

  /**
   * Initialize MutationObserver to handle dynamic content
   */
  function initObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Element node
            if (node.matches && node.matches(config.selector)) {
              processElement(node);
            }
            // Check children
            run(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Initialize on DOMContentLoaded
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
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
    text: processString,
    version: '1.0.0'
  };

  // Auto-initialize
  init();
})();
