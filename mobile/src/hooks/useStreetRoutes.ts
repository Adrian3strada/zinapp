import { useEffect, useMemo, useState } from 'react';

import type { MapPolyline } from '../components/AppMap';
import {
  buildStreetRoutes,
  snapCoordinate,
  type BuiltStreetRoutes,
  type StreetRouteSegment,
  type StreetRouteStats,
} from '../utils/routing';
import type { MapCoordinate } from '../utils/maps';
import { roundCoordinate } from '../utils/coords';

function segmentSignature(segment: StreetRouteSegment): string {
  if (!segment.from || !segment.to) return `${segment.id}:empty`;
  const from = segment.dynamic ? snapCoordinate(segment.from) : segment.from;
  const to = segment.dynamic ? snapCoordinate(segment.to) : segment.to;
  return [
    segment.id,
    segment.dynamic ? 'd' : 's',
    roundCoordinate(from.latitude),
    roundCoordinate(from.longitude),
    roundCoordinate(to.latitude),
    roundCoordinate(to.longitude),
    segment.strokeColor ?? '',
    segment.strokeWidth ?? '',
    segment.lineDashPattern?.join('-') ?? '',
  ].join('|');
}

const EMPTY_ROUTES: BuiltStreetRoutes = { polylines: [], stats: {} };

export function useStreetRoutes(segments: StreetRouteSegment[]) {
  const [result, setResult] = useState<BuiltStreetRoutes>(EMPTY_ROUTES);
  const [loading, setLoading] = useState(false);

  const signature = useMemo(
    () => segments.map(segmentSignature).join(';;'),
    [segments],
  );

  const hasActiveSegments = segments.some((s) => s.from && s.to);

  useEffect(() => {
    let cancelled = false;
    const active = segments.filter((s) => s.from && s.to);

    if (active.length === 0) {
      setResult(EMPTY_ROUTES);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    buildStreetRoutes(active)
      .then((built) => {
        if (!cancelled) {
          setResult(built);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signature]);

  return { ...result, loading: loading && hasActiveSegments };
}

export function useStreetRoute(
  from: MapCoordinate | null,
  to: MapCoordinate | null,
  style?: Omit<StreetRouteSegment, 'id' | 'from' | 'to'>,
) {
  const segments = useMemo(() => {
    if (!from || !to) return [];
    return [{ id: 'route', from, to, ...style }];
  }, [
    from?.latitude,
    from?.longitude,
    to?.latitude,
    to?.longitude,
    style?.strokeColor,
    style?.strokeWidth,
    style?.lineDashPattern?.join('-'),
  ]);

  const { polylines, stats, loading } = useStreetRoutes(segments);
  const routeStats: StreetRouteStats | null = stats.route ?? null;
  return { polylines, stats: routeStats, loading };
}
