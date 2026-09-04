import { useCallback, useMemo, useState } from "react";
import {
  PROGRESSION_INITIAL,
  PROGRESSION_RANGES,
  clampStat,
  levelForPower,
  rebirthRequirement,
} from "../playerProgression.js";

/**
 * Player progression tracking: power, level, rebirth, wins, powerPerAction.
 * Every setter clamps to that stat's range (src/playerProgression.js) before
 * committing, so values can never drift outside spec no matter what calls
 * them.
 *
 * `registerAction` is the single entry point for Power gain: call it once
 * per Action (a click, or each full 2s of continuous laser hold -- see
 * Player.jsx). It applies `powerPerAction * (rebirth + 1)` and re-derives
 * Level from the resulting Power in the same update, so the two stats never
 * go out of sync.
 *
 * Rebirth is manual: `canRebirth` reports whether the current Level meets
 * `rebirthRequirement(rebirth)`, and `acceptRebirth` is the explicit action
 * that commits it (rebirth += 1, power and level reset to their initial
 * values). It is a no-op if the requirement isn't met or Rebirth is already
 * at its max.
 */
export default function usePlayerProgression() {
  const [stats, setStats] = useState(PROGRESSION_INITIAL);

  const registerAction = useCallback(() => {
    setStats((prev) => {
      const gain = prev.powerPerAction * (prev.rebirth + 1);
      const power = clampStat("power", prev.power + gain);
      const level = levelForPower(power);
      if (power === prev.power && level === prev.level) return prev;
      return { ...prev, power, level };
    });
  }, []);

  // Sets Power directly to an arbitrary value (clamped) and re-derives
  // Level in the same update, same as registerAction/acceptRebirth do for
  // their own Power changes. Used by hex power pad "equip" (src/hexPowerPads.js).
  const equipLaser = useCallback((power) => {
    setStats((prev) => {
      const nextPower = clampStat("power", power);
      const nextLevel = levelForPower(nextPower);
      if (nextPower === prev.power && nextLevel === prev.level) return prev;
      return { ...prev, power: nextPower, level: nextLevel };
    });
  }, []);

  const acceptRebirth = useCallback(() => {
    setStats((prev) => {
      if (prev.rebirth >= PROGRESSION_RANGES.rebirth.max) return prev;
      if (prev.level < rebirthRequirement(prev.rebirth)) return prev;
      return {
        ...prev,
        rebirth: clampStat("rebirth", prev.rebirth + 1),
        power: PROGRESSION_INITIAL.power,
        level: PROGRESSION_INITIAL.level,
      };
    });
  }, []);

  const setStat = useCallback((key, value) => {
    setStats((prev) => {
      const next = clampStat(key, value);
      return next === prev[key] ? prev : { ...prev, [key]: next };
    });
  }, []);
  const addStat = useCallback(
    (key, delta) => {
      setStats((prev) => {
        const next = clampStat(key, prev[key] + delta);
        return next === prev[key] ? prev : { ...prev, [key]: next };
      });
    },
    [],
  );

  return useMemo(
    () => ({
      stats,
      registerAction,
      equipLaser,
      canRebirth:
        stats.rebirth < PROGRESSION_RANGES.rebirth.max &&
        stats.level >= rebirthRequirement(stats.rebirth),
      rebirthRequiredLevel: rebirthRequirement(stats.rebirth),
      acceptRebirth,
      setWins: (v) => setStat("wins", v),
      addWins: (d) => addStat("wins", d),
      spendWins: (amount) => addStat("wins", -amount),
      setPowerPerAction: (v) => setStat("powerPerAction", v),
      addPowerPerAction: (d) => addStat("powerPerAction", d),
    }),
    [stats, registerAction, equipLaser, acceptRebirth, setStat, addStat],
  );
}
