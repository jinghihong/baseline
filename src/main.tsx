import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme, getWorkspace } from "./state/store";

applyTheme(getWorkspace().theme);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getWorkspace().theme === "system") applyTheme("system");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
