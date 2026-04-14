import CodeBlock from "@/components/CodeBlock";
import { readFileSync } from "fs";
import path from "path";
import EssayModal from "./EssayModal";

const typesetFullCode = (() => {
  try {
    return readFileSync(path.join(process.cwd(), "src/lib/typeset.ts"), "utf-8");
  } catch {
    return "// typeset.ts — see source repository";
  }
})();

export default function UtilityPage() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 relative" style={{ zIndex: 2 }}>
      <div className="max-w-4xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          The Utility
        </p>
        <h1 
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          typeset.ts
        </h1>
        
        <div className="text-lg text-neutral-400 mb-12 space-y-6 leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
          <p>
            The web wasn't built for typographers. By default, browsers allow lonely orphans on the last line of a paragraph, string together clunky rags, leave punctuation awkwardly stranded, and render lists with unrefined spacing.
          </p>
          <p>
            <strong>typeset.ts</strong> is a universal typographic enhancement script that fixes all of this dynamically. You drop it into your project, feed it an HTML element, and it applies professional typesetting rules—binding orphans, balancing rags, injecting exact typographic measurements, and bringing structural elegance to your web typography without requiring manual CSS overrides.
          </p>
          <div className="relative z-50 isolate mt-4">
            <EssayModal />
          </div>
        </div>

        <CodeBlock code={typesetFullCode} title="typeset.ts" />
      </div>
    </main>
  );
}
