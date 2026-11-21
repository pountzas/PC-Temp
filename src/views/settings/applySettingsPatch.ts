import { updateSettings } from "../../ipc/commands";

export async function applySettingsPatch(
  partial: Parameters<typeof updateSettings>[0],
): Promise<void> {
  try {
    await updateSettings(partial);
  } catch (error) {
    console.warn("settings patch failed", partial, error);
  }
}
