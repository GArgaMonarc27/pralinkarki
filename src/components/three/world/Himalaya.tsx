"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { profile } from "@/data/profile";
import { BRIDGE, STOPS, TRAIL, fbm, ridged, smooth, terrainHeight, trailPoint } from "@/lib/terrain";
import { HoverOutline, Interactive } from "./Interactive";
import { sceneLight } from "../sceneLight";
import type { HotspotId } from "@/data/hotspots";

// ============================================
// SECTION 2: MOUNTAIN COLOURS AND MATERIALS
// Everything is built in code: no model downloads.
// ============================================
const C = {
  valley: "#3d5240",
  grass: "#56784a",
  meadow: "#7a7a4c",
  scree: "#83786c",
  rock: "#6d6a6c",
  rockDark: "#4d4a52",
  snow: "#eef1f7",
  trail: "#a38b69",
  wood: "#6b4a32",
  woodDark: "#4a3222",
  stoneWall: "#bdb3a2",
  whitewash: "#ece6da",
  slate: "#3d5961",
  maroon: "#7a2430",
  gold: "#d9a441",
  windowFrame: "#2f6fa3",
  glow: "#ffb067",
  accent: "#ff642e",
  pine: ["#2f5a3e", "#3b6a47", "#284d36"],
  cloud: "#c9c6dd",
  screen: "#140c08",
};

/** Prayer flag colours, in their traditional order: sky, air, fire, water, earth. */
const FLAGS = ["#2f6fd6", "#f2efe6", "#d63a2f", "#2f9a55", "#e8c33a"];

