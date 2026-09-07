import { useEffect, useState } from "react";
import { useNetwork } from "../network/NetworkContext.jsx";

const CONNECTED_TOAST_MS = 2500;

/**
 * Surfaces NetworkContext's connect loop so a Render free-tier cold start
 * (server asleep, 30-60s+ to wake) reads as "hang on" instead of a silently
 * broken multiplayer. Purely informational -- the game is already fully
 * playable offline (see NetworkContext.jsx), so this never blocks input.
 *
 * Stays silent on the normal fast path (server already warm, "connecting"
 * resolves in well under a second) and only speaks up once the player would
 * actually notice something is off: past WAKING_AFTER_MS with no result, or
 * after auto-retries are exhausted.
 */
export default function ConnectionStatus() {
  const { connectionStatus, attempt, retryNow } = useNetwork();
  const [hadToWait, setHadToWait] = useState(false);
  const [showConnectedToast, setShowConnectedToast] = useState(false);

  useEffect(() => {
    if (connectionStatus === "waking" || connectionStatus === "offline") setHadToWait(true);
  }, [connectionStatus]);

  useEffect(() => {
    if (connectionStatus !== "connected" || !hadToWait) return;
    setShowConnectedToast(true);
    const t = setTimeout(() => setShowConnectedToast(false), CONNECTED_TOAST_MS);
    return () => clearTimeout(t);
    // hadToWait is intentionally excluded -- this toast should only fire once,
    // the moment status flips to "connected", not re-arm if hadToWait changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

  if (connectionStatus === "waking") {
    return (
      <div className="connection-status connection-status--waking" role="status">
        <span className="connection-status__spinner" aria-hidden="true" />
        <div className="connection-status__text">
          <strong>Waking up multiplayer server{attempt > 1 ? ` (attempt ${attempt})` : ""}…</strong>
          <span>First connect can take up to a minute — you can keep playing.</span>
        </div>
      </div>
    );
  }

  if (connectionStatus === "offline") {
    return (
      <div className="connection-status connection-status--offline" role="status">
        <span className="connection-status__text">
          <strong>Multiplayer unavailable</strong>
          <span>Playing offline — your progress isn't affected.</span>
        </span>
        <button type="button" className="connection-status__retry" onClick={retryNow}>
          Retry
        </button>
      </div>
    );
  }

  if (connectionStatus === "connected" && showConnectedToast) {
    return (
      <div className="connection-status connection-status--connected" role="status">
        Multiplayer connected
      </div>
    );
  }

  // "connecting" on the normal fast path, or a settled "connected" with no
  // toast left to show -- nothing worth telling the player about.
  return null;
}
