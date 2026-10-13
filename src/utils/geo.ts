export type GeoPoint = {
  latitude: number;
  longitude: number;
};

type XY = { x: number; y: number };

const METERS_PER_DEGREE = 111_320;

function distanceToSegment(a: XY, b: XY): number {
  const distanceX = b.x - a.x;
  const distanceY = b.y - a.y;

  const lengthSquared =
    distanceX * distanceX + distanceY * distanceY;

  if (lengthSquared === 0) {
    return Math.hypot(a.x, a.y);
  }

  const segmentProgress = Math.max(
    0,
    Math.min(
      1,
      -(a.x * distanceX + a.y * distanceY) / lengthSquared,
    ),
  );

  const closestX = a.x + segmentProgress * distanceX;
  const closestY = a.y + segmentProgress * distanceY;

  return Math.hypot(closestX, closestY);
}

export function distanceToPathMeters(
    point: GeoPoint,
    path: GeoPoint[]
): number {

    const metersPerDegreelon = METERS_PER_DEGREE * Math.cos((point.latitude * Math.PI) / 180)

    const  xy = path.map((p) => ({
        x: (p.longitude - point.longitude) * metersPerDegreelon,
        y: (p.latitude - point.latitude) * METERS_PER_DEGREE
    }))

    const first = xy[0]

    if (first === undefined) return Infinity

    let best = Math.hypot(first.x, first.y)

    for (let i = 1; i < xy.length; i++) {
        const a = xy[i - 1]
        const b = xy[i]
        if (a === undefined || b === undefined) continue
        
        best = Math.min(best, distanceToSegment(a, b))
    }

    return best



}