/** Same random numbers every time for the same seed. */
function seeded(seed: number) {
  let a = seed * 9301 + 49297;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type V3 = [number, number, number];

// ---------- Ground ----------

/** The mountain the trail climbs. Sinks into the clouds at its edges. */
const NEAR = { cx: 1.5, cz: -5, size: 40 };

function nearHeight(x: number, z: number) {
  const edge = smooth(13, 20, Math.max(Math.abs(x - NEAR.cx), Math.abs(z - NEAR.cz)));
  const h = terrainHeight(x, z);
  return h + (-7 - h) * edge;
}

/** The great peaks around the trek, standing in the haze. */
function farHeight(x: number, z: number) {
  const d = Math.hypot(x - NEAR.cx, (z - NEAR.cz) * 0.85);
  const ring = smooth(25, 42, d);
  const front = 1 - smooth(-6, 16, z); // keep the view open toward the camera
  const peaks = 2 + ridged(x * 0.045 + 7, z * 0.045 - 3, 5) * 19 + fbm(x * 0.15, z * 0.15) * 2;
  return -8 + ring * front * peaks;
}

function groundColor(h: number, ny: number, x: number, z: number, snowLine: number, out: THREE.Color) {
  const n = fbm(x * 0.6 + 11, z * 0.6, 2);
  const line = snowLine + n * 1.4;
  if ((h > line && ny > 0.45) || h > line + 3) out.set(C.snow).offsetHSL(0, 0, n * 0.05);
  else if (ny < 0.58) out.set(n > 0 ? C.rock : C.rockDark);
  else if (h < -1.5) out.set(C.valley);
  else if (h < 1.4) out.set(C.grass);
  else if (h < 3.9) out.set(C.meadow);
  else out.set(C.scree);
  return out.offsetHSL(0, 0, n * 0.035);
}

/** Heightfield with one flat colour per triangle (the low-poly look). */
function buildGround(
  cx: number,
  cz: number,
  size: number,
  segs: number,
  height: (x: number, z: number) => number,
  snowLine: number,
) {
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, 0, cz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  const fp = flat.attributes.position;
  const fn = flat.attributes.normal;
  const colors = new Float32Array(fp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < fp.count; i += 3) {
    const x = (fp.getX(i) + fp.getX(i + 1) + fp.getX(i + 2)) / 3;
    const y = (fp.getY(i) + fp.getY(i + 1) + fp.getY(i + 2)) / 3;
    const z = (fp.getZ(i) + fp.getZ(i + 1) + fp.getZ(i + 2)) / 3;
    groundColor(y, fn.getY(i), x, z, snowLine, c);
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

function Ground({ detail }: { detail: number }) {
  const near = useMemo(() => buildGround(NEAR.cx, NEAR.cz, NEAR.size, detail, nearHeight, 6.2), [detail]);
  const far = useMemo(() => buildGround(NEAR.cx, -16, 180, Math.round(detail * 0.7), farHeight, 7), [detail]);
  return (
    <>
      <mesh geometry={near} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
      <mesh geometry={far}>
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </mesh>
    </>
  );
}

// ---------- The trail ----------

/** Height of the ground (or the bridge deck) under a trail point. */
const onBridge = (p: V3) => p[1] - terrainHeight(p[0], p[2]) > 0.6;

function Trail() {
  const geo = useMemo(() => {
    const W = 0.2;
    const pos: number[] = [];
    const idx: number[] = [];
    const gap: boolean[] = [];
    for (let i = 0; i < TRAIL.length; i++) {
      const a = TRAIL[Math.max(0, i - 1)], b = TRAIL[Math.min(TRAIL.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[2] - a[2];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const [x, , z] = TRAIL[i];
      const lx = x - tz * W, lz = z + tx * W, rx = x + tz * W, rz = z - tx * W;
      pos.push(lx, terrainHeight(lx, lz) + 0.05, lz, rx, terrainHeight(rx, rz) + 0.05, rz);
      gap.push(onBridge(TRAIL[i]));
    }
    for (let i = 0; i < TRAIL.length - 1; i++) {
      if (gap[i] || gap[i + 1]) continue;
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);

  // Small lanterns along the way.
  const lanterns = useMemo(() => {
    const out: V3[] = [];
    for (let i = 10; i < TRAIL.length - 6; i += 17) {
      const p = TRAIL[i];
      if (onBridge(p)) continue;
      const q = TRAIL[i + 1];
      const tx = q[0] - p[0], tz = q[2] - p[2];
      const l = Math.hypot(tx, tz) || 1;
      const side = (i / 17) % 2 < 1 ? 1 : -1;
      const x = p[0] - (tz / l) * 0.42 * side, z = p[2] + (tx / l) * 0.42 * side;
      out.push([x, terrainHeight(x, z), z]);
    }
    return out;
  }, []);
  const bulb = useGlow(C.glow, 0);

  return (
    <>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={C.trail} roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {lanterns.map((p, i) => (
        <group key={i} position={p}>
          <mesh position-y={0.2} castShadow>
            <cylinderGeometry args={[0.015, 0.02, 0.4, 5]} />
            <meshStandardMaterial color={C.woodDark} />
          </mesh>
          <mesh position-y={0.43}>
            <octahedronGeometry args={[0.05, 0]} />
            <primitive object={bulb} attach="material" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** A lone trekker's head-torch, walking up the trail and back down, forever. */
function Trekker({ still }: { still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const p = useMemo<V3>(() => [0, 0, 0], []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const T = 90; // seconds for a round trip
    const u = still ? 0.12 : (clock.elapsedTime % T) / T;
    const t = u < 0.5 ? u * 2 : 2 - u * 2;
    trailPoint(t, p);
    const ground = onBridge(p) ? p[1] : terrainHeight(p[0], p[2]);
    ref.current.position.set(p[0], ground + 0.32 + Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.02, p[2]);
    if (light.current) light.current.intensity = 1.6 * sceneLight.level;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color="#fff1d6" toneMapped={false} />
      </mesh>
      {/* The walker: a small dark figure under the torch. */}
      <mesh position-y={-0.16}>
        <capsuleGeometry args={[0.05, 0.14, 2, 6]} />
        <meshStandardMaterial color="#2a2530" />
      </mesh>
      <pointLight ref={light} color="#ffe2b0" distance={2.2} decay={2} intensity={0} />
    </group>
  );
}

// ---------- Prayer flags ----------

/**
 * A string of prayer flags between two points, sagging in the middle
 * and fluttering. One draw call per string.
 */
function PrayerFlags({
  from,
  to,
  sag = 0.2,
  count = 10,
  size = 0.12,
  still,
  seed = 0,
}: {
  from: V3;
  to: V3;
  sag?: number;
  count?: number;
  size?: number;
  still: boolean;
  seed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { pts, line, yaw } = useMemo(() => {
    const at = (t: number): V3 => [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t - sag * 4 * t * (1 - t),
      from[2] + (to[2] - from[2]) * t,
    ];
    const pts = Array.from({ length: count }, (_, i) => at((i + 0.5) / count));
    const line = Array.from({ length: 17 }, (_, i) => at(i / 16));
    return { pts, line, yaw: -Math.atan2(to[2] - from[2], to[0] - from[0]) };
  }, [from, to, sag, count]);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size * 1.25);
    g.translate(0, -size * 0.66, 0);
    return g;
  }, [size]);
  const dummy = useMemo(() => {
    const o = new THREE.Object3D();
    o.rotation.order = "YXZ";
    return o;
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) m.setColorAt(i, c.set(FLAGS[(i + seed) % FLAGS.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, seed]);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = still ? 0 : clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      dummy.position.set(...pts[i]);
      dummy.rotation.set(Math.sin(t * 2.4 + i * 0.8 + seed) * 0.45 + 0.15, yaw, Math.sin(t * 3.1 + i) * 0.06);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <Line points={line} color="#d8d0c2" lineWidth={1} transparent opacity={0.6} />
      <instancedMesh ref={ref} args={[geo, undefined, count]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

// ---------- Small pieces ----------

function Pine({ pos, scale = 1, seed = 0 }: { pos: V3; scale?: number; seed?: number }) {
  const leaf = C.pine[seed % C.pine.length];
  return (
    <group position={pos} scale={scale} rotation-y={seed}>
      <mesh position-y={0.2} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.4, 5]} />
        <meshStandardMaterial color={C.woodDark} roughness={1} flatShading />
      </mesh>
      <mesh position-y={0.62} castShadow>
        <coneGeometry args={[0.3, 0.7, 6]} />
        <meshStandardMaterial color={leaf} roughness={0.9} flatShading />
      </mesh>
      <mesh position-y={0.95} castShadow>
        <coneGeometry args={[0.2, 0.5, 6]} />
        <meshStandardMaterial color={leaf} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function Stone({ pos, size, seed = 0, color = C.rock }: { pos: V3; size: number; seed?: number; color?: string }) {
  return (
    <mesh position={pos} scale={[size, size * 0.7, size]} rotation={[seed, seed * 2, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.95} flatShading />
    </mesh>
  );
}

/**
 * Warm light (windows, lamps): one shared material that fades in with the
 * intro and is bright enough to bloom.
 */
function useGlow(color: string = C.glow, min = 0.25) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0 }),
    [color],
  );
  useFrame(() => {
    mat.opacity = min + (1 - min) * sceneLight.level;
  });
  return mat;
}

/** Bigger invisible box so small objects are easy to hover and tap. */
function Hitbox({ size, pos = [0, 0, 0] }: { size: V3; pos?: V3 }) {
  return (
    <mesh position={pos} visible={false}>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** A clickable stop on the trail, standing on its flat ground and facing the viewer. */
function Stop({ id, hit, tip, children }: { id: HotspotId; hit: V3; tip: V3; children: ReactNode }) {
  const s = STOPS[id];
  return (
    <group position={s.pos} rotation-y={s.face}>
      <Interactive id={id} tooltipAt={tip}>
        {children}
        <Hitbox size={hit} pos={[0, hit[1] / 2, 0]} />
      </Interactive>
    </group>
  );
}

/** Code lines drawn on a canvas, for the screens at base camp. */
function useCodeTexture(seed: number) {
  return useMemo(() => {
    const rnd = seeded(seed);
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = C.screen;
    ctx.fillRect(0, 0, 256, 160);
    const colors = ["#ff642e", "#ffb347", "#6f9bff", "#e9e4dc", "#7fd1a6"];
    for (let row = 0; row < 11; row++) {
      let x = 14 + Math.floor(rnd() * 3) * 14;
      const words = 1 + Math.floor(rnd() * 4);
      for (let w = 0; w < words && x < 230; w++) {
        const len = 14 + rnd() * 50;
        ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, 12 + row * 13, len, 5);
        x += len + 8;
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [seed]);
}

/** The watchful eyes painted on every side of a stupa's tower. */
function useStupaEyes() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#d9a441";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = C.whitewash;
    ctx.fillRect(0, 70, 256, 150);
    for (const cx of [78, 178]) {
      ctx.fillStyle = "#1b1b22";
      ctx.beginPath();
      ctx.ellipse(cx, 130, 42, 16, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = C.whitewash;
      ctx.beginPath();
      ctx.ellipse(cx, 131, 34, 9, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#2f6fd6";
      ctx.beginPath();
      ctx.arc(cx, 128, 8, 0, Math.PI * 2);
      ctx.fill();
      // Brow
      ctx.strokeStyle = "#1b1b22";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, 128, 50, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    // The "nose": the Nepali numeral one, for unity.
    ctx.strokeStyle = "#c2392b";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(122, 150);
    ctx.quadraticCurveTo(146, 160, 128, 178);
    ctx.quadraticCurveTo(112, 196, 136, 204);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

// ---------- The stops ----------

/** About → a stone teahouse with lit windows, your portrait on the notice board. */
function Teahouse({ still }: { still: boolean }) {
  const photo = useTexture(profile.photo);
  photo.colorSpace = THREE.SRGBColorSpace;
  const glow = useGlow();
  const smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!smoke.current) return;
    smoke.current.children.forEach((m, i) => {
      const k = still ? i / 5 : (clock.elapsedTime * 0.25 + i / 5) % 1;
      m.position.set(Math.sin(k * 5 + i) * 0.08 + k * 0.25, k * 1.3, 0);
      m.scale.setScalar(0.05 + k * 0.14);
      ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - k) * sceneLight.level;
    });
  });
  return (
    <>
      <group position={[-0.25, 0, -0.35]}>
        {/* Walls */}
        <mesh position-y={0.45} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.9, 1.05]} />
          <meshStandardMaterial color={C.stoneWall} roughness={0.95} flatShading />
          <HoverOutline thickness={0.02} />
        </mesh>
        {/* Hipped slate roof */}
        <mesh position-y={1.17} rotation-y={Math.PI / 4} scale={[1.42, 1, 0.98]} castShadow>
          <coneGeometry args={[0.85, 0.55, 4]} />
          <meshStandardMaterial color={C.slate} roughness={0.8} flatShading />
        </mesh>
        {/* Chimney and its smoke */}
        <mesh position={[0.45, 1.25, -0.2]} castShadow>
          <boxGeometry args={[0.16, 0.45, 0.16]} />
          <meshStandardMaterial color={C.rock} flatShading />
        </mesh>
        <group ref={smoke} position={[0.45, 1.5, -0.2]}>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#cfcbd8" transparent opacity={0} depthWrite={false} flatShading />
            </mesh>
          ))}
        </group>
        {/* Blue window frames with warm light inside */}
        {[-0.45, 0.45].map((x) => (
          <group key={x} position={[x, 0.5, 0.53]}>
            <mesh>
              <boxGeometry args={[0.3, 0.3, 0.03]} />
              <meshStandardMaterial color={C.windowFrame} />
            </mesh>
            <mesh position-z={0.017}>
              <planeGeometry args={[0.22, 0.22]} />
              <primitive object={glow} attach="material" />
            </mesh>
          </group>
        ))}
        {/* Door */}
        <mesh position={[0, 0.3, 0.535]}>
          <boxGeometry args={[0.26, 0.56, 0.03]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
        <PrayerFlags from={[-0.8, 1.0, 0.5]} to={[-1.6, 1.25, 1.4]} sag={0.12} count={6} size={0.1} still={still} />
      </group>
      {/* Pole for the flags */}
      <mesh position={[-1.85, 0.65, 1.05]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 1.3, 5]} />
        <meshStandardMaterial color={C.wood} />
      </mesh>

      {/* Notice board with your portrait */}
      <group position={[1.05, 0, 0.55]} rotation-y={-0.45}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]} castShadow>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
        ))}
        <mesh position-y={0.92} castShadow>
          <boxGeometry args={[0.72, 0.84, 0.05]} />
          <meshStandardMaterial color={C.woodDark} roughness={0.8} />
          <HoverOutline thickness={0.015} />
        </mesh>
        <mesh position={[0, 0.94, 0.027]}>
          <planeGeometry args={[0.58, 0.7]} />
          <meshStandardMaterial map={photo} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.4, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.86, 3]} />
          <meshStandardMaterial color={C.slate} flatShading />
        </mesh>
      </group>

      {/* Bench, firewood, stones */}
      <mesh position={[0.15, 0.14, 0.75]} castShadow>
        <boxGeometry args={[0.6, 0.05, 0.18]} />
        <meshStandardMaterial color={C.wood} />
      </mesh>
      {[-0.12, 0.12].map((x, i) =>
        [0, 1].map((r) => (
          <mesh key={`${i}${r}`} position={[-1.3 + x, 0.06 + r * 0.1, -0.85]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.5, 6]} />
            <meshStandardMaterial color={C.woodDark} flatShading />
          </mesh>
        )),
      )}
      <Stone pos={[1.4, 0.05, -0.6]} size={0.18} seed={1} />
      <Stone pos={[-0.9, 0.04, 1.3]} size={0.13} seed={2} />
      <Pine pos={[1.6, 0, -1.2]} scale={1.1} seed={1} />
      <Pine pos={[-1.6, 0, -1.3]} scale={0.9} seed={2} />
    </>
  );
}

/** Skills → a white stupa with watchful eyes, spinning prayer wheels and butter lamps. */
function Stupa({ still }: { still: boolean }) {
  const eyes = useStupaEyes();
  const wheels = useRef<THREE.Group>(null);
  const lamp = useGlow("#ffc070", 0);
  useFrame((_, dt) => {
    if (!wheels.current || still) return;
    wheels.current.children.forEach((w, i) => (w.rotation.y += dt * (0.8 + (i % 3) * 0.25)));
  });
  const top: V3 = [0, 2.05, 0];
  return (
    <>
      {/* Stepped base */}
      {[
        [1.5, 0.18],
        [1.22, 0.16],
        [0.98, 0.14],
      ].map(([w, h], i, arr) => {
        const y = arr.slice(0, i).reduce((s, a) => s + a[1], 0) + h / 2;
        return (
          <mesh key={i} position-y={y} castShadow receiveShadow>
            <boxGeometry args={[w, h, w]} />
            <meshStandardMaterial color={C.whitewash} roughness={0.9} flatShading />
            {i === 0 && <HoverOutline thickness={0.02} />}
          </mesh>
        );
      })}
      {/* Dome */}
      <mesh position-y={0.48} castShadow>
        <sphereGeometry args={[0.58, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={C.whitewash} roughness={0.85} flatShading />
        <HoverOutline thickness={0.02} />
      </mesh>
      {/* Tower with the eyes */}
      <mesh position-y={1.2} castShadow>
        <boxGeometry args={[0.38, 0.32, 0.38]} />
        <meshStandardMaterial map={eyes} roughness={0.7} />
      </mesh>
      {/* Thirteen golden steps to enlightenment */}
      {Array.from({ length: 13 }, (_, i) => (
        <mesh key={i} position-y={1.4 + i * 0.045} castShadow>
          <cylinderGeometry args={[0.15 - i * 0.008, 0.155 - i * 0.008, 0.04, 8]} />
          <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position-y={2.0} castShadow>
        <coneGeometry args={[0.12, 0.14, 8]} />
        <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Flags from the top to the four corners of the ground */}
      {[
        [1.45, 1.1],
        [-1.45, 1.1],
        [1.4, -1.15],
        [-1.4, -1.15],
      ].map(([x, z], i) => (
        <group key={i}>
          <PrayerFlags from={top} to={[x, 0.55, z]} sag={0.25} count={9} size={0.1} still={still} seed={i} />
          <mesh position={[x, 0.27, z]}>
            <cylinderGeometry args={[0.02, 0.025, 0.55, 5]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
        </group>
      ))}
      {/* Prayer wheels on a low wall */}
      <group position={[0, 0, -1.05]}>
        <mesh position-y={0.12} castShadow>
          <boxGeometry args={[1.3, 0.24, 0.16]} />
          <meshStandardMaterial color={C.maroon} roughness={0.9} />
        </mesh>
        <group ref={wheels}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-0.52 + i * 0.21, 0.37, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.24, 8]} />
              <meshStandardMaterial color={i % 2 ? "#b87333" : C.gold} metalness={0.7} roughness={0.35} flatShading />
            </mesh>
          ))}
        </group>
      </group>
      {/* Butter lamps */}
      {[-0.35, -0.12, 0.12, 0.35].map((x) => (
        <mesh key={x} position={[x, 0.2, 0.8]}>
          <octahedronGeometry args={[0.03, 0]} />
          <primitive object={lamp} attach="material" />
        </mesh>
      ))}
    </>
  );
}

/** Education → a monastery: whitewashed walls, a maroon band, a golden roof. */
function Gompa({ still }: { still: boolean }) {
  const glow = useGlow();
  const flag = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (flag.current && !still) flag.current.rotation.y = Math.sin(clock.elapsedTime * 1.6) * 0.35;
  });
  return (
    <>
      <group position={[0, 0, -0.2]}>
        <mesh position-y={0.45} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.9, 1.0]} />
          <meshStandardMaterial color={C.whitewash} roughness={0.9} flatShading />
          <HoverOutline thickness={0.02} />
        </mesh>
        {/* Maroon band under the roof */}
        <mesh position-y={1.0} castShadow>
          <boxGeometry args={[1.54, 0.22, 1.04]} />
          <meshStandardMaterial color={C.maroon} roughness={0.9} />
        </mesh>
        <mesh position-y={1.14} castShadow>
          <boxGeometry args={[1.66, 0.06, 1.14]} />
          <meshStandardMaterial color={C.woodDark} />
        </mesh>
        {/* Golden pagoda roof on top */}
        <mesh position-y={1.32} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[0.55, 0.32, 4]} />
          <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} flatShading />
        </mesh>
        <mesh position-y={1.56}>
          <cylinderGeometry args={[0.04, 0.07, 0.18, 8]} />
          <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} />
        </mesh>
        {[
          [-0.74, -0.48],
          [0.74, -0.48],
          [-0.74, 0.48],
          [0.74, 0.48],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.3, z]}>
            <cylinderGeometry args={[0.05, 0.05, 0.26, 8]} />
            <meshStandardMaterial color={C.gold} metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        {/* Windows, lit for study */}
        {[-0.5, 0.5].map((x) => (
          <group key={x} position={[x, 0.55, 0.505]}>
            <mesh>
              <boxGeometry args={[0.24, 0.3, 0.02]} />
              <meshStandardMaterial color="#1d1a1f" />
            </mesh>
            <mesh position-z={0.012}>
              <planeGeometry args={[0.16, 0.22]} />
              <primitive object={glow} attach="material" />
            </mesh>
          </group>
        ))}
        {/* Door and steps */}
        <mesh position={[0, 0.32, 0.51]}>
          <boxGeometry args={[0.3, 0.55, 0.03]} />
          <meshStandardMaterial color={C.maroon} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.03 + i * 0.05, 0.75 - i * 0.08]} receiveShadow castShadow>
            <boxGeometry args={[0.6 - i * 0.08, 0.06, 0.18]} />
            <meshStandardMaterial color={C.stoneWall} flatShading />
          </mesh>
        ))}
      </group>
      {/* A tall prayer-flag pole (darchor) */}
      <group position={[1.15, 0, 0.55]}>
        <mesh position-y={1.1} castShadow>
          <cylinderGeometry args={[0.025, 0.035, 2.2, 6]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
        <group ref={flag} position-y={1.25}>
          {FLAGS.map((c, i) => (
            <mesh key={c} position={[0.17, 0.75 - i * 0.18, 0]}>
              <planeGeometry args={[0.32, 0.18]} />
              <meshStandardMaterial color={c} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          ))}
        </group>
      </group>
      <Pine pos={[-1.25, 0, -0.9]} scale={1.0} seed={3} />
      <Pine pos={[-1.5, 0, 0.3]} scale={0.75} seed={4} />
      <Stone pos={[1.0, 0.04, -0.9]} size={0.16} seed={5} />
    </>
  );
}

