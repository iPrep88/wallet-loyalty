import type { NextConfig } from 'next'

const config: NextConfig = {
  // The workspace packages ship TypeScript source, not build output.
  transpilePackages: ['@wl/db', '@wl/passes', '@wl/shared'],
  serverExternalPackages: ['sharp', 'pg'],

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
