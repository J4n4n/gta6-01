// Solmar: a road-grid coastal city. Avenues run north-south, streets east-west;
// their crossings are the intersections traffic drives between. Blocks hold
// buildings (solid), a park, the docks, a beach and the water.
import { AVENUES, STREETS, WORLD_WIDTH, WORLD_HEIGHT, ROAD_HALF, COLORS, PLACES } from './config.js';

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createCity(rng) {
  const intersections = [];
  for (const x of AVENUES) {
    for (const y of STREETS) {
      intersections.push({ x, y });
    }
  }

  // One to three buildings per block, kept off the roads and off the named
  // places. Several tries per block, so most blocks end up built up.
  const buildings = [];
  const keepOut = [
    { x: 1400, y: 850, w: 800, h: 700 }, // park block
    { x: 0, y: 2220, w: WORLD_WIDTH, h: 180 }, // beach + water
    { x: 3300, y: 1200, w: 300, h: 600 }, // docks
    { x: 180, y: 1830, w: 300, h: 300 }, // Mara's garage yard
    { x: 1950, y: 30, w: 300, h: 300 }, // north lot
  ];
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + ROAD_HALF + 26;
      const y0 = STREETS[si] + ROAD_HALF + 26;
      const x1 = AVENUES[ai + 1] - ROAD_HALF - 26;
      const y1 = STREETS[si + 1] - ROAD_HALF - 26;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const want = rng.int(2, 3);
      let placed = 0;
      for (let n = 0; n < 9 && placed < want; n += 1) {
        const w = rng.range(80, Math.min(200, x1 - x0));
        const h = rng.range(70, Math.min(180, y1 - y0));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        let blocked = false;
        for (const k of keepOut) {
          if (rectsOverlap(x, y, w, h, k.x, k.y, k.w, k.h)) { blocked = true; break; }
        }
        if (blocked) continue;
        let clash = false;
        for (const b of buildings) {
          if (rectsOverlap(x - 14, y - 14, w + 28, h + 28, b.x, b.y, b.w, b.h)) { clash = true; break; }
        }
        if (clash) continue;
        buildings.push({ x, y, w, h, color: rng.pick(COLORS.buildingRoof), shade: rng.range(0.85, 1.1) });
        placed += 1;
      }
    }
  }

  // Palm trees for the park and the beach, and crates for the docks.
  const trees = [];
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: rng.range(1480, 2120), y: rng.range(980, 1380), r: rng.range(9, 14) });
  }
  for (let i = 0; i < 14; i += 1) {
    trees.push({ x: rng.range(120, 3480), y: rng.range(2240, 2310), r: rng.range(9, 14) });
  }
  const crates = [];
  for (let i = 0; i < 10; i += 1) {
    crates.push({ x: rng.range(3360, 3520), y: rng.range(1260, 1720), w: rng.range(34, 60), h: rng.range(34, 60) });
  }

  function onRoad(x, y) {
    for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_HALF) return true;
    return false;
  }

  // Push a circle out of a rectangle. When the centre is inside the rect the
  // nearest edge decides the direction, so a deep penetration still escapes.
  function pushOut(p, radius, r) {
    const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) return false;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * radius;
      p.y = cy + (dy / d) * radius;
      return true;
    }
    const left = p.x - r.x;
    const right = r.x + r.w - p.x;
    const top = p.y - r.y;
    const bottom = r.y + r.h - p.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) p.x = r.x - radius;
    else if (min === right) p.x = r.x + r.w + radius;
    else if (min === top) p.y = r.y - radius;
    else p.y = r.y + r.h + radius;
    return true;
  }

  // Push a circle out of every building it overlaps; returns true when it hit one.
  function collideCircle(p, radius) {
    let hit = false;
    for (const b of buildings) {
      if (pushOut(p, radius, b)) hit = true;
    }
    for (const c of crates) {
      if (pushOut(p, radius, c)) hit = true;
    }
    return hit;
  }

  function clampToWorld(p, margin) {
    p.x = Math.max(margin, Math.min(WORLD_WIDTH - margin, p.x));
    p.y = Math.max(margin, Math.min(WORLD_HEIGHT - margin, p.y));
  }

  // The axis of the road a point sits on ('ns' for an avenue, 'ew' for a
  // street), so parked cars can face along the road they stand on.
  function roadAxis(x, y) {
    let avenueDist = Infinity;
    for (const ax of AVENUES) avenueDist = Math.min(avenueDist, Math.abs(x - ax));
    let streetDist = Infinity;
    for (const sy of STREETS) streetDist = Math.min(streetDist, Math.abs(y - sy));
    return avenueDist <= streetDist ? 'ns' : 'ew';
  }

  // A random point on a road, for spawning traffic and parked cars.
  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(AVENUES) + rng.range(-34, 34), y: rng.range(60, WORLD_HEIGHT - 60) };
    }
    return { x: rng.range(60, WORLD_WIDTH - 60), y: rng.pick(STREETS) + rng.range(-34, 34) };
  }

  // The nearest intersection to a point (traffic steers between these).
  function nearestIntersection(x, y) {
    let best = intersections[0];
    let bestD = Infinity;
    for (const node of intersections) {
      const d = (node.x - x) * (node.x - x) + (node.y - y) * (node.y - y);
      if (d < bestD) { bestD = d; best = node; }
    }
    return best;
  }

  function neighbours(node) {
    const list = [];
    for (const other of intersections) {
      if (other === node) continue;
      if (other.x === node.x && Math.abs(other.y - node.y) <= 620) list.push(other);
      if (other.y === node.y && Math.abs(other.x - node.x) <= 620) list.push(other);
    }
    return list;
  }

  return {
    intersections, buildings, trees, crates,
    places: PLACES,
    onRoad, roadAxis, collideCircle, clampToWorld, randomRoadPoint, nearestIntersection, neighbours,
  };
}
