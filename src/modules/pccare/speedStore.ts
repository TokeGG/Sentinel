// Manual speed test (button only, never scheduled): downloads a fixed 25 MB file and records the result.
import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { mbps, SPEED_URL } from "./netcheck";

export interface SpeedRow { id: number; at: string; mbps: number; bytes: number; ms: number }

export async function speedHistory(): Promise<SpeedRow[]> {
  return (await getDb()).select<SpeedRow[]>("SELECT * FROM pc_speed_tests ORDER BY id DESC LIMIT 30");
}

export async function runSpeedTest(): Promise<SpeedRow[]> {
  const t0 = performance.now();
  const res = await fetch(SPEED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`speed endpoint answered ${res.status}`);
  const bytes = (await res.arrayBuffer()).byteLength;
  const ms = Math.round(performance.now() - t0);
  const v = mbps(bytes, ms);
  await (await getDb()).execute("INSERT INTO pc_speed_tests (mbps, bytes, ms) VALUES ($1,$2,$3)", [v, bytes, ms]);
  await logActivity("pccare", "speed_test", SPEED_URL, `${v} Mbps`);
  return speedHistory();
}
