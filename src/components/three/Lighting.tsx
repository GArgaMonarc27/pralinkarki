"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneStore } from "@/stores/useSceneStore";
import { INTRO, ease, windowProgress } from "@/lib/intro";
import { HOTSPOT_POS, ISLANDS } from "@/lib/world";
import { sceneLight } from "./sceneLight";
import { scrollState } from "@/lib/scroll";

// ============================================
// SECTION 2: LIGHTING SETTINGS
// Dusk over the islands: a low warm sun from the
// front-right, cool sky light from above, and a
// few coloured glows on the islands themselves.
// Every light is scaled by sceneLight.level (0
// while loading, 1 after the intro). To make the
// world brighter or darker, change `sun` and `sky`.
// ============================================
const LIGHTS = {
  ambient: { color: "#8f98c8", intensity: 0.35 },
  sky: { sky: "#aab8ff", ground: "#4a3326", intensity: 1.0 },
  sun: { color: "#ffc28a", intensity: 2.6, pos: [11, 9, 9] as [number, number, number] },
  rim: { color: "#7f9cff", intensity: 0.7, pos: [-10, 6, -8] as [number, number, number] },
  screens: { color: "#ff8a4f", intensity: 6, distance: 4 },
  crystals: { color: "#9db4ff", intensity: 5, distance: 3.5 },
  beacon: { color: "#ffb067", intensity: 5, distance: 3.5 },
  hover: { color: "#ff642e", intensity: 7, distance: 4 },
};

/** How dark the rest of the world gets while a panel is open (0–1). */
const FOCUS_DIM = 0.6;
/** How much it dims by the time the Projects section covers it. */
const SCROLL_DIM = 0.45;
/** Reflection strength from the environment (see Effects.tsx). */
const ENV_INTENSITY = 0.5;

const tmp = new THREE.Vector3();
const above = (id: keyof typeof ISLANDS, y: number): [number, number, number] => {
  const [x, py, z] = ISLANDS[id].pos;
  return [x, py + y, z + 0.4];
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
    screens: useRef<THREE.PointLight>(null),
    crystals: useRef<THREE.PointLight>(null),
    beacon: useRef<THREE.PointLight>(null),
    hover: useRef<THREE.PointLight>(null),
  };
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, -1.5);
    return o;
  }, []);

  useFrame(() => {
    const L = sceneLight.level;
    const A = sceneLight.ambient;
    const set = (r: React.RefObject<THREE.Light | null>, v: number) => {
      if (r.current) r.current.intensity = v;
    };
    // The sky is there before the intro lights everything up.
    set(refs.ambient, LIGHTS.ambient.intensity * (0.4 + 0.6 * L) * A);
    set(refs.sky, LIGHTS.sky.intensity * (0.3 + 0.7 * L) * A);
    set(refs.sun, LIGHTS.sun.intensity * L * A);
    set(refs.rim, LIGHTS.rim.intensity * (0.5 + 0.5 * L) * A);
    set(refs.screens, LIGHTS.screens.intensity * L);
    set(refs.crystals, LIGHTS.crystals.intensity * L);
    set(refs.beacon, LIGHTS.beacon.intensity * L);

    // Hover light glides to whichever island is under the cursor.
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
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight ref={refs.rim} color={LIGHTS.rim.color} position={LIGHTS.rim.pos} intensity={0} />

      {/* Glows on the islands */}
      <pointLight ref={refs.screens} color={LIGHTS.screens.color} position={above("projects", 1.4)} distance={LIGHTS.screens.distance} decay={2} intensity={0} />
      <pointLight ref={refs.crystals} color={LIGHTS.crystals.color} position={above("skills", 1.0)} distance={LIGHTS.crystals.distance} decay={2} intensity={0} />
      <pointLight ref={refs.beacon} color={LIGHTS.beacon.color} position={above("work", 1.9)} distance={LIGHTS.beacon.distance} decay={2} intensity={0} />

      {/* Hover highlight, always mounted so adding it never triggers a shader recompile */}
      <pointLight ref={refs.hover} color={LIGHTS.hover.color} distance={LIGHTS.hover.distance} decay={2} intensity={0} />
    </>
  );
}
