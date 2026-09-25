'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const SHOTS = [
  {
    src: '/screenshots/home.png',
    alt: 'Inicio de ZinApp: restaurantes y comida a domicilio en Zinapécuaro',
  },
  {
    src: '/screenshots/restaurants.png',
    alt: 'Catálogo de restaurantes en ZinApp',
  },
  {
    src: '/screenshots/services.png',
    alt: 'Servicios locales de Zinapécuaro en ZinApp',
  },
] as const;

type PhoneShowcaseProps = {
  liveHint?: string;
};

export function PhoneShowcase({ liveHint }: PhoneShowcaseProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return undefined;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SHOTS.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [reduce]);

  const shot = SHOTS[index];

  return (
    <div className="phone-stack">
      <div className="phone phone-ghost phone-ghost-left" aria-hidden="true">
        <div className="phone-screen">
          <Image src={SHOTS[1].src} alt="" width={472} height={1024} />
        </div>
      </div>
      <div className="phone phone-ghost phone-ghost-right" aria-hidden="true">
        <div className="phone-screen">
          <Image src={SHOTS[2].src} alt="" width={472} height={1024} />
        </div>
      </div>

      <motion.div
        className="phone phone-main"
        whileHover={reduce ? undefined : { rotateY: -8, rotateX: 5, y: -8 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18 }}
      >
        <div className="phone-screen">
          <div className="phone-notch" />
          <AnimatePresence mode="wait">
            <motion.div
              key={shot.src}
              className="phone-shot"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={472}
                height={1024}
                priority={index === 0}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.p
        className="hero-toast"
        initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.55, type: 'spring', stiffness: 280, damping: 18 }}
      >
        <span className="live-dot" aria-hidden="true" />
        {liveHint ? `${liveHint} ya está en ZinApp` : 'En vivo en Zinapécuaro'}
      </motion.p>

      <div className="phone-dots" role="tablist" aria-label="Capturas de ZinApp">
        {SHOTS.map((item, shotIndex) => (
          <button
            key={item.src}
            type="button"
            role="tab"
            aria-selected={shotIndex === index}
            aria-label={`Ver captura ${shotIndex + 1}`}
            className={shotIndex === index ? 'is-active' : ''}
            onClick={() => setIndex(shotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
