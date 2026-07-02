import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Typeset — A New Era in Web Typography",
  description:
    "The web finally knows how to break lines. Watch the proof, live: beam-search composition, hanging punctuation, and Tschichold spacing — set by its own engine, in your browser.",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return children;
}
