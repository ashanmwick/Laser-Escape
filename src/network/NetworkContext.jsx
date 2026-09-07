import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Client, Callbacks } from "@colyseus/sdk";

export const ARENA_ROOM_NAME = "arena";
export const MOVE_SEND_INTERVAL_MS = 66; // ~15Hz
export const WALL_DAMAGE_SEND_INTERVAL_MS = 120;

const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL ?? "http://localhost:2567";

const NetworkContext = createContext(null);

/**
 * Owns the Colyseus connection to the single global "arena" room and exposes
 * it via context. `Player.jsx` and `RemotePlayers.jsx` are siblings deep
 * under <Canvas><Physics>, both need the same room/send-functions -- a
 * context avoids threading them through App.jsx -> World.jsx, which don't
 * otherwise need to know about networking. The context value itself never
 * changes shape after mount; per-frame data (remote player transforms) lives
 * in `remotePlayersRef`, not context state, so it never causes a re-render.
 *
 * The game must stay fully playable if the server is unreachable (there's no
 * deploy story yet) -- every send* function below is a no-op when
 * disconnected, and connection happens in the background after mount rather
 * than gating render on it.
 */
export function NetworkProvider({ children }) {
  const roomRef = useRef(null);
  const [connected, setConnected] = useState(false);
  // sessionId -> raw PlayerState schema instance. Its fields are mutated in
  // place by the decoder as patches arrive, so consumers can poll them
  // directly each frame instead of needing a listener per field.
  const remotePlayersRef = useRef(new Map());
  // Join/leave only -- rare churn, fine as React state to drive mount/unmount
  // of <RemotePlayer> components.
  const [remoteIds, setRemoteIds] = useState(() => new Set());

  useEffect(() => {
    let disposed = false;
    const client = new Client(SERVER_URL);
    client
      .joinOrCreate(ARENA_ROOM_NAME)
      .then((room) => {
        if (disposed) {
          room.leave();
          return;
        }
        roomRef.current = room;
        const callbacks = Callbacks.get(room);

        callbacks.onAdd("players", (playerState, sessionId) => {
          if (sessionId === room.sessionId) return; // never render ourselves as a remote
          remotePlayersRef.current.set(sessionId, playerState);
          setRemoteIds((prev) => new Set(prev).add(sessionId));
        });
        callbacks.onRemove("players", (_playerState, sessionId) => {
          remotePlayersRef.current.delete(sessionId);
          setRemoteIds((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
        });

        setConnected(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[network] could not connect to arena room, playing offline:", err);
      });
    return () => {
      disposed = true;
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({
      roomRef,
      connected,
      remotePlayersRef,
      remoteIds,
      sendMove: (payload) => roomRef.current?.send("move", payload),
      sendWallDamage: (wallType, hp) => roomRef.current?.send("wallDamage", { wallType, hp }),
      sendWallDestroyed: (wallType) => roomRef.current?.send("wallDestroyed", { wallType }),
      sendTargetHit: (targetId) => roomRef.current?.send("targetHit", { targetId }),
      sendWinPanelHit: () => roomRef.current?.send("winPanelHit", {}),
    }),
    [connected, remoteIds],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
