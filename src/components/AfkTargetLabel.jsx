import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { labelBarStyle, labelRequirementStyle, labelColumnStyle } from "./labelStyles.js";
import {
  AFK_AIM_OFFSET,
  AFK_REBIRTH_REQUIRED,
  AFK_POWER_MULTIPLIER,
  AFK_LABEL_HEIGHT,
  AFK_LABEL_DISTANCE_FACTOR,
  AFK_LABEL_MAX_DISTANCE,
} from "../afkTargets.js";

/**
 * Floating "x{multiplier} Power / Rebirth {N} Required" label above one AFK
 * auto-fire target, same visual treatment (styling, distance-based
 * scale/cutoff) as HexPowerPad.jsx's price tags. Positioned at the same
 * bounding-box-top aim point Player.jsx actually fires at (plus a little
 * extra height), not just the mesh's own origin.
 */
export default function AfkTargetLabel({ mesh }) {
  const multiplier = AFK_POWER_MULTIPLIER[mesh.name] ?? 1;
  const rebirthRequired = AFK_REBIRTH_REQUIRED[mesh.name] ?? 0;

  const labelPos = useMemo(() => {
    const box = new THREE.Box3().setFromObject(mesh);
    const offset = AFK_AIM_OFFSET[mesh.name] ?? [0, 0, 0];
    return new THREE.Vector3(
      (box.min.x + box.max.x) / 2 + offset[0],
      box.max.y + offset[1] + AFK_LABEL_HEIGHT,
      (box.min.z + box.max.z) / 2 + offset[2],
    );
  }, [mesh]);

  // Same horizontal-only distance cutoff as HexPowerPad.jsx -- see its
  // comment for why full 3D distance doesn't work here (no ground placed
  // near spawn yet, so the player can free-fall far below any target).
  const { camera } = useThree();
  const [inRange, setInRange] = useState(false);
  const wasInRange = useRef(false);
  useFrame(() => {
    const dx = camera.position.x - labelPos.x;
    const dz = camera.position.z - labelPos.z;
    const near = dx * dx + dz * dz <= AFK_LABEL_MAX_DISTANCE * AFK_LABEL_MAX_DISTANCE;
    if (near !== wasInRange.current) {
      wasInRange.current = near;
      setInRange(near);
    }
  });

  if (!inRange) return null;

  return (
    <Html position={labelPos} center distanceFactor={AFK_LABEL_DISTANCE_FACTOR}>
      <div style={labelColumnStyle}>
        <img src="/action-popup.png" alt="" style={{ width: 28, height: 28 }} />
        <div style={labelBarStyle}>x{multiplier} Power</div>
        <div style={labelRequirementStyle}>Rebirth {rebirthRequired} Required</div>
      </div>
    </Html>
  );
}
