/**
 * DRAFT legal copy, adapted from the original nagrek.com site.
 * Must be reviewed by a qualified lawyer before public launch.
 */
export type LegalSection = { heading: string; body: string[] }

export const TERMS_VERSION = "2026-11-draft-1"

export const privacySections: LegalSection[] = [
  {
    heading: "Information you provide",
    body: [
      "To create an account you provide an email address, a display name, and your date of birth (used only to confirm you are 18 or older). During onboarding you also share food interests, conversation tone, dietary preference, budget, languages and similar preferences, which we use to match you with other people.",
    ],
  },
  {
    heading: "Camera and microphone",
    body: [
      "Live meetings use your camera and microphone. Audio and video travel peer-to-peer between participants wherever possible and are never recorded by Nagrek by default.",
      "A meeting can only be turned into a story if every participant explicitly consents.",
    ],
  },
  {
    heading: "Location",
    body: [
      "If you share your location, we round your coordinates before storing them and only ever show other users an approximate area (for example, a neighbourhood or city). You can always enter your city manually instead.",
    ],
  },
  {
    heading: "Payments",
    body: [
      "Payments are processed by our payment partner (Razorpay). Nagrek does not store your full card or UPI details.",
    ],
  },
  {
    heading: "Stories and public content",
    body: [
      "Stories you post are visible to other verified 18+ users for 24 hours and are then deleted. Reported stories are hidden while our team reviews them.",
    ],
  },
  {
    heading: "Reports and blocks",
    body: [
      "Reports create a moderation record our team reviews. Blocking hides you from each other everywhere in the app.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can edit your preferences at any time, revoke camera, microphone and location permissions in your browser, and permanently delete your account and data from your profile settings.",
    ],
  },
  {
    heading: "Children",
    body: ["Nagrek is strictly for people aged 18 and over. Accounts found to belong to minors are removed."],
  },
  {
    heading: "Contact",
    body: ["Email founder@nagrek.com for any privacy question."],
  },
]

export const termsSections: LegalSection[] = [
  {
    heading: "Eligibility",
    body: ["You must be at least 18 years old to create an account. By continuing you confirm you are 18 or older and that the date of birth you provide is accurate."],
  },
  {
    heading: "Respectful use",
    body: [
      "You agree not to use Nagrek to harass, threaten, expose, or harm another person; not to share sexual, violent, or illegal content; not to record another participant without consent; and not to impersonate others.",
      "Breaking these rules can result in suspension or permanent removal.",
    ],
  },
  {
    heading: "Subscriptions and purchases",
    body: [
      "Plus, Premium and Ultra are paid subscriptions billed in Indian Rupees. Avatar items are one-time purchases. Refunds, renewals and cancellations follow the policy shown at checkout.",
    ],
  },
  {
    heading: "Meeting in person",
    body: [
      "Nagrek helps people connect, but you are responsible for your own safety when meeting someone. Meet in public places and tell a friend where you are going.",
    ],
  },
  {
    heading: "Sponsor rewards",
    body: [
      "Streak rewards and coupons are provided by third-party sponsors, are subject to availability, and may carry their own terms.",
    ],
  },
  {
    heading: "User content",
    body: [
      "You are responsible for content you post. Nagrek does not claim ownership of your content but needs a licence to display it inside the app.",
    ],
  },
  {
    heading: "Changes",
    body: ["We may update these terms. Material changes will be announced in the app with a new version number."],
  },
]

export const guidelinesSections: LegalSection[] = [
  {
    heading: "Come hungry, come kind",
    body: ["Treat the person across the table the way you would at a real shared meal. Greet them, be curious, and leave room for them to share too."],
  },
  {
    heading: "Consent is the whole meal",
    body: ["Both people choose to accept a connection. If someone skips or leaves, respect it. Never pressure anyone to stay, share more, or meet in person."],
  },
  {
    heading: "No recording without consent",
    body: ["Do not record, screenshot, or capture another participant without their clear permission. Stories from meetings require both people to agree."],
  },
  {
    heading: "Keep it legal and clothed",
    body: ["No sexual content, no violence, no illegal activity, no harassment. This applies to video, audio, stories and messages."],
  },
  {
    heading: "Report and block",
    body: ["If someone breaks these guidelines, use Report and Block. They are available on every profile, story and call."],
  },
  {
    heading: "Be honest about who you are",
    body: ["No impersonation and no fake identities. Come as yourself."],
  },
]
