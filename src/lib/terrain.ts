import type { HotspotId } from "@/data/hotspots";

// ============================================
// SECTION 3: THE MOUNTAIN
// The trek, in metres:
//   x: left (-) to right (+)
//   y: down (-) to up (+)
//   z: far (-) toward the viewer (+)
// The trail starts at the teahouse in front and
// climbs, stop by stop, to the summit at the back.
//
// You choose where each stop is (x and z). Its
// height is read from the mountain, so every stop
// sits on the hill instead of on its own pillar.
// ============================================

export type StopSpec = {
  /** Centre of the flat ground the stop stands on. y is filled in from the hill. */
  pos: [number, number, number];
  /** Radius of that flat ground. */
  radius: number;
  /** Which way the stop faces (radians, 0 = toward the viewer). */
  face: number;
};

export const STOPS: Record<HotspotId, StopSpec> = {
  about: { pos: [-2.2, 0, 3.2], radius: 1.7, face: 0.35 },
  skills: { pos: [2.6, 0, 0.6], radius: 1.5, face: -0.3 },
  education: { pos: [-2.4, 0, -3.0], radius: 1.4, face: 0.5 },
  // The suspension bridge: its middle (see BRIDGE below).
  work: { pos: [1.15, 0, -5.9], radius: 1.1, face: -0.2 },
  projects: { pos: [5.4, 0, -8.6], radius: 1.6, face: -0.55 },
  contact: { pos: [2.6, 0, -13.2], radius: 0.9, face: 0.1 },
};

/** Order the trail visits the stops in. */
export const TRAIL_ORDER: HotspotId[] = ["about", "skills", "education", "work", "projects", "contact"];

/**
 * The suspension bridge on the Work stop spans a ravine that runs down the
 * hillside. Its two ends, in world x/z; heights are read from the hill.
 */
export const BRIDGE = {
  from: [-0.7, -5.2] as [number, number],
  to: [3.0, -6.6] as [number, number],
  fromY: 0,
  toY: 0,
  /** How deep the ravine is cut below the surrounding slope. */
  gorgeDepth: 1.7,
};

/** How far the bridge deck sags at its middle. */
export const DECK_SAG = 0.42;

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

// ---------- The mountain ----------

const SUMMIT: [number, number] = [STOPS.contact.pos[0], STOPS.contact.pos[2]];

/**
 * Height of the mountain every 2 m out from the summit, before ridges and
 * terraces are added. A smooth curve runs through these, so the slope rises
 * steadily from the valley to the peak instead of in steps.
 */
const PROFILE = [10.8, 9.6, 8.3, 7.1, 5.9, 4.8, 3.8, 2.9, 2.0, 1.1, 0.2, -0.8, -2.0, -3.4, -4.9, -6.2, -7.0, -7.5];
const PROFILE_STEP = 2;

