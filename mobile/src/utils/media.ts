import { API_URL } from '../config/api';

const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Normaliza URLs de media.
 * Corrige URLs absolutas mal armadas cuando MEDIA_URL no tenía barra inicial
 * (p. ej. https://host/api/auth/media/avatars/x → https://host/media/avatars/x).
 */
export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      const mediaIdx = u.pathname.indexOf('/media/');
      if (mediaIdx > 0) {
        u.pathname = u.pathname.slice(mediaIdx);
        return u.toString();
      }
    } catch {
      // URL inválida: devolver tal cual
    }
    return path;
  }
  if (path.startsWith('/')) return `${API_ORIGIN}${path}`;
  return `${API_ORIGIN}/${path}`;
}