/** Work → a swaying suspension bridge over the gorge, strung with prayer flags. */
const BRIDGE_MID: V3 = [(BRIDGE.from[0] + BRIDGE.to[0]) / 2, BRIDGE.height, (BRIDGE.from[1] + BRIDGE.to[1]) / 2];

function Bridge({ still }: { still: boolean }) {
  const mid = BRIDGE_MID;
  const geo = useMemo(() => {
    const ax = BRIDGE.from[0] - mid[0], az = BRIDGE.from[1] - mid[2];
    const bx = BRIDGE.to[0] - mid[0], bz = BRIDGE.to[1] - mid[2];
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;
    const W = 0.32;
    const POST = 0.95, CABLE_SAG = 0.75, DECK_SAG = 0.42;
    const deck = (t: number): V3 => [ax + (bx - ax) * t, -DECK_SAG * 4 * t * (1 - t), az + (bz - az) * t];
    const cable = (side: number, t: number): V3 => [
      ax + (bx - ax) * t + nx * W * side,
      POST - CABLE_SAG * 4 * t * (1 - t),
      az + (bz - az) * t + nz * W * side,
    ];
    const posts: V3[] = [];
    for (const side of [-1, 1]) for (const [x, z] of [[ax, az], [bx, bz]]) posts.push([x + nx * W * side, 0, z + nz * W * side]);
    const cables = [-1, 1].map((side) => Array.from({ length: 17 }, (_, i) => cable(side, i / 16)));
    // Hangers from cable down to the deck edge.
    const hangers: V3[] = [];
    for (const side of [-1, 1])
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        const d = deck(t);
        hangers.push(cable(side, t), [d[0] + nx * W * side, d[1], d[2] + nz * W * side]);
      }
    return { len, yaw: -Math.atan2(uz, ux), nx, nz, W, POST, CABLE_SAG, deck, cables, posts, hangers };
  }, [mid]);

  // Planks along the sagging deck, each turned to follow the slope.
  const planks = useRef<THREE.InstancedMesh>(null);
  const PLANKS = 30;
  const sway = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const m = planks.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const T = new THREE.Vector3(), N = new THREE.Vector3(geo.nx, 0, geo.nz), U = new THREE.Vector3();
    const basis = new THREE.Matrix4();
    for (let i = 0; i < PLANKS; i++) {
      const t = (i + 0.5) / PLANKS;
      const p = geo.deck(t), q = geo.deck(t + 0.01);
      T.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize();
      U.crossVectors(N, T).normalize();
      basis.makeBasis(T, U, N);
      o.quaternion.setFromRotationMatrix(basis);
      o.position.set(...p);
      o.scale.setScalar(1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [geo]);
  useFrame(({ clock }) => {
    if (sway.current && !still) sway.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.025;
  });

  return (
    <group position={mid}>
      <Interactive id="work" tooltipAt={[0, 1.6, 0]}>
        <group ref={sway}>
          <instancedMesh ref={planks} args={[undefined, undefined, PLANKS]} castShadow receiveShadow>
            <boxGeometry args={[0.11, 0.035, geo.W * 2 + 0.06]} />
            <meshStandardMaterial color={C.wood} roughness={0.9} flatShading />
          </instancedMesh>
          {geo.cables.map((pts, i) => (
            <Line key={i} points={pts} color="#3a3a42" lineWidth={2.2} />
          ))}
          <Line points={geo.hangers} segments color="#55545c" lineWidth={1} />
          <PrayerFlags from={geo.cables[0][0]} to={geo.cables[0][16]} sag={geo.CABLE_SAG} count={20} size={0.11} still={still} />
          <PrayerFlags from={geo.cables[1][0]} to={geo.cables[1][16]} sag={geo.CABLE_SAG} count={20} size={0.11} still={still} seed={2} />
        </group>
        {geo.posts.map((p, i) => (
          <mesh key={i} position={[p[0], geo.POST / 2 - 0.15, p[2]]} castShadow>
            <boxGeometry args={[0.09, geo.POST + 0.3, 0.09]} />
            <meshStandardMaterial color={C.woodDark} roughness={0.9} />
            <HoverOutline thickness={0.01} />
          </mesh>
        ))}
        <group rotation-y={geo.yaw}>
          <Hitbox size={[geo.len, 1.6, 1.2]} pos={[0, 0.3, 0]} />
        </group>
      </Interactive>
    </group>
  );
}

