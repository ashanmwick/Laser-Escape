import { useEffect, useRef } from "react";
import {
  CAM_DIST_MIN,
  CAM_DIST_MAX,
  MOUSE_SENS,
  PITCH_MIN,
  PITCH_MAX,
} from "../controls.js";

const JOYSTICK_DEADZONE = 0.12;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// On-screen controls for touch devices, writing directly into the shared
// `controls` object from src/controls.js (same object Player.jsx reads from
// every frame). Nothing here touches React state so a drag/pinch never
// triggers a re-render.
export default function TouchControls({ controls }) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const stickPointerId = useRef(null);

  const surfaceRef = useRef(null);
  const reticleRef = useRef(null);
  const pointers = useRef(new Map()); // pointerId -> {x, y}
  const fireId = useRef(null); // pointerId currently aiming/firing (solo touch)
  const pinchDist = useRef(null); // baseline distance while 2 fingers are down
  const pinchMid = useRef(null); // baseline midpoint while 2 fingers are down

  // --- movement joystick ---------------------------------------------------
  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const radius = () => base.getBoundingClientRect().width / 2;

    const setKnob = (dx, dy) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const onDown = (e) => {
      if (stickPointerId.current !== null) return;
      stickPointerId.current = e.pointerId;
      base.setPointerCapture(e.pointerId);
      update(e);
    };
    const update = (e) => {
      const r = base.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const rad = radius();
      const dist = Math.hypot(dx, dy);
      if (dist > rad) {
        dx = (dx / dist) * rad;
        dy = (dy / dist) * rad;
      }
      setKnob(dx, dy);
      let nx = dx / rad;
      let ny = dy / rad;
      const mag = Math.hypot(nx, ny);
      if (mag < JOYSTICK_DEADZONE) {
        nx = 0;
        ny = 0;
      }
      controls.move.x = nx;
      controls.move.z = -ny; // screen-up (negative y) is forward
    };
    const onMove = (e) => {
      if (e.pointerId !== stickPointerId.current) return;
      update(e);
    };
    const onUp = (e) => {
      if (e.pointerId !== stickPointerId.current) return;
      stickPointerId.current = null;
      setKnob(0, 0);
      controls.move.x = 0;
      controls.move.z = 0;
    };

    base.addEventListener("pointerdown", onDown);
    base.addEventListener("pointermove", onMove);
    base.addEventListener("pointerup", onUp);
    base.addEventListener("pointercancel", onUp);
    return () => {
      base.removeEventListener("pointerdown", onDown);
      base.removeEventListener("pointermove", onMove);
      base.removeEventListener("pointerup", onUp);
      base.removeEventListener("pointercancel", onUp);
    };
  }, [controls]);

  // --- fire/look surface -----------------------------------------------------
  // One finger: aim + fire at the touch point (follows the finger while
  // held), mirroring desktop's hold-left-click-at-cursor.
  // Two fingers: camera orbit (average drag) + pinch zoom (distance delta);
  // firing is suspended while a second finger is down.
  useEffect(() => {
    const el = surfaceRef.current;
    const reticle = reticleRef.current;
    if (!el) return;

    const ndcOf = (x, y) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((x - r.left) / r.width) * 2 - 1,
        y: -((y - r.top) / r.height) * 2 + 1,
      };
    };
    const showReticle = (x, y) => {
      if (!reticle) return;
      reticle.style.transform = `translate(${x}px, ${y}px)`;
      reticle.style.opacity = "1";
    };
    const hideReticle = () => {
      if (reticle) reticle.style.opacity = "0";
    };

    const startFiring = (id, x, y) => {
      fireId.current = id;
      const ndc = ndcOf(x, y);
      controls.aim.x = ndc.x;
      controls.aim.y = ndc.y;
      controls.firing = true;
      showReticle(x, y);
    };
    const stopFiring = () => {
      fireId.current = null;
      controls.firing = false;
      hideReticle();
    };

    const midAndDist = () => {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return null;
      const [a, b] = pts;
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        dist: Math.hypot(a.x - b.x, a.y - b.y),
      };
    };

    const onDown = (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 1) {
        startFiring(e.pointerId, e.clientX, e.clientY);
      } else {
        // second finger arrived: hand off from single-finger firing to
        // two-finger look/zoom.
        if (fireId.current !== null) stopFiring();
        const md = midAndDist();
        pinchMid.current = md.mid;
        pinchDist.current = md.dist;
      }
    };

    const onMove = (e) => {
      const pt = pointers.current.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;

      if (pointers.current.size >= 2) {
        const md = midAndDist();
        if (!md) return;
        if (pinchMid.current) {
          const dx = md.mid.x - pinchMid.current.x;
          const dy = md.mid.y - pinchMid.current.y;
          controls.yaw -= dx * MOUSE_SENS;
          controls.pitch = clamp(controls.pitch + dy * MOUSE_SENS, PITCH_MIN, PITCH_MAX);
        }
        if (pinchDist.current && md.dist) {
          controls.camDistTarget = clamp(
            controls.camDistTarget * (pinchDist.current / md.dist),
            CAM_DIST_MIN,
            CAM_DIST_MAX,
          );
        }
        pinchMid.current = md.mid;
        pinchDist.current = md.dist;
        return;
      }

      if (e.pointerId === fireId.current) {
        const ndc = ndcOf(e.clientX, e.clientY);
        controls.aim.x = ndc.x;
        controls.aim.y = ndc.y;
        showReticle(e.clientX, e.clientY);
      }
    };

    const onUp = (e) => {
      pointers.current.delete(e.pointerId);

      if (e.pointerId === fireId.current) stopFiring();

      if (pointers.current.size >= 2) {
        const md = midAndDist();
        pinchMid.current = md.mid;
        pinchDist.current = md.dist;
      } else if (pointers.current.size === 1) {
        // dropped from two fingers to one: resume firing with the finger
        // that's still down.
        pinchMid.current = null;
        pinchDist.current = null;
        const [[id, pt]] = pointers.current;
        startFiring(id, pt.x, pt.y);
      } else {
        pinchMid.current = null;
        pinchDist.current = null;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [controls]);

  const onJumpDown = (e) => {
    e.preventDefault();
    controls.jump = true;
  };
  const onJumpUp = (e) => {
    e.preventDefault();
    controls.jump = false;
  };

  return (
    <div className="touch-controls">
      <div className="touch-controls__surface" ref={surfaceRef} />
      <div className="touch-controls__reticle" ref={reticleRef} aria-hidden="true" />

      <div className="touch-controls__joystick" ref={baseRef}>
        <div className="touch-controls__knob" ref={knobRef} />
      </div>

      <div className="touch-controls__actions">
        <button
          type="button"
          className="touch-controls__btn touch-controls__btn--jump"
          onPointerDown={onJumpDown}
          onPointerUp={onJumpUp}
          onPointerCancel={onJumpUp}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
