import { useNetwork } from "../network/NetworkContext.jsx";
import RemotePlayer from "./RemotePlayer.jsx";

export default function RemotePlayers() {
  const { remoteIds, remotePlayersRef } = useNetwork();
  return [...remoteIds].map((id) => (
    <RemotePlayer key={id} sessionId={id} remotePlayersRef={remotePlayersRef} />
  ));
}
