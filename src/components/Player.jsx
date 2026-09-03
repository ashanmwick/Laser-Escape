import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import * as THREE from "three";

/**
 * First-person physics player for "Laser Escape".
 *
 * Self-contained: camera rig, capsule physics, WASD movement, grounded jump,
 * and the click-to-fire head laser all live here. The only thing that crosses
 * the component boundary is `onTargetHit(targetId)` — puzzle logic (open door,
 * disable a laser grid, complete the level) stays in the parent game-state
 * manager (a Zustand store is a natural home for it).
 *
 * Targets are any mesh (or group) in the scene tagged with
 * `userData.isTarget = true` (optionally `userData.targetId`). We build a
 * dedicated array from those tags and only raycast against that array — never
 * the whole scene graph. Meshes tagged `userData.isWall` / `userData.isObstacle`
 * are used purely to clamp the length of the visual beam.
 */

const SPEED = 4.5; // m/s horizontal
const JUMP_SPEED = 5.0; // m/s applied to y on jump
const CAPSULE_RADIUS = 0.3;
const CAPSULE_HALF_HEIGHT = 0.6; // cylinder half-height (excludes the two caps)
const HEAD_OFFSET = 0.5; // camera height above the body's translation
const GROUND_RAY_LEN = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + 0.12; // center -> just past the feet
const LASER_RANGE = 60;
const BEAM_MS = 130; // beam fade-out duration

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const GEO_UP = new THREE.Vector3(0, 1, 0); // cylinder's local long axis
const RAY_DOWN = { x: 0, y: -1, z: 0 };

// Manual key map keeps Player provider-free. Swap for drei's
// <KeyboardControls> + useKeyboardControls if you prefer that pattern.
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

