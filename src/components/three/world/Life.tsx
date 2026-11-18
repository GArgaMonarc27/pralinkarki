"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HOMES, POND, STREAM, bridgeDeckY, terrainHeight, trailPoint, type Home } from "@/lib/terrain";
import { sceneLight } from "../sceneLight";

// ============================================
// SECTION 2: LIFE ON THE MOUNTAIN
// Things that make the hill feel lived in:
//   - a stream and waterfall down the ravine, ending in a pond
//   - a village of farmhouses among the terraced fields
//   - a yak caravan walking the trail with its herder
// Everything is built in code: no model downloads.
// ============================================

type V3 = [number, number, number];

const C = {
  rock: "#6f6b6e",
  wood: "#6b4a32",
  woodDark: "#4a3222",
  glow: "#ffb067",
  smoke: "#cfcbd8",
};

/** Warm light (windows): one shared material that fades in with the intro. */
function useGlow(color: string = C.glow, min = 0.25) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0 }), [color]);
  useFrame(() => {
    mat.opacity = min + (1 - min) * sceneLight.level;
  });
  return mat;
}

// ---------- The stream, waterfall and pond ----------

const WATER_NOISE = /* glsl */ `
  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const STREAM_VERTEX = /* glsl */ `
  attribute float aSlope;
  attribute float aFlow;
  varying vec2 vUv;
  varying float vSlope;
  varying float vFlow;
  void main() {
    vUv = uv;
    vSlope = aSlope;
    vFlow = aFlow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Water flowing down the stream: streaks that run downstream, faster and whiter
 * where the ground is steep (the cascade), with bright foam along the banks.
 */
const STREAM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  varying vec2 vUv;
  varying float vSlope;
  varying float vFlow;
  ${WATER_NOISE}
  void main() {
    float speed = 0.7 + vSlope * 3.2;
    float s1 = vn(vec2(vUv.x * 7.0, vFlow * 4.0 - uTime * speed));
    float s2 = vn(vec2(vUv.x * 13.0 + 3.0, vFlow * 8.0 - uTime * speed * 1.7));
    float streak = smoothstep(0.5, 0.92, s1 * 0.6 + s2 * 0.5);
    float steep = smoothstep(0.4, 1.0, vSlope);
    float foam = clamp(streak * (0.3 + vSlope * 1.3) + steep * 0.45, 0.0, 1.0);
    float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    float rim = (1.0 - edge) * 0.5;
    vec3 deep = vec3(0.03, 0.15, 0.24);
    vec3 shallow = vec3(0.10, 0.36, 0.52);
    vec3 col = mix(deep, shallow, 0.3 + 0.5 * s1);
    col = mix(col, vec3(1.0), clamp(foam + rim, 0.0, 1.0));
    col *= 0.6 + 0.4 * uLevel;
    gl_FragColor = vec4(col, edge * 0.94);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const POND_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  varying vec2 vUv;
  ${WATER_NOISE}
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float edge = smoothstep(1.0, 0.84, d);
    float n = vn(vUv * 9.0 + uTime * 0.08);
    float ripple = sin(d * 24.0 - uTime * 1.7) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.03, 0.14, 0.22), vec3(0.10, 0.32, 0.46), 0.35 + 0.4 * n);
    col = mix(col, vec3(0.30, 0.16, 0.22), 0.16);      // the dusk sky, reflected
    col += ripple * 0.025 * (1.0 - d);
    col = mix(col, vec3(1.0), smoothstep(0.7, 0.95, d) * 0.4 + smoothstep(0.35, 0.0, d) * 0.15 * ripple);
    col *= 0.6 + 0.4 * uLevel;
    gl_FragColor = vec4(col, edge * 0.95);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const POND_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A ribbon of water draped along the stream, with each point's steepness for the shader. */