/** Projects → base camp: tents, a fire, and screens full of code. */
function BaseCamp({ still }: { still: boolean }) {
  const code1 = useCodeTexture(21);
  const code2 = useCodeTexture(22);
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    const t = clock.elapsedTime;
    const f = still ? 1 : 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
    flame.current.scale.set(1, f, 1);
    (flame.current.material as THREE.MeshBasicMaterial).opacity = sceneLight.level;
  });
  const tents: Array<{ pos: V3; color: string; rot: number; s: number }> = [
    { pos: [-0.85, 0, -0.55], color: C.accent, rot: 0.5, s: 1 },
    { pos: [0.35, 0, -0.95], color: "#f2b33d", rot: -0.2, s: 0.9 },
    { pos: [1.15, 0, -0.2], color: "#d94b3a", rot: -0.9, s: 0.8 },
  ];
  return (
    <>
      {tents.map((t, i) => (
        <group key={i} position={t.pos} rotation-y={t.rot} scale={t.s}>
          <mesh scale={[1.15, 0.7, 0.85]} castShadow receiveShadow>
            <sphereGeometry args={[0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={t.color} roughness={0.7} flatShading />
            <HoverOutline thickness={0.015} />
          </mesh>
          <mesh position={[0, 0.13, 0.41]} rotation-x={-0.35}>
            <circleGeometry args={[0.14, 3]} />
            <meshStandardMaterial color="#2a1d18" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Crate desk with a laptop */}
      <group position={[0.1, 0, 0.55]} rotation-y={-0.2}>
        <mesh position-y={0.16} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.32, 0.4]} />
          <meshStandardMaterial color={C.wood} roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 0.335, 0.03]} castShadow>
          <boxGeometry args={[0.34, 0.02, 0.22]} />
          <meshStandardMaterial color="#2b2b30" metalness={0.4} roughness={0.4} />
        </mesh>
        <group position={[0, 0.345, -0.08]} rotation-x={-0.25}>
          <mesh position-y={0.11}>
            <boxGeometry args={[0.34, 0.22, 0.015]} />
            <meshStandardMaterial color="#2b2b30" metalness={0.4} roughness={0.4} />
            <HoverOutline thickness={0.008} />
          </mesh>
          <mesh position={[0, 0.11, 0.009]}>
            <planeGeometry args={[0.31, 0.19]} />
            <meshBasicMaterial map={code1} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* A big screen on a tripod */}
      <group position={[-0.75, 0, 0.45]} rotation-y={0.55}>
        {[-1, 0, 1].map((k) => (
          <mesh key={k} position={[k * 0.14, 0.4, k === 0 ? -0.14 : 0.04]} rotation={[k === 0 ? 0.3 : -0.1, 0, k * 0.3]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.85, 4]} />
            <meshStandardMaterial color="#3a3a42" />
          </mesh>
        ))}
        <mesh position-y={1.02} castShadow>
          <boxGeometry args={[0.86, 0.56, 0.04]} />
          <meshStandardMaterial color="#121212" roughness={0.4} metalness={0.3} />
          <HoverOutline thickness={0.012} />
        </mesh>
        <mesh position={[0, 1.02, 0.022]}>
          <planeGeometry args={[0.78, 0.48]} />
          <meshBasicMaterial map={code2} toneMapped={false} />
        </mesh>
      </group>

      {/* Campfire */}
      <group position={[0.95, 0, 0.75]}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return <Stone key={i} pos={[Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2]} size={0.06} seed={i} />;
        })}
        {[0.6, -0.6].map((r) => (
          <mesh key={r} position-y={0.05} rotation={[0, r, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.32, 5]} />
            <meshStandardMaterial color={C.woodDark} />
          </mesh>
        ))}
        <mesh ref={flame} position-y={0.17}>
          <coneGeometry args={[0.1, 0.28, 5]} />
          <meshBasicMaterial color="#ff8a3a" toneMapped={false} transparent />
        </mesh>
      </group>

      <PrayerFlags from={[-0.85, 0.75, -0.55]} to={[1.15, 0.65, -0.2]} sag={0.22} count={11} size={0.1} still={still} seed={1} />
      {[[-0.85, -0.55], [1.15, -0.2]].map(([x, z]) => (
        <mesh key={x} position={[x, 0.38, z]}>
          <cylinderGeometry args={[0.015, 0.02, 0.76, 5]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      ))}
    </>
  );
}

