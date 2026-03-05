import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: { slug: string } }) {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '80px',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ color: '#a78bfa', fontSize: 20, letterSpacing: 4, marginBottom: 24, textTransform: 'uppercase' }}>
          consilium
        </div>
        <div style={{ color: 'white', fontSize: 48, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, marginBottom: 32 }}>
          Multi-model deliberation
        </div>
        <div style={{ color: '#9ca3af', fontSize: 24, textAlign: 'center' }}>
          5 frontier models debate. 1 judge synthesizes.
        </div>
        <div style={{ marginTop: 48, color: '#6b7280', fontSize: 18 }}>
          consilium.sh
        </div>
      </div>
    ),
    { ...size }
  )
}
