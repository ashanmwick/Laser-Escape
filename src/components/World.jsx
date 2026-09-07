import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { KTX2Loader } from "three-stdlib";
import * as THREE from "three";
import Wall from "./Wall.jsx";
import HexPowerPad from "./HexPowerPad.jsx";
import AfkTargetLabel from "./AfkTargetLabel.jsx";
import WinPanelLabel from "./WinPanelLabel.jsx";
import { WALL_NAMES, WALL_STRENGTH, WALL_MAX_HEALTH } from "../wallMaterials.js";
import { AFK_TARGET_NAMES } from "../afkTargets.js";
import { HEX_PAD_NAMES } from "../hexPowerPads.js";
import { WIN_PANEL_NAMES, WIN_PANEL_WINS } from "../winPanels.js";
import { flattenMaterial } from "../flattenMaterial.js";

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
// Below this local bounding-box size (largest dimension, in world units),
// a mesh is decorative enough that its own shadow isn't worth the shadow-
// pass draw call -- walls and other structural geometry are 4+ units,
// small props (crates, grass blocks, tree knots) are ~1 unit or less.
const SHADOW_CASTER_MIN_SIZE = 2;

const _size = new THREE.Vector3();

export default function World({
  wallHealth,
  destroyedWalls,
  onWallDestroyed,
  boughtPads,
  equippedPad,
  debrisCount,
}) {
  const { gl } = useThree();
  // world.glb's textures are KTX2/Basis (see scripts/compress-world.mjs) --
  // drei's useGLTF wires Draco/meshopt by default but not KTX2, so it needs
  // an explicit loader here. detectSupport is synchronous (just reads WebGL
  // extension flags); the transcoder WASM itself loads lazily on first use.
  const extendLoader = useMemo(() => {
    const ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(gl);
    return (loader) => loader.setKTX2Loader(ktx2Loader);
  }, [gl]);
  const { scene } = useGLTF("/world.glb", true, true, extendLoader);

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

  // Tag + collect AFK auto-fire targets (src/afkTargets.js): tagging is for
  // Player.jsx's proximity scan (runs as a useMemo, during render, before
  // any effects, so the tags are guaranteed to exist by the time Player.jsx's
  // mount effect gathers them); the mesh list is also kept so each target
  // can get its own <AfkTargetLabel> (floating power/rebirth info) below.
  const afkTargetMeshes = useMemo(() => {
    const found = [];
    scene.traverse((o) => {
      if (o.isMesh && AFK_TARGET_NAMES.includes(o.name)) {
        o.userData.isAfkTarget = true;
        found.push(o);
      }
    });
    return found;
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
        // The 15 pads are linked duplicates in the Blender export -- they
        // all share one THREE.Material instance by default, so recoloring
        // one in HexPowerPad.jsx would recolor all of them. Give each its
        // own clone before anything reads or mutates it.
        o.material = o.material.clone();
        o.userData.isHexPad = true;
        found.push(o);
      }
    });
    return found;
  }, [scene]);

  // Tag + collect win floor panels (src/winPanels.js): tagging is for
  // Player.jsx's per-frame proximity/"collision" check, same as AFK targets
  // and hex pads above; the mesh list also drives each panel's own
  // <WinPanelLabel> (floating Wins-value tag) below.
  const winPanels = useMemo(() => {
    const found = [];
    scene.traverse((o) => {
      const idx = WIN_PANEL_NAMES.indexOf(o.name);
      if (o.isMesh && idx !== -1) {
        o.userData.isWinPanel = true;
        o.userData.winPanelWins = WIN_PANEL_WINS[idx];
        found.push(o);
      }
    });
    return found;
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        // Only structurally-significant meshes cast a shadow -- receiving
        // stays universal since that side of the shadow pass is cheap, and
        // small props still want ground contact shadows falling on them.
        o.geometry.computeBoundingBox();
        o.geometry.boundingBox.getSize(_size).multiply(o.scale);
        o.castShadow = Math.max(_size.x, _size.y, _size.z) >= SHADOW_CASTER_MIN_SIZE;
        o.receiveShadow = true;
        flattenMaterial(o.material);
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
          debrisCount={debrisCount}
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
      {afkTargetMeshes.map((mesh) => (
        <AfkTargetLabel key={mesh.name} mesh={mesh} />
      ))}
      {winPanels.map((mesh) => (
        <WinPanelLabel key={mesh.name} mesh={mesh} wins={mesh.userData.winPanelWins} />
      ))}
    </>
  );
}

// Not preloaded at module scope (unlike player.glb): world.glb's textures
// are KTX2, which needs a renderer-configured KTX2Loader (see extendLoader
// above) -- a bare useGLTF.preload("/world.glb") here would race the
// component's properly-configured load under the same suspense cache key,
// and if it won, GLTFLoader would hit the KTX2 texture extension with no
// KTX2Loader registered and throw.
