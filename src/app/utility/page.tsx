import CodeBlock from "@/components/CodeBlock";
import { EVERGREEN_NOTE, EVERGREEN_SNIPPET, LIBRARY_PINNED, LIBRARY_SNIPPET, PINNED_SNIPPET, PINNED_VERSION } from "@/lib/install-snippet";
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
            The web wasn't built for typographers. Browsers fill each line until the words run out: short words like &ldquo;a&rdquo; and &ldquo;the&rdquo; get stranded at line ends, thoughts snap mid-phrase, and without <code>text-wrap: pretty</code> (Firefox has none) a single word can be left alone on the last line.
          </p>
          <p>
            <strong>Typeset</strong> chooses where the lines of a paragraph, heading or list item break, keeps links and styling exactly as authored, and checks every result after it renders. It sets horizontal, left-to-right Latin-script text in English, French, German and Spanish; anything it cannot improve safely keeps the browser&rsquo;s own layout, and says why. It does not hyphenate or justify.
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
            code={PINNED_SNIPPET}
            title={`go@${PINNED_VERSION}.js — anywhere HTML runs, pinned`}
          />
          <p className="text-sm text-neutral-500 mt-4 max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            Trying it out? <code className="text-neutral-300">{EVERGREEN_SNIPPET}</code> also works. {EVERGREEN_NOTE}
          </p>
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
            code={`${LIBRARY_SNIPPET}
<script>
  const controller = Typeset.mount(document, '.headline, article p, article li', {
    smartQuotes: 'en', opticalHanging: true
  });
  controller.ready.then(() => console.log(Typeset.auditJSON('article p')));
  // On teardown: controller.disconnect();
</script>`}
            title={LIBRARY_PINNED ? `typeset@${PINNED_VERSION}.min.js — window.Typeset` : "typeset.min.js — window.Typeset, auto-updating within 4.x"}
          />
        </section>

        <section>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            03 — The source
          </p>
          <p className="text-base text-neutral-400 mb-6 leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}>
            TypeScript, dependency-free at runtime. This is the V4 engine entry;
            its supporting modules and React adapter ship in the npm package.
            <a href={`/releases/${PINNED_VERSION}/README.md`}> Installation</a>,{" "}
            <a href={`/releases/${PINNED_VERSION}/MIGRATION.md`}>migration</a>, and{" "}
            <a href="/releases/3.5.1/README.md">V3 archive</a>.
          </p>
          <CodeBlock code={typesetFullCode} title="typeset.ts" />
        </section>
      </div>
    </main>
  );
}
