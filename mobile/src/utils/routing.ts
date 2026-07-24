import type { MapPolyline } from '../components/AppMap';
import { restaurantApi } from '../services/api';
import type { MapCoordinate } from './maps';
import { isValidCoordinate, sanitizeCoordinates } from './maps';
import { roundCoordinate } from './coords';
import { decodePolyline } from './polyline';
import { Platform } from 'react-native';

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

const OSRM_CLIENT_URLS = [
  'https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving/{coords}?overview=full&geometries=geojson',
] as const;

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';

function isStreetGeometry(coords: MapCoordinate[]): boolean {
  return coords.length >= 3;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12000): Promise<unknown | null> {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const res = await fetch(url, {
      ...init,
      signal: controller?.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (timer) clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Ruta OSRM directa (útil cuando el backend en datacenter queda bloqueado). */
async function fetchOsrmClient(
  from: MapCoordinate,
  to: MapCoordinate,
): Promise<CachedRoute | null> {
  const coords = `${from.longitude.toFixed(6)},${from.latitude.toFixed(6)};${to.longitude.toFixed(6)},${to.latitude.toFixed(6)}`;
  for (const template of OSRM_CLIENT_URLS) {
    const url = template.replace('{coords}', coords);
    const data = (await fetchJson(url)) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    } | null;
    if (!data) continue;
    const route = data.routes?.[0];
    const raw = route?.geometry?.coordinates;
    if (!raw || raw.length < 3) continue;
    const coordinates = sanitizeCoordinates(
      raw.map(([longitude, latitude]) => ({ latitude, longitude })),
    );
    if (!isStreetGeometry(coordinates)) continue;
    return {
      coordinates,
      distanceMeters: typeof route?.distance === 'number' ? route.distance : null,
      durationSeconds: typeof route?.duration === 'number' ? route.duration : null,
      isEstimated: false,
    };
  }
  return null;
}

/** Valhalla (OSM.de) — buen respaldo con CORS abierto. */
async function fetchValhallaClient(
  from: MapCoordinate,
  to: MapCoordinate,
): Promise<CachedRoute | null> {
  const data = (await fetchJson(
    VALHALLA_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [
          { lat: from.latitude, lon: from.longitude },
          { lat: to.latitude, lon: to.longitude },
        ],
        costing: 'auto',
        directions_options: { units: 'kilometers' },
      }),
    },
  )) as {
    trip?: {
      summary?: { length?: number; time?: number };
      legs?: Array<{ shape?: string }>;
    };
  } | null;
  if (!data?.trip?.legs?.length) return null;

  const coordinates: MapCoordinate[] = [];
  for (const leg of data.trip.legs) {
    if (!leg.shape) continue;
    coordinates.push(...decodePolyline(leg.shape, 6));
  }
  const cleaned = sanitizeCoordinates(coordinates);
  if (!isStreetGeometry(cleaned)) return null;

  const lengthKm = data.trip.summary?.length;
  const timeSec = data.trip.summary?.time;
  return {
    coordinates: cleaned,
    distanceMeters: typeof lengthKm === 'number' ? lengthKm * 1000 : null,
    durationSeconds: typeof timeSec === 'number' ? timeSec : null,
    isEstimated: false,
  };
}

async function fetchClientStreetRoute(
  from: MapCoordinate,
  to: MapCoordinate,
): Promise<CachedRoute | null> {
  // En web prioriza proveedores públicos (Railway a veces no llega a OSRM).
  const order =
    Platform.OS === 'web'
      ? [fetchValhallaClient, fetchOsrmClient]
      : [fetchOsrmClient, fetchValhallaClient];

  for (const fn of order) {
    const route = await fn(from, to);
    if (route && isStreetGeometry(route.coordinates)) return route;
  }
  return null;
}

async function fetchBackendStreetRoute(
  from: MapCoordinate,
  to: MapCoordinate,
): Promise<CachedRoute | null> {
  try {
    const { data } = await restaurantApi.route(from, to);
    const coords = sanitizeCoordinates(
      (data.coordinates ?? []).map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    );
    if (isStreetGeometry(coords) && !data.is_fallback) {
      return {
        coordinates: coords,
        distanceMeters: data.distance_meters ?? null,
        durationSeconds: data.duration_seconds ?? null,
        isEstimated: false,
      };
    }
  } catch {
    // ignore
  }
  return null;
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
  if (cached && !cached.isEstimated && isStreetGeometry(cached.coordinates)) {
    return cached;
  }

  // Backend + cliente en paralelo; nos quedamos con la primera geometría de calles.
  const settled = await Promise.allSettled([
    fetchBackendStreetRoute(from, to),
    fetchClientStreetRoute(from, to),
  ]);

  for (const result of settled) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    if (!isStreetGeometry(result.value.coordinates)) continue;
    routeCache.set(key, result.value);
    return result.value;
  }

  // Último recurso: línea recta (no cachear).
  return {
    coordinates: [from, to],
    distanceMeters: Math.round(haversineMeters(from, to) * 1.3),
    durationSeconds: Math.max(60, Math.round((haversineMeters(from, to) * 1.3) / (25_000 / 3600))),
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
