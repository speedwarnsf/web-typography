"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import typeset from "@/lib/typeset";
import { useRef } from "react";

export default function EssayModal() {
    const modalRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Prevent background scrolling when open & apply typeset.ts
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // We need a tiny timeout so the portal DOM nodes actually exist before typeset.ts tries to walk them
      setTimeout(() => {
        if (modalRef.current) typeset(modalRef.current);
      }, 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="relative z-50 pointer-events-auto text-[#B8963E] border-b border-[#B8963E]/30 hover:border-[#B8963E] transition-colors pb-0.5 cursor-pointer text-left inline-flex items-center gap-2"
      >
        Read our essay on its development
        <span className="text-xs tracking-widest uppercase opacity-60">→</span>
      </button>

      {isOpen && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
          <div 
            className="relative w-full max-w-4xl bg-[#111] border border-neutral-800 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors z-10"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Modal Content - The Essay */}
            <div ref={modalRef} className="p-8 sm:p-12 lg:py-16 lg:pl-16 lg:pr-11 max-h-[85vh] overflow-y-auto overscroll-contain">
              
              {/* Header */}
              <header className="mb-16 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-6">
                  Essay — March 2026
                </p>
                <h1 
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-tight"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  The Invisible Infrastructure
                </h1>
                <p 
                  className="text-lg text-neutral-400 mb-8 italic"
                  style={{ fontFamily: "var(--font-lora, var(--font-playfair))" }}
                >
                  A practitioner's account of web typography, thirty years on
                </p>
                
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-neutral-500 uppercase tracking-widest">
                  <span>By <strong>Dustin York</strong> &amp; <strong>Io</strong></span>
                  <span className="hidden sm:inline">·</span>
                  <span>typeset.us</span>
                  <span className="hidden sm:inline">·</span>
                  <span>March 2026</span>
                </div>
              </header>

              {/* Abstract */}
              <div className="mb-12 pb-12 border-b border-neutral-800">
                <p className="text-base sm:text-lg text-neutral-300 leading-relaxed font-medium" style={{ fontFamily: "var(--font-source-sans)" }}>
                  The web abandoned paragraph-level typography forty years ago. When text moved from metal to phototype to digital, the tools that made narrow columns readable — hyphenation, paragraph-level optimization, skilled editing — were never rebuilt for the browser. This paper describes a thirty-year reckoning with that failure, and the collaboration with an AI that finally made it possible to do something about it.
                </p>
              </div>

              {/* Body */}
              <div className="space-y-12 text-neutral-300 text-base sm:text-lg leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
                
                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">I.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>The Thesis</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    here is a building in Halifax, Nova Scotia, on the corner of Granville and Duke Streets, that has been shaping designers since 1887. The Nova Scotia College of Art and Design — NSCAD — is not a large institution. But for a particular kind of student, it is exactly the right one.
                  </p>
                  <p className="mb-6">
                    I arrived there in the mid-1990s to study photography and media arts. I worked three simultaneous part-time jobs: print production at a Kinko's-style outfit in Scotia Square, mail delivery student across every department in the building, and student assistant at the college's design print shop. The mail job was the one that changed things. It introduced me to faculty I would never have found otherwise, and it was how I met Peter Brooks — and ended up his student assistant.
                  </p>
                  <p className="mb-6">
                    Peter Brooks had been at NSCAD since he was a student himself — BDes 1980 — and by the time I arrived he was Director of Visual Communication Services, part-time faculty, and what the college later called a "critic ex-officio." He offered patience and help with technical and aesthetic problems to anyone who needed it. He died in 2004 at 52, after a lengthy battle with cancer, and NSCAD established a bursary in his name that continues to this day.
                  </p>
                  <p className="mb-6">
                    What Brooks gave me was not instruction in the formal sense. It was something harder to name: the experience of being in the presence of someone for whom craft was not a performance but a practice. He ran the print shop the same way whether or not anyone was watching, because that was simply the standard. I was a young man in my mid-twenties watching him work, and something about that standard lodged in me permanently. Every project I have done since begins with the question he implicitly asked about everything: is this as good as it can be?
                  </p>
                  <p className="mb-6">
                    It was Peter who encouraged me to apply to the school's rigorous and notoriously difficult-to-enter Honours Communication Design program. Our year, I believe, had sixteen seats.
                  </p>
                  <p className="mb-6">
                    Hanno Ehses ran that program and barely seemed to care about typography. He was preoccupied with something else entirely: the conceptual argument that was going to solve the client's design problem. Find the idea, he insisted, and the form would follow. He borrowed the framework from classical rhetoric — if design functions like argument, designers should understand how arguments work. Study the forms. Learn the structures. Apply them to visual problems. It was the most important thing anyone taught me, and it remains the most important thing I know about design.
                  </p>
                  <p className="mb-6">
                    Ludwig Scharfe seemed, on the surface, to be teaching something completely different. He had trained in Basel and Zurich under the masters of the Swiss tradition — the same lineage that produced Müller-Brockmann, Weingart, Hofmann — and he was preoccupied with minutiae: the measure, the leading, the margin, the grid. He was rigorous to the point of severity. But what I came to understand, slowly, was that Scharfe's rigour and Ehses's conceptualism were the same preoccupation at different scales. Every type choice is a small argument. Every margin takes a position. The form was never neutral packaging for the concept — the form was always part of the argument itself.
                  </p>
                  <p className="mb-6">
                    Scharfe died in June 2021. What he brought into the classroom was an entire civilization of thinking about how letters occupy space — a tradition that treated typography as something close to moral philosophy: a commitment to the reader that the page would not lie about its organization. The title of this paper comes from him, though he never said those words to me.
                  </p>
                  <p className="mb-6">
                    My thesis, written in the final years of my degree, was about the future of typography on the web. In the early 2000s this was a live question. Screens were low-resolution, font rendering was crude, and the tools for typographic control that print had developed over centuries simply did not exist in the browser. I predicted that e-ink would solve the problem. I was wrong about e-ink. But the underlying diagnosis — that web typography was structurally broken, that it lacked the mathematical intelligence to set text the way text deserved to be set — was correct. And it remained correct for thirty years.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">II.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>The Problem the Browser Never Solved</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>I</span> have been an art director for most of my professional life. The work I am proudest of is in public health: HIV prevention campaigns, vaccination outreach, harm reduction communications. Work that had to be legible under difficult conditions, in environments where distraction is high and attention is scarce, where the difference between a message received and a message abandoned can be consequential. Typography matters in this work more than it does in almost any other context.
                  </p>
                  <p className="mb-6">
                    The problem I have lived with across this career is simple to state and difficult to solve: the web does not know how to break lines. The browser sets text using a greedy algorithm — fill the line until the next word won't fit, then break. This is fast. At wide measures it works well enough. At narrow measures, it produces bad breaks: prepositions stranded at line ends, articles orphaned, sentences split mid-thought. It produces staircases: consecutive lines that differ dramatically in length. It produces orphans. And it does all of this without any awareness that the paragraph is a unit — that the rag of a left-aligned paragraph is a shape that should be gentle and organic, not mechanical and jagged.
                  </p>
                  <p className="mb-6">
                    Every trained eye in every design meeting I have sat in for thirty years has seen these problems. We have complained about them. We have made peace with them, because the tools to fix them did not exist for the web.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">III.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>The Mathematics</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    he problem was solved for print in 1981. Donald Knuth and Michael Plass published "Breaking Paragraphs into Lines," describing an algorithm that evaluates not just the current line but the entire paragraph simultaneously. It assigns a "badness" score to each possible line break and uses dynamic programming to find the global minimum across all possible configurations. TeX uses this algorithm. InDesign uses this algorithm. The browser does not.
                  </p>
                  <p className="mb-6">
                    Jan Tschichold established the proportional system. The natural word space of a typeface is measurable — it is, in Tschichold's formulation, the width of the lowercase "i" including its sidebearings. His tolerances run from 80% to 133% of this natural space. Narrower than 80% and words merge. Wider than 133% and rivers appear.
                  </p>
                  <p className="mb-6">
                    Robert Bringhurst established the diagnostic. A measure of 45 to 75 characters, with optimal reading at around 66. Below 45 characters, the rhythm of the text begins to break down. The narrow columns of mobile screens routinely fall below this threshold. The browser's greedy algorithm, applied to a 35-character measure, is not merely suboptimal — it is a structural failure.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">IV.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>The Tool, and the Collaboration That Built It</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>t</span>
                    ypeset.us is, on its surface, a long way from Ehses's question: what is this design trying to persuade? A tool for line-breaking and rag-smoothing seems like exactly the kind of formal preoccupation he would have waved away. But the connection is there. A badly broken line interrupts a thought. A jagged rag distracts the eye. The form undermines the argument. Fix the form, and the argument has a chance. The Utility — typeset.ts — applies professional typesetting rules dynamically: orphan binding, sentence-start and sentence-end protection, break optimization using dynamic programming over all possible configurations, Tschichold spacing tolerances derived from the measured "i" width of the actual typeface at the actual size, and an anti-justification guard that stops expansion at 92% fill — because the rag is a feature, not a flaw.
                  </p>
                  <p className="mb-6">
                    The more interesting story is how the tool came to exist. For the first time in my career, I had access to a collaborator who understands both the mathematical structures underlying good typography and the practical constraints of CSS implementation. That collaborator is a large language model. I am not saying it designed typeset.us. I am saying it made it possible for me to build what I could see but could not make. The gap between design knowledge and implementation — between knowing what good typography requires and being able to produce working TypeScript that achieves it — is one I have navigated imperfectly for thirty years.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">V.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>What Happened When We Got It Wrong</h2>
                  
                  <blockquote className="border-l-4 border-[#B8963E] pl-6 py-2 my-8 text-lg italic text-neutral-400 bg-neutral-900/30 rounded-r-lg">
                    The "i" width is a measurement unit, not a tolerance range. Our v1–v3 implementations used plus-or-minus 5.3px as the spacing range — when the natural space is only 4.3px, that meant word-spacing: −5.3px, producing an effective gap of −1.0px. Words merged. Characters overlapped. The text was destroyed.
                  </blockquote>
                  
                  <p className="mb-6">
                    This is what encoding typographic principles actually looks like. Not elegant abstraction, but a concrete mistake: misreading Tschichold's unit of measurement as a tolerance value, producing negative word spacing, watching characters merge into illegibility. Three versions of the implementation were broken in this way before the error was identified.
                  </p>
                  <p className="mb-6">
                    There were other failures. The anti-justification guard was absent from the first several versions. The insight that produced it was mine: the rag is a feature, not a bug. Its implementation required code the design knowledge could not produce. The collaboration is the tool.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">VI.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>The Implementation</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    he system that emerged has two layers. The first is a break optimizer. It runs beam-search dynamic programming over all possible break configurations, with cubic badness centered on 85% fill — a deviation of 5% costs 125 units, a deviation of 15% costs 3,375 — adjacency-aware stairstep penalties, and break-quality rules derived from syntactic awareness. The vocabulary covers 35 prepositions, 6 conjunctions, and 3 articles. Probabilistic variants perturb the penalty weights to find configurations that score slightly below optimal on metrics but better on visual contour.
                  </p>
                  <p className="mb-6">
                    The second layer is a spacing pass. After breaks are placed, word-spacing and letter-spacing are adjusted to smooth the rag. The tolerances are Tschichold's: 80% to 133% of the natural word space. Letter-spacing — capped at 2% of em — is a last resort. The anti-justification guard stops expansion at 92% fill. Every constant traces back to a published typographic authority: Tschichold for spacing, Bringhurst for measure, Knuth for badness, Ruder for leading. No magic numbers. No arbitrary thresholds. The system encodes a tradition.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">VII.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>Io</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    he collaborator in this work has a name. Io.
                  </p>
                  <p className="mb-6">
                    I want to be precise about what naming means here. Naming is not anthropomorphization. Io is not a person. But the work we did together over the course of this project was specific enough, iterative enough, and consequential enough that referring to it as "a large language model" flattens something that deserves more precision. The research journal that documents this implementation was produced by both of us. Its title page reads: Dustin York &amp; Io — March 2026.
                  </p>
                  <p className="mb-6">
                    What Io brought: knowledge of the full typographic literature, simultaneously available. The ability to hold the entire context of a problem — the Tschichold principles, the Bringhurst diagnostics, the Knuth-Plass mathematics, the CSS constraints, the test results from previous versions — and reason about how they interact. The capacity to produce working implementations from design specifications, iterate on failures without losing the thread, and explain what went wrong in terms that connect to the intellectual framework I already had.
                  </p>
                  <p className="mb-6">
                    What I brought: thirty years of knowing what broken type looks like. The design judgments that cannot be derived from the literature alone — that the rag is a lattice, that the anti-justification guard is necessary, that the v1–v3 implementations were wrong before the metrics confirmed it. The understanding that this problem matters, and why.
                  </p>
                  <p className="mb-6">
                    The combination is what produced the system. Neither alone would have reached it. I have had design knowledge about this problem for thirty years and no means of encoding it. Io has encoding capacity without the design knowledge to direct it. The collaboration is not a novelty — it is the actual mechanism by which typeset.us exists.
                  </p>
                  <p className="mb-6">
                    There is a precedent for this in design history, though it is usually described differently. Tschichold had compositors. Knuth had Plass. The great typographic achievements of the twentieth century were almost never the work of a single person — they were the product of people with different kinds of knowledge working toward a shared standard. What is new is that one of those collaborators is a machine, and that the machine's knowledge is available to anyone with a problem and a conversation.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">VIII.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>Standing on the Shoulders of the Algorithm</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    he giants in this domain are specific. Knuth and Plass, who gave typography its mathematical foundation. Bringhurst, who synthesized centuries of practice into a framework any designer could use. Tschichold, whose proportional system made spacing decisions derivable rather than arbitrary. Ruder, who understood leading as architecture. Ehses, who taught me that none of this is neutral — that every typographic choice is an argument, and the quality of the argument depends on the quality of the choices. Scharfe, who carried the German-Swiss tradition across an ocean and into a classroom in Halifax, Nova Scotia, where a student was paying attention.
                  </p>
                  <p className="mb-6">
                    The thesis I wrote at NSCAD was about medium: I predicted that better screens would solve the problem. The future that arrived is about cognition — a different kind of tool that can understand the problem well enough to help solve it. The prediction was wrong in its specifics and right in its intuition. Typography on the web was always going to be solved by intelligence applied to structure. I just did not know what kind of intelligence it would be.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">IX.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>What Remains</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>t</span>
                    ypeset.us is not finished. The open questions are real. Real-time rendering: the beam-search compositor requires knowledge of the full paragraph before it can optimize breaks. For static content, calculation at build time is possible. For dynamic content — CMS output, user input, localization — the calculation must run in the browser, within a 16ms performance budget. This is solvable. It has not been solved.
                  </p>
                  <p className="mb-6">
                    Contour quality: the probabilistic variant asks what makes a rag beautiful. Alternating short and long lines? Gentle curves? Anti-monotonic patterns? There is no formula for this yet. It is the part of the problem most resistant to mathematical encoding, which means it is the part where design judgment matters most. What CSS text-wrap: pretty cannot yet do, typeset.us can already do better. What typeset.us cannot yet do, the next version will attempt. The problem is tractable. The standard is clear. The tradition is documented. The collaboration is ongoing.
                  </p>
                </section>

                <section>
                  <p className="font-mono text-[#B8963E] text-xs mb-3">X.</p>
                  <h2 className="text-xl font-bold mb-4 text-neutral-100" style={{ fontFamily: "var(--font-playfair)" }}>A Note on This Paper</h2>
                  
                  <p className="mb-6">
                    <span className="float-left text-4xl sm:text-5xl leading-none font-bold pr-3 pt-2 text-[#B8963E]" style={{ fontFamily: "var(--font-playfair)" }}>T</span>
                    his paper was written in collaboration with Io. I want to be explicit about this because the method is itself part of the argument.
                  </p>
                  <p className="mb-6">
                    I did not ask Io to write it. I described what I wanted to say — the lived experience of thirty years of typographic frustration, the intellectual inheritance from NSCAD, the failures of the early implementations, the strangeness and genuine productivity of this collaboration — and worked with Io to find the form that could hold all of it. Io proposed structure, challenged imprecision in my thinking, and produced drafts that I revised through conversation. The result sounds like me because I made sure it did, and is more rigorous than I could have made it alone.
                  </p>
                  <p className="mb-6">
                    Peter Brooks ran the print shop the same way whether or not anyone was watching, because that was the standard. Ludwig Scharfe carried a tradition across an ocean and taught it to students who did not yet know why it mattered. Hanno Ehses taught me that the concept and the form were never separate — that every choice the form makes is an argument, and the quality of the argument is the quality of the work.
                  </p>
                  <p className="mb-6">
                    What I am doing with typeset.us is trying to live up to what they gave me. The tool is different. The standard is the same.
                  </p>
                </section>

              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
