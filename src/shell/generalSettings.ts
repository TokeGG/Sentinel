// Shared save paths for the toggles that exist both in the star-map HUD
// and in the Settings panel (a different webview): one implementation each.
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { setGameModeAuto, setNotifMoons, setOrbitMotion, setOrbitSpeed, setStarMotion } from "./layoutStore";
import * as share from "./motionStore";
import { clampSpeed } from "./orbit";

/** Emitted by the Settings panel after saving; the main window re-reads. */
export const SETTINGS_CHANGED = "settings-changed";
export type SettingKey = "game_mode_auto" | "star_motion" | "orbit_motion" | "orbit_speed" | "notif_moons";
export const notifySettingsChanged = (key: SettingKey) => emit(SETTINGS_CHANGED, { key });

export async function saveGameModeAuto(enabled: boolean): Promise<void> {
  await setGameModeAuto(enabled);
  await invoke("set_game_mode_auto", { enabled });
}

export async function saveStarMotion(enabled: boolean): Promise<void> {
  await setStarMotion(enabled);
  share.setStarMotion(enabled);
}

export async function saveOrbitMotion(enabled: boolean): Promise<void> {
  await setOrbitMotion(enabled);
  share.setOrbitMotion(enabled);
}

export async function saveOrbitSpeed(speed: number): Promise<void> {
  await setOrbitSpeed(speed);
  share.setOrbitSpeed(clampSpeed(speed));
}

export async function saveNotifMoons(enabled: boolean): Promise<void> {
  await setNotifMoons(enabled);
  share.setNotifMoons(enabled);
}
