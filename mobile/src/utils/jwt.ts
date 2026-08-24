/** Decodifica el payload de un JWT sin verificar firma (solo para leer `exp` en cliente). */
export function decodeJwtPayload(token: string): { exp?: number; user_id?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    const json =
      typeof globalThis.atob === 'function'
        ? globalThis.atob(normalized + pad)
        : Buffer.from(normalized + pad, 'base64').toString('utf8');
    return JSON.parse(json) as { exp?: number; user_id?: number };
  } catch {
    return null;
  }
}

/** true si no hay token, no se puede leer, o expira dentro de `skewSeconds`. */
export function isAccessTokenExpiringSoon(token: string | null | undefined, skewSeconds = 120): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
