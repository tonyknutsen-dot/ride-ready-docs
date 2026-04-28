import React from "react"; // refreshed
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { redirectToCanonicalOriginIfNeeded } from "./config/canonicalOrigin";

const redirectedToCanonicalOrigin = redirectToCanonicalOriginIfNeeded();

// Stability mode: unregister any existing service workers so stale PWA shells
// or cached bundles cannot interfere with check-save testing.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => {
      r.active?.postMessage({ type: 'SKIP_WAITING' });
      r.waiting?.postMessage({ type: 'SKIP_WAITING' });
      r.unregister();
    });
  });
}

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => caches.delete(key));
  });
}

// Initialize the app with StrictMode disabled in production for performance
const root = createRoot(document.getElementById("root")!);
if (!redirectedToCanonicalOrigin) {
  root.render(<App />);
}
