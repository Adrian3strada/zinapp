# Pruebas y CI

Desde `backend/`, ejecuta:

```powershell
python manage.py makemigrations --check --dry-run
python manage.py test accounts accounts.test_security dashboard local_services orders restaurants config.test_landing
```

Desde `web/`, ejecuta:

```powershell
npm ci
npm run typecheck
npm run build
```

Desde `mobile/`, ejecuta:

```powershell
npm ci
npx tsc --noEmit
```

La GitHub Action `CI` ejecuta estas comprobaciones en pull requests y en
`master`. El typecheck móvil es informativo mientras se corrige la deuda de
tipos existente; no se usa aún como bloqueo de merge. El job `web` sí bloquea
si falla el typecheck o el build de Next.js. `CodeQL` analiza Python
y JavaScript/TypeScript; Dependabot propone actualizaciones semanales de
dependencias y acciones.

Actualmente no hay pruebas automatizadas para pantallas móviles. Todo cambio
de interfaz debe validarse manualmente en Expo Go o en una build de preview,
además del typecheck.
