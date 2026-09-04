// Player progression stats: Power, Level, Rebirth, Wins.
// Each stat is strictly clamped to its range on every update -- see
// src/hooks/usePlayerProgression.js for the stateful setters that enforce
// this. Power replaces the old hardcoded LASER_POWER constant in
// wallMaterials.js: it now starts low and is meant to grow as the player
// progresses.
export const PROGRESSION_RANGES = {
  power: { min: 1, max: 10_000 },
  level: { min: 1, max: 100 },
  rebirth: { min: 0, max: 100 },
  wins: { min: 0, max: 100_000_000 },
};

export const PROGRESSION_INITIAL = {
  power: 1,
  level: 1,
  rebirth: 0,
  wins: 0,
};

export function clampStat(key, value) {
  const { min, max } = PROGRESSION_RANGES[key];
  return Math.min(max, Math.max(min, value));
}
