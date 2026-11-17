"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

// ============================================
// SECTION 5: PROJECT VISUALS
// One small animated scene per project. Each
// says what the project does, without implying
// features that aren't confirmed.
// ============================================
const ORANGE = "#ff642e";
const WARM = "#ff9a62";

type SceneProps = { still: boolean };

/** Shared lighting for every vignette. */
export function VignetteLights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#9fb1d6" />
      <directionalLight position={[2.5, 3, 3]} intensity={2.2} color="#ffd9bf" />
      <pointLight position={[-2.5, -0.5, 1.5]} intensity={6} color={ORANGE} distance={8} />
      <directionalLight position={[-1, 2, -3]} intensity={1.2} color="#8fb0ff" />
    </>
  );
}

// ---------- AgroGuard: a leaf being scanned ----------

export function LeafScan({ still }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const spots = useRef<THREE.Group>(null);

  const leaf = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -1.15);
    s.bezierCurveTo(0.75, -0.75, 0.85, 0.45, 0, 1.2);
    s.bezierCurveTo(-0.85, 0.45, -0.75, -0.75, 0, -1.15);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2, curveSegments: 32 });
    // Gentle cup so it reads as a real leaf, not a flat cut-out.
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setZ(i, pos.getZ(i) + x * x * 0.35);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  // Midrib and side veins as thin lines.
  const veins = useMemo(() => {
    const pts: THREE.Vector3[] = [new THREE.Vector3(0, -1.15, 0.05), new THREE.Vector3(0, 1.15, 0.05)];
    for (let i = 0; i < 6; i++) {
      const y = -0.8 + i * 0.32;
      for (const side of [-1, 1]) {
        pts.push(new THREE.Vector3(0, y, 0.05), new THREE.Vector3(side * 0.5 * (1 - Math.abs(y) * 0.45), y + 0.28, 0.05 + 0.08));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    if (group.current) group.current.rotation.y = Math.sin(t * 0.5) * 0.45;
    if (ring.current) ring.current.position.y = Math.sin(t * 1.1) * 1.05;
    // Spots light up as the scan line passes them.
    if (spots.current && ring.current) {
      const ry = ring.current.position.y;
      spots.current.children.forEach((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const hit = Math.max(0, 1 - Math.abs(c.position.y - ry) * 5);
        m.emissiveIntensity = 0.15 + hit * 2.5;
      });
    }
  });

  return (
    <group ref={group} scale={1.05}>
      <mesh geometry={leaf}>
        <meshPhysicalMaterial color="#3d8a45" roughness={0.45} clearcoat={0.4} sheen={0.6} sheenColor="#b6f0a0" side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={veins}>
        <lineBasicMaterial color="#a9dd8f" transparent opacity={0.55} />
      </lineSegments>
      {/* Brown blight spots: what the model looks for */}
      <group ref={spots}>
        {[
          [0.22, 0.35],
          [-0.28, -0.1],
          [0.15, -0.5],
          [-0.12, 0.62],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.07 + x * x * 0.35]}>
            <circleGeometry args={[0.06 + (i % 2) * 0.03, 16]} />
            <meshStandardMaterial color="#7a4a1c" emissive={ORANGE} emissiveIntensity={0.15} />
          </mesh>
        ))}
      </group>
      {/* Scan ring and plane */}
      <group ref={ring} position={[0, 0.5, 0]}>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.95, 0.008, 8, 96]} />
          <meshBasicMaterial color={ORANGE} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.95, 48]} />
          <meshBasicMaterial color={ORANGE} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Neoth Culture: a tee on a hanger ----------

