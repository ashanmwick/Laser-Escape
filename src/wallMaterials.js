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

// Placeholder: will later scale with game progression — not implemented yet.
export const LASER_POWER = 50;

// HP/sec = LASER_POWER / strength. Paper melts in ~2s, brick takes ~3min
// at these defaults — both constants above are the tuning knobs.
export function damagePerSecond(strength) {
  return LASER_POWER / strength;
}
