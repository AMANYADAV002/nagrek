import type { Metadata, Viewport } from 'next'
import { Geist, Instrument_Serif } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nagrek — Never Eat Alone',
  description:
    'Pick what you are craving, get matched with someone nearby who wants the same thing, and share a meal over live video.',
  applicationName: 'Nagrek',
  keywords: ['food', 'video chat', 'meal buddy', 'eat together', 'WebRTC', 'Nagrek'],
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: 'Nagrek — Never Eat Alone',
    description: 'Location-based food matching with live video.',
    type: 'website',
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
    <html lang="en" className={`${geist.variable} ${instrument.variable} bg-background`}>
      <body>{children}</body>
    </html>
  )
}
