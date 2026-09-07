import { useEffect, useState } from "react";
import { getGPUTier } from "detect-gpu";

const STORAGE_KEY = "laserEscape.qualityTier"; // "auto" | "low" | "medium" | "high"
const TIERS = ["low", "medium", "high"];

// Per-tier renderer/gameplay settings. Values are heuristics, not exact
// budgets -- the point is to give low-end/integrated GPUs a real escape
// hatch (lower resolution, no shadows, fewer debris/remote-player draws)
// while keeping high-end machines at full fidelity.
export const QUALITY_SETTINGS = {
  low: { dprCap: 1, antialias: false, shadows: false, shadowMapSize: 0, debrisCount: 8, maxRemotePlayers: 4 },
  medium: { dprCap: 1.5, antialias: true, shadows: true, shadowMapSize: 1024, debrisCount: 14, maxRemotePlayers: 12 },
  high: { dprCap: 2, antialias: true, shadows: true, shadowMapSize: 2048, debrisCount: 22, maxRemotePlayers: Infinity },
};

function readStoredPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return TIERS.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

function writeStoredPreference(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // private browsing / disabled storage -- the choice just won't persist
  }
}

// Cheap synchronous guess used immediately (Canvas mounts before detect-gpu's
// async benchmark lookup -- which fetches its model database from a CDN --
// can resolve). Refined below once that lookup comes back, unless the user
// has pinned a tier already.
function synchronousGuess(isTouch) {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = navigator.deviceMemory; // not exposed by every browser
  if (isTouch || cores <= 4 || (mem !== undefined && mem <= 4)) return "low";
  if (cores <= 6) return "medium";
  return "high";
}

function tierFromGpuScore(gpuTier) {
  if (gpuTier <= 1) return "low";
  if (gpuTier === 2) return "medium";
  return "high";
}

/**
 * Auto-detects a quality tier ("low" | "medium" | "high") from GPU
 * benchmark data (detect-gpu), falling back to a synchronous CPU/memory/
 * touch-based guess until that resolves (or if it fails -- e.g. offline).
 * A manual override, once set, persists to localStorage and skips
 * detection entirely.
 */
export default function useQualityTier(isTouch) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [autoTier, setAutoTier] = useState(() => synchronousGuess(isTouch));

  useEffect(() => {
    if (preference !== "auto") return;
    let cancelled = false;
    getGPUTier()
      .then((result) => {
        if (!cancelled) setAutoTier(tierFromGpuScore(result.tier));
      })
      .catch(() => {}); // keep the synchronous guess if the lookup fails
    return () => {
      cancelled = true;
    };
  }, [preference]);

  const tier = preference === "auto" ? autoTier : preference;

  const setTierPreference = (next) => {
    setPreference(next);
    writeStoredPreference(next);
  };

  return { tier, settings: QUALITY_SETTINGS[tier], preference, setTierPreference };
}
