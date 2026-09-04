// Shared mutable input state, written by keyboard/mouse (desktop) and the
// touch overlay, and read by Player each frame. A plain object (not React
// state) so writes never trigger re-renders.
export const CAM_DIST_DEFAULT = 5;
export const CAM_DIST_MIN = 2; // closest zoom
export const CAM_DIST_MAX = 12; // farthest zoom
export const MOUSE_SENS = 0.0025; // right-drag / touch-drag orbit sensitivity
export const PITCH_MIN = -0.6;
export const PITCH_MAX = 1.15;

export function createControlsState() {
  return {
    move: { x: 0, z: 0 }, // analog, -1..1 (x: right, z: forward)
    jump: false,
    yaw: 0,
    pitch: 0.35,
    camDistTarget: CAM_DIST_DEFAULT,
    firing: false,
    aim: { x: 0, y: 0 }, // NDC
  };
}