function useStreamGeometry() {
  return useMemo(() => {
    const n = STREAM.length;
    const pos = new Float32Array(n * 6);
    const uv = new Float32Array(n * 4);
    const slope = new Float32Array(n * 2);
    const flow = new Float32Array(n * 2);
    let dist = 0;
    let steepest = 0, steepestAt = 0;
    for (let i = 0; i < n; i++) {
      const p = STREAM[i], before = STREAM[Math.max(0, i - 1)], after = STREAM[Math.min(n - 1, i + 1)];
      const tx = after.x - before.x, tz = after.z - before.z;
      const run = Math.hypot(tx, tz) || 1;
      const lx = -tz / run, lz = tx / run;
      if (i > 0) dist += Math.hypot(p.x - before.x, p.z - before.z);
      const sl = Math.abs(after.y - before.y) / run;
      if (sl > steepest) (steepest = sl), (steepestAt = i);
      pos.set([p.x + (lx * p.w) / 2, p.y, p.z + (lz * p.w) / 2, p.x - (lx * p.w) / 2, p.y, p.z - (lz * p.w) / 2], i * 6);
      uv.set([0, 0, 1, 0], i * 4);
      slope[i * 2] = slope[i * 2 + 1] = sl;
      flow[i * 2] = flow[i * 2 + 1] = dist;
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aSlope", new THREE.BufferAttribute(slope, 1));
    g.setAttribute("aFlow", new THREE.BufferAttribute(flow, 1));
    g.setIndex(idx);
    return { geometry: g, steepestAt };
  }, []);
}

/** A soft round blob (white fading to nothing), for spray. */
function useSoftTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
}

