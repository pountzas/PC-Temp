import { PrimitivesDemo } from "./components/PrimitivesDemo";

function isPrimitivesDemoRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    new URLSearchParams(window.location.search).get("demo") === "primitives"
  );
}
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

export default function App() {
  const settings = useSettings();
  const tick = useSensors(settings.intervalMs);

  useFocusClass();
  useDock();
  useSettingsDim(settings);

  if (isPrimitivesDemoRoute()) {
    return <PrimitivesDemo />;
  }

  switch (settings.view) {
    case "expanded":
      return <ExpandedView tick={tick} />;
    case "pill":
      return <PillView tick={tick} />;
    case "compact":
    default:
      return <CompactView tick={tick} />;
  }
}
