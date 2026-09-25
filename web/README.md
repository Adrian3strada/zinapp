# Landing pública ZinApp (Next.js)

Sitio de marketing en App Router. Django sigue siendo la API, el panel y la SPA Expo en `/app/`.

## Local

1. Arranca Django en `:8000`.
2. En `web/`:

```powershell
copy .env.example .env.local
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). `next.config.ts` reescribe `/api`, `/media`, `/app` y `/static` hacia `DJANGO_ORIGIN`.

## Producción (Railway)

El servicio `zinapp-web` es el origen de `zinapp.com.mx`. Caddy (mismo contenedor) enruta:

- `/`, `/privacidad/`, `/_next/*` → Next.js
- `/api`, `/app`, `/panel`, `/pos`, `/media`, `/static`, `/ws` → Django interno

```powershell
.\scripts\deploy-web.ps1
```

Variables: `DJANGO_ORIGIN`, `SITE_URL`, `PORT` (Railway).
