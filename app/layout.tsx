import type { Metadata, Viewport } from 'next'
import { Fraunces, Outfit } from 'next/font/google'
import { PwaRegister } from '@/components/nagrek/pwa-register'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://nagrek.com'),
  title: 'Nagrek — Never Eat Alone',
  description:
    'Pick what you are craving, get matched with someone nearby who wants the same thing, and share a meal over video. Demo partners are always labeled.',
  applicationName: 'Nagrek',
  keywords: ['food', 'video chat', 'meal buddy', 'eat together', 'WebRTC', 'Nagrek', 'Bengaluru'],
  icons: { icon: '/icon.svg' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Nagrek — Never Eat Alone',
    description: 'Shared cravings. Real people. Video meal buddies nearby.',
    type: 'website',
    images: [{ url: '/icon.svg', alt: 'Nagrek' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nagrek',
  },
}

export const viewport: Viewport = {
  themeColor: '#07060a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} bg-background`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
