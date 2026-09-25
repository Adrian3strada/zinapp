import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/api';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  return [
    {
      url: `${site}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${site}/privacidad/`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];
}
