import type { HotspotId } from "@/data/hotspots";

// ============================================
// SECTION 3: THE MOUNTAIN
// The trek, in metres:
//   x: left (-) to right (+)
//   y: down (-) to up (+)
//   z: far (-) toward the viewer (+)
// The trail starts at the teahouse in front and
// climbs, stop by stop, to the summit at the back.
// Change a stop's x/z to move it; its y is the
// height of the flat ground the terrain is carved
// to around it.
// ============================================

export type StopSpec = {
  /** Centre of the flat ground the stop stands on. */
  pos: [number, number, number];
  /** Radius of that flat ground. */
  radius: number;
  /** Which way the stop faces (radians, 0 = toward the viewer). */
  face: number;
};

export const STOPS: Record<HotspotId, StopSpec> = {
  about: { pos: [-2.2, 0, 3.2], radius: 1.7, face: 0.35 },
  skills: { pos: [2.6, 1.3, 0.6], radius: 1.5, face: -0.3 },
  education: { pos: [-2.4, 2.7, -3.0], radius: 1.4, face: 0.5 },
  // The suspension bridge: pos is its middle (see BRIDGE below).
  work: { pos: [1.3, 4.0, -5.5], radius: 1.1, face: -0.2 },
  projects: { pos: [5.4, 5.6, -8.6], radius: 1.6, face: -0.55 },
  contact: { pos: [2.6, 9.4, -13.2], radius: 0.9, face: 0.1 },
};

/** Order the trail visits the stops in. */
export const TRAIL_ORDER: HotspotId[] = ["about", "skills", "education", "work", "projects", "contact"];


/**
 * The suspension bridge on the Work stop spans a gorge. Its two ends, in
 * world x/z; the terrain between them is cut away.
 */
export const BRIDGE = {
  from: [-0.6, -4.6] as [number, number],
  to: [3.2, -6.4] as [number, number],
  height: 4.0,
  gorgeDepth: 5.5,
};

// ---------- Noise ----------

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x: number, y: number, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/** Sharp ridges: 1 on a crest, falling away either side. */
export function ridged(x: number, y: number, octaves = 4) {
  let sum = 0, amp = 0.55, f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * f, y * f));
    sum += amp * n * n;
    f *= 2.1;
    amp *= 0.5;
  }
  return sum;
}

export const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- The trail ----------

/** Catmull-Rom through the stops, sampled densely. Each point is [x, y, z]. */
function buildTrail() {
  // The Work stop is the bridge: the trail runs straight across it.
  const pts: Array<{ p: [number, number, number]; bend: boolean }> = [];
  for (const id of TRAIL_ORDER) {
    if (id === "work") {
      pts.push({ p: [BRIDGE.from[0], BRIDGE.height, BRIDGE.from[1]], bend: false });
      pts.push({ p: [BRIDGE.to[0], BRIDGE.height, BRIDGE.to[1]], bend: true });
    } else pts.push({ p: STOPS[id].pos, bend: true });
  }
  // Extra bends between stops so the path winds instead of running straight.
  const ctrl: [number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    ctrl.push(pts[i].p);
    if (i < pts.length - 1 && pts[i].bend) {
      const [ax, ay, az] = pts[i].p, [bx, by, bz] = pts[i + 1].p;
      const side = i % 2 === 0 ? 1 : -1;
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      ctrl.push([(ax + bx) / 2 + (-dz / len) * 1.1 * side, (ay + by) / 2, (az + bz) / 2 + (dx / len) * 1.1 * side]);
    }
  }
  const out: [number, number, number][] = [];
  const P = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  const STEPS = 28;
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t;
      const c = (k: number) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([c(0), c(1), c(2)]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

export const TRAIL = buildTrail();

/** How deep into the gorge under the bridge (x, z) is: 0 (not at all) to 1. */
function gorgeAmount(x: number, z: number) {
  const [ax, az] = BRIDGE.from, [bx, bz] = BRIDGE.to;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  // Distance from the bridge's middle, along it and across it.
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const along = Math.abs(((x - mx) * dx + (z - mz) * dz) / len);
  const across = Math.abs(((x - mx) * -dz + (z - mz) * dx) / len);
  const half = len / 2;
  return (1 - smooth(half * 0.55, half * 0.9, along)) * (1 - smooth(4.5, 8, across));
}

// ---------- Height ----------

const SUMMIT = STOPS.contact.pos;

/** Ground height before the trail and stops are carved in. */
function baseHeight(x: number, z: number) {
  // The main peak, with ridges running down from it.
  const dx = x - SUMMIT[0], dz = z - SUMMIT[2];
  const d = Math.hypot(dx, dz);
  const massif = 11 * Math.exp(-Math.pow(d / 11, 1.6));
  const ridges = ridged(x * 0.16 + 3.1, z * 0.16 - 1.7) * 2.2 * Math.exp(-d / 12);
  // Valley floor, sinking toward the edges (into the clouds).
  const valley = -3.2 + fbm(x * 0.12, z * 0.12) * 1.4;
  return Math.max(valley, valley + massif + ridges - 1.2) + fbm(x * 0.5, z * 0.5, 3) * 0.35;
}

/** Final ground height at (x, z), including the flat stops, the trail and the gorge. */
export function terrainHeight(x: number, z: number) {
  let h = baseHeight(x, z);

  // Trail: ease the ground toward the path's height near it.
  let best = Infinity, bestY = 0;
  for (let i = 0; i < TRAIL.length; i += 2) {
    const p = TRAIL[i];
    const dd = (x - p[0]) ** 2 + (z - p[2]) ** 2;
    if (dd < best) {
      best = dd;
      bestY = p[1];
    }
  }
  const trailW = 1 - smooth(0.35, 1.6, Math.sqrt(best));
  h = h + (bestY - 0.02 - h) * trailW;

  // Stops: flat ground, blending out over a couple of metres.
  for (const id of TRAIL_ORDER) {
    if (id === "work") continue; // the bridge itself; its ends are below
    const s = STOPS[id];
    const dist = Math.hypot(x - s.pos[0], z - s.pos[2]);
    const w = 1 - smooth(s.radius, s.radius + 1.8, dist);
    h = h + (s.pos[1] - 0.02 - h) * w;
  }

  // Small landings at both ends of the bridge.
  for (const [bx, bz] of [BRIDGE.from, BRIDGE.to]) {
    const w = 1 - smooth(0.7, 1.8, Math.hypot(x - bx, z - bz));
    h = h + (BRIDGE.height - 0.02 - h) * w;
  }

  // The gorge under the bridge.
  const g = gorgeAmount(x, z);
  if (g > 0) h -= g * BRIDGE.gorgeDepth;

  return h;
}

/** Point on the trail at t (0 = teahouse, 1 = summit), just above the ground. */
export function trailPoint(t: number, out: [number, number, number] = [0, 0, 0]) {
  const f = Math.min(0.9999, Math.max(0, t)) * (TRAIL.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = TRAIL[i], b = TRAIL[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
  return out;
}
