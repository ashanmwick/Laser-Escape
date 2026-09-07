import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Client, Callbacks } from "@colyseus/sdk";

export const ARENA_ROOM_NAME = "arena";
export const MOVE_SEND_INTERVAL_MS = 66; // ~15Hz
export const WALL_DAMAGE_SEND_INTERVAL_MS = 120;

const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL ?? "http://localhost:2567";

// The server runs on Render's free tier, which spins the instance down after
// idle and takes 30-60s (occasionally longer) to wake back up on the next
// request. Render's proxy queues the request rather than rejecting it, so a
// cold-start joinOrCreate() call just hangs -- ATTEMPT_TIMEOUT_MS is a
// client-side safety net in case it hangs forever instead (dropped
// connection, proxy hiccup), not the expected cold-start path.
const ATTEMPT_TIMEOUT_MS = 60000;
const WAKING_AFTER_MS = 3000; // above this with no result yet, assume cold start and say so
const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];
const MAX_AUTO_ATTEMPTS = 6;

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
 * The game must stay fully playable if the server is unreachable or still
 * cold-starting -- every send* function below is a no-op when disconnected,
 * and connection happens in the background after mount rather than gating
 * render on it. `connectionStatus` (+ `attempt`/`retryNow`) is exposed so a
 * UI layer (ConnectionStatus.jsx) can tell the player "waking up the
 * server..." instead of silently failing.
 */
export function NetworkProvider({ children }) {
  const roomRef = useRef(null);
  const [connected, setConnected] = useState(false);
  // "connecting" | "waking" | "connected" | "offline"
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [attempt, setAttempt] = useState(1);
  const [retryToken, setRetryToken] = useState(0);
  // sessionId -> raw PlayerState schema instance. Its fields are mutated in
  // place by the decoder as patches arrive, so consumers can poll them
  // directly each frame instead of needing a listener per field.
  const remotePlayersRef = useRef(new Map());
  // Join/leave only -- rare churn, fine as React state to drive mount/unmount
  // of <RemotePlayer> components.
  const [remoteIds, setRemoteIds] = useState(() => new Set());

  useEffect(() => {
    let disposed = false;
    let attemptId = 0;
    let retryTimer = null; // always the most recently scheduled retry, for unmount cleanup
    const client = new Client(SERVER_URL);

    const attach = (room) => {
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

      room.onLeave(() => {
        if (disposed) return;
        // Server-initiated disconnect (e.g. Render idled the instance back
        // out from under us) -- drop back into the connect loop instead of
        // staying stuck "connected" with a dead room.
        roomRef.current = null;
        remotePlayersRef.current.clear();
        setRemoteIds(new Set());
        setConnected(false);
        attemptConnect(1);
      });

      setConnected(true);
      setConnectionStatus("connected");
    };

    // Render's proxy queues a request while the free-tier instance cold-boots
    // rather than rejecting it, so a slow joinOrCreate() is the *expected*
    // path, not an error -- ATTEMPT_TIMEOUT_MS below only guards against a
    // request that hangs forever (dropped connection, proxy hiccup). Because
    // that request is never cancelled, giving up on it client-side must not
    // stop us from honoring a *late* success: each attempt tracks its own
    // `settled` flag and, on late success, defers to whichever attempt
    // (possibly a later one) already attached the room.
    const attemptConnect = (attemptIndex) => {
      if (disposed) return;
      attemptId += 1;
      const thisAttemptId = attemptId;
      let settled = false;
      setAttempt(attemptIndex);
      setConnectionStatus("connecting");

      const wakingTimer = setTimeout(() => {
        if (!disposed && !settled && attemptId === thisAttemptId) setConnectionStatus("waking");
      }, WAKING_AFTER_MS);

      const scheduleRetryOrGiveUp = () => {
        if (disposed || attemptId !== thisAttemptId) return; // superseded already
        if (attemptIndex >= MAX_AUTO_ATTEMPTS) {
          setConnectionStatus("offline");
          return;
        }
        const delay = RETRY_DELAYS_MS[Math.min(attemptIndex - 1, RETRY_DELAYS_MS.length - 1)];
        retryTimer = setTimeout(() => attemptConnect(attemptIndex + 1), delay);
      };

      const giveUpTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        clearTimeout(wakingTimer);
        // eslint-disable-next-line no-console
        console.warn(`[network] connect attempt ${attemptIndex} timed out client-side, retrying`);
        scheduleRetryOrGiveUp();
      }, ATTEMPT_TIMEOUT_MS);

      client
        .joinOrCreate(ARENA_ROOM_NAME)
        .then((room) => {
          clearTimeout(wakingTimer);
          clearTimeout(giveUpTimer);
          if (disposed || roomRef.current) {
            // Disposed, or a different attempt already attached first (this
            // one arrived late after we'd already given up on it) -- either
            // way, don't hold a second seat in the room.
            room.leave();
            return;
          }
          settled = true;
          clearTimeout(retryTimer); // a connection landed; cancel any pending re-attempt
          attach(room);
        })
        .catch((err) => {
          clearTimeout(wakingTimer);
          clearTimeout(giveUpTimer);
          if (settled) return; // giveUpTimer already handled this attempt
          settled = true;
          // eslint-disable-next-line no-console
          console.warn(`[network] connect attempt ${attemptIndex} failed:`, err);
          scheduleRetryOrGiveUp();
        });
    };

    attemptConnect(1);

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      roomRef.current?.leave();
      roomRef.current = null;
    };
  }, [retryToken]);

  // Lets the UI re-arm the connect loop from "offline" without a full page
  // reload once the player asks to retry.
  const retryNow = useCallback(() => setRetryToken((t) => t + 1), []);

  const value = useMemo(
    () => ({
      roomRef,
      connected,
      connectionStatus,
      attempt,
      retryNow,
      remotePlayersRef,
      remoteIds,
      sendMove: (payload) => roomRef.current?.send("move", payload),
      sendWallDamage: (wallType, hp) => roomRef.current?.send("wallDamage", { wallType, hp }),
      sendWallDestroyed: (wallType) => roomRef.current?.send("wallDestroyed", { wallType }),
      sendTargetHit: (targetId) => roomRef.current?.send("targetHit", { targetId }),
      sendWinPanelHit: () => roomRef.current?.send("winPanelHit", {}),
    }),
    [connected, connectionStatus, attempt, retryNow, remoteIds],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
