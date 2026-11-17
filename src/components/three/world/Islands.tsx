"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { profile } from "@/data/profile";
import { DEBRIS, ISLANDS, type IslandSpec } from "@/lib/world";
import { HoverOutline, Interactive } from "./Interactive";
import { sceneLight } from "../sceneLight";
import type { HotspotId } from "@/data/hotspots";

// ============================================
// SECTION 2: ISLAND COLOURS AND MATERIALS
// Everything is built in code: no model downloads.
// ============================================
const C = {
  grass: "#5b8a5f",
  grassDark: "#466e4c",
  dirt: "#6e4c36",
  rockTop: "#6a574d",
  rockTip: "#2a2224",
  trunk: "#5a3d2b",
  leaves: ["#3f7a52", "#4f8f5c", "#2f6646"],
  stone: "#2b2a2e",
  accent: "#ff642e",
  screen: "#140c08",
  crystal: ["#ff642e", "#ffb347", "#6f9bff", "#e9e4dc", "#ff8a4f"],
  book: ["#b8442b", "#2f5d8a", "#d9a441", "#3f6b4f"],
  cloud: "#4b4f7c",
};

/** Top surface height of every island, relative to its centre. */
const TOP = 0.12;

/** Same random numbers every time for the same seed, so islands keep their shape. */
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

/**
 * Rocky underside: a downward cone with every vertex nudged at random.
 * Vertices that share a position (the seam) get the same nudge, so no cracks.
 */
function rockGeometry(radius: number, depth: number, seed: number, rough = 0.32) {
  const rnd = seeded(seed);
  const seg = Math.max(7, Math.round(6 + radius * 4));
  const g = new THREE.ConeGeometry(radius, depth, seg, 5);
  g.rotateX(Math.PI);
  g.translate(0, -depth / 2 - TOP * 0.6, 0);
  const p = g.attributes.position;
  const nudges = new Map<string, [number, number, number]>();
  const colors = new Float32Array(p.count * 3);
  const top = new THREE.Color(C.rockTop);
  const tip = new THREE.Color(C.rockTip);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    const t = Math.min(1, Math.max(0, (-y - TOP * 0.6) / depth)); // 0 at the top, 1 at the tip
    let n = nudges.get(key);
    if (!n) {
      const edge = t < 0.02 ? 0.25 : 1;
      n = [1 + (rnd() - 0.5) * rough * edge, (rnd() - 0.5) * 0.35 * depth * 0.2 * t, rnd()];
      nudges.set(key, n);
    }
    p.setXYZ(i, x * n[0], y + n[1], z * n[0]);
    c.copy(top).lerp(tip, Math.pow(t, 0.8)).offsetHSL(0, 0, (n[2] - 0.5) * 0.04);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** A gentle up-and-down float. */
function useBob(seed: number, amount: number, still: boolean) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || still) return;
    ref.current.position.y = Math.sin(clock.elapsedTime * 0.45 + seed * 1.7) * amount;
  });
  return ref;
}

// ---------- Building blocks ----------

function IslandBody({ spec, children }: { spec: IslandSpec; children?: ReactNode }) {
  const { radius, depth, seed } = spec;
  const rock = useMemo(() => rockGeometry(radius, depth, seed), [radius, depth, seed]);
  const seg = Math.max(7, Math.round(6 + radius * 4));
  return (
    <group>
      {/* Grass top */}
      <mesh position-y={0} receiveShadow castShadow>
        <cylinderGeometry args={[radius * 0.98, radius, 0.24, seg]} />
        <meshStandardMaterial color={C.grass} roughness={0.95} flatShading />
      </mesh>
      {/* Soil band */}
      <mesh position-y={-0.16} castShadow>
        <cylinderGeometry args={[radius * 1.0, radius * 0.94, 0.14, seg]} />
        <meshStandardMaterial color={C.dirt} roughness={1} flatShading />
      </mesh>
      {/* Rocky underside */}
      <mesh geometry={rock} castShadow>
        <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
      <group position-y={TOP}>{children}</group>
    </group>
  );
}

