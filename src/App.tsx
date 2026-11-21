import { lazy, Suspense } from "react";
import { CompactView } from "./views/compact/CompactView";
import { ExpandedView } from "./views/expanded/ExpandedView";
import { PillView } from "./views/pill/PillView";
import { useSettingsDim } from "./views/settings/useSettingsDim";
import { useSensors } from "./ipc/useSensors";
import { useSettings } from "./ipc/useSettings";
import { useDock } from "./window/dock";
import { useFocusClass } from "./window/focus";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/unfocused.css";

const PrimitivesDemo =
  import.meta.env.VITE_MOCK_SENSORS === "1"
    ? lazy(() =>
        import("./components/PrimitivesDemo").then((m) => ({
          default: m.PrimitivesDemo,
        })),
      )
    : null;

function isPrimitivesDemoRoute(): boolean {
  return (
    PrimitivesDemo !== null &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "primitives"
  );
}

export default function App() {
  const settings = useSettings();
  const tick = useSensors(settings.intervalMs);

  useFocusClass();
  useDock();
  useSettingsDim(settings);

  if (PrimitivesDemo && isPrimitivesDemoRoute()) {
    return (
      <Suspense fallback={null}>
        <PrimitivesDemo />
      </Suspense>
    );
  }

  switch (settings.view) {
    case "expanded":
      return <ExpandedView tick={tick} />;
    case "pill":
      return <PillView tick={tick} />;
    case "compact":
    default:
      return <CompactView />;
  }
}
