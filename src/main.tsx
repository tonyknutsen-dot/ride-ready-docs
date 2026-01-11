import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize the app with StrictMode disabled in production for performance
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
