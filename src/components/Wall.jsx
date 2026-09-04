import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { getCrackTextures } from "../wallCracks.js";
import WallDebris from "./WallDebris.jsx";

const DARK_COLOR = new THREE.Color("#1a1512");
const DARKEN_MAX = 0.4; // cap how far color drifts toward DARK_COLOR so cracks stay legible
const HP_BAR_FADE_IN = 0.15; // damage fraction where cracks first appear

/**
 * One damageable wall: its own removable collider (so it can become
 * passable at 0 HP), a health bar anchored above it, and a damage overlay
 * (darkening + procedurally-cracked decal) driven every frame straight off
 * the shared `wallHealth` Map — no React state on the hot path. At 0 HP the
 * wall is removed entirely (mesh, collider, overlay, health bar all gone).
 */
export default function Wall({
  mesh,
  wallType,
  wallHealth,
  destroyed,
  onDestroyed,
  occludeScene,
  occludeWalls,
}) {
  const barRef = useRef(null);
  const pctRef = useRef(null);
  const overlayRef = useRef(null);
  const notifiedRef = useRef(false);

  // Occlude the health bar against the rest of the level (terrain, crates,
  // trees...) and every *other* still-standing wall -- but NOT this wall's
  // own mesh. The anchor sits at the wall's own center, so raycasting
  // against the full three.js scene (which includes every wall) would have
  // the wall immediately occlude its own bar and hide it permanently.
  // occludeWalls already excludes self and any destroyed walls (World.jsx).
  const occludeTargets = useMemo(
    () => [{ current: occludeScene }, ...occludeWalls.map((w) => ({ current: w }))],
    [occludeScene, occludeWalls],
  );

  const baseColor = useMemo(() => mesh.material.color.clone(), [mesh]);
  const crackTextures = getCrackTextures();

  const overlayGeometry = mesh.geometry;

  const anchorY = useMemo(() => {
    const box = new THREE.Box3().setFromObject(mesh);
    return (box.min.y + box.max.y) / 2;
  }, [mesh]);

  const wallSize = useMemo(() => {
    mesh.geometry.computeBoundingBox();
    const s = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    s.multiply(mesh.scale);
    return [s.x, s.y, s.z];
  }, [mesh]);

  useFrame(() => {
    if (destroyed) return;
    const entry = wallHealth.get(wallType);
    if (!entry) return;
    const frac = THREE.MathUtils.clamp(entry.hp / entry.maxHp, 0, 1);
    const damageFrac = 1 - frac;

    mesh.material.color.copy(baseColor).lerp(DARK_COLOR, damageFrac * DARKEN_MAX);

    const overlay = overlayRef.current;
    if (overlay) {
      if (damageFrac < HP_BAR_FADE_IN) {
        overlay.material.opacity = 0;
      } else {
        const stage = Math.min(
          3,
          Math.floor(((damageFrac - HP_BAR_FADE_IN) / (1 - HP_BAR_FADE_IN)) * 4),
        );
        overlay.material.map = crackTextures[stage];
        overlay.material.needsUpdate = true;
        overlay.material.opacity = Math.min(0.95, 0.35 + damageFrac * 0.65);
      }
    }

    const pct = Math.round(frac * 100);
    if (barRef.current) {
      barRef.current.style.width = `${pct}%`;
      barRef.current.style.background =
        frac > 0.5 ? "#28c76f" : frac > 0.2 ? "#f0a020" : "#ff2d55";
    }
    if (pctRef.current) {
      pctRef.current.textContent = `${pct}%`;
    }

    if (entry.hp <= 0 && !destroyed && !notifiedRef.current) {
      notifiedRef.current = true;
      onDestroyed?.(wallType);
    }
  });

  if (destroyed) {
    return (
      <WallDebris
        position={mesh.position}
        quaternion={mesh.quaternion}
        size={wallSize}
        material={mesh.material}
      />
    );
  }

  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid" friction={1}>
        <primitive object={mesh} />
      </RigidBody>

      <mesh
        ref={overlayRef}
        geometry={overlayGeometry}
        position={mesh.position}
        quaternion={mesh.quaternion}
        scale={[mesh.scale.x * 1.002, mesh.scale.y * 1.002, mesh.scale.z * 1.002]}
        renderOrder={1}
      >
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <Html position={[mesh.position.x, anchorY, mesh.position.z]} occlude={occludeTargets} center>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              width: 60,
              height: 6,
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 3,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              ref={barRef}
              style={{
                width: "100%",
                height: "100%",
                background: "#28c76f",
              }}
            />
          </div>
          <div
            ref={pctRef}
            style={{
              fontSize: 10,
              lineHeight: 1,
              color: "#fff",
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              pointerEvents: "none",
              fontFamily: "monospace",
            }}
          >
            100%
          </div>
        </div>
      </Html>
    </group>
  );
}
