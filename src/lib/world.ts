import type { HotspotId } from "@/data/hotspots";
import { STOPS } from "./terrain";

// The mountain itself (stops, trail, bridge) is laid out in src/lib/terrain.ts.
export { STOPS } from "./terrain";

/** Where each clickable stop sits (its centre). Used by the hover light. */
export const HOTSPOT_POS: Record<HotspotId, [number, number, number]> = Object.fromEntries(
  Object.entries(STOPS).map(([id, s]) => [id, [s.pos[0], s.pos[1] + 0.8, s.pos[2]]]),
) as Record<HotspotId, [number, number, number]>;

// ============================================
// SECTION 1: CAMERA CONFIGURATION
// Camera views: [position], [look-at target].
// ============================================
export type View = { pos: [number, number, number]; target: [number, number, number] };

export const VIEWS = {
  /** High above the clouds, where the intro starts. */
  start: { pos: [-6, 22, 34], target: [2, 6, -8] } as View,
  /** Hero, wide screens: the mountain on the right, empty left side for the text. */
  heroWide: { pos: [-11.5, 5.2, 15.5], target: [-4.4, 3.8, -4.5] } as View,
  /** Hero, narrow screens: further back and higher; text sits over the lower half. */
  heroNarrow: { pos: [0.5, 9.5, 27], target: [1.2, 6.2, -5] } as View,
  /** Explore mode: the whole trek, teahouse to summit. */
  explore: { pos: [-6, 9, 19], target: [1.2, 3.2, -4.5] } as View,
  /** Explore mode on narrow screens: further back. */
  exploreNarrow: { pos: [-3, 12, 28], target: [1.4, 4.2, -5] } as View,
  /** End of the scroll into Projects: climbs toward base camp. */
  scrollEnd: { pos: [9.8, 9.6, -3.4], target: [5.2, 7.5, -8.9] } as View,
};

/**
 * Camera angles the visitor can switch between in explore mode.
 * The first one is the default overview.
 */
export const ANGLES: Array<{ id: string; label: string; view: View }> = [
  { id: "overview", label: "Overview", view: VIEWS.explore },
  { id: "above", label: "Above", view: { pos: [1, 24, 4], target: [1.4, 3, -5] } },
  { id: "trail", label: "Trail", view: { pos: [-3.6, 2.6, 7.2], target: [1.6, 4.4, -6] } },
  { id: "side", label: "Side", view: { pos: [16, 6.5, -2], target: [1, 4, -6] } },
  { id: "summit", label: "Summit", view: { pos: [0.2, 12.2, -16.5], target: [0.5, 3, 0] } },
];

/** Close-up for each stop: camera in front of it, a little above. */
export const FOCUS_VIEWS: Record<HotspotId, View> = Object.fromEntries(
  Object.entries(STOPS).map(([id, s]) => {
    const [x, y, z] = s.pos;
    const back = s.radius * 2.4 + 2.2;
    const a = s.face;
    return [
      id,
      {
        pos: [x + Math.sin(a) * back - back * 0.2, y + (id === "contact" ? 2.1 : 1.7), z + Math.cos(a) * back * (id === "contact" ? 1.35 : 1)],
        // The summit's tall flagpole needs the camera aimed higher.
        target: [x, y + (id === "contact" ? 1.5 : 0.7), z],
      } as View,
    ];
  }),
) as Record<HotspotId, View>;

/** Point in the air where the intro burst happens: above the summit. */
export const BURST_POS: [number, number, number] = [
  STOPS.contact.pos[0],
  STOPS.contact.pos[1] + 2.4,
  STOPS.contact.pos[2],
];
