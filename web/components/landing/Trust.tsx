import type { FaqItem, TrustMetrics } from '@/lib/types';
import { CountUp } from './CountUp';
import { Reveal } from './Reveal';

export function Trust({ metrics }: { metrics: TrustMetrics }) {
  return (
    <section className="section section-alt" id="confianza" aria-labelledby="trust-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Confianza</p>
          <h2 className="section-title" id="trust-title">
            Delivery y negocios locales de Zinapécuaro
          </h2>
          <p className="section-lead">Una plataforma hecha para el pueblo: clara, cercana y fácil de usar.</p>
        </div>

        {metrics.show_metrics ? (
          <div className="trust-metrics" aria-label="Datos de la plataforma">
            {metrics.business_count ? (
              <div className="trust-metric">
                <p className="trust-metric-value">
                  <CountUp value={metrics.business_count} />
                </p>
                <p className="trust-metric-label">Negocios registrados</p>
              </div>
            ) : null}
            {metrics.order_count ? (
              <div className="trust-metric">
                <p className="trust-metric-value">
                  <CountUp value={metrics.order_count} />
                </p>
                <p className="trust-metric-label">Pedidos realizados</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {metrics.testimonials.length ? (
          <div className="trust-testimonials" aria-label="Opiniones de usuarios">
            {metrics.testimonials.map((item) => (
              <blockquote className="trust-quote" key={item.quote}>
                <p>{item.quote}</p>
                {item.author ? <cite>{item.author}</cite> : null}
              </blockquote>
            ))}
          </div>
        ) : null}

        {metrics.active_promotions.length ? (
          <div className="trust-promos" aria-label="Promociones activas">
            {metrics.active_promotions.map((promo) => (
              <article className="trust-promo" key={promo.title}>
                <h3>{promo.title}</h3>
                {promo.summary ? <p>{promo.summary}</p> : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="trust-grid">
          {[
            {
              title: 'Negocios locales',
              body: 'Restaurantes, servicios y comercios de Zinapécuaro.',
              icon: (
                <>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </>
              ),
            },
            {
              title: 'Contacto directo',
              body: 'Atención por WhatsApp y soporte cercano para clientes y negocios.',
              icon: (
                <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1 12.4-10.3 8.4 8.4 0 0 1 3.7 6.5z" />
              ),
            },
            {
              title: 'Repartidores registrados',
              body: 'Entregas con personas registradas en la plataforma.',
              icon: (
                <>
                  <circle cx="5" cy="18" r="2.5" />
                  <circle cx="18" cy="18" r="2.5" />
                  <path d="M7.5 18H12l2-6h5l2 4" />
                  <path d="M5 18l1.5-8h6" />
                </>
              ),
            },
            {
              title: 'Creada para Zinapécuaro',
              body: 'Enfocada en tu pueblo, no en ciudades lejanas.',
              icon: (
                <>
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" />
                  <circle cx="12" cy="10" r="2.5" />
                </>
              ),
            },
            {
              title: 'Pedidos fáciles y rápidos',
              body: 'Interfaz clara pensada para usar desde el celular.',
              icon: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <article className="trust-item">
                <div className="trust-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {item.icon}
                  </svg>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="section" id="faq" aria-labelledby="faq-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Ayuda</p>
          <h2 className="section-title" id="faq-title">
            Preguntas frecuentes
          </h2>
          <p className="section-lead">Respuestas cortas para pedir comida o registrar tu negocio.</p>
        </div>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p className="faq-a">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

type ContactProps = {
  appUrl: string;
  whatsappUrl: string;
  contactEmail: string;
  supportPhone: string;
  instagramUrl: string;
  facebookUrl: string;
};

export function Contact({
  appUrl,
  whatsappUrl,
  contactEmail,
  supportPhone,
  instagramUrl,
  facebookUrl,
}: ContactProps) {
  const hasContact = Boolean(whatsappUrl || contactEmail || supportPhone);
  return (
    <section className="section section-alt" id="contacto" aria-labelledby="contact-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Estamos cerca</p>
          <h2 className="section-title" id="contact-title">
            Contacto
          </h2>
          <p className="section-lead">¿Dudas, soporte o quieres registrar tu negocio? Escríbenos.</p>
        </div>
        <div className="contact-box">
          {whatsappUrl ? (
            <a
              className="btn btn-whatsapp"
              href={`${whatsappUrl}?text=${encodeURIComponent('Hola, necesito ayuda con ZinApp')}`}
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.5-1-.9-1.4-1.9-1.6-2.2-.1-.3 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s1 2.4 1.1 2.6c.1.2 1.9 2.9 4.6 4 .6.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.9-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.4.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.2-.4-4.5-1.3l-.3-.2-3.1.8.8-3-.2-.3C4 14.9 3.5 13.5 3.5 12 3.5 7.3 7.3 3.5 12 3.5S20.5 7.3 20.5 12 16.7 20.2 12 20.2z" />
              </svg>
              WhatsApp
            </a>
          ) : null}
          <div className="contact-links">
            {contactEmail ? <a href={`mailto:${contactEmail}`}>Correo: {contactEmail}</a> : null}
            {supportPhone ? <a href={`tel:${supportPhone}`}>Teléfono: {supportPhone}</a> : null}
            {instagramUrl ? (
              <a href={instagramUrl} rel="noopener noreferrer" target="_blank">
                Instagram
              </a>
            ) : null}
            {facebookUrl ? (
              <a href={facebookUrl} rel="noopener noreferrer" target="_blank">
                Facebook
              </a>
            ) : null}
          </div>
          {!hasContact ? (
            <p className="contact-fallback">
              También puedes abrir ZinApp y escribirnos desde ahí. <a href={appUrl}>Ir a ZinApp</a>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
