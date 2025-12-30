import { ThemeProvider } from "next-themes";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const url = new URL(window.location.href);
const theme = url.searchParams.get("theme");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme={theme || "dark"} enableSystem={false}>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
