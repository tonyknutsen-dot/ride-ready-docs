import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Listens for global events from MobileBottomNav and clicks the correct buttons,
 * or navigates to the right screen and then clicks.
 */
export default function GlobalEventBridge() {
  const nav = useNavigate();
  const loc = useLocation();

  const clickById = (id: string, retries = 5) => {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el) {
      el.click();
      return true;
    }
    // Retry a few times with increasing delays if button not found
    if (retries > 0) {
      setTimeout(() => clickById(id, retries - 1), 150);
    }
    return false;
  };

  useEffect(() => {
    const addRide = () => {
      // Try to click Add Ride button if present
      if (document.getElementById("rrd-btn-add-ride")) {
        clickById("rrd-btn-add-ride");
        return;
      }
      // Go to rides tab to show RideManagement
      nav("/dashboard?tab=rides");
      setTimeout(() => clickById("rrd-btn-add-ride"), 200);
    };

    const uploadDoc = () => {
      if (document.getElementById("rrd-btn-upload-doc")) {
        clickById("rrd-btn-upload-doc");
        return;
      }
      // Go to workspace tab for documents
      nav("/dashboard?tab=workspace");
      setTimeout(() => clickById("rrd-btn-upload-doc"), 200);
    };

    const startCheck = () => {
      if (document.getElementById("rrd-start-check")) {
        clickById("rrd-start-check");
        return;
      }
      // Go to Checks page
      nav("/checks");
      setTimeout(() => clickById("rrd-start-check"), 200);
    };

    window.addEventListener("rrd:add-ride", addRide);
    window.addEventListener("rrd:upload-doc", uploadDoc);
    window.addEventListener("rrd:start-check", startCheck);

    return () => {
      window.removeEventListener("rrd:add-ride", addRide);
      window.removeEventListener("rrd:upload-doc", uploadDoc);
      window.removeEventListener("rrd:start-check", startCheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, loc.search]);

  return null;
}
