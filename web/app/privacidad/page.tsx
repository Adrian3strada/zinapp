import type { Metadata } from 'next';
import { getLandingPayload } from '@/lib/api';
import { renderPrivacyHtml } from '@/lib/privacyHtml';
import './privacidad.css';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getLandingPayload();
  const title = 'Aviso de privacidad — ZinApp';
  const description =
    'Aviso de privacidad integral de ZinApp — delivery y servicios locales en Zinapécuaro, Michoacán, México.';
  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: `${data.site_url}/privacidad/` },
    openGraph: {
      title,
      description:
        'Aviso de privacidad integral de ZinApp para clientes, restaurantes, repartidores y servicios locales en Zinapécuaro.',
      url: `${data.site_url}/privacidad/`,
      images: [{ url: data.seo_logo_url, alt: 'Logo de ZinApp' }],
    },
    twitter: {
      card: 'summary',
      title,
      description:
        'Aviso de privacidad integral de ZinApp para usuarios en Zinapécuaro, Michoacán.',
      images: [data.seo_logo_url],
    },
  };
}

export default async function PrivacyPage() {
  const data = await getLandingPayload();
  const jsonLd = { '@context': 'https://schema.org', '@graph': data.privacy_seo_graph };
  const html = renderPrivacyHtml({
    privacyEmail: data.privacy_email,
    supportEmail: data.support_email || data.privacy_email,
    siteUrl: data.site_url,
    stripeEnabled: data.stripe_payments_enabled,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        className="privacy-doc"
        style={{ viewTransitionName: 'zinapp-main' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
