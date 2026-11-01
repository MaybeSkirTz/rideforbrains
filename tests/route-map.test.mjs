import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientModules } from './client-modules.mjs';
const { mapRouteCoordinates } = await import(clientModules().routeGeometry);

test('The basemap receives the actual GPX route in geographic order without inventing or snapping points', () => {
  // Out-and-back with two identical points: both must survive unchanged.
  const gpx = [
    [-70.3921, 47.4482],
    [-70.3889, 47.4523],
    [-70.3889, 47.4523],
    [-70.3921, 47.4482],
  ];
  const unchanged = structuredClone(gpx);
  const route = mapRouteCoordinates(gpx);
  assert.deepEqual(route, [
    [47.4482, -70.3921],
    [47.4523, -70.3889],
    [47.4523, -70.3889],
    [47.4482, -70.3921],
  ]);
  assert.deepEqual(gpx, unchanged);
  // Its envelope must stay at the GPX location, including both endpoints.
  assert.deepEqual(
    [
      Math.min(...route.map((p) => p[0])),
      Math.max(...route.map((p) => p[0])),
      Math.min(...route.map((p) => p[1])),
      Math.max(...route.map((p) => p[1])),
    ],
    [47.4482, 47.4523, -70.3921, -70.3889],
  );
});

test('Missing or invalid GPX coordinates never display an unrelated default route', () => {
  for (const gpx of [
    undefined,
    null,
    [],
    [[-70, 47]],
    [
      [-70, 47],
      [NaN, 48],
    ],
    [
      [-70, 47],
      [181, 48],
    ],
    [
      [-70, 47],
      [-70, 91],
    ],
    [[-70, 47], null],
  ])
    assert.deepEqual(mapRouteCoordinates(gpx), []);
  assert.deepEqual(
    mapRouteCoordinates([
      [0, 0],
      [0, 0],
    ]),
    [
      [0, 0],
      [0, 0],
    ],
  );
});
