// 8 "win" floor panels (glow_floor_panel / glow_floor_panel.001 ..
// glow_floor_panel.007 in World.blend / public/world.glb -- see the
// glow-floor-panel-asset memory for how the prop was built). Walking near
// one (WIN_PANEL_TRIGGER_RADIUS below, not a strict on-the-mesh collision)
// instantly ends the current run: the player is teleported back to the
// spawn point (progression -- Power/Level/Rebirth/Wins -- is left untouched,
// only position/velocity reset) and every wall's health/destroyed state is
// restored, while that panel's Wins value is credited (see Player.jsx's
// per-frame proximity check and App.jsx's handleWinPanelHit).
// Blender names these glow_floor_panel / glow_floor_panel.001 ..
// .007, but GLTFLoader strips "." from node names (it's a path separator in
// animation-track bindings -- see hexPowerPads.js's comment), so at runtime
// in the loaded scene they're glow_floor_panel / glow_floor_panel001 ..
// glow_floor_panel007 -- these must match the sanitized form for World.jsx's
// /Player.jsx's scene.traverse name checks to work.
export const WIN_PANEL_NAMES = [
  "glow_floor_panel",
  ...Array.from({ length: 7 }, (_, i) => `glow_floor_panel${String(i + 1).padStart(3, "0")}`),
];

// Index-aligned with WIN_PANEL_NAMES.
export const WIN_PANEL_WINS = [1, 3, 10, 25, 50, 100, 150, 200];

// Player-to-panel horizontal distance (metres) within which getting close
// to a panel triggers its win -- same "near it" pattern as
// HEX_PAD_PROXIMITY_RADIUS/AFK_PROXIMITY_RADIUS, deliberately not a strict
// on-the-mesh collision check.
export const WIN_PANEL_TRIGGER_RADIUS = 3;

// Floating "+N Wins" label above each panel, same visual treatment as
// HexPowerPad.jsx's price tag / AfkTargetLabel.jsx's multiplier tag.
export const WIN_PANEL_LABEL_HEIGHT = 0.6;
export const WIN_PANEL_LABEL_DISTANCE_FACTOR = 8;
export const WIN_PANEL_LABEL_MAX_DISTANCE = 18;