export function HangingTee({ still }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const tee = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.32, 0.72);
    s.quadraticCurveTo(0, 0.6, 0.32, 0.72); // neckline
    s.lineTo(0.92, 0.48); // shoulder
    s.lineTo(1.08, 0.05); // sleeve end
    s.lineTo(0.66, -0.06);
    s.lineTo(0.62, -1.05); // hem
    s.quadraticCurveTo(0, -1.12, -0.62, -1.05);
    s.lineTo(-0.66, -0.06);
    s.lineTo(-1.08, 0.05);
    s.lineTo(-0.92, 0.48);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4, curveSegments: 24 });
  }, []);

  useFrame(({ clock }) => {
    if (still || !group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    group.current.rotation.y = Math.sin(t * 0.45) * 0.5;
  });

  return (
    <group position={[0, 0.85, 0]}>
      <group ref={group}>
        {/* Hook and hanger bar */}
        <mesh position={[0, 0.3, 0]} rotation-z={-Math.PI * 0.2}>
          <torusGeometry args={[0.09, 0.014, 8, 24, Math.PI * 1.4]} />
          <meshStandardMaterial color="#c9c4bb" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.2, 8]} />
          <meshStandardMaterial color="#c9c4bb" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.025, 1.7, 4, 12]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.5} />
        </mesh>
        <mesh geometry={tee} position={[0, -0.75, -0.05]}>
          <meshPhysicalMaterial color="#141416" roughness={0.9} sheen={1} sheenColor="#ffb08f" sheenRoughness={0.5} />
        </mesh>
        {/* Small chest mark in the accent colour */}
        <mesh position={[0, -0.45, 0.06]}>
          <planeGeometry args={[0.32, 0.06]} />
          <meshBasicMaterial color={ORANGE} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Finance Literacy: rate bars and a coin ----------

export function RatesAndCoin({ still }: SceneProps) {
  const bars = useRef<THREE.Group>(null);
  const coin = useRef<THREE.Group>(null);
  const heights = [0.55, 0.9, 0.7, 1.25, 1.05];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coin.current && !still) {
      coin.current.rotation.y = t * 1.2;
      coin.current.position.y = 1.15 + Math.sin(t * 1.6) * 0.08;
    }
    if (!bars.current) return;
    bars.current.children.forEach((b, i) => {
      // Bars rise one after another, hold, then settle and repeat.
      const cycle = still ? 1 : (t * 0.35 - i * 0.08) % 1;
      const k = still ? 1 : Math.min(1, Math.max(0.05, cycle < 0.7 ? cycle / 0.35 : 1 - (cycle - 0.7) / 0.3));
      b.scale.y = THREE.MathUtils.lerp(b.scale.y, k, 0.15);
    });
  });

  return (
    <group position={[0, -0.75, 0]} rotation-y={-0.4}>
      <group ref={bars}>
        {heights.map((h, i) => (
          <group key={i} position={[-0.9 + i * 0.45, 0, 0]}>
            <RoundedBox args={[0.3, h, 0.3]} radius={0.03} position={[0, h / 2, 0]}>
              <meshStandardMaterial color={i === 3 ? ORANGE : "#2a2d33"} metalness={0.3} roughness={0.4} emissive={i === 3 ? ORANGE : "#000000"} emissiveIntensity={i === 3 ? 0.4 : 0} />
            </RoundedBox>
          </group>
        ))}
      </group>
      <mesh position={[0, -0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.6, 0.9]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.8} />
      </mesh>
      {/* Coin */}
      <group ref={coin} position={[0.95, 1.15, 0.2]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.32, 0.32, 0.06, 48]} />
          <meshStandardMaterial color="#e8b04a" metalness={0.55} roughness={0.32} emissive="#5a3a08" emissiveIntensity={0.35} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.25, 0.012, 6, 48]} />
          <meshStandardMaterial color="#f6cf72" metalness={0.5} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Inventory: boxes stacking into shelves ----------

