"use client";

import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";

/**
 * Shared post-processing stack. Keep bloom subtle — this is a data
 * dashboard, not a shader demo. Disable on low-tier / reduced-motion
 * devices by conditionally rendering the parent <PostFX/>.
 */
export default function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.55}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        offset={new Vector2(0.0006, 0.0006)}
        blendFunction={BlendFunction.NORMAL}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.25} darkness={0.9} />
    </EffectComposer>
  );
}
