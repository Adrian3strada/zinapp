import { Fredoka, Space_Grotesk } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { ViewTransition } from 'react';
import './landing.css';

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space',
  display: 'swap',
});

const siteUrl = (process.env.SITE_URL || 'https://zinapp.com.mx').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Comida a domicilio en Zinapécuaro | ZinApp',
    template: '%s | ZinApp',
  },
  description:
    'Pide comida a domicilio en Zinapécuaro. Restaurantes, negocios locales, servicios y promociones en una sola app hecha para el pueblo.',
  applicationName: 'ZinApp',
  authors: [{ name: 'ZinApp' }],
  keywords: [
    'ZinApp',
    'comida a domicilio Zinapécuaro',
    'restaurantes Zinapécuaro',
    'negocios locales',
    'servicios Zinapécuaro',
  ],
  robots: { index: true, follow: true },
  icons: {
    icon: '/logo-on-blue.png',
    apple: '/logo-on-blue.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    siteName: 'ZinApp',
    url: siteUrl,
    images: [
      {
        url: '/logo-on-blue.png',
        width: 1024,
        height: 1024,
        alt: 'Logo de ZinApp',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
  other: {
    'geo.region': 'MX-MIC',
    'geo.placename': 'Zinapécuaro, Michoacán',
  },
};

export const viewport: Viewport = {
  themeColor: '#1E5DB8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${fredoka.variable} ${spaceGrotesk.variable}`}>
      <body>
        <ViewTransition name="zinapp-main">{children}</ViewTransition>
      </body>
    </html>
  );
}
