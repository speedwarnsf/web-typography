import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support Typeset — typeset.us',
  description: 'Typeset is free and MIT licensed, built by one designer. Support its development with a one-time or monthly contribution.',
};

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
