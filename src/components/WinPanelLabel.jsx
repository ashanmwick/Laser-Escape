import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { formatCompactNumber } from "../formatNumber.js";
import { labelBarStyle, labelColumnStyle } from "./labelStyles.js";
import {
  WIN_PANEL_LABEL_HEIGHT,
  WIN_PANEL_LABEL_DISTANCE_FACTOR,
  WIN_PANEL_LABEL_MAX_DISTANCE,
} from "../winPanels.js";

// Same bar as HexPowerPad.jsx's price tag, but 3x the font size and yellow
// instead of white -- the win value is the headline info on this label, so
// it reads at a glance from further away than the other pads' tags.
const winsTextStyle = {
  ...labelBarStyle,
  fontSize: labelBarStyle.fontSize * 3,
  color: "#ffd400",
};

/**
 * Floating "+N Wins" label above one win floor panel (src/winPanels.js),
 * same visual treatment (styling, distance-based scale/cutoff) as
 * HexPowerPad.jsx's price tags and AfkTargetLabel.jsx's multiplier tags.
 * Positioned above the mesh's own world-space bounding-box top-center
 * rather than its origin.
 */
export default function WinPanelLabel({ mesh, wins }) {
  const labelPos = useMemo(() => {
    const box = new THREE.Box3().setFromObject(mesh);
    return new THREE.Vector3(
      (box.min.x + box.max.x) / 2,
      box.max.y + WIN_PANEL_LABEL_HEIGHT,
      (box.min.z + box.max.z) / 2,
    );
  }, [mesh]);

  // Same horizontal-only distance cutoff as HexPowerPad.jsx/AfkTargetLabel.jsx.
  const { camera } = useThree();
  const [inRange, setInRange] = useState(false);
  const wasInRange = useRef(false);
  useFrame(() => {
    const dx = camera.position.x - labelPos.x;
    const dz = camera.position.z - labelPos.z;
    const near = dx * dx + dz * dz <= WIN_PANEL_LABEL_MAX_DISTANCE * WIN_PANEL_LABEL_MAX_DISTANCE;
    if (near !== wasInRange.current) {
      wasInRange.current = near;
      setInRange(near);
    }
  });

  if (!inRange) return null;

  return (
    <Html position={labelPos} center distanceFactor={WIN_PANEL_LABEL_DISTANCE_FACTOR}>
      <div style={labelColumnStyle}>
        <div style={winsTextStyle}>+{formatCompactNumber(wins)} Wins</div>
      </div>
    </Html>
  );
}
