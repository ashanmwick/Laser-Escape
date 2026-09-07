import { useNetwork } from "../network/NetworkContext.jsx";
import RemotePlayer from "./RemotePlayer.jsx";

// maxCount caps how many other players get a full skinned-mesh render (each
// is a cloned model, bone-posed every frame) -- on lower quality tiers this
// keeps a crowded room from scaling the frame cost with player count.
export default function RemotePlayers({ maxCount = Infinity }) {
  const { remoteIds, remotePlayersRef } = useNetwork();
  const ids = [...remoteIds].slice(0, maxCount);
  return ids.map((id) => (
    <RemotePlayer key={id} sessionId={id} remotePlayersRef={remotePlayersRef} />
  ));
}
