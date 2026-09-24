import { ogCard, OG_SIZE } from '@/lib/og-card';

export const alt = 'Typeset: better line breaks for web text';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OgImage() {
  return ogCard({ kicker: 'typeset.us', title: ['Better line breaks', 'for web text.'], line: 'No stranded short words. Links and styling intact. Chrome, Safari, Firefox.' });
}
