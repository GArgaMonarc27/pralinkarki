"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

// ============================================
// SECTION 2: LIGHTING SETTINGS (look)
// Reflections and screen effects.
// ============================================
const LOOK = {
  /** Ambient occlusion: darkens corners and where objects meet surfaces. */
  ao: { radius: 1.1, intensity: 1.8, falloff: 1.0 },
  /** Only things brighter than this glow (lamp bulbs, LED strips, screens). */
  bloom: { threshold: 0.8, intensity: 0.75, smoothing: 0.3 },
  vignette: { offset: 0.35, darkness: 0.4 },
};

/**
 * Reflections. Instead of downloading an HDR image, a tiny environment is
 * built from glowing panels: the warm setting sun, the cool sky above and
 * the dusky horizon all round, so glossy surfaces pick up the right colours.
 */
export function RoomReflections() {
  return (
    <Environment resolution={128} frames={1} background={false}>
      <Lightformer form="rect" color="#ffb47a" intensity={3} position={[14, 4, 10]} scale={[10, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" color="#7f93e8" intensity={1.2} position={[0, 18, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="ring" color="#a8513a" intensity={0.8} position={[0, 0, -20]} scale={[30, 6, 1]} />
    </Environment>
  );
}

/** Screen-space effects. Desktop / high quality only: they cost GPU time. */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO
        aoRadius={LOOK.ao.radius}
        intensity={LOOK.ao.intensity}
        distanceFalloff={LOOK.ao.falloff}
        quality="medium"
        halfRes
      />
      <Bloom
        mipmapBlur
        luminanceThreshold={LOOK.bloom.threshold}
        luminanceSmoothing={LOOK.bloom.smoothing}
        intensity={LOOK.bloom.intensity}
      />
      <Vignette offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
