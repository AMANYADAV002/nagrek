import { LegalCallout, LegalSection, LegalShell } from '@/components/nagrek/legal-shell'

export const metadata = {
  title: 'Privacy Policy | Nagrek',
  description:
    'Plain-language Privacy Policy detailing data collection, 0.1° fuzzy grid cells, and consent withdrawal on Nagrek.',
}

export default function PrivacyPage() {
  return (
    <LegalShell
      activePath="/privacy"
      eyebrow="Privacy & Data"
      title="Privacy Policy"
      subtitle="Plain language · No fine-print surprises · Data contact: privacy@nagrek.com"
    >
      <LegalSection title="1. Core Privacy Commitments">
        <div className="grid gap-3 sm:grid-cols-2">
          <LegalCallout>
            <span className="mb-1 inline-block size-2 rounded-full bg-accent" aria-hidden="true" />
            <h3 className="mt-2 text-xs font-semibold text-foreground">Video calls are never recorded</h3>
            <p className="mt-1 text-xs">
              Streams are peer-to-peer WebRTC. We never record, process, or store your camera or microphone feeds.
            </p>
          </LegalCallout>
          <LegalCallout>
            <span className="mb-1 inline-block size-2 rounded-full bg-accent" aria-hidden="true" />
            <h3 className="mt-2 text-xs font-semibold text-foreground">No exact GPS coordinates</h3>
            <p className="mt-1 text-xs">
              We store a coarse 0.1° grid cell (~10 km). Your exact street or restaurant location is never saved.
            </p>
          </LegalCallout>
        </div>
      </LegalSection>

      <LegalSection title="2. What Data We Collect">
        <p>Nagrek collects only the minimum data required to facilitate matchmaking and safety:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Login & authentication:</strong> email, username, display name, and
            avatar via Google OAuth or magic link.
          </li>
          <li>
            <strong className="text-foreground">Coarse location cell:</strong> a truncated cell used solely to find
            nearby matches.
          </li>
          <li>
            <strong className="text-foreground">Call history metadata:</strong> room id, timestamps, craving, and
            accept/skip outcomes for safety and troubleshooting.
          </li>
          <li>
            <strong className="text-foreground">Safety records:</strong> blocks and reports you submit.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How We Use Your Data">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Match you with partners who share a craving nearby.</li>
          <li>Prevent blocked users from encountering each other again.</li>
          <li>Manage subscriptions when billing is enabled.</li>
          <li>Enforce our 18+ policy and community guidelines.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Withdrawing Consent & Deleting Your Data">
        <p>
          You can withdraw consent and request permanent deletion of your profile, location cell, and block list at any
          time.
        </p>
        <LegalCallout>
          <p className="text-xs font-medium text-foreground">To withdraw consent or delete your account</p>
          <p className="mt-1 text-xs">
            Email{' '}
            <a href="mailto:privacy@nagrek.com" className="font-semibold text-accent underline-offset-4 hover:underline">
              privacy@nagrek.com
            </a>
            . Deletion requests are executed within 48 hours.
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection title="5. Data Retention & Automatic Cleanup">
        <p>
          Accounts inactive for more than 1 year are scheduled for permanent deletion after a 48-hour email notice.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact Our Data Team">
        <p className="flex flex-wrap items-center gap-2">
          DPDP / privacy requests:{' '}
          <a href="mailto:privacy@nagrek.com" className="font-medium text-foreground underline-offset-4 hover:underline">
            privacy@nagrek.com
          </a>
        </p>
      </LegalSection>
    </LegalShell>
  )
}

