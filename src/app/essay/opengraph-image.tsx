import { ImageResponse } from 'next/og';

// The essay's unfurl card: the site's own idiom — black ground, gold
// kicker, Playfair display — so the link preview is typeset's first
// impression before a single paragraph loads.

export const runtime = 'edge';
export const alt = 'The Browser Types. It Doesn’t Read. — an essay from typeset.us';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  const playfair = await fetch(
    'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xRbPQ-xDA.ttf'
  ).then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#050505',
          padding: '80px 96px',
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: '0.38em',
            color: '#B8963E',
            textTransform: 'uppercase',
            marginBottom: 44,
          }}
        >
          Typeset.us — an argument, set by its subject
        </div>
        <div
          style={{
            fontFamily: 'Playfair',
            fontSize: 104,
            lineHeight: 1.06,
            color: '#f2f2f2',
            letterSpacing: '-0.01em',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>The Browser Types.</span>
          <span>It Doesn’t Read.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 56 }}>
          <div style={{ width: 14, height: 14, background: '#B8963E', marginRight: 16 }} />
          <div style={{ fontSize: 26, color: '#a3a3a3' }}>
            Dustin York — thirty years of putting words in front of people
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Playfair', data: playfair, weight: 700 as const, style: 'normal' as const }],
    }
  );
}