/** Contact → the summit: a cairn, prayer flags, and a beacon sending out a signal. */
function Summit({ still }: { still: boolean }) {
  const orb = useRef<THREE.MeshBasicMaterial>(null);
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (orb.current) orb.current.opacity = sceneLight.level * (still ? 1 : 0.75 + Math.sin(t * 2.4) * 0.25);
    if (!rings.current) return;
    rings.current.children.forEach((r, i) => {
      const k = still ? 0.3 + i * 0.25 : (t * 0.35 + i / 3) % 1;
      r.scale.setScalar(0.2 + k * 2.2);
      ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6 * sceneLight.level;
    });
  });
  const top: V3 = [0, 1.45, 0];
  return (
    <>
      {/* Cairn */}
      {[0.32, 0.25, 0.19, 0.14, 0.1].map((s, i) => (
        <Stone key={i} pos={[0.35, 0.08 + i * 0.15, 0.25]} size={s} seed={i + 3} color={i % 2 ? C.rock : C.rockDark} />
      ))}
      <mesh position-y={0.72} castShadow>
        <cylinderGeometry args={[0.025, 0.035, 1.45, 6]} />
        <meshStandardMaterial color={C.wood} />
        <HoverOutline thickness={0.01} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        return (
          <PrayerFlags
            key={i}
            from={top}
            to={[Math.cos(a) * 1.5, -0.35, Math.sin(a) * 1.5]}
            sag={0.2}
            count={9}
            size={0.1}
            still={still}
            seed={i}
          />
        );
      })}
      {/* Beacon */}
      <mesh position={[0, 1.55, 0]}>
        <icosahedronGeometry args={[0.09, 1]} />
        <meshBasicMaterial ref={orb} color={C.accent} toneMapped={false} transparent />
      </mesh>
      <group ref={rings} position={[0, 1.55, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.95, 1, 48]} />
            <meshBasicMaterial color={C.accent} toneMapped={false} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ---------- Forest and clouds ----------

