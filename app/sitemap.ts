import type { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://consilium.sh', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://consilium.sh/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://consilium.sh/history', lastModified: new Date(), changeFrequency: 'never', priority: 0.3 },
  ]
}
