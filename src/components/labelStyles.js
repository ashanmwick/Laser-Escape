// Shared inline styles for floating world-anchored info labels (drei
// <Html>) -- used by HexPowerPad.jsx and AfkTargetLabel.jsx so both read
// identically: white-on-red bar (black outline) for the headline stat,
// yellow (black outline) for the requirement line underneath.
const outline = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";

export const labelBarStyle = {
  padding: "2px 10px",
  borderRadius: 4,
  background: "#c8102e",
  border: "1px solid rgba(0,0,0,0.7)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 28,
  whiteSpace: "nowrap",
  textShadow: outline,
};

export const labelRequirementStyle = {
  color: "#ffd400",
  fontWeight: 700,
  fontSize: 28,
  whiteSpace: "nowrap",
  textShadow: outline,
};

export const labelColumnStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
  pointerEvents: "none",
};
