import { ImageResponse } from 'next/og';

// The essay's unfurl card — black ground, gold kicker, site idiom.
// Deliberately self-contained: no remote font fetch (a failed fetch in the
// edge runtime once shipped a 200 with an empty body — an invisible card).
// The default face, set tight and large, carries the layout; the brand
// lives in the black, the gold, and the words.

export const runtime = 'edge';
export const alt = 'The Browser Types. It Doesn’t Read. — an essay from typeset.us';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
            marginBottom: 48,
          }}
        >
          Typeset.us — an argument, set by its subject
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.08,
            color: '#f2f2f2',
            letterSpacing: '-0.01em',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>The Browser Types.</span>
          <span>It Doesn’t Read.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 60 }}>
          <div style={{ width: 14, height: 14, background: '#B8963E', marginRight: 18 }} />
          <div style={{ fontSize: 26, color: '#a3a3a3' }}>
            Dustin York — thirty years of putting words in front of people
          </div>
        </div>
      </div>
    ),
    size
  );
}
