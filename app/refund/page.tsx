import { Clock, CreditCard, HelpCircle, RefreshCcw } from 'lucide-react'
import { LegalCallout, LegalSection, LegalShell } from '@/components/nagrek/legal-shell'

export const metadata = {
  title: 'Cancellation & Refund Policy | Nagrek',
  description: 'Fair, plain-language subscription cancellation and refund policy for Nagrek memberships.',
}

export default function RefundPage() {
  return (
    <LegalShell
      activePath="/refund"
      eyebrow="Clear Billing"
      icon={RefreshCcw}
      title="Cancellation & Refund Policy"
      subtitle="Fair terms · 1-tap cancellation · No hidden cancellation fees"
    >
      <LegalSection title="1. 7-day free trial" icon={Clock}>
        <p>
          During a free trial you are charged ₹0 until it expires. Cancel anytime in those 7 days with zero penalty.
        </p>
      </LegalSection>

      <LegalSection title="2. 1-tap self-serve cancellation" icon={CreditCard}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open your account menu from the header avatar.</li>
          <li>Tap cancel subscription.</li>
          <li>Cancellation takes effect immediately for future renewals.</li>
        </ol>
        <p>You keep access until the end of the prepaid period. No further charges occur.</p>
      </LegalSection>

      <LegalSection title="3. Refund policy" icon={RefreshCcw}>
        <p>Completed billing cycles are generally non-refundable once started. We refund when:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-foreground">Accidental auto-renewal</strong> reported within 48 hours with no new
            calls in that cycle
          </li>
          <li>
            <strong className="text-foreground">Technical failure</strong> that blocked use of the service
          </li>
          <li>
            <strong className="text-foreground">Duplicate charges</strong>
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How to request a refund" icon={HelpCircle}>
        <LegalCallout>
          <p className="text-xs font-medium text-foreground">Billing support</p>
          <p className="mt-1 text-xs">
            Email{' '}
            <a href="mailto:billing@nagrek.com" className="font-semibold text-accent underline-offset-4 hover:underline">
              billing@nagrek.com
            </a>{' '}
            with your registered email and payment id. Refunds return to the original method within 5–7 business days.
          </p>
        </LegalCallout>
      </LegalSection>
    </LegalShell>
  )
}
