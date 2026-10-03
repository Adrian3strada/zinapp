'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ScrollProgress } from './ScrollProgress';

type HeaderProps = {
  appUrl: string;
  halloween?: boolean;
};

export function Header({ appUrl, halloween = false }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > 18);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header${compact ? ' is-compact' : ''}${halloween ? ' is-halloween' : ''}`}>
      <ScrollProgress />
      <div className="wrap">
        <Link className="brand" href="/" style={{ viewTransitionName: 'zinapp-logo' }}>
          <Image src="/logo-on-blue.png" width={36} height={36} alt="ZinApp" />
          <span>ZinApp</span>
          {halloween ? (
            <span className="season-chip" aria-label="Halloween">
              🎃 Halloween
            </span>
          ) : null}
        </Link>

        <nav className="nav-desktop" aria-label="Principal">
          <Link href="/">Inicio</Link>
          <a href="#comida">Comida</a>
          <a href="#cobertura">Cobertura</a>
          <a href="#servicios">Servicios</a>
          <a href="#promociones">Promociones</a>
          <a href="#negocios">Para negocios</a>
          <a className="btn btn-primary btn-sm nav-cta" href={appUrl}>
            Ver restaurantes
          </a>
        </nav>

        <button
          type="button"
          className="menu-toggle"
          aria-controls="nav-mobile"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      <nav
        className={`nav-mobile${open ? ' is-open' : ''}`}
        id="nav-mobile"
        aria-label="Menú móvil"
        hidden={!open}
      >
        <Link href="/" onClick={() => setOpen(false)}>
          Inicio
        </Link>
        <a href="#comida" onClick={() => setOpen(false)}>
          Comida
        </a>
        <a href="#cobertura" onClick={() => setOpen(false)}>
          Cobertura
        </a>
        <a href="#servicios" onClick={() => setOpen(false)}>
          Servicios
        </a>
        <a href="#promociones" onClick={() => setOpen(false)}>
          Promociones
        </a>
        <a href="#negocios" onClick={() => setOpen(false)}>
          Registrar negocio
        </a>
        <a href="#instalar" onClick={() => setOpen(false)}>
          Descargar ZinApp
        </a>
        <a className="btn btn-primary btn-block" href={appUrl}>
          Ver restaurantes y comida
        </a>
      </nav>
    </header>
  );
}