function profileAt(d: number) {
  const n = PROFILE.length;
  const f = Math.max(0, d) / PROFILE_STEP;
  const i = Math.min(n - 2, Math.floor(f));
  const t = Math.min(1, f - i);
  // Catmull-Rom through four neighbours; at the summit, carry the slope on past
  // the top so the peak comes to a point rather than a dome.
  const p0 = i === 0 ? 2 * PROFILE[0] - PROFILE[1] : PROFILE[i - 1];
  const p1 = PROFILE[i], p2 = PROFILE[i + 1], p3 = PROFILE[Math.min(n - 1, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** 0 to 1: how much the farmers' terraces cover the hillside here. */
export function terraceAmount(x: number, z: number) {
  const d = Math.hypot(x - SUMMIT[0], z - SUMMIT[1]);
  const patchy = 0.55 + 0.45 * smooth(-0.25, 0.25, fbm(x * 0.09 + 3, z * 0.09 - 8, 2));
  // Leave the ground around each stop and the bridge ends as a clearing.
  let clear = 1;
  for (const id of TRAIL_ORDER) {
    const s = STOPS[id];
    clear = Math.min(clear, smooth(s.radius + 0.6, s.radius + 2.8, Math.hypot(x - s.pos[0], z - s.pos[2])));
  }
  for (const [bx, bz] of [BRIDGE.from, BRIDGE.to]) clear = Math.min(clear, smooth(1.5, 3.5, Math.hypot(x - bx, z - bz)));
  return smooth(9.5, 12.5, d) * (1 - smooth(21, 25, d)) * patchy * clear;
}

const TERRACE_STEP = 0.5;
/** Where along a terrace step the steep riser starts (0 to 1). */
export const TERRACE_RISER = 0.76;

/** Ground height before the terraces, trail, stops and ravine are added. */
function rawHeight(x: number, z: number) {
  const dx = x - SUMMIT[0], dz = z - SUMMIT[1];
  // Warp the distance a little so the mountain isn't a perfect cone.
  const warp = 1 + fbm(x * 0.06 + 5, z * 0.06 - 2, 2) * 0.16;
  const d = Math.hypot(dx, dz) * warp;
  let h = profileAt(d);

  // Spurs and gullies running down the flanks, like the ribs of a real mountain.
  const ang = Math.atan2(dz, dx);
  const spur = fbm(Math.cos(ang) * 2.3 + d * 0.03, Math.sin(ang) * 2.3 - d * 0.02, 3);
  h += spur * 2.0 * smooth(1.5, 9, d) * (1 - smooth(22, 32, d));
  // Soft, rolling bumps on top.
  h += fbm(x * 0.2, z * 0.2, 3) * 0.5 * smooth(2, 8, d);
  return h;
}

/** 0 to 1: how far up the current terrace step (x, z) is. Treads are below TERRACE_RISER. */
export function terraceFraction(x: number, z: number) {
  const q = rawHeight(x, z) / TERRACE_STEP;
  return q - Math.floor(q);
}

/** Ground height before the trail, stops and ravine are carved in. */
function baseHeight(x: number, z: number) {
  let h = rawHeight(x, z);

  // Terraced fields: the slope turns into wide steps with short steep risers.
  const tw = terraceAmount(x, z);
  if (tw > 0) {
    const q = h / TERRACE_STEP;
    const fl = Math.floor(q);
    const terr = (fl + smooth(TERRACE_RISER, 1, q - fl)) * TERRACE_STEP;
    h += (terr - h) * 0.9 * tw;
  }
  return h;
}

// Read each stop's height from the hill (averaged over its ground), and the
// bridge ends' heights from the slope they stand on.
function groundAverage(x: number, z: number, r: number) {
  let sum = baseHeight(x, z);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    sum += baseHeight(x + Math.cos(a) * r, z + Math.sin(a) * r);
  }
  return sum / 9;
}
for (const id of TRAIL_ORDER) {
  const s = STOPS[id];
  s.pos[1] = groundAverage(s.pos[0], s.pos[2], s.radius * 0.7);
}
BRIDGE.fromY = groundAverage(BRIDGE.from[0], BRIDGE.from[1], 0.5);
BRIDGE.toY = groundAverage(BRIDGE.to[0], BRIDGE.to[1], 0.5);
STOPS.work.pos[1] = (BRIDGE.fromY + BRIDGE.toY) / 2;

// ---------- The trail ----------

/** A point on the ground just in front of a stop, where the trail passes by. */
export function frontOf(id: HotspotId): [number, number, number] {
  const s = STOPS[id];
  const d = s.radius + 0.35;
  return [s.pos[0] + Math.sin(s.face) * d, s.pos[1], s.pos[2] + Math.cos(s.face) * d];
}

/** Catmull-Rom through the stops, sampled densely. Each point is [x, y, z]. */
function buildTrail() {
  // The Work stop is the bridge: the trail runs straight across it.
  const pts: Array<{ p: [number, number, number]; bend: boolean }> = [];
  for (const id of TRAIL_ORDER) {
    if (id === "work") {
      pts.push({ p: [BRIDGE.from[0], BRIDGE.fromY, BRIDGE.from[1]], bend: false });
      pts.push({ p: [BRIDGE.to[0], BRIDGE.toY, BRIDGE.to[1]], bend: true });
    } else pts.push({ p: frontOf(id), bend: true });
  }
  // Extra bends between stops so the path winds. Steeper sections swing wider:
  // switchbacks, like a real mountain trail.
  const ctrl: [number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    ctrl.push(pts[i].p);
    if (i < pts.length - 1 && pts[i].bend) {
      const [ax, ay, az] = pts[i].p, [bx, by, bz] = pts[i + 1].p;
      const side = i % 2 === 0 ? 1 : -1;
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      const off = 0.6 + 2.2 * (Math.abs(by - ay) / len);
      ctrl.push([(ax + bx) / 2 + (-dz / len) * off * side, (ay + by) / 2, (az + bz) / 2 + (dx / len) * off * side]);
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

// ---------- The ravine and the bridge ----------

/** Where (x, z) is relative to the bridge: along its length, and across it. */
function bridgeFrame(x: number, z: number) {
  const [ax, az] = BRIDGE.from, [bx, bz] = BRIDGE.to;
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  return {
    len,
    /** Metres from the bridge's middle, along the bridge. */
    along: (x - mx) * ux + (z - mz) * uz,
    /** Metres from the bridge's centre line, to either side (down or up the hill). */
    across: -(x - mx) * uz + (z - mz) * ux,
  };
}

/** How deep into the ravine under the bridge (x, z) is: 0 (not at all) to 1. */
function gorgeAmount(x: number, z: number) {
  const { len, along, across } = bridgeFrame(x, z);
  const half = len / 2;
  // A V-shaped cut as wide as the bridge is long, running a good way up and down the hill.
  const v = 1 - smooth(half * 0.35, half * 1.3, Math.abs(along));
  const l = 1 - smooth(3.5, 8.5, Math.abs(across));
  return v * l;
}

/**
 * If (x, z) is on the bridge, the deck's height there; otherwise null.
 * The deck runs from one end's height to the other's, sagging in between.
 */
export function bridgeDeckY(x: number, z: number): number | null {
  const { len, along, across } = bridgeFrame(x, z);
  const t = along / len + 0.5;
  if (t < 0.02 || t > 0.98 || Math.abs(across) > 0.5) return null;
  return BRIDGE.fromY + (BRIDGE.toY - BRIDGE.fromY) * t - DECK_SAG * 4 * t * (1 - t);
}

/** Trail samples that are up on the bridge: the ground under them is left alone. */
const ON_BRIDGE = TRAIL.map(([x, , z]) => {
  const { len, along, across } = bridgeFrame(x, z);
  const t = along / len + 0.5;
  return t > 0.06 && t < 0.94 && Math.abs(across) < 0.6;
});

// ---------- Height ----------

/** Final ground height at (x, z), including the ravine, the trail and the flat stops. */
export function terrainHeight(x: number, z: number) {
  let h = baseHeight(x, z);

  // The ravine under the bridge.
  h -= gorgeAmount(x, z) * BRIDGE.gorgeDepth;

  // Trail: ease the ground toward the path's height near it.
  let best = Infinity, bestY = 0;
  for (let i = 0; i < TRAIL.length; i += 2) {
    if (ON_BRIDGE[i]) continue;
    const p = TRAIL[i];
    const dd = (x - p[0]) ** 2 + (z - p[2]) ** 2;
    if (dd < best) {
      best = dd;
      bestY = p[1];
    }
  }
  const trailW = 1 - smooth(0.3, 1.3, Math.sqrt(best));
  h = h + (bestY - 0.02 - h) * trailW;

  // Stops: flat ground, blending back into the slope over a couple of metres.
  for (const id of TRAIL_ORDER) {
    if (id === "work") continue; // the bridge itself; its ends are below
    const s = STOPS[id];
    const dist = Math.hypot(x - s.pos[0], z - s.pos[2]);
    const w = 1 - smooth(s.radius + 0.2, s.radius + 2.4, dist);
    h = h + (s.pos[1] - 0.02 - h) * w;
  }

  // Small landings at both ends of the bridge.
  for (const [bx, bz, by] of [
    [BRIDGE.from[0], BRIDGE.from[1], BRIDGE.fromY],
    [BRIDGE.to[0], BRIDGE.to[1], BRIDGE.toY],
  ]) {
    const w = 1 - smooth(0.7, 2.0, Math.hypot(x - bx, z - bz));
    h = h + (by - 0.02 - h) * w;
  }

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
