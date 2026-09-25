import { ImageResponse } from 'next/og';

// Unfurl cards in the site idiom: black ground, gold kicker, square corners.
// Self-contained, like the essay's card: no remote font fetch.
export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ kicker, title, line }: { kicker: string; title: string[]; line: string }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#050505', padding: '80px 96px' }}>
        <div style={{ fontSize: 22, letterSpacing: '0.38em', color: '#B8963E', textTransform: 'uppercase', marginBottom: 48 }}>{kicker}</div>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.08, color: '#f2f2f2', letterSpacing: '-0.01em', display: 'flex', flexDirection: 'column' }}>
          {title.map(t => <span key={t}>{t}</span>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 56 }}>
          <div style={{ width: 14, height: 14, background: '#B8963E', marginRight: 18 }} />
          <div style={{ fontSize: 28, color: '#a3a3a3' }}>{line}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
