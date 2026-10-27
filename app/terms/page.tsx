import { LegalCallout, LegalSection, LegalShell } from '@/components/nagrek/legal-shell'

export const metadata = {
  title: 'Terms of Service | Nagrek',
  description: 'Terms of Service and conditions for using the Nagrek video meal matchmaking platform.',
}

export default function TermsPage() {
  return (
    <LegalShell
      activePath="/terms"
      eyebrow="Legal & Terms"
      title="Terms of Service"
      subtitle="Last updated: October 2026 · Plain language edition for adults sharing meals on video."
    >
      <LegalSection title="1. Strict 18+ Age Requirement">
        <p>
          Nagrek is strictly an adults-only platform (18 years of age or older). You must verify your age during account
          setup. If you are under 18, you are legally prohibited from using Nagrek. Any accounts found to belong to
          minors will be permanently banned immediately without refund.
        </p>
      </LegalSection>

      <LegalSection title="2. The Nagrek Service">
        <p>
          Nagrek connects people spontaneously over shared food cravings. Connections are powered by real-time WebRTC
          peer-to-peer video streaming. Nagrek does not record, intercept, or store your live audio or video streams.
        </p>
      </LegalSection>

      <LegalSection title="3. Community Standards & Zero Tolerance">
        <p>Nagrek enforces a strict zero-tolerance policy against:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Nudity, sexual activity, or sexually explicit behavior.</li>
          <li>Harassment, bullying, hate speech, or threatening other users.</li>
          <li>Commercial spam, soliciting money, or advertising.</li>
          <li>Impersonation or recording calls without consent.</li>
        </ul>
        <p>Violations result in an immediate, permanent device and account ban.</p>
      </LegalSection>

      <LegalSection title="4. Subscriptions, Free Trials & Billing">
        <p>
          Nagrek offers membership plans (Monthly, 3-Month, and 6-Month passes) and may offer a 7-day free trial.
          Subscriptions renew automatically at the end of each billing cycle until cancelled. You can cancel your
          subscription at any time with 1 tap in your Account Settings. Upon cancellation, you retain access until the
          end of your prepaid period.
        </p>
      </LegalSection>

      <LegalSection title="5. Account Termination & Appeals">
        <p>
          We reserve the right to suspend or ban accounts that violate these Terms or our Community Guidelines. Banned
          users are shown their ban reason and can appeal by contacting{' '}
          <a href="mailto:appeals@nagrek.com" className="font-medium text-accent underline-offset-4 hover:underline">
            appeals@nagrek.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Contact Information">
        <LegalCallout>
          For legal inquiries, contact{' '}
          <a href="mailto:legal@nagrek.com" className="font-medium text-foreground underline-offset-4 hover:underline">
            legal@nagrek.com
          </a>
          .
        </LegalCallout>
      </LegalSection>
    </LegalShell>
  )
}

