export function formatCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  return `$${safe.toFixed(2)}`;
}

export function normalizePriceInput(value: string): string {
  return value.trim().replace(',', '.');
}

export function parsePriceInput(value: string): number | null {
  const normalized = normalizePriceInput(value);
  if (!normalized) return null;
  const num = parseFloat(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function formatTimeAgo(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 10) return 'ahora mismo';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
}

export function formatRouteSummary(distanceMeters: number, durationSeconds: number): string {
  return `${formatRouteDistance(distanceMeters)} · ${formatRouteDuration(durationSeconds)}`;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo para recoger',
  picked_up: 'Recogido',
  on_the_way: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
