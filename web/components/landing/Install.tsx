type InstallProps = {
  appUrl: string;
  appStoreUrl: string;
  googlePlayEnabled: boolean;
  playStoreUrl: string;
};

export function Install({ appUrl, appStoreUrl, googlePlayEnabled, playStoreUrl }: InstallProps) {
  const playReady = googlePlayEnabled && Boolean(playStoreUrl);
  return (
    <section className="section" id="instalar" aria-labelledby="install-title">
      <div className="wrap">
        <div className="section-head">
          <p className="section-kicker">En tu celular</p>
          <h2 className="section-title" id="install-title">
            Instala ZinApp en tu celular
          </h2>
          <p className="section-lead">
            {playReady
              ? 'Descarga ZinApp desde Google Play o App Store y empieza a pedir en Zinapécuaro.'
              : 'Disponible en App Store. En Android puedes usarla desde el navegador hasta que esté en Google Play.'}
          </p>
        </div>

        <div className="install-actions">
          {playReady ? (
            <a className="btn btn-primary" href={playStoreUrl} rel="noopener noreferrer" target="_blank">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.6 2.7c-.3.2-.5.6-.5 1.1v16.4c0 .5.2.9.5 1.1l.1.1 9.1-9.1v-.2L3.7 2.6l-.1.1zm11.3 6.5L12.1 12l2.8 2.8 3.5-2c.6-.3.6-1.2 0-1.6l-3.5-2zm-1.5 3.6-9.4 9.4c.2 0 .4 0 .6-.1l10.6-6.1-1.8-3.2zm0-1.6 1.8-3.2L5.6 2.1c-.2-.1-.4-.1-.6-.1l9.4 9.2z" />
              </svg>
              Google Play
            </a>
          ) : (
            <a className="btn btn-primary" href={appUrl}>
              Usar ZinApp en Android
            </a>
          )}
          {appStoreUrl ? (
            <a className="btn btn-secondary" href={appStoreUrl} rel="noopener noreferrer" target="_blank">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-1.98 1.08-3.13-1.05.05-2.31.72-3.05 1.6-.66.78-1.24 2.03-1.08 3.18 1.14.09 2.31-.66 3.05-1.65z" />
              </svg>
              App Store
            </a>
          ) : null}
          <a className="btn btn-ghost" href={appUrl}>
            Abrir en el navegador
          </a>
        </div>
        <p className="install-note">
          Disponible en App Store.{' '}
          {playReady ? 'Disponible en Google Play.' : 'En Android puedes usarla desde el navegador.'}
        </p>

        <div className="accordion">
          <details id="instalar-android" open={!playReady}>
            <summary>Instrucciones para Android</summary>
            <div className="acc-body">
              {playReady ? (
                <>
                  <ol>
                    <li>
                      Abre la app <strong>Google Play Store</strong> en tu celular.
                    </li>
                    <li>
                      Busca <strong>ZinApp</strong>.
                    </li>
                    <li>
                      Toca <strong>Instalar</strong> y espera a que termine la descarga.
                    </li>
                    <li>Abre ZinApp desde tu pantalla de inicio y crea tu cuenta o inicia sesión.</li>
                  </ol>
                  <p style={{ margin: '0.85rem 0 0' }}>
                    <a
                      className="btn btn-primary btn-sm"
                      href={playStoreUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Descargar en Google Play
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <ol>
                    <li>Abre el navegador de tu celular Android (Chrome, Firefox, etc.).</li>
                    <li>
                      Entra a <strong>zinapp.com.mx/app</strong> o toca el botón de abajo.
                    </li>
                    <li>Inicia sesión o crea tu cuenta para pedir comida y ver negocios.</li>
                    <li>Cuando ZinApp esté en Google Play, podrás instalarla desde la tienda.</li>
                  </ol>
                  <p style={{ margin: '0.85rem 0 0' }}>
                    <a className="btn btn-primary btn-sm" href={appUrl}>
                      Usar ZinApp en Android
                    </a>
                  </p>
                </>
              )}
            </div>
          </details>

          <details id="instalar-iphone" open={!appStoreUrl}>
            <summary>Instrucciones para iPhone</summary>
            <div className="acc-body">
              <ol>
                <li>
                  Abre la app <strong>App Store</strong> en tu iPhone.
                </li>
                <li>
                  Busca <strong>ZinApp</strong>.
                </li>
                <li>
                  Toca <strong>Obtener</strong> o el ícono de descarga e inicia sesión con tu Apple ID
                  si te lo pide.
                </li>
                <li>Abre ZinApp desde tu pantalla de inicio y crea tu cuenta o inicia sesión.</li>
              </ol>
              {appStoreUrl ? (
                <p style={{ margin: '0.85rem 0 0' }}>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={appStoreUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Descargar en App Store
                  </a>
                </p>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
