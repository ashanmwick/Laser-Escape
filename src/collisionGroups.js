// Rapier collision groups (16 membership bits + 16 filter bits per collider).
// Only the player <-> debris pair needs an explicit filter; everything else
// (ground, walls, debris-vs-ground, debris-vs-debris) keeps Rapier's default
// "belongs to every group, collides with every group" behaviour.
export const GROUP_PLAYER = 0;
export const GROUP_DEBRIS = 1;

// Every group except GROUP_DEBRIS -- the player's capsule filters on this so
// it walks straight through wall-break debris chunks instead of being
// blocked by them.
export const PLAYER_FILTER = Array.from({ length: 16 }, (_, i) => i).filter(
  (i) => i !== GROUP_DEBRIS,
);
