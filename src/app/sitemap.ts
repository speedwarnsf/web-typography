import type { MetadataRoute } from 'next';
import { getAllPages } from '@/lib/sitemap';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = new Set(['/', '/install', ...getAllPages().map(page => page.slug)]);
  return [...paths].map(path => ({ url: `https://typeset.us${path}` }));
}
