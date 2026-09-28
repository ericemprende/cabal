import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/waitlist'

/** Páginas públicas que conviene que encuentren los buscadores (/sitemap.xml). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/bot`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/terminos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacidad`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/creditos`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