function Tree({ pos, scale = 1, seed = 0 }: { pos: [number, number, number]; scale?: number; seed?: number }) {
  const leaf = C.leaves[seed % C.leaves.length];
  return (
    <group position={pos} scale={scale} rotation-y={seed}>
      <mesh position-y={0.25} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 0.5, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={1} flatShading />
      </mesh>
      <mesh position-y={0.68} castShadow>
        <coneGeometry args={[0.36, 0.6, 7]} />
        <meshStandardMaterial color={leaf} roughness={0.9} flatShading />
      </mesh>
      <mesh position-y={0.98} castShadow>
        <coneGeometry args={[0.26, 0.48, 7]} />
        <meshStandardMaterial color={leaf} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function Rock({ pos, size, seed }: { pos: [number, number, number]; size: number; seed: number }) {
  return (
    <mesh position={pos} scale={[size, size * 0.7, size]} rotation={[seed, seed * 2, 0]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={C.rockTop} roughness={0.95} flatShading />
    </mesh>
  );
}

/** Bigger invisible box so small objects are easy to hover and tap. */
function Hitbox({ size, pos = [0, 0, 0] }: { size: [number, number, number]; pos?: [number, number, number] }) {
  return (
    <mesh position={pos} visible={false}>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** An island you can click: floats, highlights on hover, opens its panel. */
function ClickableIsland({
  id,
  still,
  bob = 0.1,
  children,
}: {
  id: HotspotId;
  still: boolean;
  bob?: number;
  children: ReactNode;
}) {
  const spec = ISLANDS[id];
  const ref = useBob(spec.seed, bob, still);
  return (
    <group position={spec.pos}>
      <group ref={ref}>
        <Interactive id={id} tooltipAt={[0, 2.1, 0]}>
          <IslandBody spec={spec}>{children}</IslandBody>
          <Hitbox size={[spec.radius * 1.8, 2.2, spec.radius * 1.8]} pos={[0, 0.6, 0]} />
        </Interactive>
      </group>
    </group>
  );
}

// ---------- What stands on each island ----------

/** Hub island → About: a stone slab with your portrait, among trees. */
function HubContent() {
  const photo = useTexture(profile.photo);
  photo.colorSpace = THREE.SRGBColorSpace;
  const edge = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (edge.current) edge.current.opacity = 0.35 + 0.65 * sceneLight.level;
  });
  return (
    <>
      <group position={[0.2, 0, -0.3]} rotation-y={-0.35}>
        <mesh position-y={0.85} castShadow receiveShadow>
          <boxGeometry args={[1.0, 1.7, 0.16]} />
          <meshStandardMaterial color={C.stone} roughness={0.7} flatShading />
          <HoverOutline thickness={0.02} />
        </mesh>
        <mesh position={[0, 0.95, 0.082]}>
          <planeGeometry args={[0.74, 0.92]} />
          <meshStandardMaterial map={photo} roughness={0.6} />
        </mesh>
        {/* Glowing strip under the portrait */}
        <mesh position={[0, 0.36, 0.082]}>
          <planeGeometry args={[0.74, 0.03]} />
          <meshBasicMaterial ref={edge} color={C.accent} toneMapped={false} transparent />
        </mesh>
      </group>
      <Tree pos={[-1.3, 0, -0.6]} scale={1.15} seed={1} />
      <Tree pos={[-0.9, 0, -1.3]} scale={0.85} seed={2} />
      <Tree pos={[1.4, 0, -1.0]} scale={1.0} seed={3} />
      <Tree pos={[-1.6, 0, 0.7]} scale={0.7} seed={4} />
      <Rock pos={[1.2, 0.05, 0.9]} size={0.22} seed={1} />
      <Rock pos={[1.45, 0.03, 0.6]} size={0.13} seed={2} />
      <Rock pos={[-0.6, 0.03, 1.3]} size={0.15} seed={3} />
      {/* Stepping stones toward the front */}
      {[[0.3, 0.6], [0.1, 1.05], [0.35, 1.5], [0.15, 1.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.005, z]} rotation-y={i} receiveShadow>
          <cylinderGeometry args={[0.16, 0.18, 0.04, 7]} />
          <meshStandardMaterial color="#8d8478" roughness={0.9} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** Code lines drawn on a canvas, for the floating screens. */
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

function Screen({ pos, rotY, seed, still }: { pos: [number, number, number]; rotY: number; seed: number; still: boolean }) {
  const tex = useCodeTexture(seed);
  const ref = useBob(seed + 10, 0.06, still);
  return (
    <group position={pos} rotation-y={rotY}>
      <group ref={ref}>
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.6, 0.05]} />
          <meshStandardMaterial color="#121212" roughness={0.4} metalness={0.3} />
          <HoverOutline thickness={0.012} />
        </mesh>
        <mesh position-z={0.027}>
          <planeGeometry args={[0.84, 0.52]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Projects island: three floating screens with code on them. */
function ProjectsContent({ still }: { still: boolean }) {
  return (
    <>
      <Screen pos={[-0.62, 0.95, 0.2]} rotY={0.45} seed={21} still={still} />
      <Screen pos={[0.25, 1.15, -0.25]} rotY={-0.05} seed={22} still={still} />
      <Screen pos={[0.95, 0.85, 0.35]} rotY={-0.6} seed={23} still={still} />
      {/* Small desk the screens hover over */}
      <mesh position={[0.15, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.06, 0.6]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.6} />
      </mesh>
      {[-0.5, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]} castShadow>
          <boxGeometry args={[0.06, 0.2, 0.5]} />
          <meshStandardMaterial color="#3a2a20" roughness={0.6} />
        </mesh>
      ))}
      <Tree pos={[-1.05, 0, -0.75]} scale={0.6} seed={5} />
    </>
  );
}

/** Skills island: glowing crystals, one colour per skill area. */
function SkillsContent({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current && !still) group.current.rotation.y += dt * 0.15;
  });
  const crystals: Array<[number, number, number, number]> = [
    [0, 0, 0, 0.9],
    [0.45, 0, 0.25, 0.55],
    [-0.4, 0, 0.3, 0.6],
    [0.2, 0, -0.45, 0.5],
    [-0.35, 0, -0.35, 0.42],
  ];
  return (
    <group ref={group}>
      {crystals.map(([x, , z, h], i) => (
        <mesh key={i} position={[x, h * 0.55, z]} scale={[0.26, h, 0.26]} rotation={[0.08 * i, i, 0.1 * (i % 2 ? 1 : -1)]} castShadow>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={C.crystal[i]}
            emissive={C.crystal[i]}
            emissiveIntensity={0.55}
            roughness={0.25}
            metalness={0.1}
            flatShading
          />
          {i === 0 && <HoverOutline thickness={0.015} />}
        </mesh>
      ))}
    </group>
  );
}

/** Education island: a stack of books with a graduation cap. */
function EducationContent() {
  const books: Array<[number, number, number]> = [
    [0.9, 0.14, 0.1],
    [0.8, 0.12, -0.12],
    [0.85, 0.13, 0.18],
    [0.7, 0.11, -0.05],
  ];
  let y = 0;
  return (
    <group position={[0.05, 0, 0]}>
      {books.map(([w, h, rot], i) => {
        const at = y + h / 2;
        y += h;
        return (
          <mesh key={i} position-y={at} rotation-y={rot} castShadow receiveShadow>
            <boxGeometry args={[w, h, 0.6]} />
            <meshStandardMaterial color={C.book[i]} roughness={0.7} />
            {i === 0 && <HoverOutline thickness={0.012} />}
          </mesh>
        );
      })}
      {/* Graduation cap */}
      <group position-y={y + 0.08} rotation-y={0.5}>
        <mesh castShadow>
          <cylinderGeometry args={[0.17, 0.2, 0.14, 12]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
        <mesh position-y={0.08} castShadow>
          <boxGeometry args={[0.55, 0.025, 0.55]} />
          <meshStandardMaterial color="#141414" roughness={0.6} />
        </mesh>
        <mesh position={[0.22, 0.0, 0.22]}>
          <boxGeometry args={[0.02, 0.18, 0.02]} />
          <meshStandardMaterial color={C.accent} emissive={C.accent} emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Tree pos={[-0.65, 0, -0.35]} scale={0.55} seed={6} />
    </group>
  );
}

/** Work island: a beacon tower with a turning light. */
function WorkContent({ still }: { still: boolean }) {
  const head = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (head.current && !still) head.current.rotation.y += dt * 0.8;
    if (lamp.current) lamp.current.opacity = 0.12 * sceneLight.level;
  });
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position-y={0.22 + i * 0.36} castShadow>
          <cylinderGeometry args={[0.24 - i * 0.025, 0.27 - i * 0.025, 0.36, 10]} />
          <meshStandardMaterial color={i % 2 ? C.accent : "#ece6dc"} roughness={0.6} flatShading />
          {i === 0 && <HoverOutline thickness={0.012} />}
        </mesh>
      ))}
      <group position-y={1.62}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.22, 10]} />
          <meshStandardMaterial color="#ffd9a8" emissive="#ffb067" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
        <mesh position-y={0.2} castShadow>
          <coneGeometry args={[0.26, 0.24, 10]} />
          <meshStandardMaterial color="#2b2a2e" roughness={0.6} />
        </mesh>
        {/* Light beam */}
        <group ref={head}>
          <mesh position-x={1.4} rotation-z={Math.PI / 2}>
            <coneGeometry args={[0.35, 2.8, 16, 1, true]} />
            <meshBasicMaterial
              ref={lamp}
              color="#ffc68a"
              transparent
              opacity={0.12}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      </group>
      <Rock pos={[0.55, 0.04, 0.35]} size={0.16} seed={7} />
      <Tree pos={[-0.55, 0, -0.4]} scale={0.6} seed={7} />
    </group>
  );
}

