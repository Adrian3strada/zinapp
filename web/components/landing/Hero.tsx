'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useCatalog } from './Catalog';
import { LocalClock } from './LocalClock';
import { PhoneShowcase } from './PhoneShowcase';
import { SearchBar } from './SearchBar';

type HeroProps = {
  appUrl: string;
  appStoreUrl: string;
  googlePlayEnabled: boolean;
  playStoreUrl: string;
  liveHint?: string;
  halloween?: boolean;
};

const TITLE_WORDS = ['Todo', 'Zinapécuaro'];

export function Hero({
  appUrl,
  appStoreUrl,
  googlePlayEnabled,
  playStoreUrl,
  liveHint,
  halloween = false,
}: HeroProps) {
  const reduce = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;
  const { filter, applyKind } = useCatalog();

  return (
    <section className={`hero${halloween ? ' is-halloween' : ''}`} aria-labelledby="hero-title">
      <div className="hero-aurora" aria-hidden="true">
        <span className="hero-blob hero-blob-a" />
        <span className="hero-blob hero-blob-b" />
        <span className="hero-blob hero-blob-c" />
      </div>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <motion.p
            className="hero-badge"
            role="note"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease }}
          >
            <span className="live-dot" aria-hidden="true" />
            {halloween ? '🎃  Halloween en ZinApp · ' : null}
            Zinapécuaro, Michoacán
            <LocalClock />
          </motion.p>
          <h1 id="hero-title">
            {TITLE_WORDS.map((word, index) => (
              <motion.span
                key={word}
                className="hero-word"
                initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, delay: 0.08 + index * 0.08, ease }}
              >
                {word}{' '}
              </motion.span>
            ))}
            <motion.span
              className="hero-word hero-line"
              initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.55, delay: 0.24, ease }}
            >
              en una sola <span className="hero-accent">app</span>
            </motion.span>
          </h1>
          <motion.p
            className="hero-lead"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32, ease }}
          >
            Pide comida a domicilio, descubre restaurantes y negocios locales, encuentra
            servicios y aprovecha promociones cerca de ti.
          </motion.p>
          <SearchBar />
          <motion.ul
            className="hero-pills"
            aria-label="Qué encuentras en ZinApp"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {[
              { label: 'Restaurantes', kind: 'food' as const },
              { label: 'Comida a domicilio', kind: 'food' as const },
              { label: 'Negocios', kind: 'all' as const },
              { label: 'Servicios', kind: 'service' as const },
            ].map((item, index) => (
              <motion.li
                key={item.label}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 + index * 0.06, duration: 0.35, ease }}
              >
                <button
                  type="button"
                  className={item.kind !== 'all' && filter.kind === item.kind ? 'is-active' : undefined}
                  onClick={() => applyKind(item.kind)}
                >
                  {item.label}
                </button>
              </motion.li>
            ))}
            <motion.li
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.66, duration: 0.35, ease }}
            >
              <a href="#ofertas">Promociones</a>
            </motion.li>
          </motion.ul>
          <motion.div
            className="hero-actions"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.55, ease }}
          >
            <a className="btn btn-primary btn-shimmer" href={appUrl}>
              Ver restaurantes y comida
            </a>
            <a className="btn btn-secondary" href="#instalar">
              Descargar ZinApp
            </a>
          </motion.div>
          <p className="hero-note">
            {appStoreUrl ? 'Disponible en App Store. ' : null}
            {googlePlayEnabled && playStoreUrl
              ? 'Disponible en Google Play.'
              : 'En Android puedes usarla desde el navegador.'}
          </p>
        </div>

        <motion.div
          className="hero-visual"
          initial={reduce ? false : { opacity: 0, y: 36, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease }}
        >
          <PhoneShowcase liveHint={liveHint} />
        </motion.div>
      </div>
    </section>
  );
}
