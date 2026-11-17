"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneLight } from "./sceneLight";

// ============================================
// SECTION 2: SKY
// A dusk gradient dome, stars, distance fog that
// matches the horizon, and warm fireflies drifting
// between the islands.
// ============================================
const SKY = {
  top: "#060818",
  middle: "#1a1d44",
  horizon: "#a8513a",
  below: "#0c0e22",
  fog: "#191c3d",
};

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 top; uniform vec3 middle; uniform vec3 horizon; uniform vec3 below;
  uniform float level;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 c = mix(horizon, middle, smoothstep(-0.02, 0.28, h));
    c = mix(c, top, smoothstep(0.28, 0.85, h));
    c = mix(c, below, smoothstep(-0.02, -0.35, h));
    // A warmer glow on the side the sun sets.
    float sunSide = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(0.8, 0.0, 0.6))));
    c += horizon * 0.35 * pow(sunSide, 6.0) * (1.0 - smoothstep(0.0, 0.35, abs(h)));
    gl_FragColor = vec4(c * (0.55 + 0.45 * level), 1.0);
  }
`;

type Props = { particleCount: number; reducedMotion: boolean };

export function Environment({ particleCount, reducedMotion }: Props) {
  const skyMat = useRef<THREE.ShaderMaterial>(null);
  const stars = useRef<THREE.PointsMaterial>(null);
  const flies = useRef<THREE.Points>(null);
  const fliesMat = useRef<THREE.PointsMaterial>(null);

  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color(SKY.top) },
      middle: { value: new THREE.Color(SKY.middle) },
      horizon: { value: new THREE.Color(SKY.horizon) },
      below: { value: new THREE.Color(SKY.below) },
      level: { value: 0 },
    }),
    [],
  );

  // Stars on the upper part of a big sphere.
  const starPositions = useMemo(() => {
    const n = 900;
    const arr = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(70);
      arr.set([v.x, v.y, v.z], i * 3);
    }
    return arr;
  }, []);

  // Fireflies in the space around the islands.
  const flyPositions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = -3 + Math.random() * 8;
      arr[i * 3 + 2] = -9 + Math.random() * 14;
    }
    return arr;
  }, [particleCount]);

  useFrame(({ clock }, delta) => {
    const L = sceneLight.level;
    if (skyMat.current) skyMat.current.uniforms.level.value = L;
    if (stars.current) stars.current.opacity = 0.35 + 0.5 * L;
    if (fliesMat.current) fliesMat.current.opacity = 0.75 * L;
    if (!flies.current || reducedMotion) return;
    flies.current.rotation.y += delta * 0.012;
    flies.current.position.y = Math.sin(clock.elapsedTime * 0.3) * 0.25;
  });

  return (
    <>
      <color attach="background" args={[SKY.below]} />
      <fog attach="fog" args={[SKY.fog, 20, 62]} />

      <mesh scale={90} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          ref={skyMat}
          uniforms={uniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={stars} size={0.22} color="#dfe4ff" transparent opacity={0.4} depthWrite={false} fog={false} />
      </points>

      <points ref={flies}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flyPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={fliesMat}
          size={0.06}
          color="#ffb47a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </>
  );
}
