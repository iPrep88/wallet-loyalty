import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Wallet Loyalty',
  description: 'Stamp cards that live in Apple Wallet and Google Wallet.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The join page is scanned at a counter; a stray pinch-zoom is only noise.
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)',  color: '#061525' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body style={{ fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
