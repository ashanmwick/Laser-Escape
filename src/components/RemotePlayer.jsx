import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  CAPSULE_HALF_HEIGHT,
  MUZZLE_HEIGHT,
  RUN_BOB_AMP,
  lerpAngle,
  cloneCharacterModel,
  computeModelFit,
  collectGaitBones,
  makePoseBone,
  advanceGaitPhase,
  applyGaitPose,
} from "../playerModel.js";

const GEO_UP = new THREE.Vector3(0, 1, 0);
const _beamDir = new THREE.Vector3();

/**
 * Render+animate-only counterpart to Player.jsx for another connected
 * player: no RigidBody/camera/input, just smoothing the position/yaw/gait/
 * beam reported by the server (src/network/NetworkContext.jsx) onto a clone
 * of the same player.glb model.
 */
export default function RemotePlayer({ sessionId, remotePlayersRef }) {
  const gltf = useGLTF("/player.glb");
  const model = useMemo(() => cloneCharacterModel(gltf.scene), [gltf.scene]);

  const rig = useRef(null);
  const inner = useRef(null);
  const beam = useRef(null);
  const poseBone = useRef(() => {}); // rebuilt whenever the model's gait bones change, not per-frame
  const phase = useRef(0);
  const gait = useRef(0);

  const fit = useMemo(() => computeModelFit(model), [model]);

  useEffect(() => {
    const { bones, rest } = collectGaitBones(model);
    poseBone.current = makePoseBone(bones, rest);
  }, [model]);

  // Smoothed toward the last network sample -- exponential damp, not a full
  // snapshot-interpolation buffer. Updates arrive ~15Hz (MOVE_SEND_INTERVAL_MS
  // in NetworkContext.jsx); this is sufficient for a third-person playground,
  // not a competitive shooter.
  const smoothedPos = useRef(new THREE.Vector3());
  const smoothedYaw = useRef(0);
  const initialized = useRef(false);

  useFrame((_, dt) => {
    const p = remotePlayersRef.current.get(sessionId);
    if (!p) return;

    if (!initialized.current) {
      smoothedPos.current.set(p.x, p.y, p.z);
      smoothedYaw.current = p.yaw;
      initialized.current = true;
    } else {
      smoothedPos.current.x = THREE.MathUtils.damp(smoothedPos.current.x, p.x, 15, dt);
      smoothedPos.current.y = THREE.MathUtils.damp(smoothedPos.current.y, p.y, 15, dt);
      smoothedPos.current.z = THREE.MathUtils.damp(smoothedPos.current.z, p.z, 15, dt);
      smoothedYaw.current = lerpAngle(smoothedYaw.current, p.yaw, 1 - Math.pow(0.001, dt));
    }

    if (rig.current) {
      rig.current.position.copy(smoothedPos.current);
      rig.current.rotation.y = smoothedYaw.current;
    }

    const g = advanceGaitPhase(phase, gait, p.speed, dt);
    const sw = applyGaitPose(poseBone.current, phase.current, g);
    if (inner.current) {
      inner.current.position.y = fit.y + Math.abs(sw) * RUN_BOB_AMP * g;
    }

    const mesh = beam.current;
    if (mesh) {
      if (p.firing) {
        const fromX = smoothedPos.current.x;
        const fromY = smoothedPos.current.y - CAPSULE_HALF_HEIGHT + MUZZLE_HEIGHT;
        const fromZ = smoothedPos.current.z;
        const toX = p.beamToX;
        const toY = p.beamToY;
        const toZ = p.beamToZ;
        const len = Math.hypot(toX - fromX, toY - fromY, toZ - fromZ);
        mesh.position.set((fromX + toX) / 2, (fromY + toY) / 2, (fromZ + toZ) / 2);
        _beamDir.set(toX - fromX, toY - fromY, toZ - fromZ).normalize();
        mesh.quaternion.setFromUnitVectors(GEO_UP, _beamDir);
        mesh.scale.set(1, Math.max(len, 0.001), 1);
        mesh.material.opacity = 0.8 + 0.2 * Math.sin(performance.now() * 0.05);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <>
      <group ref={rig}>
        <group ref={inner} scale={fit.scale} position={[0, fit.y, 0]}>
          <primitive object={model} />
        </group>
      </group>

      <mesh ref={beam} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8, 1, true]} />
        <meshBasicMaterial
          color="#ff2d55"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
