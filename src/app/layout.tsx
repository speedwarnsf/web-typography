import type { Metadata } from "next";
import {
  Playfair_Display,
  Source_Sans_3,
  JetBrains_Mono,
  Inter,
  Lora,
  Space_Grotesk,
  Crimson_Pro,
  DM_Serif_Display,
  DM_Sans,
  Cormorant_Garamond,
  Fira_Sans,
  Sora,
  Merriweather,
  Libre_Baskerville,
  Nunito_Sans,
  Oswald,
  EB_Garamond,
  Raleway,
  Bitter,
  Work_Sans,
  Spectral,
} from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const crimsonPro = Crimson_Pro({ subsets: ["latin"], variable: "--font-crimson-pro", display: "swap" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant", weight: ["400", "600"], display: "swap" });
const firaSans = Fira_Sans({ subsets: ["latin"], variable: "--font-fira-sans", weight: ["400", "500"], display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-merriweather", weight: ["400", "700"], display: "swap" });
const libreBaskerville = Libre_Baskerville({ subsets: ["latin"], variable: "--font-libre-baskerville", weight: ["400", "700"], display: "swap" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-eb-garamond", display: "swap" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway", display: "swap" });
const bitter = Bitter({ subsets: ["latin"], variable: "--font-bitter", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans", display: "swap" });
const spectral = Spectral({ subsets: ["latin"], variable: "--font-spectral", weight: ["400", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "Web Typography -- A Resource for Designers",
  description: "Typographic rules, font pairings, and practical tips for beautiful web text.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    playfair, sourceSans, jetbrains, inter, lora, spaceGrotesk, crimsonPro,
    dmSerif, dmSans, cormorant, firaSans, sora, merriweather, libreBaskerville,
    nunitoSans, oswald, ebGaramond, raleway, bitter, workSans, spectral,
  ].map((f) => f.variable).join(" ");

  return (
    <html lang="en">
      <body className={`${fontVars} antialiased bg-[#0a0a0a] text-neutral-200`}>
        {children}
      </body>
    </html>
  );
}
