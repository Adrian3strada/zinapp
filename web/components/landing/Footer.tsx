import Image from 'next/image';
import Link from 'next/link';

type FooterProps = {
  appUrl: string;
  termsUrl: string;
};

export function Footer({ appUrl, termsUrl }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <>
      <footer className="site-footer">
        <div className="wrap footer-main">
          <div className="footer-brand">
            <Link href="/">
              <Image src="/logo-on-blue.png" width={40} height={40} alt="Logo de ZinApp" />
              ZinApp
            </Link>
            <p>
              Todo Zinapécuaro en una sola app. Comida a domicilio, restaurantes, servicios y
              negocios locales.
            </p>
          </div>

          <div className="footer-grid">
            <div className="footer-group">
              <h3>Explorar</h3>
              <nav aria-label="Explorar">
                <Link href="/">Inicio</Link>
                <a href="#comida">Comida a domicilio</a>
                <a href="#servicios">Servicios</a>
                <a href="#promociones">Promociones</a>
                <a href={appUrl}>Ver restaurantes</a>
              </nav>
            </div>

            <div className="footer-group">
              <h3>Negocios</h3>
              <nav aria-label="Negocios">
                <a href="#negocios">Registrar negocio</a>
                <a href="#como">Cómo funciona</a>
                <a href="#instalar">Descargar ZinApp</a>
                <a href="#faq">Preguntas frecuentes</a>
              </nav>
            </div>

            <div className="footer-group">
              <h3>Legal</h3>
              <nav aria-label="Legal">
                <Link href="/privacidad/">Aviso de privacidad</Link>
                {termsUrl ? <a href={termsUrl}>Términos y condiciones</a> : null}
                <a href="#contacto">Contacto</a>
              </nav>
            </div>
          </div>
        </div>

        <div className="wrap footer-bottom">
          <span>© {year} ZinApp. Todos los derechos reservados.</span>
          <span>ZinApp Zinapécuaro</span>
        </div>
      </footer>

      <div className="mobile-bar" role="navigation" aria-label="Acciones rápidas">
        <a className="btn btn-primary" href={appUrl}>
          Ver comida
        </a>
        <a className="btn btn-secondary" href="#instalar">
          Descargar
        </a>
      </div>
    </>
  );
}
