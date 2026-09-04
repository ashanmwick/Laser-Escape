import { Component, Suspense, useCallback, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import World from "./components/World.jsx";
import Player from "./components/Player.jsx";
import TouchControls from "./components/TouchControls.jsx";
import PortraitOverlay from "./components/PortraitOverlay.jsx";
import useIsTouchDevice from "./hooks/useIsTouchDevice.js";
import { createControlsState } from "./controls.js";

class ErrBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error("SCENE ERROR:", err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            padding: 24,
            color: "#ff6b81",
            font: "13px/1.5 monospace",
            whiteSpace: "pre-wrap",
            zIndex: 100,
          }}
        >
          {String(this.state.err?.stack || this.state.err)}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Laser Escape — third-person playground.
 * World geometry comes from World.blend (public/world.glb); the player is
 * the rigged character from the same file (public/player.glb).
 *
 * Click to lock the mouse, WASD to move, Space to jump, left-click to fire
 * the laser at the glowing target blocks. Puzzle logic (which targets are
 * down, "gate open") lives here — Player only calls onTargetHit.
 */

const TARGETS = [
  { id: "target-a", position: [-6, 1.2, 8] },
  { id: "target-b", position: [8, 1.2, 2] },
  { id: "target-c", position: [0, 1.6, 16] },
];

function Target({ id, position, hit, onHit }) {
  return (
    <mesh
      position={position}
      userData={{ isTarget: true, targetId: id, onHit }}
      castShadow
    >
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color={hit ? "#28c76f" : "#ff2d55"}
        emissive={hit ? "#0d5c33" : "#5c0d22"}
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

export default function App() {
  const [hits, setHits] = useState(() => new Set());
  const controls = useMemo(() => createControlsState(), []);
  const isTouch = useIsTouchDevice();

  const handleTargetHit = useCallback((id) => {
    setHits((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const allDown = TARGETS.every((t) => hits.has(t.id));

  return (
    <>
      <Canvas shadows camera={{ fov: 70, near: 0.1, far: 500, position: [0, 3, 8] }}>
        <color attach="background" args={["#0b0d12"]} />
        <Sky sunPosition={[40, 30, 20]} turbidity={6} rayleigh={1.5} />
        <hemisphereLight args={["#bcd4ff", "#4a4436", 0.7]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[30, 40, 20]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          shadow-camera-far={200}
        />

        <ErrBoundary>
          <Suspense fallback={null}>
            <Physics>
              <World />
              {TARGETS.map((t) => (
                <Target
                  key={t.id}
                  id={t.id}
                  position={t.position}
                  hit={hits.has(t.id)}
                  onHit={handleTargetHit}
                />
              ))}
              <Player
                spawnPosition={[0, 2, 2]}
                onTargetHit={handleTargetHit}
                controls={controls}
              />
            </Physics>
          </Suspense>
        </ErrBoundary>
      </Canvas>

      {isTouch && <TouchControls controls={controls} />}
      {isTouch && <PortraitOverlay />}

      <div className="hud">
        {isTouch ? (
          <>
            <b>Left stick</b> move &nbsp;·&nbsp; <b>Drag</b> look &nbsp;·&nbsp;{" "}
            <b>Pinch</b> zoom &nbsp;·&nbsp; <b>Fire</b> / <b>Jump</b> buttons
          </>
        ) : (
          <>
            <b>WASD</b> move &nbsp;·&nbsp; <b>Space</b> jump &nbsp;·&nbsp;{" "}
            <b>Hold left-click</b> fire at cursor &nbsp;·&nbsp; <b>Right-drag</b> orbit
            &nbsp;·&nbsp; <b>Scroll</b> zoom
          </>
        )}
        <br />
        Targets down: {hits.size} / {TARGETS.length}
        {allDown ? "  —  gate open ✔" : ""}
      </div>
    </>
  );
}