/** Soft puffs of spray that rise from where the water lands, then fade. */
function Mist({ at, count, spread, height, still, seed }: { at: V3; count: number; spread: number; height: number; still: boolean; seed: number }) {
  const ref = useRef<THREE.Group>(null);
  const soft = useSoftTexture();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((m, i) => {
      const k = still ? (i + 0.5) / count : (clock.elapsedTime * 0.2 + i / count) % 1;
      m.position.set(Math.sin(i * 2.4 + seed) * spread * (0.3 + k), k * height, Math.cos(i * 1.7 + seed) * spread * (0.3 + k));
      m.scale.setScalar(0.3 + k * 0.7);
      ((m as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.38 * sceneLight.level;
    });
  });
  return (
    <group ref={ref} position={at}>
      {Array.from({ length: count }, (_, i) => (
        <sprite key={i}>
          <spriteMaterial map={soft} color="#e8f0f8" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** The stream and waterfall under the bridge, running down into a pond. */
export function Stream({ still }: { still: boolean }) {
  const { geometry, steepestAt } = useStreamGeometry();
  const streamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
        vertexShader: STREAM_VERTEX,
        fragmentShader: STREAM_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const pondMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uLevel: { value: 0 } },
        vertexShader: POND_VERTEX,
        fragmentShader: POND_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    for (const m of [streamMat, pondMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uLevel.value = sceneLight.level;
    }
  });
  const foot = STREAM[Math.min(STREAM.length - 1, steepestAt + 10)];
  return (
    <>
      <mesh geometry={geometry} material={streamMat} renderOrder={2} frustumCulled={false} />
      <mesh position={[POND.x, POND.y, POND.z]} rotation-x={-Math.PI / 2} material={pondMat} renderOrder={2}>
        <circleGeometry args={[POND.r, 40]} />
      </mesh>
      <Mist at={[foot.x, foot.y + 0.05, foot.z]} count={6} spread={0.25} height={0.8} still={still} seed={1} />
      <Mist at={[POND.x, POND.y + 0.02, POND.z]} count={7} spread={0.45} height={0.7} still={still} seed={4} />
    </>
  );
}

// ---------- The village ----------

type HouseStyle = { wall: string; base: string; roof: string; trim: string };

/** Three kinds of hill house: ochre with a tin roof, whitewashed, and mustard yellow. */
const HOUSES: HouseStyle[] = [
  { wall: "#caa46c", base: "#a4553a", roof: "#8e3b2c", trim: "#4a3222" },
  { wall: "#efe6d2", base: "#b9ad99", roof: "#3f6275", trim: "#2f6fa3" },
  { wall: "#d8b86a", base: "#8a6a4b", roof: "#6b6b72", trim: "#7a2430" },
];

function Smoke({ at, still }: { at: V3; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((m, i) => {
      const k = still ? i / 4 : (clock.elapsedTime * 0.25 + i / 4) % 1;
      m.position.set(Math.sin(k * 5 + i) * 0.05 + k * 0.18, k * 0.9, 0);
      m.scale.setScalar(0.035 + k * 0.1);
      ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - k) * sceneLight.level;
    });
  });
  return (
    <group ref={ref} position={at}>
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={C.smoke} transparent opacity={0} depthWrite={false} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** One farmhouse: stone footing, painted walls, hipped roof, lit windows, drying corn and chillies. */
function House({ home, glow, still }: { home: Home; glow: THREE.MeshBasicMaterial; still: boolean }) {
  const st = HOUSES[home.kind % HOUSES.length];
  const chimney = home.kind !== 1;
  return (
    <group position={home.pos} rotation-y={home.rot}>
      {/* Stone footing, sunk into the slope so the house never floats */}
      <mesh position-y={-0.2} receiveShadow>
        <boxGeometry args={[0.98, 0.5, 0.74]} />
        <meshStandardMaterial color={C.rock} roughness={1} flatShading />
      </mesh>
      {/* Walls: a darker painted band below, then the main colour */}
      <mesh position-y={0.07} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.14, 0.68]} />
        <meshStandardMaterial color={st.base} roughness={0.95} flatShading />
      </mesh>
      <mesh position-y={0.29} castShadow receiveShadow>
        <boxGeometry args={[0.88, 0.3, 0.64]} />
        <meshStandardMaterial color={st.wall} roughness={0.95} flatShading />
      </mesh>
      {/* Hipped roof */}
      <mesh position-y={0.62} rotation-y={Math.PI / 4} scale={[1, 1, 0.74]} castShadow>
        <coneGeometry args={[0.78, 0.34, 4]} />
        <meshStandardMaterial color={st.roof} roughness={0.8} flatShading />
      </mesh>
      {/* Door and two lit windows on the front */}
      <mesh position={[0, 0.2, 0.327]}>
        <boxGeometry args={[0.13, 0.24, 0.025]} />
        <meshStandardMaterial color={st.trim} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <group key={x} position={[x, 0.33, 0.325]}>
          <mesh>
            <boxGeometry args={[0.15, 0.15, 0.02]} />
            <meshStandardMaterial color={st.trim} />
          </mesh>
          <mesh position-z={0.012}>
            <planeGeometry args={[0.1, 0.1]} />
            <primitive object={glow} attach="material" />
          </mesh>
        </group>
      ))}
      {/* Corn and chillies hung out to dry under the eaves */}
      <mesh position={[-0.1, 0.45, 0.345]}>
        <boxGeometry args={[0.42, 0.07, 0.03]} />
        <meshStandardMaterial color="#e2b53c" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.27, 0.45, 0.345]}>
        <boxGeometry args={[0.2, 0.06, 0.03]} />
        <meshStandardMaterial color="#c8302c" roughness={0.9} flatShading />
      </mesh>
      {/* A mat of chillies drying in the yard */}
      <mesh position={[0.05, 0.012, 0.52]} rotation-y={0.15} receiveShadow>
        <boxGeometry args={[0.46, 0.012, 0.2]} />
        <meshStandardMaterial color={home.kind === 2 ? "#e2b53c" : "#c8302c"} roughness={1} flatShading />
      </mesh>
      {chimney && (
        <>
          <mesh position={[0.28, 0.68, -0.12]} castShadow>
            <boxGeometry args={[0.1, 0.22, 0.1]} />
            <meshStandardMaterial color={C.rock} roughness={1} flatShading />
          </mesh>
          <Smoke at={[0.28, 0.82, -0.12]} still={still} />
        </>
      )}
    </group>
  );
}

/** Farmhouses among the terraced fields. */
export function Village({ still }: { still: boolean }) {
  const glow = useGlow();
  return (
    <>
      {HOMES.map((h, i) => (
        <House key={i} home={h} glow={glow} still={still} />
      ))}
    </>
  );
}

// ---------- The yak caravan ----------

