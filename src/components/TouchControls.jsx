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

// On-screen twin-stick style controls for touch devices, writing directly
// into the shared `controls` object from src/controls.js (same object
// Player.jsx reads from every frame). Nothing here touches React state so a
// drag/pinch never triggers a re-render.
export default function TouchControls({ controls }) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const stickPointerId = useRef(null);

  const lookRef = useRef(null);
  const lookPointers = useRef(new Map()); // pointerId -> {x, y}
  const pinchDist = useRef(null);

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

  // --- look area: single-finger drag orbits, two-finger pinch zooms -------
  useEffect(() => {
    const el = lookRef.current;
    if (!el) return;

    const twoFingerDist = () => {
      const pts = [...lookPointers.current.values()];
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onDown = (e) => {
      el.setPointerCapture(e.pointerId);
      lookPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pinchDist.current = twoFingerDist();
    };
    const onMove = (e) => {
      const pt = lookPointers.current.get(e.pointerId);
      if (!pt) return;

      if (lookPointers.current.size >= 2) {
        pt.x = e.clientX;
        pt.y = e.clientY;
        const dist = twoFingerDist();
        if (pinchDist.current && dist) {
          controls.camDistTarget = clamp(
            controls.camDistTarget * (pinchDist.current / dist),
            CAM_DIST_MIN,
            CAM_DIST_MAX,
          );
        }
        pinchDist.current = dist;
        return;
      }

      const dx = e.clientX - pt.x;
      const dy = e.clientY - pt.y;
      pt.x = e.clientX;
      pt.y = e.clientY;
      controls.yaw -= dx * MOUSE_SENS;
      controls.pitch = clamp(controls.pitch + dy * MOUSE_SENS, PITCH_MIN, PITCH_MAX);
    };
    const onUp = (e) => {
      lookPointers.current.delete(e.pointerId);
      pinchDist.current = lookPointers.current.size >= 2 ? twoFingerDist() : null;
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

  // --- fire / jump buttons ---------------------------------------------------
  const onFireDown = (e) => {
    e.preventDefault();
    controls.aim.x = 0;
    controls.aim.y = 0;
    controls.firing = true;
  };
  const onFireUp = (e) => {
    e.preventDefault();
    controls.firing = false;
  };
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
      <div className="touch-controls__reticle" aria-hidden="true" />

      <div className="touch-controls__look" ref={lookRef} />

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
        <button
          type="button"
          className="touch-controls__btn touch-controls__btn--fire"
          onPointerDown={onFireDown}
          onPointerUp={onFireUp}
          onPointerCancel={onFireUp}
        >
          Fire
        </button>
      </div>
    </div>
  );
}
