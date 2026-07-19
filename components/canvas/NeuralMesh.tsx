"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Icosahedron } from "@react-three/drei";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";

/**
 * Ambient rotating wireframe used as hero decoration behind the
 * Overview page's energy-flow graph. Purely atmospheric.
 */
export default function NeuralMesh({ radius = 2.2 }: { radius?: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.05;
    ref.current.rotation.y += delta * 0.08;
  });

  return (
    <Icosahedron ref={ref} args={[radius, 2]}>
      <meshBasicMaterial color={COLORS.violet} wireframe transparent opacity={0.18} />
    </Icosahedron>
  );
}
