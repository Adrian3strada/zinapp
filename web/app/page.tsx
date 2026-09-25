import type { Metadata } from 'next';
import { Categories } from '@/components/landing/Categories';
import { Discover, Promos } from '@/components/landing/Discover';
import { Featured, Newest } from '@/components/landing/Featured';
import { Footer } from '@/components/landing/Footer';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Marquee } from '@/components/landing/Marquee';
import { ForBusiness, HowItWorks } from '@/components/landing/HowItWorks';
import { Install } from '@/components/landing/Install';
import { OauthHashRedirect } from '@/components/landing/OauthHashRedirect';
import { CoverageMap } from '@/components/landing/CoverageMap';
import { CatalogProvider } from '@/components/landing/Catalog';
import { Contact, Faq, Trust } from '@/components/landing/Trust';
import { WhatsAppFloat } from '@/components/landing/WhatsAppFloat';
import { getLandingPayload } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const data = await getLandingPayload();
  return {
    title: { absolute: data.seo_title },
    description: data.seo_description,
    alternates: { canonical: `${data.site_url}/` },
    openGraph: {
      title: data.seo_title,
      description: data.seo_description,
      url: `${data.site_url}/`,
      images: [{ url: data.seo_logo_url, alt: 'Logo de ZinApp' }],
    },
    twitter: {
      title: data.seo_title,
      description: data.seo_description,
      images: [data.seo_logo_url],
    },
  };
}

export default async function HomePage() {
  const data = await getLandingPayload();
  const jsonLd = { '@context': 'https://schema.org', '@graph': data.seo_graph };
  const tickerNames = [
    ...data.featured_businesses.map((biz) => biz.name),
    ...data.newest_businesses.map((biz) => biz.name),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <OauthHashRedirect />
      <a className="skip-link" href="#contenido-principal">
        Saltar al contenido
      </a>
      <Header appUrl={data.app_url} />
      <main id="contenido-principal" tabIndex={-1} style={{ viewTransitionName: 'zinapp-main' }}>
        <CatalogProvider
          businesses={[...data.featured_businesses, ...data.newest_businesses]}
        >
          <Hero
            appUrl={data.app_url}
            appStoreUrl={data.app_store_url}
            googlePlayEnabled={data.google_play_enabled}
            playStoreUrl={data.play_store_url}
            liveHint={data.featured_businesses[0]?.name}
          />
          <Marquee items={tickerNames} />
          <CoverageMap
            coverage={data.coverage}
            businesses={[...data.featured_businesses, ...data.newest_businesses]}
            appUrl={data.app_url}
          />
          <Categories appUrl={data.app_url} />
          <Featured
            businesses={data.featured_businesses}
            isDemo={data.featured_is_demo}
            appUrl={data.app_url}
          />
          <Discover dishes={data.discover_dishes} />
          <Promos promos={data.landing_promos} />
          <Newest businesses={data.newest_businesses} />
        </CatalogProvider>
        <HowItWorks />
        <ForBusiness
          whatsappUrl={data.whatsapp_url}
          registerText={data.register_whatsapp_text}
        />
        <Install
          appUrl={data.app_url}
          appStoreUrl={data.app_store_url}
          googlePlayEnabled={data.google_play_enabled}
          playStoreUrl={data.play_store_url}
        />
        <Trust metrics={data.trust_metrics} />
        <Faq items={data.landing_faqs} />
        <Contact
          appUrl={data.app_url}
          whatsappUrl={data.whatsapp_url}
          contactEmail={data.contact_email}
          supportPhone={data.support_phone}
          instagramUrl={data.social_instagram_url}
          facebookUrl={data.social_facebook_url}
        />
      </main>
      <Footer appUrl={data.app_url} termsUrl={data.terms_url} />
      <WhatsAppFloat href={data.whatsapp_url} />
    </>
  );
}
