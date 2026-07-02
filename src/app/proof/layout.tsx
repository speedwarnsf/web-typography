import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Proof — Typeset.us",
  description:
    "Live before/after: paste your own text, pick a real column width, and compare the browser's line breaking against the typeset.ts engine — measured, not fabricated.",
};

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return children;
}
