import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sponsor Typeset — typeset.us',
  description: 'Typeset is free and MIT licensed, built by one designer. Sponsor its development with a one-time or monthly contribution.',
};

export default function SponsorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
