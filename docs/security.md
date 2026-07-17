# Seguridad

## Reportar una vulnerabilidad

No abras un issue público con detalles explotables, secretos o datos
personales. Sigue el proceso de [SECURITY.md](../SECURITY.md).

## Configuración de producción

- `DEBUG=False`, `SECRET_KEY` aleatorio de al menos 32 caracteres y hosts/CORS
  explícitos.
- `DEMO_ACCOUNTS_ENABLED=false`, `SEED_DATA=false` y
  `ALLOW_DEMO_SEED=false`. El seed exige ambas variables y solo se admite en
  entornos efímeros.
- Configura `MERCADOPAGO_WEBHOOK_SECRET`; la aplicación rechaza webhooks sin
  firma válida y valida monto, moneda y referencia antes de marcar un pedido
  como pagado.
- Mantén `SERVE_MEDIA=false` salvo que haya un proxy o almacenamiento diseñado
  para media. Nunca hagas públicos los documentos de repartidores.
- Configura `REDIS_URL` para rate limits compartidos si Gunicorn se ejecuta con
  varios workers o réplicas; sin esa variable el backend usa cache local solo
  apta para desarrollo.
- Las acciones sensibles de pedidos, pagos, envíos y verificación de
  repartidores generan `AuditLog` con actor, objeto, IP, user-agent y metadata
  mínima para soporte o revisión forense.
- `GET /api/health/` solo expone `ok`; los detalles de infraestructura deben
  revisarse en logs internos, no en endpoints públicos.
- Mantén `API_DOCS_ENABLED=false` en producción normal; actívalo solo para
  revisión controlada o entornos internos.
- En web, el access token se guarda por sesión y el refresh token queda solo en
  memoria. Esto reduce persistencia, pero la defensa fuerte ante XSS requiere
  una migración futura a cookies HttpOnly con CSRF.

## Controles de GitHub

El administrador del repositorio debe activar protección de `master`, revisión
por pull request, secret scanning y alertas de Dependabot. CodeQL y Dependabot
ya están configurados en el repositorio, pero las alertas y las reglas de rama
se habilitan desde la interfaz de GitHub.

## Rotación

Ante una exposición, revoca y rota de inmediato `SECRET_KEY`, credenciales de
Mercado Pago, tokens de cron, claves de tiendas y cualquier secreto afectado.
Revisa logs, despliega la nueva configuración y cierra sesiones si procede.
