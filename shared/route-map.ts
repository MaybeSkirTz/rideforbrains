export type RouteCoordinate = [number, number];

// Published GPX coordinates use [longitude, latitude]; Leaflet uses the reverse.
// Preserve every published point and its order: this is not a routing service.
export function mapRouteCoordinates(coordinates: unknown): RouteCoordinate[] {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
  if (
    coordinates.some(
      (p) =>
        !Array.isArray(p) ||
        p.length < 2 ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90,
    )
  )
    return [];
  return coordinates.map(([lng, lat]) => [lat, lng]);
}
