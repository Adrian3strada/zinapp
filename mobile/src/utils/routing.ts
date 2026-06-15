import type { MapPolyline } from '../components/AppMap';
import { restaurantApi } from '../services/api';
import type { MapCoordinate } from './maps';
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

/** ~150 m — agrupa recálculos cuando el repartidor se mueve poco. */
export function snapCoordinate(coord: MapCoordinate, gridMeters = 150): MapCoordinate {
  const latStep = gridMeters / 111_320;
  const lngStep = gridMeters / (111_320 * Math.cos((coord.latitude * Math.PI) / 180));
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
  const key = routeKey(from, to, dynamic);
  const cached = routeCache.get(key);
  if (cached) return cached;

  try {
    const { data } = await restaurantApi.route(from, to);
    const coords = (data.coordinates ?? []).map((c) => ({
      latitude: c.latitude,
      longitude: c.longitude,
    }));
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
