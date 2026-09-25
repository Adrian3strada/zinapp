export type BusinessCard = {
  id: string;
  name: string;
  category: string;
  description: string;
  schedule: string;
  location: string;
  image_url: string;
  image_fit: string;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  source: string;
  is_demo: boolean;
  is_open_now: boolean | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export type CoverageArea = {
  label: string;
  bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  center: {
    latitude: number;
    longitude: number;
  };
};

export type DishCard = {
  id: string;
  name: string;
  restaurant: string;
  description: string;
  image_url: string;
  image_alt: string;
  cta_url: string;
};

export type PromoCard = {
  id: string;
  title: string;
  product: string;
  restaurant: string;
  image_url: string;
  image_alt: string;
  cta_url: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type TrustMetrics = {
  business_count: number | null;
  order_count: number | null;
  show_metrics: boolean;
  testimonials: { quote: string; author?: string }[];
  active_promotions: { title: string; summary?: string }[];
};

export type LandingPayload = {
  site_url: string;
  seo_title: string;
  seo_description: string;
  seo_logo_url: string;
  seo_graph: unknown[];
  privacy_seo_graph: unknown[];
  landing_faqs: FaqItem[];
  app_url: string;
  app_store_url: string;
  google_play_enabled: boolean;
  play_store_url: string;
  whatsapp_url: string;
  support_email: string;
  contact_email: string;
  privacy_email: string;
  support_phone: string;
  social_instagram_url: string;
  social_facebook_url: string;
  terms_url: string;
  register_whatsapp_text: string;
  featured_businesses: BusinessCard[];
  featured_is_demo: boolean;
  newest_businesses: BusinessCard[];
  discover_dishes: DishCard[];
  landing_promos: PromoCard[];
  trust_metrics: TrustMetrics;
  coverage: CoverageArea;
  stripe_payments_enabled: boolean;
};
