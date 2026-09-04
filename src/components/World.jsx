import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import Wall from "./Wall.jsx";
import { WALL_NAMES, WALL_STRENGTH, WALL_MAX_HEALTH } from "../wallMaterials.js";

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
export default function World({ wallHealth, destroyedWalls, onWallDestroyed }) {
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
    </>
  );
}

useGLTF.preload("/world.glb");
