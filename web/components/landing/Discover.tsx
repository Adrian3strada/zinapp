'use client';

import type { DishCard, PromoCard } from '@/lib/types';
import { matchesDish, matchesPromo } from '@/lib/catalog';
import { useCatalog } from './Catalog';
import { Reveal } from './Reveal';
import { ShareButton } from './ShareButton';

export function Discover({ dishes }: { dishes: DishCard[] }) {
  const { filter, openNames } = useCatalog();
  const visible = dishes.filter((dish) => matchesDish(dish, filter, openNames));
  if (!visible.length) return null;
  return (
    <section className="section section-alt" id="comer-hoy" aria-labelledby="dish-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Menú local</p>
          <h2 className="section-title" id="dish-title">
            Descubre qué comer hoy en Zinapécuaro
          </h2>
          <p className="section-lead">Platillos reales de restaurantes que ya están en ZinApp.</p>
        </div>
        <div className="dish-grid">
          {visible.map((dish, index) => (
            <Reveal key={dish.id} delay={index * 0.05}>
              <article className="dish-card">
                <div className="dish-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dish.image_url}
                    alt={dish.image_alt}
                    loading="lazy"
                    decoding="async"
                    width={480}
                    height={360}
                  />
                </div>
                <div className="dish-body">
                  <h3>{dish.name}</h3>
                  <p className="dish-place">{dish.restaurant}</p>
                  {dish.description ? <p className="dish-desc">{dish.description}</p> : null}
                  <div className="biz-actions">
                    <a className="btn btn-primary btn-sm" href={dish.cta_url}>
                      Pedir ahora
                    </a>
                    <ShareButton name={dish.name} url={dish.cta_url} />
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Promos({ promos }: { promos: PromoCard[] }) {
  const { filter, openNames } = useCatalog();
  const visible = promos.filter((promo) => matchesPromo(promo, filter, openNames));
  if (!visible.length) return null;
  return (
    <section className="section" id="ofertas" aria-labelledby="promo-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Ofertas</p>
          <h2 className="section-title" id="promo-title">
            Promociones en Zinapécuaro
          </h2>
          <p className="section-lead">Promos vigentes publicadas por restaurantes en ZinApp.</p>
        </div>
        <div className="promo-grid">
          {visible.map((promo, index) => (
            <Reveal key={promo.id} delay={index * 0.05}>
              <article className="promo-card">
                <div className="promo-media">
                  {promo.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={promo.image_url}
                      alt={promo.image_alt}
                      loading="lazy"
                      decoding="async"
                      width={480}
                      height={320}
                    />
                  ) : null}
                  <span className="promo-badge">{promo.title}</span>
                </div>
                <div className="promo-body">
                  <h3>{promo.product}</h3>
                  <p>{promo.restaurant}</p>
                  <div className="biz-actions">
                    <a className="btn btn-primary btn-sm" href={promo.cta_url}>
                      Ver promoción
                    </a>
                    <ShareButton name={promo.product} url={promo.cta_url} />
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
