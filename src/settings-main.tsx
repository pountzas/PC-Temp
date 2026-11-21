import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SettingsApp from "./SettingsApp";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>,
);
