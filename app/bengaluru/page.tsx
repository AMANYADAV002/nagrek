import type { Metadata } from 'next'
import { CityLanding } from '@/components/nagrek/city-landing'

export const metadata: Metadata = {
  title: 'Nagrek Bengaluru — Never eat alone',
  description:
    'Match with someone in Bengaluru over the same craving — biryani, dosa, chai, pizza — and share a meal on video.',
  openGraph: {
    title: 'Nagrek Bengaluru',
    description: 'Food matching for Bengaluru. Join the waitlist for lunch & dinner windows.',
  },
}

export default function BengaluruPage() {
  return <CityLanding city="Bengaluru" headlineCity="Bengaluru" source="city-bengaluru" />
}
