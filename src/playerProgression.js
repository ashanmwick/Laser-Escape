// Player progression stats: Power, Level, Rebirth, Wins, PowerPerAction.
// Every stat is strictly clamped to its range on every update -- see
// src/hooks/usePlayerProgression.js for the stateful setters that enforce
// this. Power feeds wallMaterials.js's damagePerSecond (replacing the old
// hardcoded LASER_POWER constant): it starts low and grows as the player
// performs Actions.
export const PROGRESSION_RANGES = {
  power: { min: 1, max: 10_000 },
  level: { min: 1, max: 1010 },
  rebirth: { min: 0, max: 100 },
  wins: { min: 0, max: 100_000_000 },
  powerPerAction: { min: 1, max: 3500 },
};

export const PROGRESSION_INITIAL = {
  power: 1,
  level: 1,
  rebirth: 0,
  wins: 0,
  powerPerAction: 1,
};

// An Action is either a quick laser click, or each full ACTION_HOLD_SECONDS
// of continuous laser hold (see usePlayerProgression's registerAction /
// Player.jsx's per-frame edge detection on controls.firing).
export const ACTION_HOLD_SECONDS = 2;

export function clampStat(key, value) {
  const { min, max } = PROGRESSION_RANGES[key];
  return Math.min(max, Math.max(min, value));
}

// Level auto-derives from Power: 1-49 -> 1, 50-99 -> 2, 100-149 -> 3, ...
export function levelForPower(power) {
  return clampStat("level", Math.floor(power / 50) + 1);
}

// Level required to unlock the next Rebirth, given the current Rebirth count.
export function rebirthRequirement(rebirth) {
  return (rebirth + 1) * 10;
}
