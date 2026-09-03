import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";

/**
 * The game world, exported from World.blend -> public/world.glb.
 * Wrapped in a single fixed trimesh RigidBody so its geometry is solid.
 */
export default function World() {
  const { scene } = useGLTF("/world.glb");

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <RigidBody type="fixed" colliders="trimesh" friction={1}>
      <primitive object={scene} />
    </RigidBody>
  );
}

useGLTF.preload("/world.glb");
