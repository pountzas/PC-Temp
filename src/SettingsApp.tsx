import { useSettings } from "./ipc/useSettings";
import { SettingsView } from "./views/settings/SettingsView";
import { useFocusClass } from "./window/focus";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import "./styles/unfocused.css";
import "./views/settings/settings-backdrop.css";

export default function SettingsApp() {
  const settings = useSettings();
  useFocusClass();
  return <SettingsView settings={settings} />;
}
