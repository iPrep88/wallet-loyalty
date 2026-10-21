import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wallet Loyalty',
  description: 'Digital stamp cards that live in Apple Wallet and Google Wallet.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The join page is scanned at a counter; a stray pinch-zoom is only noise.
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-50">
        {children}
      </body>
    </html>
  )
}
