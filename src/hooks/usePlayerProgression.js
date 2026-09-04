import { useCallback, useMemo, useState } from "react";
import { PROGRESSION_INITIAL, clampStat } from "../playerProgression.js";

/**
 * Player progression tracking: power, level, rebirth, wins.
 * Every setter/adder clamps to that stat's range (src/playerProgression.js)
 * before committing, so the values can never drift outside spec no matter
 * what calls them.
 */
export default function usePlayerProgression() {
  const [stats, setStats] = useState(PROGRESSION_INITIAL);

  const set = useCallback((key, value) => {
    setStats((prev) => {
      const next = clampStat(key, value);
      return next === prev[key] ? prev : { ...prev, [key]: next };
    });
  }, []);

  const add = useCallback(
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
      setPower: (v) => set("power", v),
      addPower: (d) => add("power", d),
      setLevel: (v) => set("level", v),
      addLevel: (d) => add("level", d),
      setRebirth: (v) => set("rebirth", v),
      addRebirth: (d) => add("rebirth", d),
      setWins: (v) => set("wins", v),
      addWins: (d) => add("wins", d),
    }),
    [stats, set, add],
  );
}
