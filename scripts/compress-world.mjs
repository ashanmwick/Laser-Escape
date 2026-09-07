#!/usr/bin/env node
// Compresses public/world.glb in place: run this after every re-export from
// World.blend, before committing. Do NOT run it twice in a row on its own
// output -- texture compression here is lossy, so re-compressing an
// already-compressed file keeps degrading texture quality for no size
// benefit.
//
// --vertex-layout separate is required on every step: gltf-transform
// defaults to "interleaved" vertex buffers, which this project's
// GLTFLoader/Rapier trimesh-collider setup cannot read correctly (verified:
// an interleaved dedup pass produced a file that loaded without errors but
// rendered nothing and froze the frame loop for several seconds on load).
//
// meshopt (EXT_meshopt_compression) is deliberately NOT used here -- it is
// an inherently interleaved wire format, so it silently reintroduces the
// same breakage regardless of --vertex-layout. Revisit meshopt only after
// confirming against a newer three-stdlib/GLTFLoader that the
// incompatibility is gone.
//
// Textures: KTX2 (Basis Universal) is used when the KTX-Software `toktx`
// binary is on PATH -- UASTC for normal maps (quality-sensitive), ETC1S for
// base color/emissive (fine to compress harder). This is the format that
// actually reduces GPU memory (~222MB -> ~18MB decoded VRAM for this file's
// textures, verified via `gltf-transform inspect`'s gpuSize column) since
// KTX2 stays block-compressed on the GPU, unlike PNG/WebP/JPEG which are
// fully decoded to RGBA on upload. Requires public/basis/ to hold the
// matching Basis transcoder (see README below) and src/components/World.jsx
// to load textures through a KTX2Loader (already wired).
//
// If `toktx` isn't installed, falls back to WebP -- smaller download, and
// zero code changes needed (three.js's GLTFLoader handles EXT_texture_webp
// natively), but textures still decode to full RGBA in VRAM.
//
// Installing toktx (Windows): download the installer from
// https://github.com/KhronosGroup/KTX-Software/releases (KTX-Software-*-
// Windows-x64.exe), which also needs the Microsoft Visual C++ Redistributable
// (https://aka.ms/vs/17/release/vc_redist.x64.exe) if not already present.
// Add its bin/ directory to PATH so `toktx --version` works, then re-run
// this script.
import { execSync } from "node:child_process";
import { mkdtempSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = join(process.cwd(), "public/world.glb");
const work = mkdtempSync(join(tmpdir(), "world-compress-"));

function hasToktx() {
  try {
    execSync("toktx --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const useKtx2 = hasToktx();
console.log(useKtx2 ? "toktx found -- compressing textures to KTX2." : "toktx not found on PATH -- falling back to WebP (see script comments to install it).");

const steps = [
  ["dedup"],
  ["prune"],
  ...(useKtx2
    ? [
        ["uastc", "--slots", "normalTexture", "--zstd", "18"],
        ["etc1s", "--slots", "baseColorTexture"],
        ["etc1s", "--slots", "emissiveTexture"],
      ]
    : [["webp"]]),
];

function run(cmd, input, output) {
  const args = ["gltf-transform", ...cmd, "--vertex-layout", "separate", input, output];
  // execSync runs through a shell (needed to resolve npx's Windows .cmd
  // shim), so each argument must be quoted individually -- otherwise a
  // space anywhere in a path (e.g. this repo's own directory name) splits
  // into extra tokens and gltf-transform sees the wrong argument count.
  const quoted = args.map((a) => `"${a}"`).join(" ");
  execSync(`npx ${quoted}`, { stdio: "inherit" });
}

let current = target;
for (const [i, cmd] of steps.entries()) {
  const next = join(work, `step${i}.glb`);
  run(cmd, current, next);
  current = next;
}

copyFileSync(current, target);
rmSync(work, { recursive: true, force: true });

if (useKtx2 && !existsSync(join(process.cwd(), "public/basis/basis_transcoder.wasm"))) {
  console.warn(
    "\nWarning: public/basis/basis_transcoder.wasm is missing -- the KTX2 textures just written won't load in the browser. Copy it (and basis_transcoder.js) from node_modules/three/examples/jsm/libs/basis/ into public/basis/.",
  );
}

console.log(`\nCompressed world.glb written to ${target}`);