export function StackingBoxes({ still }: SceneProps) {
  const boxes = useRef<THREE.Group>(null);
  const slots = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: (i % 3) * 0.62 - 0.62,
        y: Math.floor(i / 3) * 0.52 + 0.25,
        tint: ["#b07a48", "#c08a55", "#9c6b3f"][i % 3],
      })),
    [],
  );

  useFrame(({ clock }) => {
    if (!boxes.current) return;
    const t = clock.elapsedTime;
    const cycle = still ? 9 : (t * 1.4) % 13; // 9 boxes in, hold, clear
    boxes.current.children.forEach((b, i) => {
      const s = slots[i];
      const p = cycle > 11.5 ? 0 : Math.min(1, Math.max(0, cycle - i));
      const eased = 1 - Math.pow(1 - p, 3);
      b.position.y = s.y + (1 - eased) * 1.6;
      b.scale.setScalar(Math.max(0.0001, eased));
    });
  });

  return (
    <group position={[0, -0.95, 0]} rotation-y={0.45} rotation-x={0.05}>
      {/* Shelf frame */}
      {[0, 0.52, 1.04, 1.56].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2, 0.03, 0.62]} />
          <meshStandardMaterial color="#3a3e44" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x, 0.78, 0]}>
          <boxGeometry args={[0.03, 1.6, 0.62]} />
          <meshStandardMaterial color="#3a3e44" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <group ref={boxes}>
        {slots.map((s, i) => (
          <group key={i} position={[s.x, s.y, 0]}>
            <RoundedBox args={[0.5, 0.42, 0.46]} radius={0.025}>
              <meshStandardMaterial color={s.tint} roughness={0.85} />
            </RoundedBox>
            {/* Label */}
            <mesh position={[0, 0.02, 0.232]}>
              <planeGeometry args={[0.22, 0.1]} />
              <meshBasicMaterial color={i === 4 ? WARM : "#efe8dc"} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------- Driving school: a car looping along a road ----------

export function DrivingCar({ still }: SceneProps) {
  const car = useRef<THREE.Group>(null);
  const dashes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    if (car.current) car.current.position.y = 0.33 + Math.abs(Math.sin(t * 9)) * 0.012;
    if (dashes.current) dashes.current.position.x = -((t * 1.2) % 0.6);
  });
  return (
    <group position={[0, -0.75, 0]} rotation={[0.18, -0.55, 0]}>
      {/* Road */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4.2, 1.3]} />
        <meshStandardMaterial color="#26282c" roughness={0.9} />
      </mesh>
      <group ref={dashes}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-2.1 + i * 0.6, 0.002, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.3, 0.05]} />
            <meshBasicMaterial color="#f2e6c9" />
          </mesh>
        ))}
      </group>
      {/* Car */}
      <group ref={car} position={[0, 0.33, 0.28]}>
        <RoundedBox args={[1.25, 0.3, 0.6]} radius={0.08}>
          <meshStandardMaterial color={ORANGE} metalness={0.3} roughness={0.35} />
        </RoundedBox>
        <RoundedBox args={[0.7, 0.26, 0.54]} radius={0.08} position={[-0.08, 0.24, 0]}>
          <meshStandardMaterial color="#1c2230" metalness={0.4} roughness={0.15} />
        </RoundedBox>
        {/* "L" learner plate */}
        <mesh position={[0.63, 0.02, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[0.2, 0.14]} />
          <meshBasicMaterial color="#f5d742" />
        </mesh>
        {[[-0.38, 0.31], [0.38, 0.31], [-0.38, -0.31], [0.38, -0.31]].map(([x, z], i) => (
          <mesh key={i} position={[x, -0.16, z]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.14, 0.14, 0.1, 20]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
        ))}
        {/* Headlights */}
        {[-0.18, 0.18].map((z) => (
          <mesh key={z} position={[0.63, 0.04, z]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#fff2d6" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Gold-loan ledger: gold bars weighed on a scale ----------

export function GoldScale({ still }: SceneProps) {
  const beam = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const a = still ? 0.08 : Math.sin(clock.elapsedTime * 0.9) * 0.12;
    if (beam.current) beam.current.rotation.z = a;
    // Pans hang straight down whatever the beam does.
    if (left.current) left.current.position.y = -Math.sin(a) * 0.9;
    if (right.current) right.current.position.y = Math.sin(a) * 0.9;
  });
  const gold = (
    <meshStandardMaterial color="#e8b04a" metalness={0.7} roughness={0.28} emissive="#5a3a08" emissiveIntensity={0.3} />
  );
  return (
    <group position={[0, -0.95, 0]} rotation-y={0.35}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.08, 32]} />
        <meshStandardMaterial color="#2a2d33" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.4, 12]} />
        <meshStandardMaterial color="#c9a46a" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={beam} position={[0, 1.45, 0]}>
        <mesh>
          <boxGeometry args={[1.85, 0.05, 0.05]} />
          <meshStandardMaterial color="#c9a46a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {[[-0.9, left], [0.9, right]].map(([x, ref], i) => (
        <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 0, 0]}>
          <group position={[0, 0.95, 0]}>
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.5, 4]} />
              <meshStandardMaterial color="#c9a46a" />
            </mesh>
            <mesh>
              <cylinderGeometry args={[0.36, 0.3, 0.05, 32]} />
              <meshStandardMaterial color="#c9a46a" metalness={0.7} roughness={0.3} />
            </mesh>
            {i === 0 ? (
              <>
                <mesh position={[0, 0.08, 0]} rotation-y={0.3}>
                  <boxGeometry args={[0.36, 0.1, 0.16]} />
                  {gold}
                </mesh>
                <mesh position={[0.02, 0.18, 0]} rotation-y={-0.2}>
                  <boxGeometry args={[0.3, 0.09, 0.14]} />
                  {gold}
                </mesh>
              </>
            ) : (
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.1, 6]} />
                <meshStandardMaterial color="#8e8e96" metalness={0.8} roughness={0.3} />
              </mesh>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}

