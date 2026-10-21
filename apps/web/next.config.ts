import type { NextConfig } from 'next'

const config: NextConfig = {
  // The workspace packages ship TypeScript source, not build output.
  transpilePackages: ['@wl/db', '@wl/passes', '@wl/shared'],
  serverExternalPackages: ['sharp', 'pg'],
}

export default config
