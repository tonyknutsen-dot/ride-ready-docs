import React from "react"; // refreshed
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline-first PWA support
// Skip in dev/preview environments to prevent stale-cache issues
const _hostname = window.location.hostname;
const _isDevEnv = _hostname === 'localhost' || _hostname.includes('lovableproject.com') || _hostname.includes('lovable.app');

if ('serviceWorker' in navigator && !_isDevEnv) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('[PWA] SW registration failed:', err);
    });
  });
} else if (_isDevEnv && 'serviceWorker' in navigator) {
  // Unregister any previously registered SW in preview to clear stale caches
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Initialize the app with StrictMode disabled in production for performance
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
