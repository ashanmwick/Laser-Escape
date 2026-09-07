import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { NetworkProvider } from "./network/NetworkContext.jsx";
import "./styles.css";

// No <StrictMode>: react-three/fiber v8 + rapier are not double-invoke safe.
createRoot(document.getElementById("root")).render(
  <NetworkProvider>
    <App />
  </NetworkProvider>,
);
