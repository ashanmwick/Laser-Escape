import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import Wall from "./Wall.jsx";
import HexPowerPad from "./HexPowerPad.jsx";
import { WALL_NAMES, WALL_STRENGTH, WALL_MAX_HEALTH } from "../wallMaterials.js";
import { AFK_TARGET_NAMES } from "../afkTargets.js";
import { HEX_PAD_NAMES } from "../hexPowerPads.js";

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

/**
 * The game world, exported from World.blend -> public/world.glb.
 * Everything except the 10 named wall meshes stays merged into one fixed
 * trimesh RigidBody (unchanged, still solid). The walls are detached from
 * that subtree so each can get its own removable collider + damage/health
 * behaviour (see Wall.jsx) -- a merged trimesh can't drop one piece of its
 * geometry independently.
 */
export default function World({
  wallHealth,
  destroyedWalls,
  onWallDestroyed,
  boughtPads,
  equippedPad,
}) {
  const { scene } = useGLTF("/world.glb");

  const walls = useMemo(() => {
    const found = [];
    const toDetach = [];
    scene.traverse((o) => {
      if (o.isMesh && WALL_NAMES.includes(o.name)) toDetach.push(o);
    });
    for (const mesh of toDetach) {
      mesh.updateWorldMatrix(true, false);
      mesh.matrixWorld.decompose(_pos, _quat, _scale);
      mesh.parent.remove(mesh);
      mesh.position.copy(_pos);
      mesh.quaternion.copy(_quat);
      mesh.scale.copy(_scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const wallType = mesh.name;
      const strength = WALL_STRENGTH[wallType];
      mesh.userData = { isWall: true, wallType, strength };
      if (!wallHealth.has(wallType)) {
        wallHealth.set(wallType, { hp: WALL_MAX_HEALTH, maxHp: WALL_MAX_HEALTH });
      }
      found.push({ mesh, wallType, strength });
    }
    return found;
    // Runs once per loaded gltf scene; wallHealth is a stable ref (see App.jsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Tag AFK auto-fire targets (src/afkTargets.js) so Player.jsx's proximity
  // scan can find them. Runs as a useMemo (during render, before any
  // effects) rather than an effect, so the tags are guaranteed to exist by
  // the time Player.jsx's mount effect gathers them.
  useMemo(() => {
    scene.traverse((o) => {
      if (o.isMesh && AFK_TARGET_NAMES.includes(o.name)) {
        o.userData.isAfkTarget = true;
      }
    });
  }, [scene]);

  // Tag + collect hex power pads (src/hexPowerPads.js): tagging (for
  // Player.jsx's proximity scan) happens here in a useMemo for the same
  // reason as AFK targets above; the mesh list is also kept so each pad can
  // get its own <HexPowerPad> (material recolor + floating label) below --
  // the pads themselves stay part of the merged trimesh, unlike walls.
  const hexPads = useMemo(() => {
    const found = [];
    scene.traverse((o) => {
      if (o.isMesh && HEX_PAD_NAMES.includes(o.name)) {
        o.userData.isHexPad = true;
        found.push(o);
      }
    });
    return found;
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={1}>
        <primitive object={scene} />
      </RigidBody>
      {walls.map(({ mesh, wallType }) => (
        <Wall
          key={wallType}
          mesh={mesh}
          wallType={wallType}
          wallHealth={wallHealth}
          destroyed={destroyedWalls.has(wallType)}
          onDestroyed={onWallDestroyed}
          occludeScene={scene}
          occludeWalls={walls
            .filter((w) => w.wallType !== wallType && !destroyedWalls.has(w.wallType))
            .map((w) => w.mesh)}
        />
      ))}
      {hexPads.map((mesh) => (
        <HexPowerPad
          key={mesh.name}
          mesh={mesh}
          state={
            equippedPad === mesh.name
              ? "equipped"
              : boughtPads.has(mesh.name)
                ? "owned"
                : "locked"
          }
        />
      ))}
    </>
  );
}

useGLTF.preload("/world.glb");
