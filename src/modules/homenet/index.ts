import { registerModule, type ModuleManifest } from "../../core/module";
import { loadDevices } from "./netStore";
import { deviceInfoSave, forgetDevice, scanNetwork, sendToLab, tagDevice } from "./ops";
import { homenetSections } from "./panelLogic";
import { markEventsSeen, newDeviceCount, pingAll, setIcon, wakeDevice } from "./netOps";

export const homeNetModule: ModuleManifest = {
  id: "hub.homenet",
  name: "Home Network",
  accent: "#02aa94",
  ring: "system",
  category: "system",
  icon: "homenet",
  description:
    "Devices from your OS's own ARP cache — passive, no active scan. Doubles as the allow-list source for the Pentest Lab's own-infrastructure scope; \"Send to Lab\" adds a device to an active engagement.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: homenetSections },
  skills: [
    { name: "scan_network", run: scanNetwork },
    { name: "tag_device", run: tagDevice },
    { name: "forget_device", run: forgetDevice },
    { name: "device_info", run: deviceInfoSave },
    { name: "send_to_lab", run: sendToLab },
    { name: "ping_all", run: pingAll },
    { name: "wake_device", run: wakeDevice },
    { name: "set_icon", run: setIcon },
    { name: "mark_events_seen", run: markEventsSeen },
  ],
  load: loadDevices,
  // Opt-in only: the scheduler starts nothing until the user flips "Auto-refresh" (pings for uptime history).
  schedule: { skill: "ping_all", intervalMinutes: 15 },
  badge: newDeviceCount,
  actions: [{ label: "Scan now", skill: "scan_network" }],
};

registerModule(homeNetModule);
