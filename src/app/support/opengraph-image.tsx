import { ogCard, OG_SIZE } from '@/lib/og-card';

export const alt = 'Support Typeset, free and MIT licensed';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OgImage() {
  return ogCard({ kicker: 'typeset.us / support', title: ['Keep the web', 'well set.'], line: 'Typeset is free and MIT licensed, built by one designer.' });
}
