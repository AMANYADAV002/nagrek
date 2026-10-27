import { LegalCallout, LegalSection, LegalShell } from '@/components/nagrek/legal-shell'

export const metadata = {
  title: 'Community Guidelines | Nagrek',
  description: 'Community standards and 18+ rules for a safe, respectful meal experience on Nagrek.',
}

export default function GuidelinesPage() {
  return (
    <LegalShell
      activePath="/guidelines"
      eyebrow="Respect & Safety"
      title="Community Guidelines"
      subtitle="Rules that keep meal connections spontaneous, respectful, and safe."
    >
      <LegalSection title="1. Strictly 18+ only">
        <p>
          Nagrek is exclusively for adults. If you suspect someone in a call is a minor, use <strong>Report</strong>{' '}
          immediately. Minor accounts are banned permanently.
        </p>
      </LegalSection>

      <LegalSection title="2. What is never allowed">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">Nudity or sexual behavior</strong>
          </li>
          <li>
            <strong className="text-foreground">Harassment & hate</strong>
          </li>
          <li>
            <strong className="text-foreground">Violence or weapons</strong>
          </li>
          <li>
            <strong className="text-foreground">Commercial spam & scams</strong>
          </li>
          <li>
            <strong className="text-foreground">Recording calls</strong> without consent
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Empowering your safety">
        <div className="space-y-3">
          <LegalCallout>
            <p className="text-xs font-semibold text-foreground">Blurred accept phase</p>
            <p className="mt-1 text-xs">
              Your partner’s video stays blurred until both of you Accept. Skip anytime if you feel uncomfortable.
            </p>
          </LegalCallout>
          <LegalCallout>
            <p className="text-xs font-semibold text-foreground">Report & Block</p>
            <p className="mt-1 text-xs">
              Report alerts safety and ends the call. Block permanently prevents future matches with that person.
            </p>
          </LegalCallout>
        </div>
      </LegalSection>

      <LegalSection title="4. Appeals process">
        <p>
          Believe a ban was a mistake? Email{' '}
          <a href="mailto:appeals@nagrek.com" className="font-semibold text-accent underline-offset-4 hover:underline">
            appeals@nagrek.com
          </a>{' '}
          with your account email and username. Appeals are reviewed within 7 business days.
        </p>
      </LegalSection>
    </LegalShell>
  )
}

