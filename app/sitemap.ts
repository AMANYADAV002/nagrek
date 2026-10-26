import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://nagrek.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/bengaluru`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/guidelines`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refund`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]
}