export default function Player({ spawnPosition = [0, 2, 0], onTargetHit }) {
  const body = useRef(null); // RapierRigidBody
  const beam = useRef(null); // reusable world-space beam mesh
  const viewmodel = useRef(null); // held laser device, follows the camera

  const { camera, scene } = useThree();
  const { world, rapier } = useRapier();

  const input = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
  });

  // Dedicated interactable arrays — populated from userData tags, not scanned per-ray.
  const targets = useRef([]);
  const walls = useRef([]);

  const beamState = useRef({
    active: false,
    t0: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tmp = useMemo(
    () => ({
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      side: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      origin: new THREE.Vector3(),
    }),
    [],
  );

  // --- build / refresh the interactable arrays from scene tags -------------
  const collect = useCallback(() => {
    const t = [];
    const w = [];
    scene.traverse((o) => {
      if (!o.isMesh && !o.userData?.isTarget) return;
      if (o.userData?.isTarget) t.push(o);
      else if (o.userData?.isWall || o.userData?.isObstacle) w.push(o);
    });
    targets.current = t;
    walls.current = w;
  }, [scene]);

  useEffect(() => {
    collect();
  }, [collect]);

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
    window.addEventListener("blur", clear); // don't leave keys stuck on focus loss
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // --- resolve a raycast hit up to its tagged target ------------------------
  const resolveTarget = (obj) => {
    let o = obj;
    while (o) {
      if (o.userData?.isTarget) return o;
      o = o.parent;
    }
    return null;
  };

  // --- fire the head laser ---------------------------------------------------
  const fireLaser = useCallback(() => {
    // Ray from the camera along its forward vector (pitch included — you can
    // shoot where you look).
    camera.getWorldDirection(tmp.dir);
    raycaster.set(camera.position, tmp.dir);
    raycaster.far = LASER_RANGE;

    // Keep the arrays fresh so doors/targets that spawned or despawned are
    // reflected. Cheap: one scene walk on click, and we still only *raycast*
    // the filtered arrays below.
    collect();

    const tHit = raycaster.intersectObjects(targets.current, true)[0];
    const wHit = raycaster.intersectObjects(walls.current, true)[0];

    let hitTarget = null;
    const to = beamState.current.to;
    if (tHit && (!wHit || tHit.distance <= wHit.distance)) {
      to.copy(tHit.point);
      hitTarget = resolveTarget(tHit.object);
    } else if (wHit) {
      to.copy(wHit.point);
    } else {
      to.copy(camera.position).addScaledVector(tmp.dir, LASER_RANGE);
    }

    // Beam is drawn from a muzzle point offset from the eye (down + right +
    // slightly forward) so it reads as coming from the held device.
    tmp.side.set(1, 0, 0).applyQuaternion(camera.quaternion);
    beamState.current.from
      .copy(camera.position)
      .addScaledVector(tmp.side, 0.14)
      .addScaledVector(WORLD_UP, -0.12)
      .addScaledVector(tmp.dir, 0.15);
    beamState.current.t0 = performance.now();
    beamState.current.active = true;

    if (hitTarget) {
      const id =
        hitTarget.userData.targetId ?? hitTarget.name ?? hitTarget.uuid;
      hitTarget.userData.onHit?.(id); // optional per-target hook
      onTargetHit?.(id); // parent game-state manager
    }
  }, [camera, raycaster, tmp, collect, onTargetHit]);

  // Only fire while the pointer is actually locked; the click that *acquires*
  // the lock (pointerLockElement still null) just locks.
  useEffect(() => {
    const onDown = (e) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement == null) return;
      fireLaser();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [fireLaser]);

  // --- per-frame: camera follow, movement, jump, beam fade -----------------
  useFrame(() => {
    const rb = body.current;
    if (!rb) return;

    // Camera sits at head height, tracking the (invisible) capsule.
    const t = rb.translation();
    camera.position.set(t.x, t.y + HEAD_OFFSET, t.z);

    // Movement basis from camera YAW only — flatten forward onto XZ so looking
    // up/down never tilts the walk direction.
    camera.getWorldDirection(tmp.forward);
    tmp.forward.y = 0;
    if (tmp.forward.lengthSq() < 1e-6) tmp.forward.set(0, 0, -1);
    tmp.forward.normalize();
    tmp.right.crossVectors(tmp.forward, WORLD_UP).normalize(); // forward × up = right

    const i = input.current;
    const mz = (i.forward ? 1 : 0) - (i.back ? 1 : 0);
    const mx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    tmp.wish
      .set(0, 0, 0)
      .addScaledVector(tmp.forward, mz)
      .addScaledVector(tmp.right, mx);
    if (tmp.wish.lengthSq() > 0) tmp.wish.normalize().multiplyScalar(SPEED);

    const v = rb.linvel();
    // Drive x/z, leave y to gravity / jump.
    rb.setLinvel({ x: tmp.wish.x, y: v.y, z: tmp.wish.z }, true);

    // Grounded check: short ray straight down from the body centre, excluding
    // the player's own rigid body.
    tmp.origin.set(t.x, t.y, t.z);
    const ray = new rapier.Ray(tmp.origin, RAY_DOWN);
    const groundHit = world.castRay(
      ray,
      GROUND_RAY_LEN,
      true,
      undefined,
      undefined,
      undefined,
      rb,
    );
    const grounded = groundHit != null;

    // Jump only from the ground and only while not already moving up — no
    // air-jump, no auto-bhop from a held space bar.
    if (i.jump && grounded && v.y <= 0.1) {
      rb.setLinvel({ x: v.x, y: JUMP_SPEED, z: v.z }, true);
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

    // Held device follows the camera. NOTE: this simple follow can clip into
    // near walls. To make it truly clip-proof, render `viewmodel` in a second
    // pass (overlay scene, gl.autoClear = false, depth cleared) — that's the
    // pattern the reference repo uses; kept pragmatic here.
    const vm = viewmodel.current;
    if (vm) {
      vm.position.copy(camera.position);
      vm.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <>
      {/* Yaw/pitch live entirely in PointerLockControls; we never rotate the body. */}
      <PointerLockControls />

      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={spawnPosition}
        enabledRotations={[false, false, false]} // rotation is camera-only
        ccd // don't tunnel through walls at speed
        mass={1}
        gravityScale={1}
        friction={0} // don't snag on walls
        restitution={0}
        linearDamping={0}
        canSleep={false}
      >
        <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      </RigidBody>

      {/* Reused world-space beam — positioned/scaled/faded each shot. */}
      <mesh ref={beam} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6, 1, true]} />
        <meshBasicMaterial
          color="#ff2d55"
          transparent
          opacity={0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Held laser device (viewmodel). The capsule itself renders nothing. */}
      <group ref={viewmodel}>
        <mesh position={[0.14, -0.12, -0.28]}>
          <boxGeometry args={[0.05, 0.05, 0.22]} />
          <meshStandardMaterial color="#1c1c1f" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.14, -0.12, -0.4]}>
          <cylinderGeometry args={[0.014, 0.014, 0.06, 8]} />
          <meshBasicMaterial color="#ff2d55" toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
