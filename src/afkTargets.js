// "AFK" auto-fire targets: standalone target/stand props (see the
// target-stand-asset-family .glb files at the project root) meant to be
// placed into World.blend / public/world.glb. When the player is near one,
// Player.jsx shows a "Press E to AFK Here" prompt; pressing E continuously
// fires the laser at that target's aim point until a movement key or jump
// cancels it (see the "AFK auto-fire" block in Player.jsx's useFrame).
export const AFK_TARGET_NAMES = [
  "grand_gold_multi_target",
  "target_blue",
  "target_grey",
  "target_red",
  "target_tan",
  "target_yellow",
  "triple_target_gold",
  "triple_target_grey",
  "vortex_target",
];

// Per-target aim-point offset, added on top of each target mesh's own
// world-space bounding-box top-center -- this is the "top area" the beam
// is aimed at. [x, y, z] in metres, y typically small/positive to sit just
// above the model's actual top rather than clipping into it. Placeholder
// values until the assets are placed in world.glb and can be measured;
// tune per name here.
export const AFK_AIM_OFFSET = {
  grand_gold_multi_target: [0, 0.1, 0],
  target_blue: [0, 0.1, 0],
  target_grey: [0, 0.1, 0],
  target_red: [0, 0.1, 0],
  target_tan: [0, 0.1, 0],
  target_yellow: [0, 0.1, 0],
  triple_target_gold: [0, 0.1, 0],
  triple_target_grey: [0, 0.1, 0],
  vortex_target: [0, 0.1, 0],
};

// Player-to-target distance (metres) within which the "Press E to AFK
// Here" prompt appears.
export const AFK_PROXIMITY_RADIUS = 4;

// Minimum Rebirth (src/playerProgression.js) required to start AFK at each
// target -- Player.jsx's E-press handler gates on this; App.jsx uses it to
// show "Requires Rebirth N" instead of the prompt when not yet eligible.
export const AFK_REBIRTH_REQUIRED = {
  target_grey: 0,
  target_yellow: 0,
  target_red: 2,
  triple_target_grey: 4,
  target_tan: 6,
  target_blue: 10,
  triple_target_gold: 15,
  grand_gold_multi_target: 0,
  vortex_target: 0,
};

// Power-gain multiplier while AFK'd at each target: while active, an
// Action's gain becomes `powerPerAction * (rebirth + 1) * multiplier`
// instead of the normal `powerPerAction * (rebirth + 1)` (see
// usePlayerProgression's registerAction). Source data expresses these as
// "x0"/"x1"/"x2"... -- "x0" means no bonus, normalized to 1 here (the
// actual effective multiplier), not 0.
export const AFK_POWER_MULTIPLIER = {
  target_grey: 1,
  target_yellow: 1,
  target_red: 2,
  triple_target_grey: 4,
  target_tan: 6,
  target_blue: 10,
  triple_target_gold: 15,
  grand_gold_multi_target: 1, // source "x0" -> no bonus
  vortex_target: 1, // source "x0" -> no bonus
};

// Floating label above each target (AfkTargetLabel.jsx), same treatment as
// the hex power pads' price tags: extra height added on top of the aim
// point itself (so the label doesn't sit right on top of the beam's actual
// landing spot), plus the same distance-based scale/visibility cutoff.
export const AFK_LABEL_HEIGHT = 0.5;
export const AFK_LABEL_DISTANCE_FACTOR = 8;
export const AFK_LABEL_MAX_DISTANCE = 18;
