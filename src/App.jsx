import { Component, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import World from "./components/World.jsx";
import Player from "./components/Player.jsx";
import TouchControls from "./components/TouchControls.jsx";
import PortraitOverlay from "./components/PortraitOverlay.jsx";
import ActionPopups from "./components/ActionPopups.jsx";
import useIsTouchDevice from "./hooks/useIsTouchDevice.js";
import usePlayerProgression from "./hooks/usePlayerProgression.js";
import { createControlsState } from "./controls.js";
import { HEX_PAD_NAMES, HEX_PAD_TIERS } from "./hexPowerPads.js";
import { AFK_REBIRTH_REQUIRED } from "./afkTargets.js";
import { formatCompactNumber } from "./formatNumber.js";

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
  const progression = usePlayerProgression();
  const powerStatRef = useRef(null);
  const popupsRef = useRef(null);
  const [nearAfkTarget, setNearAfkTarget] = useState(null);
  const [afkActive, setAfkActive] = useState(false);
  const [boughtPads, setBoughtPads] = useState(() => new Set());
  const [equippedPad, setEquippedPad] = useState(null);
  const [nearHexPad, setNearHexPad] = useState(null);

  // Per-frame wall HP lives in a plain mutable Map (written every frame by
  // Player's laser raycast, read every frame by each Wall's damage visuals)
  // -- same pattern as controls.js, kept out of React state to avoid
  // re-rendering on every tick of damage.
  const wallHealth = useMemo(() => new Map(), []);
  const [destroyedWalls, setDestroyedWalls] = useState(() => new Set());

  const handleTargetHit = useCallback((id) => {
    setHits((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleWallDestroyed = useCallback((wallType) => {
    setDestroyedWalls((prev) => {
      if (prev.has(wallType)) return prev;
      const next = new Set(prev);
      next.add(wallType);
      return next;
    });
  }, []);

  const handleAction = useCallback(
    (multiplier) => {
      progression.registerAction(multiplier);
      popupsRef.current?.spawn();
    },
    [progression.registerAction],
  );

  // Win floor panels (src/winPanels.js): Player.jsx already teleported the
  // capsule back to spawn by the time this fires -- here we only touch the
  // state App.jsx owns: credit the panel's Wins (progression is otherwise
  // untouched) and restore every wall to undestroyed/full HP for the next
  // run.
  const handleWinPanelHit = useCallback(
    (_name, wins) => {
      progression.addWins(wins);
      for (const entry of wallHealth.values()) entry.hp = entry.maxHp;
      setDestroyedWalls((prev) => (prev.size === 0 ? prev : new Set()));
    },
    [progression.addWins, wallHealth],
  );

  const handleAfkNearChange = useCallback((name) => setNearAfkTarget(name), []);
  const handleAfkActiveChange = useCallback((active) => setAfkActive(active), []);

  const handleNearHexPadChange = useCallback((name) => setNearHexPad(name), []);

  // Player.jsx only reports "E was pressed near this pad" -- this decides
  // whether that means buy (locked, and affordable) or equip (owned).
  // Wins are spent as currency on buy (Wins never affects Power directly).
  const handleHexPadInteract = useCallback(
    (name) => {
      const idx = HEX_PAD_NAMES.indexOf(name);
      if (idx === -1) return;
      const tier = HEX_PAD_TIERS[idx];
      if (boughtPads.has(name)) {
        if (equippedPad === name) return; // already equipped
        setEquippedPad(name);
        progression.equipLaser(tier.power);
      } else if (progression.stats.wins >= tier.winsRequired) {
        progression.spendWins(tier.winsRequired);
        setBoughtPads((prev) => {
          const next = new Set(prev);
          next.add(name);
          return next;
        });
      }
    },
    [boughtPads, equippedPad, progression],
  );

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
              <World
                wallHealth={wallHealth}
                destroyedWalls={destroyedWalls}
                onWallDestroyed={handleWallDestroyed}
                boughtPads={boughtPads}
                equippedPad={equippedPad}
              />
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
                onAction={handleAction}
                onAfkNearChange={handleAfkNearChange}
                onAfkActiveChange={handleAfkActiveChange}
                onNearHexPadChange={handleNearHexPadChange}
                onHexPadInteract={handleHexPadInteract}
                onWinPanelHit={handleWinPanelHit}
                controls={controls}
                wallHealth={wallHealth}
                laserPower={progression.stats.power}
                rebirth={progression.stats.rebirth}
              />
            </Physics>
          </Suspense>
        </ErrBoundary>
      </Canvas>

      {isTouch && <TouchControls controls={controls} />}
      {isTouch && <PortraitOverlay />}
      <ActionPopups ref={popupsRef} targetRef={powerStatRef} />

      {(() => {
        let prompt = null;
        if (afkActive) prompt = "AFK'ing — move or press Space to stop";
        else if (nearAfkTarget) {
          const required = AFK_REBIRTH_REQUIRED[nearAfkTarget] ?? 0;
          prompt =
            progression.stats.rebirth >= required
              ? "Press E to AFK Here"
              : `Requires Rebirth ${required}`;
        } else if (nearHexPad && nearHexPad !== equippedPad) {
          prompt = boughtPads.has(nearHexPad)
            ? "Press E to Equip Laser"
            : "Press E to Buy Laser";
        }
        return prompt && <div className="interaction-prompt">{prompt}</div>;
      })()}

      <div className="hud">
        {isTouch ? (
          <>
            <b>Left stick</b> move &nbsp;·&nbsp; <b>Touch &amp; hold</b> fire at that spot
            &nbsp;·&nbsp; <b>2-finger drag</b> look &nbsp;·&nbsp; <b>Pinch</b> zoom
            &nbsp;·&nbsp; <b>Jump</b> button
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
        <br />
        <span ref={powerStatRef}>
          Power: {formatCompactNumber(progression.stats.power)}
        </span>{" "}
        &nbsp;·&nbsp; Level: {progression.stats.level}
        &nbsp;·&nbsp; Rebirth: {progression.stats.rebirth} &nbsp;·&nbsp; Wins:{" "}
        {formatCompactNumber(progression.stats.wins)}
        {progression.canRebirth ? (
          <>
            {" "}
            <button type="button" onClick={progression.acceptRebirth}>
              Rebirth available (Lv {progression.rebirthRequiredLevel}) — Accept
            </button>
          </>
        ) : (
          <>
            {" "}
            (next Rebirth at Lv {progression.rebirthRequiredLevel})
          </>
        )}
      </div>
    </>
  );
}
