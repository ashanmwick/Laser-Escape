import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import * as THREE from "three";

/**
 * Third-person physics player for "Laser Escape".
 *
 * The visible character is the rigged mesh exported from World.blend
 * (public/player.glb). It is driven by an invisible dynamic capsule:
 * physics moves the capsule, the model is snapped to it each frame and
 * yawed toward the movement direction. An orbit camera follows behind,
 * steered with the mouse while the pointer is locked (click to lock).
 *
 * The only thing that crosses the component boundary is
 * `onTargetHit(targetId)`. Targets are meshes tagged
 * `userData.isTarget = true` (optionally `userData.targetId`); the laser
 * mesh-raycasts only that array, and uses a cheap physics ray for the
 * beam's end point on a miss.
 */

const SPEED = 5;
const JUMP_SPEED = 5.5;
const CAPSULE_RADIUS = 0.3;
const CAPSULE_HALF_HEIGHT = 0.6; // cylinder half-height (~1.8 total)
const FOOT_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // centre -> feet

const MODEL_TARGET_HEIGHT = 1.7; // normalize the glb to this many metres
const MODEL_FACING = 0; // yaw added so the model faces its travel dir

const CAM_DIST = 5;
const CAM_LOOK_HEIGHT = 1.5; // look point above the feet
const CAM_MIN_DIST = 1.0; // don't let wall-collision push closer than this
const MOUSE_SENS = 0.0022;
const PITCH_MIN = -0.6;
const PITCH_MAX = 1.15;

const LASER_RANGE = 80;
const BEAM_MS = 130;
const MUZZLE_HEIGHT = 1.5; // beam origin above the feet

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const GEO_UP = new THREE.Vector3(0, 1, 0);
const RAY_DOWN = { x: 0, y: -1, z: 0 };

