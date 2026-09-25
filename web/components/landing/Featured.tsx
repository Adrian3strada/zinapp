'use client';

import type { BusinessCard } from '@/lib/types';
import { matchesBusiness } from '@/lib/catalog';
import { FilterBar, useCatalog } from './Catalog';
import { Reveal } from './Reveal';
import { ShareButton } from './ShareButton';
import { SpotlightCard } from './SpotlightCard';

type FeaturedProps = {
  businesses: BusinessCard[];
  isDemo: boolean;
  appUrl: string;
};

function BusinessCardView({ biz }: { biz: BusinessCard }) {
  const mediaClass = [
    'biz-media',
    biz.image_fit === 'cover' ? 'biz-media-cover' : '',
    biz.image_fit === 'contain' ? 'biz-media-contain' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className="biz-card">
      <div className={mediaClass}>
        {biz.is_demo ? <span className="biz-demo">Ejemplo</span> : null}
        {biz.is_open_now === true ? <span className="biz-open">Abierto ahora</span> : null}
        {biz.is_open_now === false ? <span className="biz-closed">Cerrado ahora</span> : null}
        {biz.image_url ? (
          // Fotos de /media/ las sirve Django (rewrite / Caddy).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={biz.image_url}
            alt={biz.image_alt || biz.name}
            loading="lazy"
            decoding="async"
            width={640}
            height={400}
          />
        ) : (
          <span aria-hidden="true">{biz.name.slice(0, 18)}</span>
        )}
      </div>
      <div className="biz-body">
        <span className="biz-cat">{biz.category || '\u00a0'}</span>
        <h3 className="biz-name">{biz.name}</h3>
        <p className="biz-desc">{biz.description || '\u00a0'}</p>
        <div className="biz-meta">
          <span title={biz.schedule || undefined}>
            {biz.schedule ? `Horario: ${biz.schedule}` : '\u00a0'}
          </span>
          <span title={biz.location || undefined}>
            {biz.location ? `Ubicación: ${biz.location}` : '\u00a0'}
          </span>
        </div>
        <div className="biz-actions">
          <a className="btn btn-primary btn-sm" href={biz.cta_url}>
            {biz.cta_label}
          </a>
          <ShareButton name={biz.name} url={biz.cta_url} />
        </div>
      </div>
    </article>
  );
}

function EmptyCatalog({
  appUrl,
  query,
  openNow,
}: {
  appUrl: string;
  query: string;
  openNow: boolean;
}) {
  const { clearFilters } = useCatalog();
  const appHref = query ? `${appUrl.replace(/\/?$/, '/')}?q=${encodeURIComponent(query)}` : appUrl;
  const message = openNow
    ? 'Nada abierto ahora en Zinapécuaro. Quita el filtro para ver el resto.'
    : query
      ? `No encontramos “${query}” en esta lista.`
      : 'No hay negocios para mostrar con ese filtro.';

  return (
    <div className="catalog-empty">
      <p>{message}</p>
      <div className="catalog-empty-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
          Ver todos
        </button>
        <a className="btn btn-primary btn-sm" href={appHref}>
          Buscar en la app
        </a>
      </div>
    </div>
  );
}

export function Featured({ businesses, isDemo, appUrl }: FeaturedProps) {
  const { filter } = useCatalog();
  const visible = businesses.filter((biz) => matchesBusiness(biz, filter));

  return (
    <section className="section" id="destacados" aria-labelledby="feat-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Cerca de ti</p>
          <h2 className="section-title" id="feat-title">
            Negocios destacados en Zinapécuaro
          </h2>
          <p className="section-lead">Locales reales disponibles en ZinApp para pedir o contactar.</p>
        </div>

        <FilterBar />

        {visible.length ? (
          <div className="biz-grid">
            {visible.map((biz, index) => (
              <Reveal key={biz.id} delay={index * 0.07}>
                <SpotlightCard>
                  <BusinessCardView biz={biz} />
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyCatalog appUrl={appUrl} query={filter.query} openNow={filter.openNow} />
        )}

        {isDemo && visible.length ? (
          <p className="demo-note">
            Estos son ejemplos. Cuando haya restaurantes o servicios activos, se mostrarán aquí.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function Newest({ businesses }: { businesses: BusinessCard[] }) {
  const { filter } = useCatalog();
  const visible = businesses.filter((biz) => matchesBusiness(biz, filter));
  if (!visible.length) return null;
  return (
    <section className="section" id="nuevos" aria-labelledby="new-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Se están sumando</p>
          <h2 className="section-title" id="new-title">
            Nuevos en ZinApp
          </h2>
          <p className="section-lead">Negocios de Zinapécuaro que se acaban de publicar.</p>
        </div>
        <div className="biz-grid biz-grid-compact">
          {visible.map((biz, index) => (
            <Reveal key={biz.id} delay={index * 0.07}>
              <BusinessCardView biz={biz} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
