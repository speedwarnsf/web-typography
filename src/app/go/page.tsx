"use client";

import { useState, useEffect, useRef } from "react";
import CopyButton from "@/components/CopyButton";
import { typesetText, smoothRag } from "@/lib/typeset";

export default function GoPage() {
  const scriptTag = '<script src="https://typeset.us/go.js"></script>';
  const fileSize = "6KB";

  const beforeText = "This is a sample paragraph that demonstrates what text looks like without professional typesetting. Notice how the last word might sit alone on a line, creating an orphan. Short words like a, an, the are not bound to the following word, and there are other issues.";

  const afterText = "This is a sample paragraph that demonstrates what text looks like with professional typesetting. Notice how the last two words are bound together, preventing orphans. Short words like a, an, the are properly bound to the following word, and sentence breaks are handled elegantly.";

  const afterRef = useRef<HTMLParagraphElement>(null);

  // Apply real typesetText + smoothRag to the "after" paragraph
  useEffect(() => {
    if (!afterRef.current) return;
    afterRef.current.textContent = typesetText(afterText);
    const cleanup = smoothRag(afterRef.current);
    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
            Universal Typeset
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-playfair)] text-6xl md:text-7xl mb-6 leading-[1.1]" style={{ textWrap: 'balance' }}>
          One line of code.
          Book-quality typography.
        </h1>

        <p className="font-[family-name:var(--font-source-sans)] text-xl text-neutral-400 mb-12 max-w-2xl" style={{ textWrap: 'pretty' }}>
          Drop this single script into any website and instantly apply professional typographic rules used by book publishers and design studios.
        </p>

        {/* Script tag with copy button */}
        <div className="border border-neutral-800 bg-neutral-950/50 p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <code className="font-mono text-sm text-neutral-300 break-all flex-1">
              {scriptTag}
            </code>
            <CopyButton text={scriptTag} />
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-neutral-800">
            <span className="inline-block px-2 py-1 text-xs font-mono bg-[#B8963E]/10 text-[#B8963E] border border-[#B8963E]/30">
              {fileSize}
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              Zero dependencies • Pure vanilla JS
            </span>
          </div>
        </div>
      </section>

      {/* Before & After */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
            Before & After
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Before */}
          <div className="border border-neutral-800 bg-neutral-950/50 p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500 mb-4">
              Without go.js
            </h3>
            <p className="font-[family-name:var(--font-source-sans)] text-neutral-400 leading-relaxed" data-no-typeset data-no-smooth>
              {beforeText}
            </p>
          </div>

          {/* After */}
          <div className="border border-neutral-800 bg-neutral-950/50 p-6">
            <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
              With go.js
            </h3>
            <p
              ref={afterRef}
              className="font-[family-name:var(--font-source-sans)] text-neutral-200 leading-relaxed"
              style={{
                textWrap: 'pretty' as any,
                hangingPunctuation: 'first last',
                fontFeatureSettings: '"liga" 1, "calt" 1, "kern" 1'
              }}
            >
              {afterText}
            </p>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
            What it does
          </span>
        </div>

        <div className="grid gap-4">
          {[
            {
              rule: "Orphan Prevention",
              desc: "Binds the last two words of paragraphs together with non-breaking spaces, preventing single words from sitting alone on the final line."
            },
            {
              rule: "Short Word Binding",
              desc: "Automatically binds articles and prepositions (a, an, the, in, on, at, to, by, of, or, is, it, as, if, vs) to the following word to prevent awkward line breaks."
            },
            {
              rule: "Sentence-Start Protection",
              desc: "Binds the first two words after sentence-ending punctuation to ensure sentences don't start with a single word on a new line."
            },
            {
              rule: "Sentence-End Protection",
              desc: "Binds short words (1-3 characters) before punctuation to the previous word for better visual rhythm."
            },
            {
              rule: "Text Wrap",
              desc: "Applies CSS text-wrap: pretty to paragraphs for balanced line lengths, and text-wrap: balance to headings for optimal centering."
            },
            {
              rule: "Hanging Punctuation",
              desc: "Enables hanging-punctuation: first last on paragraphs so quotation marks and punctuation optically align with text."
            },
            {
              rule: "OpenType Features",
              desc: "Activates ligatures, contextual alternates, and kerning (liga, calt, kern) for professional-grade letter spacing and connections."
            }
          ].map((item, idx) => (
            <div key={idx} className="border border-neutral-800 bg-neutral-950/50 p-6">
              <h4 className="font-[family-name:var(--font-source-sans)] font-semibold text-neutral-100 mb-2">
                {item.rule}
              </h4>
              <p className="font-[family-name:var(--font-source-sans)] text-sm text-neutral-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
            Configuration
          </span>
        </div>

        <div className="border border-neutral-800 bg-neutral-950/50 p-6 space-y-6">
          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              data-typeset-selector
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Customize which elements get typeset. Default targets: p, li, blockquote, figcaption, h1-h6, td, th, dd, dt, label
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              &lt;script src="https://typeset.us/go.js" data-typeset-selector=".article p, .content h2"&gt;&lt;/script&gt;
            </code>
          </div>

          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              data-typeset-disable
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Disable specific rules. Options: orphans, short-words, sentence-start, sentence-end, text-wrap, hanging-punctuation, font-features
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              &lt;script src="https://typeset.us/go.js" data-typeset-disable="orphans,short-words"&gt;&lt;/script&gt;
            </code>
          </div>

          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              data-no-typeset
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Skip typesetting for specific elements or sections
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              &lt;div data-no-typeset&gt;This content won't be typeset&lt;/div&gt;
            </code>
          </div>
        </div>
      </section>

      {/* API */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E]">
            JavaScript API
          </span>
        </div>

        <div className="border border-neutral-800 bg-neutral-950/50 p-6 space-y-6">
          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              window.typeset.run(element)
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Manually run typesetting on a specific element or the entire document
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              {`// Run on entire document\nwindow.typeset.run();\n\n// Run on specific element\nconst article = document.querySelector('.article');\nwindow.typeset.run(article);`}
            </code>
          </div>

          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              window.typeset.text(string)
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Process a string of text and return it with typographic rules applied
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              {`const raw = "This is a sample text";\nconst processed = window.typeset.text(raw);\nconsole.log(processed);`}
            </code>
          </div>

          <div>
            <h4 className="font-mono text-sm text-neutral-100 mb-2">
              window.typeset.version
            </h4>
            <p className="text-sm text-neutral-400 mb-3">
              Get the current version of go.js
            </p>
            <code className="block font-mono text-xs text-neutral-300 bg-black/50 p-3 border border-neutral-800">
              console.log(window.typeset.version); // "1.0.0"
            </code>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t border-neutral-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <a
              href="/"
              className="font-[family-name:var(--font-playfair)] text-2xl text-neutral-100 hover:text-[#B8963E] transition-colors"
            >
              typeset.us
            </a>
            <p className="text-sm text-neutral-500 mt-2">
              Professional typography for the web
            </p>
          </div>

          <div className="flex gap-6">
            <a
              href="/"
              className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors font-[family-name:var(--font-source-sans)]"
            >
              Home
            </a>
            <a
              href="/demo"
              className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors font-[family-name:var(--font-source-sans)]"
            >
              Demo
            </a>
            <a
              href="/go.js"
              className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors font-[family-name:var(--font-source-sans)]"
            >
              Download
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
