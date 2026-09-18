import CodeBlock from "@/components/CodeBlock";
import { readFileSync } from "fs";
import path from "path";
import EssayModal from "./EssayModal";

const typesetFullCode = (() => {
  try {
    return readFileSync(path.join(process.cwd(), "src/lib/v4/typeset.next.ts"), "utf-8");
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
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-8"
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

        <section className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            01 — The drop-in
          </p>
          <p className="text-base text-neutral-400 mb-6 leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            One script tag. No configuration, no build step, no framework. It
            composes paragraphs, list items, and headings with the same engine
            that sets this site: beam-search line breaking with contour
            re-ranking, Tschichold spacing, hanging punctuation, smart quotes,
            and self-checks that fall back to browser rendering rather than
            ever make your text worse. Opt any element out with{" "}
            <code className="text-neutral-300">data-no-typeset</code>.
          </p>
          <CodeBlock
            code={`<script src="https://typeset.us/go.js" defer></script>`}
            title="go.js — anywhere HTML runs"
          />
        </section>

        <section className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            02 — The library
          </p>
          <p className="text-base text-neutral-400 mb-6 leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            The same engine as a <code className="text-neutral-300">window.Typeset</code>{" "}
            global, for when you want to decide what gets composed and when.
          </p>
          <CodeBlock
            code={`<script src="https://typeset.us/typeset.min.js"></script>
<script>
  const controller = Typeset.mount(document, '.headline, article p, article li', {
    smartQuotes: 'en', opticalHanging: true
  });
  controller.ready.then(() => console.log(Typeset.auditJSON('article p')));
  // On teardown: controller.disconnect();
</script>`}
            title="typeset.min.js — window.Typeset"
          />
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            03 — The source
          </p>
          <p className="text-base text-neutral-400 mb-6 leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            TypeScript, dependency-free at runtime. This is the V4 engine entry;
            its supporting modules and React adapter ship in the npm package.
            <a href="/releases/4.2.0/README.md"> Installation</a>,{" "}
            <a href="/releases/4.2.0/MIGRATION.md">migration</a>, and{" "}
            <a href="/releases/3.5.1/README.md">V3 archive</a>.
          </p>
          <CodeBlock code={typesetFullCode} title="typeset.ts" />
        </section>
      </div>
    </main>
  );
}
