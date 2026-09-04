import { useEffect, useState } from "react";

function detect() {
  if (typeof window === "undefined") return false;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  return hasTouch && coarsePointer;
}

// True for touch-primary devices (phones/tablets), re-evaluated on
// resize/orientationchange so a detachable-keyboard tablet or devtools
// device emulation toggle updates without a full reload.
export default function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(detect);

  useEffect(() => {
    const update = () => setIsTouch(detect());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return isTouch;
}
