import type { LandingPayload } from './types';

const SITE_URL = 'https://zinapp.com.mx';
const APP_URL = 'https://zinapp.com.mx/app/';

export const FALLBACK_LANDING: LandingPayload = {
  site_url: SITE_URL,
  seo_title: 'Comida a domicilio en Zinapécuaro | ZinApp',
  seo_description:
    'Pide comida a domicilio en Zinapécuaro. Restaurantes, negocios locales, servicios y promociones en una sola app hecha para el pueblo.',
  seo_logo_url: `${SITE_URL}/logo-on-blue.png`,
  seo_graph: [],
  privacy_seo_graph: [],
  landing_faqs: [
    {
      question: '¿Necesito descargar ZinApp?',
      answer:
        'Puedes usarla en el navegador en zinapp.com.mx/app. En iPhone también está en App Store. En Android úsala desde el navegador hasta que esté en Google Play.',
    },
    {
      question: '¿Cómo hago un pedido?',
      answer:
        'Abre ZinApp, elige un restaurante, arma tu pedido y confirma. Puedes recibirlo a domicilio o recogerlo en el local.',
    },
    {
      question: '¿Cómo registro mi negocio?',
      answer:
        'Toca Registrar mi negocio y te guiamos por WhatsApp. Hay modalidad Servicios y modalidad Restaurantes y pedidos.',
    },
    {
      question: '¿Qué incluye la modalidad Servicios?',
      answer:
        'Publicamos tu negocio con contacto, horario, dirección y ubicación en Google Maps.',
    },
    {
      question: '¿Cómo funciona la comisión para restaurantes?',
      answer:
        'No hay mensualidad. El precio en ZinApp incluye un 10% adicional. El restaurante recibe su precio original; ZinApp conserva ese 10%.',
    },
    {
      question: '¿Cómo contacto a ZinApp?',
      answer:
        'Escríbenos por WhatsApp desde Contacto. Ahí también verás correo o teléfono si están disponibles.',
    },
  ],
  app_url: APP_URL,
  app_store_url: '',
  google_play_enabled: false,
  play_store_url: '',
  whatsapp_url: '',
  support_email: '',
  contact_email: '',
  privacy_email: 'adrianestradachavez123@gmail.com',
  support_phone: '',
  social_instagram_url: '',
  social_facebook_url: '',
  terms_url: '',
  register_whatsapp_text:
    'Hola, quiero registrar mi negocio en ZinApp Zinapécuaro.\n\nNombre del negocio:\nGiro / categoría:\nTeléfono / WhatsApp:\nHorario:\nDirección:',
  featured_businesses: [
    {
      id: 'demo-1',
      name: 'Ejemplo: Taquería El Centro',
      category: 'Restaurante',
      schedule: 'Lun–Dom · 11:00 a. m.–10:00 p. m.',
      location: 'Centro, Zinapécuaro',
      image_url: '',
      description: '',
      image_fit: '',
      image_alt: 'Ejemplo de restaurante en ZinApp',
      cta_label: 'Pedir ahora',
      cta_url: APP_URL,
      source: 'demo',
      is_demo: true,
      is_open_now: null,
      latitude: null,
      longitude: null,
      created_at: '',
    },
    {
      id: 'demo-2',
      name: 'Ejemplo: Salón María Belleza',
      category: 'Servicio',
      schedule: 'Lun–Sáb · 10:00 a. m.–7:00 p. m.',
      location: 'Col. Independencia',
      image_url: '',
      description: '',
      image_fit: '',
      image_alt: 'Ejemplo de servicio en ZinApp',
      cta_label: 'Ver negocio',
      cta_url: APP_URL,
      source: 'demo',
      is_demo: true,
      is_open_now: null,
      latitude: null,
      longitude: null,
      created_at: '',
    },
    {
      id: 'demo-3',
      name: 'Ejemplo: Abarrotes Don Luis',
      category: 'Comercio',
      schedule: 'Lun–Dom · 8:00 a. m.–9:00 p. m.',
      location: 'Av. Principal',
      image_url: '',
      description: '',
      image_fit: '',
      image_alt: 'Ejemplo de comercio en ZinApp',
      cta_label: 'Ver negocio',
      cta_url: APP_URL,
      source: 'demo',
      is_demo: true,
      is_open_now: null,
      latitude: null,
      longitude: null,
      created_at: '',
    },
  ],
  featured_is_demo: true,
  newest_businesses: [],
  discover_dishes: [],
  landing_promos: [],
  trust_metrics: {
    business_count: null,
    order_count: null,
    show_metrics: false,
    testimonials: [],
    active_promotions: [],
  },
  coverage: {
    label: 'Zinapécuaro, Michoacán',
    bounds: {
      min_lat: 19.81,
      max_lat: 19.91,
      min_lon: -100.88,
      max_lon: -100.78,
    },
    center: { latitude: 19.86, longitude: -100.83 },
  },
  stripe_payments_enabled: false,
};

export function siteUrl(): string {
  return (process.env.SITE_URL || FALLBACK_LANDING.site_url).replace(/\/$/, '');
}

export function djangoOrigin(): string {
  return (process.env.DJANGO_ORIGIN || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

export async function getLandingPayload(): Promise<LandingPayload> {
  try {
    const response = await fetch(`${djangoOrigin()}/api/landing/`, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`landing api ${response.status}`);
    }
    return (await response.json()) as LandingPayload;
  } catch {
    return { ...FALLBACK_LANDING, site_url: siteUrl() };
  }
}
