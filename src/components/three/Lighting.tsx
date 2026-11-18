"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneStore } from "@/stores/useSceneStore";
import { INTRO, ease, windowProgress } from "@/lib/intro";
import { HOTSPOT_POS, STOPS } from "@/lib/world";
import { sceneLight } from "./sceneLight";
import { scrollState } from "@/lib/scroll";

// ============================================
// SECTION 2: LIGHTING SETTINGS
// Dusk in the Himalaya: a low warm sun from the
// front-right (alpenglow on the snow), cool sky
// light from above, and a few warm glows at the
// stops along the trail.
// Every light is scaled by sceneLight.level (0
// while loading, 1 after the intro). To make the
// world brighter or darker, change `sun` and `sky`.
// ============================================
const LIGHTS = {
  ambient: { color: "#9aa3cf", intensity: 0.5 },
  sky: { sky: "#b4c0ff", ground: "#5a4333", intensity: 1.25 },
  sun: { color: "#ffc28a", intensity: 2.6, pos: [11, 9, 9] as [number, number, number] },
  rim: { color: "#7f9cff", intensity: 0.7, pos: [-10, 6, -8] as [number, number, number] },
  /** Campfire at base camp (flickers). */
  camp: { color: "#ff8a4f", intensity: 6, distance: 4 },
  /** Butter lamps at the stupa. */
  lamps: { color: "#ffc070", intensity: 3.5, distance: 3 },
  /** The signal beacon on the summit. */
  beacon: { color: "#ff7a45", intensity: 6, distance: 4.5 },
  hover: { color: "#ff642e", intensity: 7, distance: 4 },
};

/** How dark the rest of the world gets while a panel is open (0–1). */
const FOCUS_DIM = 0.6;
/** How much it dims by the time the Projects section covers it. */
const SCROLL_DIM = 0.45;
/** Reflection strength from the environment (see Effects.tsx). */
const ENV_INTENSITY = 0.5;

const tmp = new THREE.Vector3();
const above = (id: keyof typeof STOPS, y: number, dx = 0, dz = 0.4): [number, number, number] => {
  const [x, py, z] = STOPS[id].pos;
  return [x + dx, py + y, z + dz];
};

type Props = { reducedMotion: boolean };

/** Updates the shared light levels once per frame. Mount before other scene parts. */
export function LightDriver({ reducedMotion }: Props) {
  useFrame(({ scene }) => {
    const { introStart, phase, focus } = useSceneStore.getState();
    if (phase === "loading" || introStart === null) sceneLight.level = 0;
    else if (reducedMotion || phase === "done") sceneLight.level = 1;
    else {
      const t = (performance.now() - introStart) / 1000;
      sceneLight.level = ease.outCubic(windowProgress(t, INTRO.roomLights.start, INTRO.roomLights.end));
    }
    const target = focus ? FOCUS_DIM : 1 - SCROLL_DIM * scrollState.progress;
    sceneLight.ambient += (target - sceneLight.ambient) * (reducedMotion ? 1 : 0.06);
    scene.environmentIntensity = ENV_INTENSITY * sceneLight.level * sceneLight.ambient;
  });
  return null;
}

type LightingProps = { quality: "high" | "low" };

export function Lighting({ quality }: LightingProps) {
  const refs = {
    ambient: useRef<THREE.AmbientLight>(null),
    sky: useRef<THREE.HemisphereLight>(null),
    sun: useRef<THREE.DirectionalLight>(null),
    rim: useRef<THREE.DirectionalLight>(null),
    camp: useRef<THREE.PointLight>(null),
    lamps: useRef<THREE.PointLight>(null),
    beacon: useRef<THREE.PointLight>(null),
    hover: useRef<THREE.PointLight>(null),
  };
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(1.5, 3, -5);
    return o;
  }, []);

  useFrame(({ clock }) => {
    const L = sceneLight.level;
    const t = clock.elapsedTime;
    const flicker = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
    const A = sceneLight.ambient;
    const set = (r: React.RefObject<THREE.Light | null>, v: number) => {
      if (r.current) r.current.intensity = v;
    };
    // The sky is there before the intro lights everything up.
    set(refs.ambient, LIGHTS.ambient.intensity * (0.4 + 0.6 * L) * A);
    set(refs.sky, LIGHTS.sky.intensity * (0.3 + 0.7 * L) * A);
    set(refs.sun, LIGHTS.sun.intensity * L * A);
    set(refs.rim, LIGHTS.rim.intensity * (0.5 + 0.5 * L) * A);
    set(refs.camp, LIGHTS.camp.intensity * L * flicker);
    set(refs.lamps, LIGHTS.lamps.intensity * L);
    set(refs.beacon, LIGHTS.beacon.intensity * L * (0.75 + Math.sin(t * 2.4) * 0.25));

    // Hover light glides to whichever stop is under the cursor.
    const { hovered, focus } = useSceneStore.getState();
    const hover = refs.hover.current;
    if (hover) {
      const target = hovered && hovered !== focus ? LIGHTS.hover.intensity : 0;
      hover.intensity += (target - hover.intensity) * 0.15;
      if (hovered) {
        const [x, y, z] = HOTSPOT_POS[hovered];
        hover.position.lerp(tmp.set(x - 0.6, y + 1.0, z + 1.2), 0.25);
      }
    }
  });

  const high = quality === "high";

  return (
    <>
      <ambientLight ref={refs.ambient} color={LIGHTS.ambient.color} intensity={0} />
      <hemisphereLight ref={refs.sky} args={[LIGHTS.sky.sky, LIGHTS.sky.ground, 0]} />

      <primitive object={sunTarget} />
      <directionalLight
        ref={refs.sun}
        color={LIGHTS.sun.color}
        position={LIGHTS.sun.pos}
        target={sunTarget}
        intensity={0}
        castShadow={high}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      <directionalLight ref={refs.rim} color={LIGHTS.rim.color} position={LIGHTS.rim.pos} intensity={0} />

      {/* Warm glows along the trail */}
      <pointLight ref={refs.camp} color={LIGHTS.camp.color} position={above("projects", 0.5, 0.6, 0.8)} distance={LIGHTS.camp.distance} decay={2} intensity={0} />
      <pointLight ref={refs.lamps} color={LIGHTS.lamps.color} position={above("skills", 0.5, 0, 1.0)} distance={LIGHTS.lamps.distance} decay={2} intensity={0} />
      <pointLight ref={refs.beacon} color={LIGHTS.beacon.color} position={above("contact", 1.7, 0, 0)} distance={LIGHTS.beacon.distance} decay={2} intensity={0} />

      {/* Hover highlight, always mounted so adding it never triggers a shader recompile */}
      <pointLight ref={refs.hover} color={LIGHTS.hover.color} distance={LIGHTS.hover.distance} decay={2} intensity={0} />
    </>
  );
}
