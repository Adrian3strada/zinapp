import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/api';

export default function robots(): MetadataRoute.Robots {
  const site = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacidad/'],
      disallow: ['/admin/', '/panel/', '/api/', '/app/', '/media/'],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
