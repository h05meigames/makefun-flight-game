// The world: an island chain the course flies over, built once from a fixed
// seed. Two runways (home strip at the south end, far strip at the north),
// twelve golden rings threading the route, three beacons, drifting clouds and
// a mountain ridge on the far horizon. Everything the physics and the
// renderer ask about the ground goes through groundHeightAt / terrainAt.

import { COURSE_LENGTH, WORLD_SEED } from './config.js';
import { createRandom, hash2 } from './random.js';

const HOME_RUNWAY = { x: 0, z0: 0, z1: 520, heading: 0, name: 'MERIDIAN 09', number: '09' };
const FAR_RUNWAY = { x: 0, z0: 9520, z1: 10040, heading: 0, name: 'NORTH ISLE 27', number: '27' };
const RUNWAY_HALF_WIDTH = 14;

export function createWorld(seed = WORLD_SEED) {
  const random = createRandom(seed);

  // Islands: z-interval, lateral centre and half-width, height, kind.
  // The home and far islands carry the runways; the rest are scenery the
  // pilot threads between, with hills, fields and forest.
  const islands = [
    { z0: -600, z1: 1100, cx: 0, half: 420, height: 14, kind: 'home' },
    { z0: 1500, z1: 2600, cx: -260, half: 300, height: 34, kind: 'hill' },
    { z0: 2100, z1: 3300, cx: 300, half: 260, height: 22, kind: 'fields' },
    { z0: 3600, z1: 4700, cx: 120, half: 340, height: 46, kind: 'forest' },
    { z0: 4300, z1: 5600, cx: -320, half: 280, height: 26, kind: 'fields' },
    { z0: 5900, z1: 7000, cx: -80, half: 360, height: 64, kind: 'mountain' },
    { z0: 6600, z1: 7800, cx: 330, half: 240, height: 30, kind: 'hill' },
    { z0: 8000, z1: 8800, cx: -240, half: 260, height: 20, kind: 'fields' },
    { z0: 9100, z1: 10600, cx: 0, half: 430, height: 16, kind: 'home' },
  ];

  // Rings thread the course: a gentle slalom that climbs over the mountain
  // island, so throttle and turn discipline both pay.
  const ringStops = [
    [0, 120, 1300], [-90, 150, 2100], [110, 190, 2900], [-40, 230, 3700],
    [140, 260, 4500], [-120, 300, 5300], [60, 340, 6100], [-60, 380, 6900],
    [120, 330, 7700], [-100, 280, 8400], [40, 220, 9000], [0, 160, 9400],
  ];
  const rings = ringStops.map(([x, y, z], index) => ({ id: index + 1, x, y, z, passed: false }));

  const beacons = [
    { id: 1, name: 'HARBOUR', x: -260, y: 70, z: 3000, visited: false },
    { id: 2, name: 'LIGHTHOUSE', x: 300, y: 90, z: 6100, visited: false },
    { id: 3, name: 'MOUNTAIN PASS', x: 0, y: 330, z: 8400, visited: false },
  ];

  // Clouds drift slowly and wrap around the course.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: (random() - 0.5) * 1600,
      y: 420 + random() * 320,
      z: random() * COURSE_LENGTH,
      size: 90 + random() * 190,
      speed: 2 + random() * 4,
    });
  }

  // A far ridge of peaks drawn on the horizon, fixed bearings.
  const ridge = [];
  for (let i = 0; i < 22; i += 1) {
    ridge.push({ bearing: -1.1 + i * 0.1 + (random() - 0.5) * 0.05, height: 60 + random() * 130 });
  }

  function islandAt(x, z) {
    for (const island of islands) {
      if (z >= island.z0 && z <= island.z1 && Math.abs(x - island.cx) <= island.half) {
        return island;
      }
    }
    return null;
  }

  function onRunway(x, z) {
    for (const runway of [HOME_RUNWAY, FAR_RUNWAY]) {
      if (z >= runway.z0 && z <= runway.z1 && Math.abs(x - runway.x) <= RUNWAY_HALF_WIDTH) {
        return runway;
      }
    }
    return null;
  }

  return {
    islands,
    rings,
    beacons,
    clouds,
    ridge,
    homeRunway: HOME_RUNWAY,
    farRunway: FAR_RUNWAY,
    runwayHalfWidth: RUNWAY_HALF_WIDTH,

    /** Height of the ground (or sea, 0) at a world point, in metres. */
    groundHeightAt(x, z) {
      if (onRunway(x, z)) return 2;
      const island = islandAt(x, z);
      if (!island) return 0;
      // Soft edge: the ground falls away to the sea near the shoreline.
      const edge = Math.min(
        (x - (island.cx - island.half)) / 60,
        ((island.cx + island.half) - x) / 60,
        (z - island.z0) / 60,
        (island.z1 - z) / 60,
      );
      const falloff = Math.max(0, Math.min(1, edge));
      const bump = 1 + 0.35 * Math.sin(x * 0.05 + z * 0.021) * Math.sin(z * 0.037);
      return island.height * falloff * bump;
    },

    /** 'runway' | 'land' | 'beach' | 'sea' — what the ground is here. */
    terrainAt(x, z) {
      if (onRunway(x, z)) return 'runway';
      const island = islandAt(x, z);
      if (!island) return 'sea';
      const edge = Math.min(
        Math.abs(x - (island.cx - island.half)),
        Math.abs((island.cx + island.half) - x),
        z - island.z0,
        island.z1 - z,
      );
      if (edge < 26) return 'beach';
      return 'land';
    },

    /** Which island kind the ground belongs to ('sea' when over water). */
    islandKindAt(x, z) {
      const island = islandAt(x, z);
      return island ? island.kind : 'sea';
    },

    /** Field-patch variation for farmland, in [0, 1). */
    patchAt(x, z) {
      return hash2(Math.floor(x / 120), Math.floor(z / 120));
    },

    reset() {
      for (const ring of rings) ring.passed = false;
      for (const beacon of beacons) beacon.visited = false;
    },
  };
}
