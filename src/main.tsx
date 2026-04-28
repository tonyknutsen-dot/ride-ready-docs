import React from "react"; // refreshed
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Stability mode: unregister any existing service workers so stale PWA shells
// or cached bundles cannot interfere with check-save testing.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Initialize the app with StrictMode disabled in production for performance
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
