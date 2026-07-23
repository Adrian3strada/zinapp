import type { MapPolyline } from '../components/AppMap';
import { restaurantApi } from '../services/api';
import type { MapCoordinate } from './maps';
import { isValidCoordinate, sanitizeCoordinates } from './maps';
import { roundCoordinate } from './coords';

export interface StreetRouteStats {
  distanceMeters: number | null;
  durationSeconds: number | null;
  isEstimated?: boolean;
}

interface CachedRoute extends StreetRouteStats {
  coordinates: MapCoordinate[];
}

const routeCache = new Map<string, CachedRoute>();

export function haversineMeters(a: MapCoordinate, b: MapCoordinate): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projectOnSegment(
  position: MapCoordinate,
  a: MapCoordinate,
  b: MapCoordinate,
): { point: MapCoordinate; t: number; dist: number } {
  const ax = a.longitude;
  const ay = a.latitude;
  const bx = b.longitude;
  const by = b.latitude;
  const px = position.longitude;
  const py = position.latitude;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const point = {
    latitude: ay + dy * t,
    longitude: ax + dx * t,
  };
  return { point, t, dist: haversineMeters(position, point) };
}

export type TrimRouteResult = {
  coordinates: MapCoordinate[];
  /** Índice del vértice desde el que sigue la ruta (nunca debe bajar). */
  progressIndex: number;
};

/**
 * Recorta la polilínea a lo pendiente. `minProgressIndex` evita que la línea
 * "crezca" otra vez si el GPS tiembla hacia atrás.
 */
export function trimRouteAhead(
  coordinates: MapCoordinate[],
  position: MapCoordinate,
  minProgressIndex = 0,
): TrimRouteResult {
  if (coordinates.length < 2 || !isValidCoordinate(position)) {
    return { coordinates, progressIndex: minProgressIndex };
  }

  const startAt = Math.max(0, Math.min(minProgressIndex, coordinates.length - 2));
  let bestSeg = startAt;
  let bestT = 0;
  let bestPoint = coordinates[startAt];
  let bestDist = Infinity;

  for (let i = startAt; i < coordinates.length - 1; i += 1) {
    const proj = projectOnSegment(position, coordinates[i], coordinates[i + 1]);
    if (proj.dist < bestDist) {
      bestDist = proj.dist;
      bestSeg = i;
      bestT = proj.t;
      bestPoint = proj.point;
    }
  }

  // Si está muy desviado de la ruta, no recortes agresivo (espera recalcular).
  if (bestDist > 120) {
    const rest = coordinates.slice(Math.max(startAt, bestSeg));
    return {
      coordinates: rest.length >= 2 ? rest : coordinates.slice(-2),
      progressIndex: Math.max(minProgressIndex, bestSeg),
    };
  }

  const nextIndex = bestT > 0.92 ? bestSeg + 1 : bestSeg;
  const progressIndex = Math.max(minProgressIndex, nextIndex);
  const tail = coordinates.slice(progressIndex + (bestT > 0.92 ? 0 : 1));
  const remaining = [bestPoint, ...tail];
  if (remaining.length < 2) {
    return {
      coordinates: [bestPoint, coordinates[coordinates.length - 1]],
      progressIndex,
    };
  }
  return { coordinates: remaining, progressIndex };
}

/** ~250 m — menos redibujos de ruta mientras el repartidor se mueve. */
export function snapCoordinate(coord: MapCoordinate, gridMeters = 250): MapCoordinate {
  const latStep = gridMeters / 111_320;
  const cosLat = Math.max(Math.abs(Math.cos((coord.latitude * Math.PI) / 180)), 0.01);
  const lngStep = gridMeters / (111_320 * cosLat);
  return {
    latitude: Math.round(coord.latitude / latStep) * latStep,
    longitude: Math.round(coord.longitude / lngStep) * lngStep,
  };
}

function routeKey(
  from: MapCoordinate,
  to: MapCoordinate,
  dynamic = false,
): string {
  const origin = dynamic ? snapCoordinate(from) : from;
  const dest = dynamic ? snapCoordinate(to) : to;
  return [
    dynamic ? 'd' : 's',
    roundCoordinate(origin.latitude),
    roundCoordinate(origin.longitude),
    roundCoordinate(dest.latitude),
    roundCoordinate(dest.longitude),
  ].join(',');
}

export interface StreetRouteSegment {
  id: string;
  from: MapCoordinate | null;
  to: MapCoordinate | null;
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  /** true para segmentos con origen móvil (repartidor); reduce peticiones al API. */
  dynamic?: boolean;
}

export interface BuiltStreetRoutes {
  polylines: MapPolyline[];
  stats: Record<string, StreetRouteStats>;
}

export async function fetchStreetRoute(
  from: MapCoordinate,
  to: MapCoordinate,
  dynamic = false,
): Promise<CachedRoute> {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return {
      coordinates: [],
      distanceMeters: null,
      durationSeconds: null,
      isEstimated: true,
    };
  }

  const key = routeKey(from, to, dynamic);
  const cached = routeCache.get(key);
  if (cached) return cached;

  try {
    const { data } = await restaurantApi.route(from, to);
    const coords = sanitizeCoordinates(
      (data.coordinates ?? []).map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    );
    if (coords.length >= 2) {
      const result: CachedRoute = {
        coordinates: coords,
        distanceMeters: data.distance_meters ?? null,
        durationSeconds: data.duration_seconds ?? null,
        isEstimated: !!data.is_fallback,
      };
      routeCache.set(key, result);
      return result;
    }
  } catch {
    // fallback below — no cachear errores
  }

  return {
    coordinates: [from, to],
    distanceMeters: null,
    durationSeconds: null,
    isEstimated: true,
  };
}

export async function buildStreetRoutes(
  segments: StreetRouteSegment[],
): Promise<BuiltStreetRoutes> {
  const active = segments.filter((s) => s.from && s.to);
  const results = await Promise.all(
    active.map(async (segment) => {
      const route = await fetchStreetRoute(segment.from!, segment.to!, segment.dynamic);
      return { segment, route };
    }),
  );

  const polylines: MapPolyline[] = [];
  const stats: Record<string, StreetRouteStats> = {};

  for (const { segment, route } of results) {
    if (route.coordinates.length < 2) continue;
    polylines.push({
      id: segment.id,
      coordinates: route.coordinates,
      strokeColor: segment.strokeColor,
      strokeWidth: segment.strokeWidth,
      lineDashPattern: segment.lineDashPattern,
    });
    stats[segment.id] = {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      isEstimated: route.isEstimated,
    };
  }

  return { polylines, stats };
}