const CARAVAN = {
  /** The caravan walks from the teahouse up to base camp, rests, and walks back. */
  from: 0.02,
  to: 0.84,
  /** Seconds to walk one way, and to rest at each end. */
  walk: 82,
  rest: 6,
  /** Seconds between one animal and the next. */
  gap: 2.7,
  /** How far to one side of the path each direction keeps to (up on one side, down on the other). */
  lane: 0.25,
};

const YAK_COATS = ["#2b2321", "#3b2d27", "#1f1b1b", "#4a382e"];
const BLANKETS: Array<[string, string]> = [
  ["#c0392b", "#e8c33a"],
  ["#2f6fd6", "#f2efe6"],
  ["#e8782a", "#2f9a55"],
  ["#7a2430", "#d9a441"],
];

/** Where a walker is on the trail at a given time: how far along, which way, and whether moving. */
function caravanAt(time: number) {
  const { from, to, walk, rest } = CARAVAN;
  const total = 2 * (walk + rest);
  const u = ((time % total) + total) % total;
  if (u < walk) return { t: from + ((to - from) * u) / walk, dir: 1, moving: true };
  if (u < walk + rest) return { t: to, dir: -1, moving: false };
  if (u < 2 * walk + rest) return { t: to - ((to - from) * (u - walk - rest)) / walk, dir: -1, moving: true };
  return { t: from, dir: 1, moving: false };
}

/** A shared bit of state a walker's body reads, set each frame by the caravan. */
type WalkState = { moving: boolean };

function Leg({ legRef, pivot, length, width, color }: { legRef: React.RefObject<THREE.Group | null>; pivot: V3; length: number; width: number; color: string }) {
  return (
    <group ref={legRef} position={pivot}>
      <mesh position-y={-length / 2} castShadow>
        <boxGeometry args={[width, length, width]} />
        <meshStandardMaterial color={color} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -length + 0.01, 0.006]}>
        <boxGeometry args={[width * 1.15, 0.022, width * 1.4]} />
        <meshStandardMaterial color="#1a1515" roughness={1} />
      </mesh>
    </group>
  );
}

