import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Listens for global events from MobileBottomNav and clicks the correct buttons,
 * or navigates to the right screen and then clicks.
 */
export default function GlobalEventBridge() {
  const nav = useNavigate();
  const loc = useLocation();

  const clickById = (id: string) => {
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el) {
      el.click();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const addRide = () => {
      // Try to click Add Ride button if present
      if (clickById("rrd-btn-add-ride")) return;
      // Go to Workspace tab, then click
      if (loc.pathname !== "/dashboard" || new URLSearchParams(loc.search).get("tab") !== "workspace") {
        nav("/dashboard?tab=workspace");
        setTimeout(() => clickById("rrd-btn-add-ride"), 120);
      }
    };

    const uploadDoc = () => {
      if (clickById("rrd-btn-upload-doc")) return;
      // Go to Documents tab within dashboard/workspace and then click
      if (loc.pathname !== "/dashboard" || new URLSearchParams(loc.search).get("tab") !== "workspace") {
        nav("/dashboard?tab=workspace");
      }
      setTimeout(() => clickById("rrd-btn-upload-doc"), 120);
    };

    const startCheck = () => {
      if (clickById("rrd-start-check")) return;
      // Go to Checks page then click
      if (loc.pathname !== "/checks") nav("/checks");
      setTimeout(() => clickById("rrd-start-check"), 120);
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
