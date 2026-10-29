import { registerModule, type ModuleManifest } from "../../core/module";
import { loadDevices } from "./netStore";
import { deviceInfoSave, forgetDevice, scanNetwork, sendToLab, tagDevice } from "./ops";
import { homenetSections } from "./panelLogic";

export const homeNetModule: ModuleManifest = {
  id: "hub.homenet",
  name: "Home Network",
  accent: "#02aa94",
  ring: "system",
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
  ],
  load: loadDevices,
  actions: [{ label: "Scan now", skill: "scan_network" }],
};

registerModule(homeNetModule);
