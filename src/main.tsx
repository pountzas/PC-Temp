import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PRODUCT_NAME } from "./lib/product";

function WidgetPlaceholder() {
  return (
    <main
      style={{
        margin: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        color: "rgba(255,255,255,0.72)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        userSelect: "none",
      }}
    >
      {PRODUCT_NAME} widget placeholder
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WidgetPlaceholder />
  </StrictMode>,
);