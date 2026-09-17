'use client';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyAction({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState('copied'); }
    catch { setState('error'); }
  }
  return <span className="v4-copy-wrap"><button type="button" className={`v4-button ${className}`} onClick={copy} aria-label={label} title={label}>
    {state === 'copied' ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
    {state === 'copied' ? 'Copied' : label}
  </button><span className="v4-sr" role="status">{state === 'copied' ? 'Copied to clipboard' : state === 'error' ? 'Clipboard unavailable. The text remains selectable.' : ''}</span></span>;
}
