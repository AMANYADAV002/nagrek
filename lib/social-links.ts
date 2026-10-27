/** Normalize and build public URLs for optional social handles. */

export type SocialHandles = {
  instagram?: string | null
  snapchat?: string | null
  facebook?: string | null
  linkedin?: string | null
}

function clean(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.trim().replace(/^@/, '')
  return v.length ? v.slice(0, 120) : null
}

export function normalizeSocialHandles(input: SocialHandles): Required<SocialHandles> {
  return {
    instagram: clean(input.instagram),
    snapchat: clean(input.snapchat),
    facebook: clean(input.facebook),
    linkedin: clean(input.linkedin),
  }
}

export function socialHref(
  network: 'instagram' | 'snapchat' | 'facebook' | 'linkedin',
  value: string,
): string {
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  switch (network) {
    case 'instagram':
      return `https://instagram.com/${encodeURIComponent(v.replace(/^@/, ''))}`
    case 'snapchat':
      return `https://www.snapchat.com/add/${encodeURIComponent(v.replace(/^@/, ''))}`
    case 'facebook':
      return `https://facebook.com/${encodeURIComponent(v.replace(/^@/, ''))}`
    case 'linkedin':
      return v.includes('/')
        ? `https://www.linkedin.com/${v.replace(/^\//, '')}`
        : `https://www.linkedin.com/in/${encodeURIComponent(v)}`
  }
}

export const SOCIAL_LABELS = [
  { key: 'instagram' as const, label: 'Instagram', placeholder: 'handle' },
  { key: 'snapchat' as const, label: 'Snapchat', placeholder: 'username' },
  { key: 'facebook' as const, label: 'Facebook', placeholder: 'username or URL' },
  { key: 'linkedin' as const, label: 'LinkedIn', placeholder: 'username or URL' },
]
