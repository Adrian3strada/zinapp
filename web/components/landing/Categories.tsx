'use client';

import Image from 'next/image';
import { useCatalog } from './Catalog';
import { Reveal } from './Reveal';

type CategoriesProps = {
  appUrl: string;
};

const CATEGORIES = [
  {
    id: 'comida',
    title: 'Restaurantes y comida',
    body: 'Pide de tus locales favoritos y recíbelo en casa o recógelo en el establecimiento.',
    cta: 'Ver restaurantes y comida',
    image: '/screenshots/restaurants.png',
    alt: 'Restaurantes y comida a domicilio en Zinapécuaro dentro de ZinApp',
    featured: true,
    kind: 'food' as const,
    href: '#destacados',
  },
  {
    id: 'servicios',
    title: 'Servicios locales',
    body: 'Encuentra peluquerías, talleres, salud y más negocios de Zinapécuaro.',
    cta: 'Explorar servicios',
    image: '/screenshots/services.png',
    alt: 'Servicios y negocios locales de Zinapécuaro en ZinApp',
    featured: false,
    kind: 'service' as const,
    href: '#destacados',
  },
  {
    id: 'promociones',
    title: 'Negocios y promociones',
    body: 'Descubre comercios locales y las ofertas que haya activas en ZinApp.',
    cta: 'Explorar negocios',
    image: '/screenshots/home.png',
    alt: 'Negocios, productos y promociones locales en ZinApp',
    featured: false,
    kind: 'all' as const,
    href: '#destacados',
  },
];

export function Categories({ appUrl }: CategoriesProps) {
  const { applyKind } = useCatalog();

  return (
    <section className="section" id="categorias" aria-labelledby="cat-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">Explora Zinapécuaro</p>
          <h2 className="section-title" id="cat-title">
            Comida a domicilio, negocios y servicios
          </h2>
          <p className="section-lead">
            Lo que el pueblo ya usa: restaurantes, comercios locales y servicios cerca de ti.
          </p>
        </div>

        <div className="cat-grid cat-bento">
          {CATEGORIES.map((category, index) => (
            <Reveal key={category.id} delay={index * 0.08}>
              <article
                className={`cat-card cat-card-visual${category.featured ? ' cat-card-feature' : ''}`}
                id={category.id}
              >
                <div className="cat-media">
                  <Image
                    src={category.image}
                    alt={category.alt}
                    width={640}
                    height={400}
                  />
                </div>
                <div className="cat-body">
                  <h3>{category.title}</h3>
                  <p>{category.body}</p>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={category.href}
                    onClick={() => applyKind(category.kind)}
                  >
                    {category.cta}
                  </a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="catalog-app-hint">
          ¿No lo ves aquí?{' '}
          <a href={appUrl}>Ábrelo en la app</a>
        </p>
      </div>
    </section>
  );
}
