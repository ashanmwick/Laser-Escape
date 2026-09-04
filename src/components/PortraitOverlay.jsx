import { useEffect, useState } from "react";

function isPortrait() {
  return window.matchMedia?.("(orientation: portrait)").matches ?? false;
}

// Full-screen prompt shown on touch devices while held in portrait; the game
// is designed and laid out for landscape play.
export default function PortraitOverlay() {
  const [portrait, setPortrait] = useState(isPortrait);

  useEffect(() => {
    const update = () => setPortrait(isPortrait());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!portrait) return null;

  return (
    <div className="portrait-overlay">
      <div className="portrait-overlay__icon" aria-hidden="true">
        ⟳
      </div>
      <p>Rotate your device for the best experience</p>
    </div>
  );
}
