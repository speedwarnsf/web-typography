"use client";

import { useState, useMemo } from "react";

type RhetoricalFont = {
  name: string;
  variable: string;
  ethos: number;
  pathos: number;
  logos: number;
  tags: string[];
  bestFor: string;
};

const fonts: RhetoricalFont[] = [
  {
    name: "Playfair Display",
    variable: "var(--font-playfair)",
    ethos: 85,
    pathos: 70,
    logos: 55,
    tags: ["elegant", "editorial", "authoritative", "sophisticated"],
    bestFor: "Luxury brands, editorial design, high-end marketing",
  },
  {
    name: "Inter",
    variable: "var(--font-inter)",
    ethos: 60,
    pathos: 25,
    logos: 95,
    tags: ["neutral", "systematic", "professional", "invisible"],
    bestFor: "Tech products, dashboards, data-heavy interfaces",
  },
  {
    name: "Bebas Neue",
    variable: "var(--font-bebas-neue)",
    ethos: 45,
    pathos: 80,
    logos: 40,
    tags: ["urgent", "bold", "confrontational", "attention-demanding"],
    bestFor: "Public health campaigns, urgent messaging, activism",
  },
  {
    name: "Cormorant Garamond",
    variable: "var(--font-cormorant)",
    ethos: 90,
    pathos: 65,
    logos: 70,
    tags: ["classical", "literary", "refined", "timeless"],
    bestFor: "Academic publishing, literary journals, heritage brands",
  },
  {
    name: "Space Grotesk",
    variable: "var(--font-space-grotesk)",
    ethos: 55,
    pathos: 40,
    logos: 85,
    tags: ["technical", "modern", "engineered", "precise"],
    bestFor: "Tech startups, engineering docs, developer tools",
  },
  {
    name: "Lora",
    variable: "var(--font-lora)",
    ethos: 75,
    pathos: 60,
    logos: 75,
    tags: ["warm", "scholarly", "balanced", "approachable"],
    bestFor: "Educational content, healthcare, community organizations",
  },
  {
    name: "DM Serif Display",
    variable: "var(--font-dm-serif)",
    ethos: 80,
    pathos: 75,
    logos: 50,
    tags: ["luxury", "emotional", "dramatic", "premium"],
    bestFor: "Fashion, premium products, emotional campaigns",
  },
  {
    name: "Oswald",
    variable: "var(--font-oswald)",
    ethos: 50,
    pathos: 70,
    logos: 55,
    tags: ["industrial", "forceful", "compressed", "impactful"],
    bestFor: "News headlines, sports, industrial design",
  },
  {
    name: "Source Sans 3",
    variable: "var(--font-source-sans)",
    ethos: 65,
    pathos: 20,
    logos: 90,
    tags: ["institutional", "clean", "functional", "accessible"],
    bestFor: "Government sites, institutional communications, accessibility-focused design",
  },
  {
    name: "Merriweather",
    variable: "var(--font-merriweather)",
    ethos: 70,
    pathos: 55,
    logos: 80,
    tags: ["readable", "trustworthy", "steady", "journalistic"],
    bestFor: "Long-form journalism, blogs, research reports",
  },
  {
    name: "Roboto",
    variable: "var(--font-roboto)",
    ethos: 55,
    pathos: 30,
    logos: 85,
    tags: ["systematic", "mechanical", "universal", "android"],
    bestFor: "Mobile apps, Android design, systematic interfaces",
  },
  {
    name: "Poppins",
    variable: "var(--font-poppins)",
    ethos: 50,
    pathos: 55,
    logos: 75,
    tags: ["friendly", "approachable", "geometric", "youthful"],
    bestFor: "Youth programs, wellness, approachable brands",
  },
  {
    name: "EB Garamond",
    variable: "var(--font-eb-garamond)",
    ethos: 95,
    pathos: 60,
    logos: 75,
    tags: ["classical", "intellectual", "historical", "academic"],
    bestFor: "Academic institutions, historical content, scholarly work",
  },
  {
    name: "Raleway",
    variable: "var(--font-raleway)",
    ethos: 60,
    pathos: 45,
    logos: 70,
    tags: ["airy", "elegant", "lightweight", "modern"],
    bestFor: "Minimal brands, modern portfolios, lifestyle content",
  },
  {
    name: "Libre Baskerville",
    variable: "var(--font-libre-baskerville)",
    ethos: 85,
    pathos: 50,
    logos: 80,
    tags: ["traditional", "authoritative", "bookish", "reliable"],
    bestFor: "Legal documents, traditional institutions, formal communications",
  },
  {
    name: "Montserrat",
    variable: "var(--font-montserrat)",
    ethos: 60,
    pathos: 50,
    logos: 75,
    tags: ["urban", "geometric", "versatile", "contemporary"],
    bestFor: "Urban brands, contemporary design, versatile applications",
  },
  {
    name: "Nunito Sans",
    variable: "var(--font-nunito-sans)",
    ethos: 40,
    pathos: 65,
    logos: 65,
    tags: ["soft", "rounded", "approachable", "gentle"],
    bestFor: "Children's content, friendly brands, wellness",
  },
  {
    name: "Crimson Pro",
    variable: "var(--font-crimson-pro)",
    ethos: 80,
    pathos: 55,
    logos: 75,
    tags: ["editorial", "literary", "dignified", "thoughtful"],
    bestFor: "Publishing, thoughtful content, literary magazines",
  },
  {
    name: "DM Sans",
    variable: "var(--font-dm-sans)",
    ethos: 55,
    pathos: 35,
    logos: 85,
    tags: ["geometric", "clean", "startup", "systematic"],
    bestFor: "Tech startups, SaaS products, modern web apps",
  },
  {
    name: "Fira Sans",
    variable: "var(--font-fira-sans)",
    ethos: 60,
    pathos: 30,
    logos: 85,
    tags: ["mozilla", "technical", "open-source", "functional"],
    bestFor: "Open-source projects, technical documentation, Firefox-style UIs",
  },
  {
    name: "Sora",
    variable: "var(--font-sora)",
    ethos: 55,
    pathos: 45,
    logos: 80,
    tags: ["modern", "tech", "geometric", "balanced"],
    bestFor: "Tech companies, modern brands, balanced communications",
  },
];