/** Contact island: a mailbox and a small radio mast with a blinking tip. */
function ContactContent({ still }: { still: boolean }) {
  const tip = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!tip.current) return;
    const blink = still ? 1 : 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 3) > 0.2 ? 1 : 0);
    tip.current.color.set(C.accent).multiplyScalar(blink * (0.3 + 0.7 * sceneLight.level) * 2);
  });
  return (
    <group>
      {/* Mailbox */}
      <group position={[-0.15, 0, 0.15]} rotation-y={0.35}>
        <mesh position-y={0.35} castShadow>
          <boxGeometry args={[0.07, 0.7, 0.07]} />
          <meshStandardMaterial color={C.trunk} roughness={0.9} />
        </mesh>
        <mesh position-y={0.78} castShadow>
          <boxGeometry args={[0.32, 0.22, 0.5]} />
          <meshStandardMaterial color={C.accent} roughness={0.5} />
          <HoverOutline thickness={0.012} />
        </mesh>
        <mesh position-y={0.89} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.5, 12, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={C.accent} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Flag */}
        <mesh position={[0.18, 0.95, -0.05]} castShadow>
          <boxGeometry args={[0.02, 0.2, 0.12]} />
          <meshStandardMaterial color="#ece6dc" />
        </mesh>
      </group>
      {/* Radio mast */}
      <group position={[0.45, 0, -0.3]}>
        <mesh position-y={0.7} castShadow>
          <cylinderGeometry args={[0.02, 0.04, 1.4, 6]} />
          <meshStandardMaterial color="#9a9aa2" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position-y={1.42}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshBasicMaterial ref={tip} color={C.accent} toneMapped={false} />
        </mesh>
      </group>
      <Rock pos={[-0.5, 0.04, -0.4]} size={0.14} seed={8} />
    </group>
  );
}

