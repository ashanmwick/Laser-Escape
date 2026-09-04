// Per-material laser resistance, weakest -> strongest. Tune freely.
export const WALL_STRENGTH = {
  paper_wall: 1,
  cardboard_wall: 10,
  carpet_wall: 20,
  leather_wall: 30,
  rubber_wall: 40,
  grass_wall: 50,
  wood_wall: 60,
  glass_wall: 70,
  concrete_wall: 80,
  brick_wall: 90,
};

export const WALL_NAMES = Object.keys(WALL_STRENGTH);

export const WALL_MAX_HEALTH = 100;

// HP/sec = power / strength. `power` is the player's live Power stat
// (src/playerProgression.js), starting at 1 and growing with progression.
export function damagePerSecond(strength, power) {
  return power / strength;
}