// ---------- POS hardware tool: a receipt printer feeding paper ----------

export function ReceiptPrinter({ still }: SceneProps) {
  const paper = useRef<THREE.Mesh>(null);
  const led = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = still ? 2 : clock.elapsedTime;
    const p = (t * 0.35) % 1; // 0 → 1: paper comes out, then resets
    if (paper.current) {
      paper.current.scale.y = Math.max(0.001, p);
      paper.current.position.y = 0.62 + (p * 0.9) / 2;
    }
    if (led.current) led.current.color.set(Math.sin(t * 6) > 0 ? "#57e389" : "#1d5c35");
  });
  return (
    <group position={[0, -0.85, 0]} rotation={[0.12, -0.6, 0]}>
      <RoundedBox args={[1.1, 0.55, 0.9]} radius={0.08} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#26282c" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* Paper slot */}
      <mesh position={[0, 0.58, 0.12]}>
        <boxGeometry args={[0.7, 0.02, 0.04]} />
        <meshStandardMaterial color="#0d0d0f" />
      </mesh>
      {/* Receipt */}
      <mesh ref={paper} position={[0, 0.62, 0.12]} rotation-x={-0.25}>
        <boxGeometry args={[0.62, 0.9, 0.004]} />
        <meshStandardMaterial color="#f3efe6" roughness={0.9} />
      </mesh>
      {/* Status light and button */}
      <mesh position={[0.4, 0.4, 0.455]}>
        <circleGeometry args={[0.03, 16]} />
        <meshBasicMaterial ref={led} color="#57e389" toneMapped={false} />
      </mesh>
      <mesh position={[0.28, 0.4, 0.455]}>
        <circleGeometry args={[0.04, 16]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      {/* Cash drawer under it */}
      <RoundedBox args={[1.5, 0.26, 1.1]} radius={0.04} position={[0, -0.13, 0.05]}>
        <meshStandardMaterial color="#1a1b1e" roughness={0.6} metalness={0.3} />
      </RoundedBox>
    </group>
  );
}

// ---------- Network simulator: a rack with blinking ports and cables ----------

export function NetworkRack({ still }: SceneProps) {
  const leds = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!leds.current) return;
    const t = still ? 0 : clock.elapsedTime;
    leds.current.children.forEach((m, i) => {
      const on = Math.sin(t * (3 + (i % 5)) + i * 1.7) > 0.1;
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(on ? (i % 4 === 0 ? ORANGE : "#57e389") : "#1b2a22");
    });
  });
  const units = [0.2, 0.55, 0.9, 1.25];
  return (
    <group position={[0, -1.0, 0]} rotation-y={-0.45}>
      {/* Rack frame */}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.8, 0]}>
          <boxGeometry args={[0.06, 1.6, 0.6]} />
          <meshStandardMaterial color="#3a3e44" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {units.map((y, u) => (
        <RoundedBox key={u} args={[1.34, 0.26, 0.55]} radius={0.02} position={[0, y, 0]}>
          <meshStandardMaterial color={u === 2 ? "#3b1d12" : "#22252a"} metalness={0.4} roughness={0.45} />
        </RoundedBox>
      ))}
      <group ref={leds}>
        {units.flatMap((y, u) =>
          Array.from({ length: 8 }, (_, i) => (
            <mesh key={`${u}-${i}`} position={[-0.5 + i * 0.13, y + 0.06, 0.28]}>
              <planeGeometry args={[0.035, 0.035]} />
              <meshBasicMaterial color="#57e389" toneMapped={false} />
            </mesh>
          )),
        )}
      </group>
      {/* Patch cables */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.3 + i * 0.3, 0.72, 0.31]}>
          <torusGeometry args={[0.18, 0.012, 6, 24, Math.PI]} />
          <meshStandardMaterial color={["#3d7bd9", ORANGE, "#e9e4dc"][i]} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The visuals a project can use. Pick one per project in src/data/projects.ts (`visual`). */
export const SCENES = {
  leaf: LeafScan,
  tee: HangingTee,
  chart: RatesAndCoin,
  boxes: StackingBoxes,
  car: DrivingCar,
  gold: GoldScale,
  printer: ReceiptPrinter,
  rack: NetworkRack,
} as const;
