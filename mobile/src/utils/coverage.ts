/** Mismos límites que backend/restaurants/geo.py */
export const ZINAPECUARO_BOUNDS = {
  minLat: 19.81,
  maxLat: 19.91,
  minLon: -100.88,
  maxLon: -100.78,
};

export function isInCoverage(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= ZINAPECUARO_BOUNDS.minLat
    && latitude <= ZINAPECUARO_BOUNDS.maxLat
    && longitude >= ZINAPECUARO_BOUNDS.minLon
    && longitude <= ZINAPECUARO_BOUNDS.maxLon
  );
}
