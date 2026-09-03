import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import Player from "./components/Player.jsx";

/**
 * Minimal test level for the Player component: a lit room with perimeter
 * walls, a couple of interior dividers, and three shootable targets.
 * Click the canvas to lock the pointer, WASD to move, Space to jump,
 * left-click to fire the head laser at the pink targets.
 */

const WALL_H = 4;
const ROOM = 20; // half-extent of the floor

function Wall({ position, size }) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={position} userData={{ isWall: true }} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
    </RigidBody>
  );
}

function Target({ id, position, hit, onHit }) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh
        position={position}
        userData={{ isTarget: true, targetId: id, onHit }}
        castShadow
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={hit ? "#28c76f" : "#ff2d55"}
          emissive={hit ? "#0d5c33" : "#5c0d22"}
          emissiveIntensity={0.6}
        />
      </mesh>
    </RigidBody>
  );
}

export default function App() {
  const [hits, setHits] = useState(() => new Set());
  const hitsRef = useRef(hits);
  hitsRef.current = hits;

  // Puzzle logic lives here, outside Player — Player only calls onTargetHit.
  const handleTargetHit = useCallback((id) => {
    setHits((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const targets = [
    { id: "target-a", position: [-6, 1, -8] },
    { id: "target-b", position: [7, 1, -4] },
    { id: "target-c", position: [0, 2.4, -14] },
  ];
  const allDown = targets.every((t) => hits.has(t.id));

  return (
    <>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.6, 6] }}>
        <color attach="background" args={["#0b0d12"]} />
        <fog attach="fog" args={["#0b0d12", 30, 80]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#9fb4d8", "#20242d", 0.6]} />
        <directionalLight
          position={[10, 18, 6]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Physics>
          {/* floor */}
          <RigidBody type="fixed" colliders="cuboid">
            <mesh position={[0, -0.5, 0]} userData={{ isWall: true }} receiveShadow>
              <boxGeometry args={[ROOM * 2, 1, ROOM * 2]} />
              <meshStandardMaterial color="#20242d" />
            </mesh>
          </RigidBody>

          {/* perimeter */}
          <Wall position={[0, WALL_H / 2, -ROOM]} size={[ROOM * 2, WALL_H, 1]} />
          <Wall position={[0, WALL_H / 2, ROOM]} size={[ROOM * 2, WALL_H, 1]} />
          <Wall position={[-ROOM, WALL_H / 2, 0]} size={[1, WALL_H, ROOM * 2]} />
          <Wall position={[ROOM, WALL_H / 2, 0]} size={[1, WALL_H, ROOM * 2]} />

          {/* interior dividers */}
          <Wall position={[-3, WALL_H / 2, -6]} size={[1, WALL_H, 12]} />
          <Wall position={[5, WALL_H / 2, -10]} size={[12, WALL_H, 1]} />

          {targets.map((t) => (
            <Target
              key={t.id}
              id={t.id}
              position={t.position}
              hit={hits.has(t.id)}
              onHit={handleTargetHit}
            />
          ))}

          <Player spawnPosition={[0, 2, 4]} onTargetHit={handleTargetHit} />
        </Physics>
      </Canvas>

      <div className="hud">
        Click to lock &nbsp;·&nbsp; <b>WASD</b> move &nbsp;·&nbsp; <b>Space</b> jump
        &nbsp;·&nbsp; <b>Left-click</b> fire
        <br />
        Targets disabled: {hits.size} / {targets.length}
        {allDown ? "  —  gate open ✔" : ""}
      </div>
    </>
  );
}
