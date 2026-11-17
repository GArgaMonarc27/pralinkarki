"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sceneLight } from "./sceneLight";

// ============================================
// SECTION 2: SKY
// A dusk gradient dome with alpenglow on the
// horizon, stars, distance haze that turns the
// far peaks blue, and light snow drifting down.
// ============================================
const SKY = {
  top: "#060818",
  middle: "#1c1f4a",
  horizon: "#c0604a",
  below: "#141632",
  fog: "#2a2c58",
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
      v.normalize().multiplyScalar(130);
      arr.set([v.x, v.y, v.z], i * 3);
    }
    return arr;
  }, []);

  // Snowflakes in a box around the trek; they fall and wrap back to the top.
  const SNOW = { x: [-14, 16], y: [-3, 15], z: [-20, 10] } as const;
  const flyPositions = useMemo(() => {
    const n = particleCount * 2;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = SNOW.x[0] + Math.random() * (SNOW.x[1] - SNOW.x[0]);
      arr[i * 3 + 1] = SNOW.y[0] + Math.random() * (SNOW.y[1] - SNOW.y[0]);
      arr[i * 3 + 2] = SNOW.z[0] + Math.random() * (SNOW.z[1] - SNOW.z[0]);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particleCount]);

  useFrame(({ clock }, delta) => {
    const L = sceneLight.level;
    if (skyMat.current) skyMat.current.uniforms.level.value = L;
    if (stars.current) stars.current.opacity = 0.35 + 0.5 * L;
    if (fliesMat.current) fliesMat.current.opacity = 0.8 * L;
    if (!flies.current || reducedMotion) return;
    const attr = flies.current.geometry.attributes.position as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const fall = Math.min(delta, 0.1) * 0.45;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += Math.sin(t * 0.6 + i) * fall * 0.6;
      a[i + 1] -= fall * (0.7 + (i % 7) * 0.08);
      if (a[i + 1] < SNOW.y[0]) a[i + 1] = SNOW.y[1];
    }
    attr.needsUpdate = true;
  });

  return (
    <>
      <color attach="background" args={[SKY.below]} />
      <fog attach="fog" args={[SKY.fog, 28, 110]} />

      <mesh scale={150} renderOrder={-1}>
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
        <pointsMaterial ref={stars} size={0.4} color="#dfe4ff" transparent opacity={0.4} depthWrite={false} fog={false} />
      </points>

      <points ref={flies}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[flyPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={fliesMat}
          size={0.05}
          color="#f4f1ff"
          transparent
          opacity={0}
          depthWrite={false}
                    sizeAttenuation
        />
      </points>
    </>
  );
}