function Forest({ count }: { count: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => {
    const rnd = seeded(7);
    const out: Array<{ p: V3; s: number; r: number; c: number }> = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 30) {
      const x = -14 + rnd() * 30, z = -18 + rnd() * 30;
      const h = nearHeight(x, z);
      if (h < -2.6 || h > 3.4) continue;
      const slope = Math.abs(nearHeight(x + 0.3, z) - h) + Math.abs(nearHeight(x, z + 0.3) - h);
      if (slope > 0.32) continue;
      let clear = true;
      for (let i = 0; i < TRAIL.length && clear; i += 3) if (Math.hypot(x - TRAIL[i][0], z - TRAIL[i][2]) < 0.75) clear = false;
      for (const s of Object.values(STOPS)) if (Math.hypot(x - s.pos[0], z - s.pos[2]) < s.radius + 0.5) clear = false;
      if (!clear) continue;
      out.push({ p: [x, h, z], s: 0.6 + rnd() * 0.7, r: rnd() * 6, c: Math.floor(rnd() * 3) });
    }
    return out;
  }, [count]);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      o.position.set(t.p[0], t.p[1] + 0.2 * t.s, t.p[2]);
      o.scale.setScalar(t.s);
      o.rotation.set(0, t.r, 0);
      o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
      o.position.y = t.p[1] + 0.75 * t.s;
      o.updateMatrix();
      crowns.current?.setMatrixAt(i, o.matrix);
      crowns.current?.setColorAt(i, col.set(C.pine[t.c]));
    });
    for (const m of [trunks.current, crowns.current]) {
      if (!m) continue;
      m.count = trees.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [trees]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.4, 5]} />
        <meshStandardMaterial color={C.woodDark} roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]} castShadow receiveShadow>
        <coneGeometry args={[0.3, 1.0, 6]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

/** A sea of cloud filling the valleys below the trail. */
function CloudSea({ still }: { still: boolean }) {
  const puffs = useMemo(() => {
    const rnd = seeded(99);
    return Array.from({ length: 46 }, () => ({
      pos: [-22 + rnd() * 48, -3.4 - rnd() * 1.6, -30 + rnd() * 44] as V3,
      scale: [2 + rnd() * 3, 0.6 + rnd() * 0.6, 1.6 + rnd() * 2.2] as V3,
    }));
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current && !still) group.current.position.x = ((group.current.position.x + dt * 0.06 + 5) % 10) - 5;
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.scale}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={C.cloud} roughness={1} flatShading transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- The whole trek ----------

export function Himalaya({ reducedMotion, quality }: { reducedMotion: boolean; quality: "high" | "low" }) {
  const still = reducedMotion;
  const high = quality === "high";
  return (
    <>
      <Ground detail={high ? 180 : 110} />
      <Trail />
      <Trekker still={still} />
      <Forest count={high ? 260 : 140} />
      <CloudSea still={still} />

      <Stop id="about" hit={[3.2, 1.8, 2.6]} tip={[0, 2.1, 0]}>
        <Teahouse still={still} />
      </Stop>
      <Stop id="skills" hit={[2.4, 2.2, 2.4]} tip={[0, 2.5, 0]}>
        <Stupa still={still} />
      </Stop>
      <Stop id="education" hit={[2.6, 1.9, 2.2]} tip={[0, 2.2, 0]}>
        <Gompa still={still} />
      </Stop>
      <Bridge still={still} />
      <Stop id="projects" hit={[3.0, 1.5, 2.4]} tip={[0, 1.9, 0]}>
        <BaseCamp still={still} />
      </Stop>
      <Stop id="contact" hit={[1.8, 2.0, 1.8]} tip={[0, 2.2, 0]}>
        <Summit still={still} />
      </Stop>
    </>
  );
}
