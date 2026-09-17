import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import '@/app/v4/v4.css';

export default function V4Shell({ children }: { children: ReactNode }) {
  return <div className="v4-site">
    <a href="#main" className="v4-skip">Skip to content</a>
    <header className="v4-header"><Link href="/" className="v4-wordmark">typeset<span>.ts</span></Link>
      <nav aria-label="Primary"><Link href="/#proof">The difference</Link><Link href="/agents">For agents</Link><Link href="/v4" className="v4-nav-install">Get V4 <ArrowUpRight size={16} aria-hidden="true" /></Link></nav>
    </header>
    {children}
    <footer className="v4-footer"><div><Link className="v4-wordmark" href="/">typeset<span>.ts</span></Link><p>A little more care for the words on the web.</p></div>
      <nav aria-label="Footer"><Link href="/v4">Installation</Link><a href="/for-agents.md">Agent instructions</a><Link href="/library">Typography library</Link><Link href="/about">Dustin York</Link><Link href="/support">Support the project</Link></nav>
      <p className="v4-colophon">Free and open source. MIT licensed. V4 beta is an explicit upgrade; existing V3 installations stay unchanged.</p>
    </footer>
  </div>;
}