const KEYMAP = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
};

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export default function Player({ spawnPosition = [0, 2, 0], onTargetHit }) {
  const body = useRef(null); // RapierRigidBody
  const rig = useRef(null); // group holding the model, snapped to the capsule
  const beam = useRef(null); // reused world-space beam mesh

  const { camera, gl, scene } = useThree();
  const { world, rapier } = useRapier();

  // --- character model ------------------------------------------------------
  // Single instance -> use the loaded scene directly (cloning a SkinnedMesh
  // needs SkeletonUtils and isn't worth it for one player).
  const gltf = useGLTF("/player.glb");
  const model = gltf.scene;
  const { actions, names } = useAnimations(gltf.animations, model);

  const fit = useMemo(() => {
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = MODEL_TARGET_HEIGHT / (size.y || 1);
    const y = -FOOT_OFFSET - box.min.y * s; // lowest point sits at the feet
    return { scale: s, y };
  }, [model]);

  useEffect(() => {
    model.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    if (names.length) actions[names[0]]?.reset().play(); // hold the bind pose
  }, [model, actions, names]);

  // --- input --------------------------------------------------------------
  const input = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
  });
  const yaw = useRef(0);
  const pitch = useRef(0.35);
  const modelYaw = useRef(0);

  const targets = useRef([]);
  const beamState = useRef({
    active: false,
    t0: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
  });
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      cam: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      right: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      origin: new THREE.Vector3(),
    }),
    [],
  );

  // --- keyboard ----------------------------------------------------------------
  useEffect(() => {
    const set = (code, v) => {
      const k = KEYMAP[code];
      if (k) input.current[k] = v;
    };
    const down = (e) => set(e.code, true);
    const up = (e) => set(e.code, false);
    const clear = () => {
      for (const k in input.current) input.current[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // --- pointer lock + mouse look --------------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    const onMove = (e) => {
      if (document.pointerLockElement !== el) return;
      yaw.current -= e.movementX * MOUSE_SENS;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + e.movementY * MOUSE_SENS,
        PITCH_MIN,
        PITCH_MAX,
      );
    };
    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
    };
  }, [gl]);

  // --- target array from userData tags ------------------------------------
  const collect = useCallback(() => {
    const t = [];
    scene.traverse((o) => {
      if (o.userData?.isTarget) t.push(o);
    });
    targets.current = t;
  }, [scene]);
  useEffect(() => {
    collect();
  }, [collect]);

  const resolveTarget = (obj) => {
    let o = obj;
    while (o) {
      if (o.userData?.isTarget) return o;
      o = o.parent;
    }
    return null;
  };

  // --- fire the laser ----------------------------------------------------
  const fireLaser = useCallback(() => {
    const rb = body.current;
    if (!rb) return;

    camera.getWorldDirection(tmp.dir);
    raycaster.set(camera.position, tmp.dir);
    raycaster.far = LASER_RANGE;
    collect();

    // Precise mesh ray against the small tagged array only.
    const tHit = raycaster.intersectObjects(targets.current, true)[0];

    // Cheap physics ray for where the beam stops on a miss / against the world.
    const rray = new rapier.Ray(camera.position, tmp.dir);
    const wHit = world.castRay(
      rray,
      LASER_RANGE,
      true,
      undefined,
      undefined,
      undefined,
      rb,
    );
    const wallToi = wHit ? wHit.timeOfImpact : Infinity;

    const to = beamState.current.to;
    let hitTarget = null;
    if (tHit && tHit.distance <= wallToi) {
      to.copy(tHit.point);
      hitTarget = resolveTarget(tHit.object);
    } else if (wHit) {
      to.copy(camera.position).addScaledVector(tmp.dir, wallToi);
    } else {
      to.copy(camera.position).addScaledVector(tmp.dir, LASER_RANGE);
    }

    // Beam starts at the character's muzzle, not the camera.
    const t = rb.translation();
    beamState.current.from.set(t.x, t.y - CAPSULE_HALF_HEIGHT + MUZZLE_HEIGHT, t.z);
    beamState.current.t0 = performance.now();
    beamState.current.active = true;

    if (hitTarget) {
      const id =
        hitTarget.userData.targetId ?? hitTarget.name ?? hitTarget.uuid;
      hitTarget.userData.onHit?.(id);
      onTargetHit?.(id);
    }
  }, [camera, raycaster, tmp, world, rapier, collect, onTargetHit]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== gl.domElement) return;
      fireLaser();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [fireLaser, gl]);

  // --- per-frame ---------------------------------------------------------
  useFrame((_, dt) => {
    const rb = body.current;
    if (!rb) return;
    const step = Math.min(dt, 0.05);

    const t = rb.translation();
    tmp.pos.set(t.x, t.y, t.z);

    // Camera basis: forward is where the camera looks, flattened to XZ.
    const cy = yaw.current;
    const cp = pitch.current;
    tmp.offset
      .set(
        Math.sin(cy) * Math.cos(cp),
        Math.sin(cp),
        Math.cos(cy) * Math.cos(cp),
      )
      .multiplyScalar(CAM_DIST);
    tmp.look.copy(tmp.pos).addScaledVector(WORLD_UP, CAM_LOOK_HEIGHT - FOOT_OFFSET);
    tmp.cam.copy(tmp.look).add(tmp.offset);

    // Pull the camera in if a wall is between it and the player.
    tmp.dir.copy(tmp.cam).sub(tmp.look);
    const want = tmp.dir.length();
    tmp.dir.normalize();
    const camRay = new rapier.Ray(tmp.look, tmp.dir);
    const camHit = world.castRay(
      camRay,
      want,
      true,
      undefined,
      undefined,
      undefined,
      rb,
    );
    const dist = camHit
      ? Math.max(CAM_MIN_DIST, camHit.timeOfImpact - 0.15)
      : want;
    camera.position.copy(tmp.look).addScaledVector(tmp.dir, dist);
    camera.lookAt(tmp.look);

    // Movement direction from camera yaw only.
    tmp.fwd.copy(tmp.look).sub(tmp.cam);
    tmp.fwd.y = 0;
    if (tmp.fwd.lengthSq() < 1e-6) tmp.fwd.set(0, 0, -1);
    tmp.fwd.normalize();
    tmp.right.crossVectors(tmp.fwd, WORLD_UP).normalize();

    const i = input.current;
    const mz = (i.forward ? 1 : 0) - (i.back ? 1 : 0);
    const mx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    tmp.wish
      .set(0, 0, 0)
      .addScaledVector(tmp.fwd, mz)
      .addScaledVector(tmp.right, mx);
    const moving = tmp.wish.lengthSq() > 0;
    if (moving) tmp.wish.normalize().multiplyScalar(SPEED);

    const v = rb.linvel();
    rb.setLinvel({ x: tmp.wish.x, y: v.y, z: tmp.wish.z }, true);

    // Grounded check + jump.
    tmp.origin.set(t.x, t.y, t.z);
    const groundHit = world.castRay(
      new rapier.Ray(tmp.origin, RAY_DOWN),
      FOOT_OFFSET + 0.15,
      true,
      undefined,
      undefined,
      undefined,
      rb,
    );
    const grounded = groundHit != null;
    if (i.jump && grounded && v.y <= 0.1) {
      rb.setLinvel({ x: v.x, y: JUMP_SPEED, z: v.z }, true);
    }

    // Snap the model to the capsule; yaw it toward travel direction.
    if (rig.current) {
      rig.current.position.copy(tmp.pos);
      if (moving) {
        const target = Math.atan2(tmp.wish.x, tmp.wish.z) + MODEL_FACING;
        modelYaw.current = lerpAngle(modelYaw.current, target, 1 - Math.pow(0.001, step));
      }
      rig.current.rotation.y = modelYaw.current;
    }

    // Beam fade.
    const bs = beamState.current;
    const mesh = beam.current;
    if (mesh) {
      if (!bs.active) {
        mesh.visible = false;
      } else {
        const age = performance.now() - bs.t0;
        if (age >= BEAM_MS) {
          bs.active = false;
          mesh.visible = false;
        } else {
          const len = bs.from.distanceTo(bs.to);
          tmp.mid.copy(bs.from).add(bs.to).multiplyScalar(0.5);
          tmp.dir.copy(bs.to).sub(bs.from).normalize();
          mesh.position.copy(tmp.mid);
          mesh.quaternion.setFromUnitVectors(GEO_UP, tmp.dir);
          mesh.scale.set(1, len, 1);
          mesh.material.opacity = 1 - age / BEAM_MS;
          mesh.visible = true;
        }
      }
    }
  });

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={spawnPosition}
        enabledRotations={[false, false, false]}
        ccd
        mass={1}
        friction={0}
        restitution={0}
        linearDamping={0}
        canSleep={false}
      >
        <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      </RigidBody>

      {/* visible character, snapped to the capsule every frame */}
      <group ref={rig}>
        <group scale={fit.scale} position={[0, fit.y, 0]}>
          <primitive object={model} />
        </group>
      </group>

      {/* reused world-space laser beam */}
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

useGLTF.preload("/player.glb");
