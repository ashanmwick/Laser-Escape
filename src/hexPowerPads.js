// 15 purchasable/equippable "power pad" props (hex_power_pad.001 ..
// hex_power_pad.015 in World.blend / public/world.glb). Walking near one
// shows a buy/equip prompt (see Player.jsx's proximity scan and App.jsx's
// handleHexPadInteract); each pad's material recolors red (locked) -> white
// (bought) -> green (equipped) (see HexPowerPad.jsx) and shows a floating
// power/wins-required label.
// Blender names these hex_power_pad.001 .. hex_power_pad.015, but
// GLTFLoader sanitizes node names by stripping "." (it's a path separator
// in animation-track bindings), so at runtime in the loaded scene they're
// hex_power_pad001 .. hex_power_pad015 -- these must match the sanitized
// form for World.jsx's/Player.jsx's scene.traverse name checks to work.
export const HEX_PAD_NAMES = Array.from(
  { length: 15 },
  (_, i) => `hex_power_pad${String(i + 1).padStart(3, "0")}`,
);

// Index-aligned with HEX_PAD_NAMES: hex_power_pad.001 -> HEX_PAD_TIERS[0], etc.
export const HEX_PAD_TIERS = [
  { power: 1, winsRequired: 0 },
  { power: 2, winsRequired: 1 },
  { power: 5, winsRequired: 5 },
  { power: 10, winsRequired: 25 },
  { power: 25, winsRequired: 100 },
  { power: 50, winsRequired: 250 },
  { power: 100, winsRequired: 750 },
  { power: 150, winsRequired: 2500 },
  { power: 250, winsRequired: 7500 },
  { power: 400, winsRequired: 25000 },
  { power: 700, winsRequired: 50000 },
  { power: 1000, winsRequired: 100000 },
  { power: 1500, winsRequired: 250000 },
  { power: 2500, winsRequired: 750000 },
  { power: 3500, winsRequired: 2500000 },
];

// Player-to-pad distance (metres) within which the buy/equip prompt shows.
export const HEX_PAD_PROXIMITY_RADIUS = 4;

export const HEX_PAD_COLOR_OWNED = "#ffffff";
export const HEX_PAD_COLOR_EQUIPPED = "#28c76f"; // matches the target-hit green elsewhere

// Metres above the pad's own origin the floating label is anchored at.
export const HEX_PAD_LABEL_HEIGHT = 1.1;

// Without these, a label rendered at a constant screen size with no
// distance cutoff can end up projected right where the (always roughly
// centered, close-camera) player is drawn even when the pad itself is many
// metres away -- it *looks* like the info is floating over the player. This
// makes labels shrink with true distance (perspective-correct, like a
// world object) and disappear past a reasonable range instead of piling up
// on screen for every pad at once.
export const HEX_PAD_LABEL_DISTANCE_FACTOR = 8;
export const HEX_PAD_LABEL_MAX_DISTANCE = 18;
