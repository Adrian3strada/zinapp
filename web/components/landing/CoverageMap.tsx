'use client';

import type { BusinessCard, CoverageArea } from '@/lib/types';
import { matchesBusiness } from '@/lib/catalog';
import { useCatalog } from './Catalog';

type CoverageMapProps = {
  coverage: CoverageArea;
  businesses: BusinessCard[];
  appUrl: string;
};

function pinStyle(biz: BusinessCard, bounds: CoverageArea['bounds']) {
  const lat = biz.latitude as number;
  const lon = biz.longitude as number;
  const left = ((lon - bounds.min_lon) / (bounds.max_lon - bounds.min_lon)) * 100;
  const top = ((bounds.max_lat - lat) / (bounds.max_lat - bounds.min_lat)) * 100;
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(92, Math.max(8, top))}%`,
  };
}

export function CoverageMap({ coverage, businesses, appUrl }: CoverageMapProps) {
  const { filter } = useCatalog();
  if (!coverage?.bounds) return null;

  const pins = businesses.filter(
    (biz) =>
      biz.latitude != null &&
      biz.longitude != null &&
      !biz.is_demo &&
      matchesBusiness(biz, filter),
  );
  const bbox = [
    coverage.bounds.min_lon,
    coverage.bounds.min_lat,
    coverage.bounds.max_lon,
    coverage.bounds.max_lat,
  ].join(',');
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;

  return (
    <section className="section" id="cobertura" aria-labelledby="cover-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Cobertura</p>
          <h2 className="section-title" id="cover-title">
            Entregamos en {coverage.label}
          </h2>
          <p className="section-lead">
            Pedidos a domicilio dentro del pueblo. Si estás en el mapa, ZinApp llega.
          </p>
        </div>

        <div className="coverage-frame">
          <iframe
            className="coverage-iframe"
            title={`Mapa de cobertura ${coverage.label}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {pins.length ? (
            <div className="coverage-pins" aria-hidden="true">
              {pins.map((biz) => (
                <span
                  key={biz.id}
                  className={`coverage-pin${biz.is_open_now === true ? ' is-open' : ''}${biz.is_open_now === false ? ' is-closed' : ''}`}
                  style={pinStyle(biz, coverage.bounds)}
                  title={biz.name}
                />
              ))}
            </div>
          ) : null}
        </div>
        <p className="coverage-note">
          Zona de entrega: {coverage.label}.{' '}
          <a href={appUrl}>Pide desde la app</a>
          {' · '}
          <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">
            © OpenStreetMap
          </a>
        </p>
      </div>
    </section>
  );
}
