// Compact number formatting for HUD/label display: 5000 -> "5K",
// 2500000 -> "2.5M". Numbers under 1000 are shown as-is.
export function formatCompactNumber(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return trimDecimal(n / 1_000_000) + "M";
  if (abs >= 1_000) return trimDecimal(n / 1_000) + "K";
  return String(n);
}

// One decimal place, trailing ".0" dropped (2.5 -> "2.5", 25 -> "25").
function trimDecimal(n) {
  return Number(n.toFixed(1)).toString();
}
