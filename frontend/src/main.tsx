import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

// Force dark mode
document.documentElement.classList.add("dark");

// Initialize PostHog analytics
initPostHog();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
