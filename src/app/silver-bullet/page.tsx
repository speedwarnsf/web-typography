import CodeBlock from "@/components/CodeBlock";

const cssCode = `ul.ts-styled {
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
  content: "\\2022"; /* Bullet character */
  position: absolute;
  left: -1.25em;
  width: 1.25em;
  /* Right-align the bullet within its box so it sits close to the text */
  text-align: right;
  padding-right: 0.28em; 
  box-sizing: border-box;
  font-size: 1.25em;
  /* Lock line-height so the larger font doesn't stretch the baseline down */
  line-height: 1;
  /* Push it down slightly from the top of the li box to align with x-height */
  top: 0.05em;
  opacity: 0.8;
}`;

export default function SilverBulletPage() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 relative" style={{ zIndex: 2 }}>
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          Breakout Code
        </p>
        <h1 
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          The Silver Bullet
        </h1>
        
        <div className="text-lg text-neutral-400 mb-12 space-y-6 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
          <p>
            Standard browser bullet lists are typographic disasters. They use oversized, badly aligned bullet characters, tie paragraph spacing to standard text flow, and refuse to sit harmoniously with surrounding content. 
          </p>
          <p>
            <strong>The Silver Bullet</strong> is the CSS snippet we inject into <code>typeset.ts</code> to automatically resolve this. By using strictly relative <code>em</code> units, it scales perfectly regardless of your base font size. It drops the bullet vertically to align exactly with the lowercase x-height, separates items visually while maintaining body-copy leading, and enforces structural rhythm.
          </p>
        </div>

        <CodeBlock code={cssCode} title="silver-bullet.css" />
      </div>
    </main>
  );
}
