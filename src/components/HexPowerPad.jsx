import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { formatCompactNumber } from "../formatNumber.js";
import {
  HEX_PAD_NAMES,
  HEX_PAD_TIERS,
  HEX_PAD_LABEL_HEIGHT,
  HEX_PAD_LABEL_DISTANCE_FACTOR,
  HEX_PAD_LABEL_MAX_DISTANCE,
  HEX_PAD_COLOR_OWNED,
  HEX_PAD_COLOR_EQUIPPED,
} from "../hexPowerPads.js";

const barStyle = {
  padding: "2px 10px",
  borderRadius: 4,
  background: "#c8102e",
  border: "1px solid rgba(0,0,0,0.7)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 28,
  whiteSpace: "nowrap",
  textShadow:
    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
};

const winsStyle = {
  color: "#ffd400",
  fontWeight: 700,
  fontSize: 28,
  whiteSpace: "nowrap",
  textShadow:
    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
};

/**
 * One buyable/equippable hex power pad (World.jsx tags the meshes, the pad
 * itself stays part of the world's merged trimesh -- this component only
 * owns the floating price label and the material recolor, it doesn't render
 * the mesh). `state` is "locked" | "owned" | "equipped" (App.jsx owns that,
 * based on Player.jsx's proximity + E-press reports).
 */
export default function HexPowerPad({ mesh, state }) {
  const tier = useMemo(() => {
    const idx = HEX_PAD_NAMES.indexOf(mesh.name);
    return HEX_PAD_TIERS[idx];
  }, [mesh]);

  const labelPos = useMemo(
    () => new THREE.Vector3(mesh.position.x, mesh.position.y + HEX_PAD_LABEL_HEIGHT, mesh.position.z),
    [mesh],
  );

  // Hide the label past HEX_PAD_LABEL_MAX_DISTANCE -- horizontal distance
  // only (matches Player.jsx's own proximity scan), since a full 3D check
  // would blow up if the player's Y ever drifts far from the pad's own
  // (falling, jumping, the tiered pad rows sitting at different heights)
  // even while standing right on top of it. Only updates React state on a
  // threshold crossing, not every frame.
  const { camera } = useThree();
  const [inRange, setInRange] = useState(false);
  const wasInRange = useRef(false);
  useFrame(() => {
    const dx = camera.position.x - labelPos.x;
    const dz = camera.position.z - labelPos.z;
    const near = dx * dx + dz * dz <= HEX_PAD_LABEL_MAX_DISTANCE * HEX_PAD_LABEL_MAX_DISTANCE;
    if (near !== wasInRange.current) {
      wasInRange.current = near;
      setInRange(near);
    }
  });

  // The default "locked" red comes entirely from the authored emissive ring
  // texture -- multiplying that by a color factor can only darken/tint it,
  // never turn it a clean white or green, so owned/equipped instead drop
  // the maps and go flat-colored. Locked is left untouched (original look).
  useEffect(() => {
    if (state === "locked") return;
    const mat = mesh.material;
    const color = state === "equipped" ? HEX_PAD_COLOR_EQUIPPED : HEX_PAD_COLOR_OWNED;
    mat.map = null;
    mat.emissiveMap = null;
    mat.color.set(color);
    mat.emissive.set(color);
    mat.needsUpdate = true;
  }, [mesh, state]);

  if (!tier || !inRange) return null;

  return (
    <Html position={labelPos} center distanceFactor={HEX_PAD_LABEL_DISTANCE_FACTOR}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          pointerEvents: "none",
        }}
      >
        <img src="/action-popup.png" alt="" style={{ width: 28, height: 28 }} />
        <div style={barStyle}>+{formatCompactNumber(tier.power)} Power</div>
        <div style={winsStyle}>{formatCompactNumber(tier.winsRequired)} Wins Required</div>
      </div>
    </Html>
  );
}
