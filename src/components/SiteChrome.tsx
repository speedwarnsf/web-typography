'use client';
import { usePathname } from 'next/navigation';
import NtfyTracker from './NtfyTracker';
import GlobalTypeset from './GlobalTypeset';
import BackToTop from './BackToTop';
import CommandPalette from './CommandPalette';
import SectionFooter from './SectionFooter';
import PrevNextStrip from './PrevNextStrip';
import GlyphField from './chrome/GlyphField';
import ScrollHairline from './chrome/ScrollHairline';
import BloomMenu from './chrome/BloomMenu';

export default function SiteChrome({ position }: { position: 'top' | 'bottom' }) {
  const pathname = usePathname();
  if (pathname === '/' || pathname === '/v4' || pathname === '/agents') return null;
  return position === 'top'
    ? <><NtfyTracker /><GlyphField /><ScrollHairline /><BloomMenu /><CommandPalette /></>
    : <><PrevNextStrip /><SectionFooter /><BackToTop /><GlobalTypeset /></>;
}
