/** Clave única por intento de checkout — evita pedidos/envíos duplicados en el servidor. */
export function createIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 14);
  return `zin-${Date.now()}-${rand}`;
}