const DEMO_SENTENCE = "Your health matters to us";

export default function RhetoricPage() {
  const [selectedFonts, setSelectedFonts] = useState<string[]>([]);
  const [hoveredFont, setHoveredFont] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<{
    goal?: string;
    context?: string;
    tone?: string;
  }>({});

  const toggleFontSelection = (fontName: string) => {
    if (selectedFonts.includes(fontName)) {
      setSelectedFonts(selectedFonts.filter((f) => f !== fontName));
    } else if (selectedFonts.length < 3) {
      setSelectedFonts([...selectedFonts, fontName]);
    }
  };

  const resetWizard = () => {
    setWizardStep(0);
    setWizardAnswers({});
  };

  const getWizardRecommendations = () => {
    const { goal, context, tone } = wizardAnswers;
    let scored = fonts.map((font) => {
      let score = 0;

      if (goal === "trust") score += font.ethos / 100;
      if (goal === "emotion") score += font.pathos / 100;
      if (goal === "clarity") score += font.logos / 100;

      if (context === "healthcare" && (font.tags.includes("trustworthy") || font.tags.includes("warm") || font.tags.includes("approachable"))) score += 0.5;
      if (context === "technology" && (font.tags.includes("technical") || font.tags.includes("systematic") || font.tags.includes("modern"))) score += 0.5;
      if (context === "luxury" && (font.tags.includes("luxury") || font.tags.includes("elegant") || font.tags.includes("sophisticated"))) score += 0.5;
      if (context === "education" && (font.tags.includes("scholarly") || font.tags.includes("academic") || font.tags.includes("readable"))) score += 0.5;
      if (context === "government" && (font.tags.includes("institutional") || font.tags.includes("authoritative") || font.tags.includes("reliable"))) score += 0.5;
      if (context === "activism" && (font.tags.includes("urgent") || font.tags.includes("bold") || font.tags.includes("confrontational"))) score += 0.5;

      if (tone === "formal" && font.ethos > 70) score += 0.3;
      if (tone === "casual" && font.pathos > 50) score += 0.3;
      if (tone === "urgent" && font.pathos > 65) score += 0.3;
      if (tone === "calm" && font.logos > 75) score += 0.3;

      return { font, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map((s) => s.font);
  };

  const comparisonFonts = useMemo(
    () => fonts.filter((f) => selectedFonts.includes(f.name)),
    [selectedFonts]
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a]/85 text-neutral-200 overflow-x-hidden">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
          10 -- Rhetorical Type
        </p>
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Typography as Rhetoric
        </h1>
        <p
          className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-3xl"
          style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
        >
          Every typeface carries rhetorical weight. It persuades, positions,
          and speaks beyond the literal meaning of words. This tool maps
          typefaces to rhetorical modes{"\u00A0\u2014"} drawn from 30{"\u00A0"}years
          of practice in design for social{"\u00A0"}good.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
        <h2
          className="text-3xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          The Rhetorical Triangle
        </h2>
        <p
          className="text-neutral-400 leading-relaxed mb-12 max-w-3xl"
          style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
        >
          Aristotle named three modes of persuasion: <strong>Ethos</strong>{" "}
          (trust), <strong>Pathos</strong> (emotion), and{" "}
          <strong>Logos</strong> (logic). Type works on all three axes at once.
          Hover any point to see the font and sample&nbsp;text.
        </p>

        <div className="relative w-full max-w-2xl mx-auto mb-16">
          <svg
            viewBox="0 0 600 520"
            className="w-full h-auto"
            style={{ maxHeight: "520px" }}
          >
            <polygon
              points="300,40 100,460 500,460"
              fill="none"
              stroke="#333"
              strokeWidth="1"
            />

            <text
              x="300"
              y="20"
              textAnchor="middle"
              fill="#B8963E"
              fontSize="14"
              fontFamily="monospace"
              className="uppercase tracking-wider"
            >
              ETHOS
            </text>
            <text
              x="80"
              y="490"
              textAnchor="middle"
              fill="#B8963E"
              fontSize="14"
              fontFamily="monospace"
              className="uppercase tracking-wider"
            >
              PATHOS
            </text>
            <text
              x="520"
              y="490"
              textAnchor="middle"
              fill="#B8963E"
              fontSize="14"
              fontFamily="monospace"
              className="uppercase tracking-wider"
            >
              LOGOS
            </text>

            {fonts.map((font) => {
              const total = font.ethos + font.pathos + font.logos;
              const normEthos = font.ethos / total;
              const normPathos = font.pathos / total;
              const normLogos = font.logos / total;

              const x = 300 + (normLogos - normPathos) * 200;
              const y = 460 - normEthos * 420;

              return (
                <g key={font.name}>
                  <circle
                    cx={x}
                    cy={y}
                    r={hoveredFont === font.name ? 8 : 5}
                    fill={selectedFonts.includes(font.name) ? "#B8963E" : "#666"}
                    stroke={hoveredFont === font.name ? "#B8963E" : "none"}
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredFont(font.name)}
                    onMouseLeave={() => setHoveredFont(null)}
                    onClick={() => toggleFontSelection(font.name)}
                  />
                  {hoveredFont === font.name && (
                    <>
                      <rect
                        x={x + 12}
                        y={y - 25}
                        width="180"
                        height="50"
                        fill="#0a0a0a"
                        stroke="#B8963E"
                        strokeWidth="1"
                      />
                      <text
                        x={x + 20}
                        y={y - 8}
                        fill="#B8963E"
                        fontSize="11"
                        fontFamily="monospace"
                      >
                        {font.name}
                      </text>
                      <text
                        x={x + 20}
                        y={y + 8}
                        fill="#e5e5e5"
                        fontSize="10"
                        fontFamily={font.variable}
                      >
                        {DEMO_SENTENCE.slice(0, 20)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bg-neutral-950/50 border border-neutral-800 p-4 sm:p-6">
          <h3
            className="text-xl font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Understanding the Axes
          </h3>
          <div className="grid sm:grid-cols-3 gap-6 text-sm leading-relaxed" style={{ fontFamily: "var(--font-source-sans)" }}>
            <div>
              <p className="text-[#B8963E] font-mono uppercase text-xs tracking-wider mb-2">
                Ethos (Credibility)
              </p>
              <p className="text-neutral-400">
                How much trust and authority does this typeface project? High
                ethos fonts establish expertise and institutional weight.
              </p>
            </div>
            <div>
              <p className="text-[#B8963E] font-mono uppercase text-xs tracking-wider mb-2">
                Pathos (Emotion)
              </p>
              <p className="text-neutral-400">
                What emotional response does this typeface evoke? High pathos
                fonts create urgency, warmth, or dramatic impact.
              </p>
            </div>
            <div>
              <p className="text-[#B8963E] font-mono uppercase text-xs tracking-wider mb-2">
                Logos (Logic)
              </p>
              <p className="text-neutral-400">
                How effectively does this typeface communicate rational, clear
                information? High logos fonts prioritize readability and function.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
        <h2
          className="text-3xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Font Explorer
        </h2>
        <p
          className="text-neutral-400 leading-relaxed mb-8"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Click any font to add it to comparison mode (up to 3 fonts).
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {fonts.map((font) => (
            <div
              key={font.name}
              className={`border ${
                selectedFonts.includes(font.name)
                  ? "border-[#B8963E] bg-neutral-950/80"
                  : "border-neutral-800 bg-neutral-950/50"
              } p-4 sm:p-6 cursor-pointer transition-all hover:border-[#B8963E]/50`}
              onClick={() => toggleFontSelection(font.name)}
            >
              <h3
                className="text-2xl font-bold mb-2"
                style={{ fontFamily: font.variable }}
              >
                {font.name}
              </h3>
              <p
                className="text-sm text-neutral-400 mb-4"
                style={{ fontFamily: font.variable }}
              >
                The quick brown fox jumps over the lazy dog
              </p>

              <div className="space-y-2 mb-4">
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span className="font-mono uppercase tracking-wider">Ethos</span>
                    <span>{font.ethos}</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1">
                    <div
                      className="bg-[#B8963E] h-1"
                      style={{ width: `${font.ethos}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span className="font-mono uppercase tracking-wider">Pathos</span>
                    <span>{font.pathos}</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1">
                    <div
                      className="bg-[#B8963E] h-1"
                      style={{ width: `${font.pathos}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span className="font-mono uppercase tracking-wider">Logos</span>
                    <span>{font.logos}</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1">
                    <div
                      className="bg-[#B8963E] h-1"
                      style={{ width: `${font.logos}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {font.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 bg-neutral-900 text-neutral-500 border border-neutral-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-xs text-neutral-500 italic">{font.bestFor}</p>
            </div>
          ))}
        </div>
      </section>

      {comparisonFonts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Comparison Mode
            </h2>
            <button
              onClick={() => setSelectedFonts([])}
              className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-[#B8963E] transition-colors"
            >
              Clear Selection
            </button>
          </div>

          <div className="space-y-8">
            {comparisonFonts.map((font) => (
              <div
                key={font.name}
                className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6"
              >
                <h3
                  className="text-3xl font-bold mb-4"
                  style={{ fontFamily: font.variable }}
                >
                  {DEMO_SENTENCE}
                </h3>
                <p className="text-sm font-mono text-[#B8963E] mb-3">
                  {font.name}
                </p>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-500 font-mono uppercase tracking-wider">
                      Ethos:
                    </span>{" "}
                    <span className="text-neutral-300">{font.ethos}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-mono uppercase tracking-wider">
                      Pathos:
                    </span>{" "}
                    <span className="text-neutral-300">{font.pathos}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 font-mono uppercase tracking-wider">
                      Logos:
                    </span>{" "}
                    <span className="text-neutral-300">{font.logos}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-neutral-950/50 border border-neutral-800 p-4 sm:p-6">
            <h3
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Rhetorical Analysis
            </h3>
            <p
              className="text-sm text-neutral-400 leading-relaxed"
              style={{ fontFamily: "var(--font-source-sans)" }}
            >
              {comparisonFonts.length === 2 && (
                <>
                  <strong>{comparisonFonts[0].name}</strong> scores{" "}
                  {Math.abs(comparisonFonts[0].ethos - comparisonFonts[1].ethos) > 20
                    ? "significantly higher"
                    : "similarly"}
                  {comparisonFonts[0].ethos > comparisonFonts[1].ethos
                    ? " in credibility (ethos)"
                    : ""}{" "}
                  while <strong>{comparisonFonts[1].name}</strong>{" "}
                  {comparisonFonts[1].pathos > comparisonFonts[0].pathos
                    ? "creates more emotional impact (pathos)"
                    : "offers better logical clarity (logos)"}
                  . Choose based on whether your message needs to establish
                  authority or create emotional resonance.
                </>
              )}
              {comparisonFonts.length === 3 && (
                <>
                  These three fonts occupy different rhetorical positions.{" "}
                  <strong>{comparisonFonts[0].name}</strong> leads in{" "}
                  {comparisonFonts[0].ethos > comparisonFonts[0].pathos &&
                  comparisonFonts[0].ethos > comparisonFonts[0].logos
                    ? "credibility"
                    : comparisonFonts[0].pathos > comparisonFonts[0].logos
                    ? "emotion"
                    : "clarity"}
                  , while the others offer different strategic advantages. Mix
                  them in a single design to balance multiple rhetorical goals.
                </>
              )}
            </p>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
        <h2
          className="text-3xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Find Your Font
        </h2>
        <p
          className="text-neutral-400 leading-relaxed mb-8"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Answer three questions to get personalized font recommendations based
          on rhetorical strategy.
        </p>

        <div className="bg-neutral-950/50 border border-neutral-800 p-4 sm:p-6 lg:p-8">
          {wizardStep === 0 && (
            <div>
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                What is the primary goal?
              </h3>
              <div className="space-y-3">
                {[
                  { value: "trust", label: "Establish trust and credibility" },
                  { value: "emotion", label: "Evoke emotion and connection" },
                  { value: "clarity", label: "Communicate clearly and\u00A0logically" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setWizardAnswers({ ...wizardAnswers, goal: option.value });
                      setWizardStep(1);
                    }}
                    className="w-full text-left p-4 border border-neutral-800 hover:border-[#B8963E] bg-neutral-900/50 hover:bg-neutral-900 transition-all" style={{ textWrap: "balance" } as React.CSSProperties}
                  >
                    <span style={{ fontFamily: "var(--font-source-sans)" }}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div>
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                What is the context?
              </h3>
              <div className="space-y-3">
                {[
                  { value: "healthcare", label: "Healthcare" },
                  { value: "technology", label: "Technology" },
                  { value: "luxury", label: "Luxury" },
                  { value: "education", label: "Education" },
                  { value: "government", label: "Government" },
                  { value: "activism", label: "Activism" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setWizardAnswers({ ...wizardAnswers, context: option.value });
                      setWizardStep(2);
                    }}
                    className="w-full text-left p-4 border border-neutral-800 hover:border-[#B8963E] bg-neutral-900/50 hover:bg-neutral-900 transition-all" style={{ textWrap: "balance" } as React.CSSProperties}
                  >
                    <span style={{ fontFamily: "var(--font-source-sans)" }}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setWizardStep(0)}
                className="mt-4 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-[#B8963E] transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {wizardStep === 2 && (
            <div>
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: "var(--font-playfair)" }}
              >
                What is the tone?
              </h3>
              <div className="space-y-3">
                {[
                  { value: "formal", label: "Formal" },
                  { value: "casual", label: "Casual" },
                  { value: "urgent", label: "Urgent" },
                  { value: "calm", label: "Calm" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setWizardAnswers({ ...wizardAnswers, tone: option.value });
                      setWizardStep(3);
                    }}
                    className="w-full text-left p-4 border border-neutral-800 hover:border-[#B8963E] bg-neutral-900/50 hover:bg-neutral-900 transition-all" style={{ textWrap: "balance" } as React.CSSProperties}
                  >
                    <span style={{ fontFamily: "var(--font-source-sans)" }}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setWizardStep(1)}
                className="mt-4 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-[#B8963E] transition-colors"
              >
                ← Back
              </button>
            </div>
          )}

          {wizardStep === 3 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3
                  className="text-xl font-bold"
                  style={{ fontFamily: "var(--font-playfair)" }}
                >
                  Recommended Fonts
                </h3>
                <button
                  onClick={resetWizard}
                  className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-[#B8963E] transition-colors"
                >
                  Start Over
                </button>
              </div>
              <div className="space-y-6">
                {getWizardRecommendations().map((font, idx) => (
                  <div
                    key={font.name}
                    className="border border-neutral-800 bg-neutral-900/50 p-4 sm:p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs font-mono text-[#B8963E] uppercase tracking-wider mb-1">
                          #{idx + 1} Recommendation
                        </p>
                        <h4
                          className="text-2xl font-bold"
                          style={{ fontFamily: font.variable }}
                        >
                          {font.name}
                        </h4>
                      </div>
                      <div className="text-right text-xs text-neutral-500">
                        <div>Ethos: {font.ethos}</div>
                        <div>Pathos: {font.pathos}</div>
                        <div>Logos: {font.logos}</div>
                      </div>
                    </div>
                    <p
                      className="text-lg mb-3"
                      style={{ fontFamily: font.variable }}
                    >
                      {DEMO_SENTENCE}
                    </p>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                      {idx === 0 &&
                        `This is your top match. ${
                          wizardAnswers.goal === "trust"
                            ? `With an ethos score of ${font.ethos}, it establishes strong credibility.`
                            : wizardAnswers.goal === "emotion"
                            ? `With a pathos score of ${font.pathos}, it creates emotional impact.`
                            : `With a logos score of ${font.logos}, it prioritizes clarity and logic.`
                        }`}
                      {idx > 0 &&
                        `Another strong option for ${wizardAnswers.context} contexts with a ${wizardAnswers.tone} tone.`}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {font.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] font-mono uppercase tracking-wider px-2 py-1 bg-neutral-800 text-neutral-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-b border-neutral-800">
        <h2
          className="text-3xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          The Same Words, Different Voice
        </h2>
        <p
          className="text-neutral-400 leading-relaxed mb-8"
          style={{ fontFamily: "var(--font-source-sans)" }}
        >
          Notice how the same sentence changes meaning when set in different
          typefaces. This is rhetoric in action.
        </p>

        <div className="space-y-6">
          {[
            {
              font: fonts.find((f) => f.name === "EB Garamond")!,
              annotation:
                "Classical authority. Feels institutional, trustworthy, academic.",
            },
            {
              font: fonts.find((f) => f.name === "Bebas Neue")!,
              annotation:
                "Urgent demand for attention. Feels confrontational, immediate.",
            },
            {
              font: fonts.find((f) => f.name === "Inter")!,
              annotation:
                "Neutral professionalism. Feels systematic, invisible, functional.",
            },
            {
              font: fonts.find((f) => f.name === "DM Serif Display")!,
              annotation:
                "Emotional sophistication. Feels premium, caring, dramatic.",
            },
            {
              font: fonts.find((f) => f.name === "Lora")!,
              annotation:
                "Warm approachability. Feels human, scholarly, balanced.",
            },
            {
              font: fonts.find((f) => f.name === "Space Grotesk")!,
              annotation:
                "Technical precision. Feels engineered, modern, exact.",
            },
          ].map(({ font, annotation }) => (
            <div
              key={font.name}
              className="border border-neutral-800 bg-neutral-950/50 p-4 sm:p-6 lg:p-8"
            >
              <h3
                className="text-4xl sm:text-5xl font-bold mb-4"
                style={{ fontFamily: font.variable }}
              >
                {DEMO_SENTENCE}
              </h3>
              <p className="text-sm font-mono text-[#B8963E] mb-2">
                {font.name}
              </p>
              <p
                className="text-sm text-neutral-400 italic"
                style={{ fontFamily: "var(--font-source-sans)" }}
              >
                {annotation}
              </p>
              <div className="mt-4 flex gap-8 text-xs text-neutral-500">
                <div>
                  <span className="font-mono uppercase tracking-wider">Ethos:</span>{" "}
                  {font.ethos}
                </div>
                <div>
                  <span className="font-mono uppercase tracking-wider">Pathos:</span>{" "}
                  {font.pathos}
                </div>
                <div>
                  <span className="font-mono uppercase tracking-wider">Logos:</span>{" "}
                  {font.logos}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <h2
          className="text-3xl font-bold tracking-tight mb-6"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          About This Framework
        </h2>
        <div
          className="text-neutral-400 leading-relaxed space-y-4"
          style={{ fontFamily: "var(--font-source-sans)", textWrap: "pretty" }}
        >
          <p style={{ maxWidth: "65ch" }}>
            This tool is based on <strong>Aristotle's rhetorical triangle</strong>{" "}
            — a framework from classical rhetoric that identifies three modes of
            persuasion: ethos (credibility), pathos (emotion), and logos (logic).
          </p>
          <p style={{ maxWidth: "65ch" }}>
            Typography is never neutral. Every typeface choice is a rhetorical act
            that shapes how a message lands. After 30{"\u00A0"}years of practice in social
            marketing and design for public good, these mappings reflect real choices
            made for campaigns on HIV/AIDS, tobacco, mental health, LGBTQ+ rights,
            and social{"\u00A0"}justice.
          </p>
          <p style={{ maxWidth: "65ch" }}>
            No other tool on the web maps typeface choices to rhetorical strategy.
            Use it to make informed, deliberate decisions about type in any context
            where persuasion{"\u00A0"}matters.
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-800 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-600">
          typeset.us
        </p>
      </footer>
    </main>
  );
}
