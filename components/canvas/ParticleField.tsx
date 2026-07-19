"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COLORS } from "@/lib/constants";

const COUNT = 900;

function Field() {
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport, pointer } = useThree();

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const palette = [
      new THREE.Color(COLORS.cyan),
      new THREE.Color(COLORS.violet),
      new THREE.Color(COLORS.mint),
    ];
    for (let i = 0; i < COUNT; i++) {
      const r = 6 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
      pos[i * 3 + 2] = r * Math.cos(phi) - 4;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += 0.00065;
    pointsRef.current.rotation.x += 0.00012;
    // gentle mouse-reactive camera parallax
    state.camera.position.x += (pointer.x * 1.4 - state.camera.position.x) * 0.02;
    state.camera.position.y += (pointer.y * 1.0 - state.camera.position.y) * 0.02;
    state.camera.lookAt(0, 0, -4);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Full-viewport, fixed, mouse-reactive particle background.
 * Mount once in the root layout — it persists across route changes.
 */
export default function ParticleField() {
  return (
    <div className="fixed inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} dpr={[1, 1.75]}>
        <Field />
      </Canvas>
    </div>
  );
}
