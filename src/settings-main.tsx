import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PRODUCT_NAME } from "./lib/product";

function SettingsPlaceholder() {
  return (
    <main
      style={{
        margin: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d1f25",
        color: "rgba(255,255,255,0.88)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      {PRODUCT_NAME} settings placeholder
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsPlaceholder />
  </StrictMode>,
);