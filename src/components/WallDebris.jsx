import { useEffect, useMemo, useRef, useState } from "react";
import { RigidBody, interactionGroups } from "@react-three/rapier";
import * as THREE from "three";
import { GROUP_DEBRIS } from "../collisionGroups.js";

const FRAGMENT_COUNT = 22;
const LIFETIME_MS = 6000;
const SIZE_FRACTION = 1 / 5; // each fragment's *average* size is ~1/5 of the wall's own dimensions
const DEBRIS_GROUPS = interactionGroups(GROUP_DEBRIS);

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * One-shot debris burst spawned when a wall is destroyed: a handful of small
 * dynamic-physics chunks (randomly-sized off the wall's own dimensions,
 * textured with the wall's own material, spawned already aligned to the
 * wall's orientation so they read as pieces of it) that pop outward/up from
 * the wall's volume, tumble, and settle on the ground under gravity -- then
 * the whole burst unmounts itself after a few seconds. They're on their own
 * collision group so the player walks straight through them.
 */
export default function WallDebris({ position, quaternion, size, material }) {
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setAlive(false), LIFETIME_MS);
    return () => clearTimeout(t);
  }, []);

  const fragments = useMemo(() => {
    const [w, h, d] = size;
    const fragBase = [
      Math.max(w * SIZE_FRACTION, 0.02),
      Math.max(h * SIZE_FRACTION, 0.02),
      Math.max(d * SIZE_FRACTION, 0.02),
    ];
    const quatArr = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
    const list = [];
    for (let i = 0; i < FRAGMENT_COUNT; i++) {
      const local = new THREE.Vector3(
        randRange(-w / 2, w / 2),
        randRange(-h / 2, h / 2),
        randRange(-d / 2, d / 2),
      ).applyQuaternion(quaternion);
      const impulseDir = new THREE.Vector3(
        randRange(-1, 1),
        randRange(0.5, 1.3),
        randRange(-1, 1),
      ).normalize();
      // Wide, independent-per-axis jitter so pieces genuinely differ in size
      // and proportions (a sliver here, a chunky lump there) rather than all
      // being the same shape scaled up or down together.
      const fragSize = [
        fragBase[0] * randRange(0.35, 1.8),
        fragBase[1] * randRange(0.35, 1.8),
        fragBase[2] * randRange(0.35, 1.8),
      ];
      const avgFrag = (fragSize[0] + fragSize[1] + fragSize[2]) / 3;
      const volume = fragSize[0] * fragSize[1] * fragSize[2];
      list.push({
        key: i,
        pos: [position.x + local.x, position.y + local.y, position.z + local.z],
        // Spawn aligned to the wall's own orientation -- it visually reads
        // as a real piece that just broke off, before physics tumbles it.
        quat: quatArr,
        size: fragSize,
        mass: Math.max(0.01, volume * 8),
        impulse: impulseDir.multiplyScalar(randRange(0.4, 1.2) * avgFrag * 12).toArray(),
        spin: [randRange(-6, 6), randRange(-6, 6), randRange(-6, 6)],
      });
    }
    return list;
    // one-shot burst at spawn time -- deliberately not reactive to further
    // position/quaternion/size/material changes (the wall is already gone).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!alive) return null;

  return (
    <>
      {fragments.map((f) => (
        <DebrisFragment key={f.key} {...f} material={material} />
      ))}
    </>
  );
}

function DebrisFragment({ pos, quat, size, mass, impulse, spin, material }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const rb = bodyRef.current;
    if (!rb) return;
    rb.applyImpulse({ x: impulse[0], y: impulse[1], z: impulse[2] }, true);
    rb.applyTorqueImpulse({ x: spin[0], y: spin[1], z: spin[2] }, true);
    // fires once, right after the body mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RigidBody
      ref={bodyRef}
      position={pos}
      quaternion={quat}
      colliders="cuboid"
      collisionGroups={DEBRIS_GROUPS}
      friction={0.9}
      restitution={0.15}
      linearDamping={0.4}
      angularDamping={0.5}
      mass={mass}
    >
      {/* Same material as the wall it broke off of (baked albedo/normal
          texture included), just re-used on a tiny box -- so fragments read
          as chunks of that material rather than flat-colored gravel. */}
      <mesh castShadow receiveShadow material={material}>
        <boxGeometry args={size} />
      </mesh>
    </RigidBody>
  );
}
