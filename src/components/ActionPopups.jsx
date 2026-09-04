import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Fire-and-forget "Action" feedback: every time the player performs an
 * Action (see Player.jsx's action-tracking + usePlayerProgression's
 * registerAction), one of these pops up near screen center and flies
 * toward the HUD's Power stat, fading out before it visually arrives.
 *
 * Fully imperative DOM (like TouchControls' reticle) rather than React
 * state -- nothing else needs to read "how many popups are active", so
 * routing this through useState/rerenders would be pure overhead on the
 * Action hot path.
 */

const ICON_SRC = "/action-popup.png";
const ICON_SIZE_PX = 48;
const SPAWN_JITTER_RADIUS_PX = 110;
// 150ms pop-in (to 2x size) + 2000ms hold + 500ms fly-out/fade. The
// keyframe % breakpoints in styles.css are hand-derived from this total --
// recompute them if this changes.
const ANIMATION_DURATION_MS = 2650;
const STOP_SHORT_FRACTION = 0.8; // fraction of the true distance the icon travels before fading out

const ActionPopups = forwardRef(function ActionPopups({ targetRef }, ref) {
  const containerRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      spawn() {
        const container = containerRef.current;
        const target = targetRef?.current;
        if (!container || !target) return;

        const rect = target.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * SPAWN_JITTER_RADIUS_PX;
        const spawnX = window.innerWidth / 2 + Math.cos(angle) * radius;
        const spawnY = window.innerHeight / 2 + Math.sin(angle) * radius;

        const dx = (targetX - spawnX) * STOP_SHORT_FRACTION;
        const dy = (targetY - spawnY) * STOP_SHORT_FRACTION;

        const img = document.createElement("img");
        img.src = ICON_SRC;
        img.alt = "";
        img.className = "action-popup__icon";
        img.style.left = `${spawnX}px`;
        img.style.top = `${spawnY}px`;
        img.style.width = `${ICON_SIZE_PX}px`;
        img.style.height = `${ICON_SIZE_PX}px`;
        img.style.animationDuration = `${ANIMATION_DURATION_MS}ms`;
        img.style.setProperty("--popup-dx", `${dx}px`);
        img.style.setProperty("--popup-dy", `${dy}px`);

        const remove = () => img.remove();
        img.addEventListener("animationend", remove, { once: true });
        setTimeout(remove, ANIMATION_DURATION_MS + 100);

        container.appendChild(img);
      },
    }),
    [targetRef],
  );

  // Dev-mode HMR/StrictMode double-invoke safety net; ActionPopups is
  // otherwise mounted for the whole app lifetime.
  useEffect(() => {
    return () => containerRef.current?.replaceChildren();
  }, []);

  return <div className="action-popups" ref={containerRef} aria-hidden="true" />;
});

export default ActionPopups;
