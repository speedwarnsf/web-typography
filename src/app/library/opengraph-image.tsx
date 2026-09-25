import { ogCard, OG_SIZE } from '@/lib/og-card';

export const alt = 'The Typeset library: typographic rules, font pairings and tips';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OgImage() {
  return ogCard({ kicker: 'typeset.us / library', title: ['Rules, pairings', 'and tips.'], line: 'The working reference, every paragraph set live by Typeset.' });
}