/** A yak: a shaggy dark coat down to its knees, a hump, curved horns, a bell, a striped blanket and two sacks. */
function Yak({ coat, blanket, state, seed }: { coat: string; blanket: [string, string]; state: WalkState; seed: number }) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const swing = state.moving ? Math.sin(t * 4.2 + seed) * 0.42 : 0;
    // Diagonal pairs move together: front-left with back-right.
    if (legs[0].current) legs[0].current.rotation.x = swing;
    if (legs[3].current) legs[3].current.rotation.x = swing;
    if (legs[1].current) legs[1].current.rotation.x = -swing;
    if (legs[2].current) legs[2].current.rotation.x = -swing;
    if (body.current) body.current.position.y = state.moving ? Math.abs(Math.cos(t * 4.2 + seed)) * 0.008 : 0;
    // The head bobs a little as it walks, and nods down to graze when it rests.
    if (head.current) head.current.rotation.x = state.moving ? Math.sin(t * 4.2 + seed) * 0.05 : 0.25 + Math.sin(t * 1.3 + seed) * 0.12;
  });
  const dark = "#1a1514";
  return (
    <group>
      <Leg legRef={legs[0]} pivot={[-0.065, 0.15, 0.14]} length={0.15} width={0.045} color={dark} />
      <Leg legRef={legs[1]} pivot={[0.065, 0.15, 0.14]} length={0.15} width={0.045} color={dark} />
      <Leg legRef={legs[2]} pivot={[-0.065, 0.15, -0.14]} length={0.15} width={0.045} color={dark} />
      <Leg legRef={legs[3]} pivot={[0.065, 0.15, -0.14]} length={0.15} width={0.045} color={dark} />
      <group ref={body}>
        {/* Torso, hump, and the long hair hanging like a skirt */}
        <mesh position={[0, 0.23, 0]} castShadow>
          <boxGeometry args={[0.2, 0.16, 0.4]} />
          <meshStandardMaterial color={coat} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.335, 0.09]} castShadow>
          <boxGeometry args={[0.15, 0.07, 0.14]} />
          <meshStandardMaterial color={coat} roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 0.14, -0.005]} castShadow>
          <boxGeometry args={[0.25, 0.13, 0.34]} />
          <meshStandardMaterial color={coat} roughness={1} flatShading />
        </mesh>
        {/* Striped blanket and two sacks */}
        <mesh position={[0, 0.315, -0.04]} castShadow>
          <boxGeometry args={[0.23, 0.018, 0.2]} />
          <meshStandardMaterial color={blanket[0]} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.326, -0.04]}>
          <boxGeometry args={[0.234, 0.006, 0.05]} />
          <meshStandardMaterial color={blanket[1]} roughness={0.9} />
        </mesh>
        {[-0.135, 0.135].map((x) => (
          <mesh key={x} position={[x, 0.27, -0.04]} castShadow>
            <boxGeometry args={[0.07, 0.1, 0.13]} />
            <meshStandardMaterial color={x < 0 ? "#d8c8a4" : "#b8844a"} roughness={1} flatShading />
          </mesh>
        ))}
        <mesh position={[0, 0.2, -0.23]} rotation-x={0.35}>
          <boxGeometry args={[0.035, 0.12, 0.035]} />
          <meshStandardMaterial color={coat} roughness={1} flatShading />
        </mesh>
        {/* Neck and head, carried low */}
        <group ref={head} position={[0, 0.24, 0.2]}>
          <mesh position={[0, -0.01, 0.06]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color={coat} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, -0.04, 0.16]} rotation-x={0.3} castShadow>
            <boxGeometry args={[0.1, 0.1, 0.14]} />
            <meshStandardMaterial color={coat} roughness={1} flatShading />
          </mesh>
          <mesh position={[0, -0.075, 0.235]}>
            <boxGeometry args={[0.07, 0.06, 0.05]} />
            <meshStandardMaterial color="#5a4a44" roughness={1} flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.07, 0.04, 0.13]} rotation-z={-s * 1.05} castShadow>
                <coneGeometry args={[0.014, 0.1, 5]} />
                <meshStandardMaterial color="#efe4cc" roughness={0.7} />
              </mesh>
              <mesh position={[s * 0.065, 0.0, 0.09]}>
                <boxGeometry args={[0.03, 0.045, 0.02]} />
                <meshStandardMaterial color={coat} roughness={1} flatShading />
              </mesh>
            </group>
          ))}
          {/* The bell */}
          <mesh position={[0, -0.09, 0.0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#d9a441" metalness={0.7} roughness={0.35} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** The yak herder: a topi (Nepali cap), warm jacket, red scarf, and a walking stick. */
function Herder({ state, seed }: { state: WalkState; seed: number }) {
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const swing = state.moving ? Math.sin(t * 4.2 + seed) * 0.5 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.3 - 0.35;
    if (body.current) body.current.position.y = state.moving ? Math.abs(Math.cos(t * 4.2 + seed)) * 0.01 : 0;
  });
  const jacket = "#9a5a2c", trousers = "#3a4a5a", skin = "#b9825c";
  return (
    <group>
      <Leg legRef={legL} pivot={[-0.032, 0.2, 0]} length={0.2} width={0.045} color={trousers} />
      <Leg legRef={legR} pivot={[0.032, 0.2, 0]} length={0.2} width={0.045} color={trousers} />
      <group ref={body}>
        <group position-y={0.2}>
          <mesh position-y={0.085} castShadow>
            <boxGeometry args={[0.13, 0.17, 0.08]} />
            <meshStandardMaterial color={jacket} roughness={0.85} flatShading />
          </mesh>
          <mesh position-y={0.18} castShadow>
            <boxGeometry args={[0.1, 0.03, 0.09]} />
            <meshStandardMaterial color="#c0392b" roughness={0.9} flatShading />
          </mesh>
          <mesh position-y={0.225} castShadow>
            <sphereGeometry args={[0.044, 10, 8]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
          {/* The topi: a Nepali cap with a white band */}
          <mesh position-y={0.262} castShadow>
            <cylinderGeometry args={[0.046, 0.05, 0.05, 8]} />
            <meshStandardMaterial color="#8a4a82" roughness={0.9} />
          </mesh>
          <mesh position-y={0.246}>
            <cylinderGeometry args={[0.0505, 0.0505, 0.012, 8]} />
            <meshStandardMaterial color="#efe6d2" roughness={0.9} />
          </mesh>
          <group ref={armL} position={[-0.082, 0.16, 0]}>
            <mesh position-y={-0.07} castShadow>
              <boxGeometry args={[0.035, 0.14, 0.035]} />
              <meshStandardMaterial color={jacket} roughness={0.85} flatShading />
            </mesh>
          </group>
          <group ref={armR} position={[0.082, 0.16, 0]}>
            <mesh position-y={-0.07} castShadow>
              <boxGeometry args={[0.035, 0.14, 0.035]} />
              <meshStandardMaterial color={jacket} roughness={0.85} flatShading />
            </mesh>
            {/* Walking stick */}
            <mesh position={[0, -0.14, 0.03]} rotation-x={0.12}>
              <cylinderGeometry args={[0.007, 0.007, 0.36, 4]} />
              <meshStandardMaterial color={C.wood} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

type Member = { kind: "yak" | "herder"; coat: string; blanket: [string, string] };

const CARAVAN_MEMBERS: Member[] = [
  ...[0, 1, 2, 3].map((i): Member => ({ kind: "yak", coat: YAK_COATS[i], blanket: BLANKETS[i] })),
  { kind: "herder", coat: "", blanket: BLANKETS[0] },
];

/**
 * A caravan of four yaks and their herder, walking from the teahouse up to base
 * camp and back, one behind another. Each direction keeps to its own side of the
 * path, so they pass the way people do on a narrow trail. Each animal pitches to
 * follow the slope and crosses the suspension bridge along its deck.
 */
export function Yaks({ still }: { still: boolean }) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const states = useMemo(() => CARAVAN_MEMBERS.map((): WalkState => ({ moving: false })), []);
  const motion = useRef(CARAVAN_MEMBERS.map(() => ({ yaw: 0, lane: 0, ready: false })));
  const p = useMemo<V3>(() => [0, 0, 0], []);
  const q = useMemo<V3>(() => [0, 0, 0], []);

  useFrame(({ clock }) => {
    const time = still ? 24 : clock.elapsedTime + 30;
    CARAVAN_MEMBERS.forEach((_, i) => {
      const g = groups.current[i];
      if (!g) return;
      const m = motion.current[i];
      const { t, dir, moving } = caravanAt(time - i * CARAVAN.gap);
      states[i].moving = moving && !still;

      trailPoint(Math.min(0.995, Math.max(0.005, t)), p);
      trailPoint(Math.min(0.995, Math.max(0.005, t) + 0.004), q);
      const tx = q[0] - p[0], tz = q[2] - p[2];
      const run = Math.hypot(tx, tz) || 1;
      // Up on one side of the path, down on the other.
      const laneTarget = dir > 0 ? CARAVAN.lane : -CARAVAN.lane;
      m.lane = m.ready ? m.lane + (laneTarget - m.lane) * 0.04 : laneTarget;
      const x = p[0] + (-tz / run) * m.lane, z = p[2] + (tx / run) * m.lane;

      // Face the way they are heading (or about to head), turning smoothly.
      const want = Math.atan2(tx * dir, tz * dir);
      if (!m.ready) m.yaw = want;
      let diff = want - m.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      m.yaw += diff * 0.05;
      m.ready = true;

      const ground = (gx: number, gz: number) => bridgeDeckY(gx, gz) ?? terrainHeight(gx, gz);
      const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      const y = ground(x, z);
      // Lean along the slope, front end against back end.
      const pitch = Math.atan2(ground(x + fx * 0.22, z + fz * 0.22) - ground(x - fx * 0.22, z - fz * 0.22), 0.44);
      g.rotation.order = "YXZ";
      g.rotation.set(-pitch * 0.9, m.yaw, 0);
      g.position.set(x, y, z);
    });
  });

  return (
    <>
      {CARAVAN_MEMBERS.map((m, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          {m.kind === "yak" ? <Yak coat={m.coat} blanket={m.blanket} state={states[i]} seed={i * 1.7} /> : <Herder state={states[i]} seed={i * 1.7} />}
        </group>
      ))}
    </>
  );
}
