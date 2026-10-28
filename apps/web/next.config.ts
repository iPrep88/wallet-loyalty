import type { NextConfig } from 'next'

const config: NextConfig = {
  // The workspace packages ship TypeScript source, not build output.
  transpilePackages: ['@wl/db', '@wl/passes', '@wl/shared'],
  serverExternalPackages: ['sharp', 'pg'],

  // The short URLs are what we hand out — they go on wallet-review
  // submissions, in emails to shop owners, and anywhere a link has to be read
  // aloud or typed. The pages themselves live under /legal, and a reviewer
  // who follows a 404 does not look for the real one.
  async redirects() {
    return [
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
      { source: '/terms', destination: '/legal/terms', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        // The QR decoder is a megabyte of WebAssembly, and the counter phone
        // fetches it the first time it scans. Next serves /public with
        // no-cache by default, so without this every shift downloads it
        // again over a shop's wifi. The file only changes when the library
        // version does, and then its contents change with it.
        source: '/zxing_reader.wasm',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:icon(icon-192.png|icon-512.png|icon-maskable-512.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
    ]
  },
}

export default config
