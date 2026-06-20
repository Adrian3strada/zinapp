/** Referencia visible del pedido (código aleatorio o #id de respaldo). */
export function orderRef(order: { id: number; code?: string | null }): string {
  const code = order.code?.trim();
  if (code) return code;
  return `#${order.id}`;
}

/** Etiqueta completa, p. ej. "Pedido K7M3X9". */
export function formatOrderLabel(
  order: { id: number; code?: string | null },
  prefix = 'Pedido',
): string {
  return `${prefix} ${orderRef(order)}`;
}
