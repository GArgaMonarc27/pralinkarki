import type { HotspotId } from "@/data/hotspots";

// ============================================
// SECTION 3: THE ISLANDS
// Layout of the floating world, in metres.
//   x: left (-) to right (+)
//   y: down (-) to up (+)
//   z: far (-) toward the viewer (+)
// The hub island (About) sits at the origin; the
// others float around it at different heights.
// ============================================

export type IslandSpec = {
  /** Centre of the island's grassy top. */
  pos: [number, number, number];
  /** Radius of the top. */
  radius: number;
  /** How far the rocky underside hangs down. */
  depth: number;
  /** Changes the rock shape; any whole number. */
  seed: number;
};

export const ISLANDS: Record<HotspotId, IslandSpec> = {
  about: { pos: [0, 0, 0], radius: 2.3, depth: 3.2, seed: 1 },
  projects: { pos: [5.4, 0.9, -2.4], radius: 1.55, depth: 2.4, seed: 2 },
  skills: { pos: [-4.9, 1.3, -3.2], radius: 1.3, depth: 2.1, seed: 3 },
  education: { pos: [-5.6, -0.9, 1.6], radius: 1.05, depth: 1.8, seed: 4 },
  work: { pos: [1.6, 2.1, -6.6], radius: 1.1, depth: 1.9, seed: 5 },
  contact: { pos: [5.0, -1.2, 2.6], radius: 1.0, depth: 1.7, seed: 6 },
};

/** Small decorative rocks drifting between the islands. */
export const DEBRIS: Array<{ pos: [number, number, number]; size: number; seed: number }> = [
  { pos: [-2.6, 2.6, -4.5], size: 0.35, seed: 11 },
  { pos: [3.1, -2.3, -0.8], size: 0.28, seed: 12 },
  { pos: [-3.3, -2.0, 3.8], size: 0.22, seed: 13 },
  { pos: [7.4, 2.6, -5.2], size: 0.4, seed: 14 },
  { pos: [-7.6, 3.0, -1.0], size: 0.3, seed: 15 },
  { pos: [2.2, 3.6, 1.6], size: 0.18, seed: 16 },
  { pos: [-1.4, -3.4, -2.6], size: 0.3, seed: 17 },
  { pos: [6.8, -0.4, 5.6], size: 0.2, seed: 18 },
];

/** Where each clickable object sits (its centre). Used by the hover light. */
export const HOTSPOT_POS: Record<HotspotId, [number, number, number]> = Object.fromEntries(
  Object.entries(ISLANDS).map(([id, s]) => [id, [s.pos[0], s.pos[1] + 0.8, s.pos[2]]]),
) as Record<HotspotId, [number, number, number]>;

// ============================================
// SECTION 1: CAMERA CONFIGURATION
// Camera views: [position], [look-at target].
// ============================================
export type View = { pos: [number, number, number]; target: [number, number, number] };

export const VIEWS = {
  /** High and far away, where the intro starts. */
  start: { pos: [-4, 14, 30], target: [0.5, 0, -1] } as View,
  /** Hero, wide screens: islands on the right, empty left side for the text. */
  heroWide: { pos: [-9.6, 3.4, 12.6], target: [-3.4, 0.9, -1.6] } as View,
  /** Hero, narrow screens: further back and higher; text sits over the lower half. */
  heroNarrow: { pos: [0.6, 7.6, 23], target: [0.2, 2.6, -1.4] } as View,
  /** Explore mode: the whole archipelago. */
  explore: { pos: [-1.2, 5.2, 13.5], target: [0, 0.2, -1.6] } as View,
  /** Explore mode on narrow screens: further back. */
  exploreNarrow: { pos: [-0.6, 8.4, 24], target: [0, 0.2, -1.6] } as View,
  /** End of the scroll into Projects: glides toward the projects island. */
  scrollEnd: { pos: [3.0, 2.4, 2.6], target: [5.4, 1.4, -2.4] } as View,
};

/**
 * Camera angles the visitor can switch between in explore mode.
 * The first one is the default overview.
 */
export const ANGLES: Array<{ id: string; label: string; view: View }> = [
  { id: "overview", label: "Overview", view: VIEWS.explore },
  { id: "above", label: "Above", view: { pos: [0.4, 15, 5.5], target: [0, 0, -1.4] } },
  { id: "below", label: "Below", view: { pos: [-2.5, -5.5, 10.5], target: [0, 0.4, -1.5] } },
  { id: "side", label: "Side", view: { pos: [-13, 2.6, 1.5], target: [0.5, 0.4, -1.5] } },
  { id: "behind", label: "Behind", view: { pos: [3.5, 4.0, -15], target: [0, 0.4, -1] } },
];

/** Close-up for each island: camera in front of it, a little above. */
export const FOCUS_VIEWS: Record<HotspotId, View> = Object.fromEntries(
  Object.entries(ISLANDS).map(([id, s]) => {
    const [x, y, z] = s.pos;
    const back = s.radius * 2.7 + 1.6;
    return [id, { pos: [x - back * 0.25, y + 1.6, z + back], target: [x, y + 0.7, z] } as View];
  }),
) as Record<HotspotId, View>;

/** Point in the air where the intro burst happens: above the hub island. */
export const BURST_POS: [number, number, number] = [0, 2.2, 0];
