// Roblox-style flat/matte look: kill specular shine and reflections on
// imported glTF materials without touching color/map/emissive (Wall.jsx
// darkens color on damage, HexPowerPad.jsx recolors color/emissive directly
// -- both keep working since neither property is touched here).
export function flattenMaterial(material) {
  if (!material) return;
  for (const mat of Array.isArray(material) ? material : [material]) {
    if (!mat?.isMeshStandardMaterial) continue;
    mat.roughness = 1;
    mat.metalness = 0;
    if (mat.envMap) mat.envMapIntensity = 0;
  }
}