// ---------- Atmosphere between the islands ----------

/** Glowing dotted paths from the hub to every other island. */
function Paths() {
  const ends = (Object.keys(ISLANDS) as HotspotId[]).filter((id) => id !== "about");
  return (
    <>
      {ends.map((id) => {
        const [x, y, z] = ISLANDS[id].pos;
        const mid: [number, number, number] = [x * 0.5, Math.max(y, 0) + 1.2, z * 0.5];
        return (
          <QuadraticBezierLine
            key={id}
            start={[0, TOP + 0.05, 0]}
            end={[x, y + TOP + 0.05, z]}
            mid={mid}
            color={C.accent}
            lineWidth={1}
            dashed
            dashSize={0.12}
            gapSize={0.18}
            transparent
            opacity={0.45}
          />
        );
      })}
    </>
  );
}

function Debris({ still }: { still: boolean }) {
  return (
    <>
      {DEBRIS.map((d) => (
        <FloatingRock key={d.seed} {...d} still={still} />
      ))}
    </>
  );
}

function FloatingRock({ pos, size, seed, still }: { pos: [number, number, number]; size: number; seed: number; still: boolean }) {
  const geo = useMemo(() => rockGeometry(size, size * 2.2, seed, 0.5), [size, seed]);
  const ref = useBob(seed, 0.15, still);
  return (
    <group position={pos}>
      <group ref={ref}>
        <mesh geometry={geo}>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading />
        </mesh>
        <mesh position-y={0}>
          <cylinderGeometry args={[size, size, 0.08, 7]} />
          <meshStandardMaterial color={C.grassDark} roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

/** A soft sea of clouds far below the islands. */
function Clouds({ still }: { still: boolean }) {
  const puffs = useMemo(() => {
    const rnd = seeded(99);
    return Array.from({ length: 22 }, () => ({
      pos: [(rnd() - 0.5) * 40, -9.5 - rnd() * 2.5, -18 + rnd() * 20] as [number, number, number],
      scale: [1.6 + rnd() * 2.4, 0.6 + rnd() * 0.5, 1.2 + rnd() * 1.6] as [number, number, number],
    }));
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current && !still) group.current.position.x = ((group.current.position.x + dt * 0.08 + 6) % 12) - 6;
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.scale}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={C.cloud} roughness={1} flatShading transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- The whole world ----------

export function Islands({ reducedMotion }: { reducedMotion: boolean }) {
  const still = reducedMotion;
  return (
    <>
      <ClickableIsland id="about" still={still} bob={0.05}>
        <HubContent />
      </ClickableIsland>
      <ClickableIsland id="projects" still={still}>
        <ProjectsContent still={still} />
      </ClickableIsland>
      <ClickableIsland id="skills" still={still}>
        <SkillsContent still={still} />
      </ClickableIsland>
      <ClickableIsland id="education" still={still}>
        <EducationContent />
      </ClickableIsland>
      <ClickableIsland id="work" still={still}>
        <WorkContent still={still} />
      </ClickableIsland>
      <ClickableIsland id="contact" still={still}>
        <ContactContent still={still} />
      </ClickableIsland>
      <Paths />
      <Debris still={still} />
      <Clouds still={still} />
    </>
  );
}
