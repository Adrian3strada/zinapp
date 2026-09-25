'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const STEPS = [
  {
    title: 'Elige un restaurante, servicio o negocio',
    body: 'Explora el catálogo local y encuentra lo que necesitas cerca de ti.',
    image: '/screenshots/home.png',
    alt: 'Inicio de ZinApp con negocios de Zinapécuaro',
  },
  {
    title: 'Realiza tu pedido o contacta directamente',
    body: 'Confirma en la app o escribe al negocio por WhatsApp cuando aplique.',
    image: '/screenshots/restaurants.png',
    alt: 'Catálogo de restaurantes para armar el pedido',
  },
  {
    title: 'Recibe tu pedido o visita el establecimiento',
    body: 'Te lo llevan a domicilio o vas al local. Tú eliges cómo.',
    image: '/screenshots/services.png',
    alt: 'Servicios y negocios locales en ZinApp',
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % STEPS.length);
    }, 3800);
    return () => window.clearInterval(id);
  }, [paused]);

  const step = STEPS[active];

  return (
    <section className="section section-alt" id="como" aria-labelledby="how-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Simple</p>
          <h2 className="section-title" id="how-title">
            Cómo pedir comida o contactar un negocio
          </h2>
          <p className="section-lead">
            Tres pasos para pedir a domicilio, contactar o visitar un local de Zinapécuaro.
          </p>
        </div>

        <div
          className="how-split"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <ol className="how-steps">
            {STEPS.map((item, index) => (
              <li key={item.title}>
                <button
                  type="button"
                  className={`how-step${index === active ? ' is-active' : ''}`}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => setActive(index)}
                  onFocus={() => setActive(index)}
                >
                  <span className="how-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="how-phone" aria-hidden="true">
            <div className="phone phone-main">
              <div className="phone-screen">
                <div className="phone-notch" />
                <Image src={step.image} alt={step.alt} width={472} height={1024} />
              </div>
            </div>
            <p className="how-caption">{step.title}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type ForBusinessProps = {
  whatsappUrl: string;
  registerText: string;
};

export function ForBusiness({ whatsappUrl, registerText }: ForBusinessProps) {
  const registerHref = whatsappUrl
    ? `${whatsappUrl}?text=${encodeURIComponent(registerText)}`
    : '#contacto';

  return (
    <section className="section section-alt" id="negocios" aria-labelledby="biz-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Para negocios</p>
          <h2 className="section-title" id="biz-title">
            Registra tu restaurante, negocio o servicio
          </h2>
          <p className="section-lead">
            Elige la modalidad que mejor se adapte a tu local en Zinapécuaro.
          </p>
        </div>

        <div className="plan-grid">
          <article className="plan-card">
            <h3>Modalidad Servicios</h3>
            <ul className="plan-list">
              <li>Publicación del nombre del negocio</li>
              <li>Giro o categoría</li>
              <li>Teléfono y WhatsApp</li>
              <li>Horario</li>
              <li>Dirección</li>
              <li>Ubicación en Google Maps</li>
            </ul>
          </article>
          <article className="plan-card">
            <h3>Modalidad Restaurantes y pedidos</h3>
            <p className="plan-price">Sin mensualidad</p>
            <ul className="plan-list">
              <li>Publicación del menú</li>
              <li>Recepción de pedidos desde ZinApp</li>
              <li>Apoyo con entrega mediante repartidores</li>
            </ul>
            <p className="plan-note">
              Los precios publicados en ZinApp incluyen un 10% adicional. El restaurante recibe
              el precio original de sus productos; ZinApp conserva el 10% adicional como comisión.
            </p>
          </article>
        </div>

        <div className="biz-cta-row">
          <a
            className="btn btn-primary btn-shimmer"
            href={registerHref}
            rel={whatsappUrl ? 'noopener noreferrer' : undefined}
          >
            Registrar mi negocio
          </a>
          <a className="btn btn-ghost" href="#como">
            Conocer cómo funciona
          </a>
        </div>
      </div>
    </section>
  );
}
