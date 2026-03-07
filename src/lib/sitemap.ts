/**
 * Site structure: sections, pages, and their typographic identities.
 *
 * Each section has a distinct typeface that serves as wayfinding —
 * you know where you are by the type itself.
 */

export type SitePage = {
  slug: string;        // URL path (e.g. "/clamp")
  name: string;        // Display name
  shortName?: string;  // Abbreviated name for tight spaces
  description: string; // One-line description
};

export type SiteSection = {
  id: string;
  name: string;
  font: string;        // CSS font-family value
  fontVar: string;     // CSS variable (--font-*)
  pages: SitePage[];
};

export const sections: SiteSection[] = [
  {
    id: "learn",
    name: "Learn",
    font: "'Playfair Display', serif",
    fontVar: "var(--font-playfair)",
    pages: [
      {
        slug: "/",
        name: "Rules & Pairings",
        shortName: "Home",
        description: "Typographic rules, font pairings, and tips",
      },
      {
        slug: "/rhetoric",
        name: "Rhetorical Type",
        shortName: "Rhetoric",
        description: "Persuasion through typographic choices",
      },
      {
        slug: "/animations",
        name: "Type Animations",
        shortName: "Animations",
        description: "CSS and JS animation techniques for text",
      },
    ],
  },
  {
    id: "analyze",
    name: "Analyze",
    font: "'JetBrains Mono', monospace",
    fontVar: "var(--font-mono)",
    pages: [
      {
        slug: "/font-inspector",
        name: "Font Inspector",
        shortName: "Inspector",
        description: "Examine OpenType features and metrics",
      },
      {
        slug: "/specimen",
        name: "Specimen Generator",
        shortName: "Specimen",
        description: "Generate type specimens for any font",
      },
      {
        slug: "/variable-fonts",
        name: "Variable Fonts",
        shortName: "Variable",
        description: "Explore variable font axes in real time",
      },
      {
        slug: "/dna",
        name: "Font DNA",
        shortName: "DNA",
        description: "Extract the genetic fingerprint of a typeface",
      },
      {
        slug: "/audit",
        name: "Type Audit",
        shortName: "Audit",
        description: "Audit any website's typographic choices",
      },
    ],
  },
  {
    id: "build",
    name: "Build",
    font: "'Source Sans 3', sans-serif",
    fontVar: "var(--font-source-sans)",
    pages: [
      {
        slug: "/perfect-paragraph",
        name: "Perfect Paragraph",
        shortName: "Paragraph",
        description: "Tune every parameter of body text",
      },
      {
        slug: "/reading-lab",
        name: "Reading Lab",
        shortName: "Reading",
        description: "Test readability across configurations",
      },
      {
        slug: "/clamp",
        name: "Clamp Calculator",
        shortName: "Clamp",
        description: "Generate fluid type scales with clamp()",
      },
      {
        slug: "/pairing-cards",
        name: "Pairing Builder",
        shortName: "Builder",
        description: "Create and export font pairing cards",
      },
      {
        slug: "/go",
        name: "go.js",
        description: "Universal typographic enhancement script",
      },
    ],
  },
];

/** Flat list of all pages with their section info */
export type PageInfo = SitePage & {
  section: SiteSection;
  sectionIndex: number;
  pageIndex: number;
  prev: SitePage | null;
  next: SitePage | null;
};

export function getPageInfo(pathname: string): PageInfo | null {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    for (let pi = 0; pi < section.pages.length; pi++) {
      if (section.pages[pi].slug === normalized) {
        return {
          ...section.pages[pi],
          section,
          sectionIndex: si,
          pageIndex: pi,
          prev: pi > 0 ? section.pages[pi - 1] : null,
          next: pi < section.pages.length - 1 ? section.pages[pi + 1] : null,
        };
      }
    }
  }
  return null;
}

/** Pages not in the main sections (shown separately in menu) */
export const metaPages: SitePage[] = [
  { slug: "/about", name: "About", description: "About the author" },
  { slug: "/support", name: "Support", description: "Support this project" },
];

export function getAllPages(): SitePage[] {
  return [
    ...sections.flatMap((s) => s.pages),
    ...metaPages,
  ];
}
