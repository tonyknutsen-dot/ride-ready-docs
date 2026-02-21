import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for offline-first PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('[PWA] SW registration failed:', err);
    });
  });
}

// Initialize the app with StrictMode disabled in production for performance
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
