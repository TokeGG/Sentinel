// Small bundled MAC vendor table (best effort: common home-network makers only; anything else is "unknown vendor").
// Key = first 3 bytes of the MAC, upper-case hex, no separators.
const OUI: Record<string, string> = {
  B827EB: "Raspberry Pi", DCA632: "Raspberry Pi", E45F01: "Raspberry Pi", D83ADD: "Raspberry Pi", "2CCF67": "Raspberry Pi",
  "000C29": "VMware", "005056": "VMware", "000569": "VMware", "080027": "VirtualBox", "00155D": "Microsoft Hyper-V", "0050F2": "Microsoft",
  "000393": "Apple", "000A95": "Apple", "001124": "Apple", "3C0754": "Apple", F01898: "Apple", A483E7: "Apple",
  "3C5AB4": "Google", F4F5D8: "Google", FC65DE: "Amazon", "44650D": "Amazon", "000E58": "Sonos", "5CAAFD": "Sonos",
  "240AC4": "Espressif (IoT)", "30AEA4": "Espressif (IoT)", A4CF12: "Espressif (IoT)",
  "002722": "Ubiquiti", "24A43C": "Ubiquiti", "44D9E7": "Ubiquiti", F09FC2: "Ubiquiti",
  "50C7BF": "TP-Link", "14CC20": "TP-Link", "00095B": "Netgear", "204E7F": "Netgear", "000C41": "Linksys", "001195": "D-Link", "001150": "Belkin",
  "001132": "Synology", "001B21": "Intel", "3CA9F4": "Intel", "001422": "Dell", "001B78": "HP", "001A92": "ASUS", "00000C": "Cisco",
  "001247": "Samsung", "0009BF": "Nintendo", B0A737: "Roku", "001315": "Sony",
};

export function normalizeMac(mac: string): string | null {
  const h = mac.trim().toLowerCase().replace(/[:\-.]/g, "");
  return /^[0-9a-f]{12}$/.test(h) ? h.match(/../g)!.join(":") : null;
}

/** Phones and laptops often use a random per-network MAC (locally administered bit set): no vendor can be known. */
export const isRandomMac = (mac: string) => {
  const n = normalizeMac(mac);
  return !!n && (parseInt(n.slice(0, 2), 16) & 2) !== 0;
};

export function vendorOf(mac: string): string {
  const n = normalizeMac(mac);
  if (!n) return "unknown vendor";
  if (isRandomMac(n)) return "private (randomized) MAC";
  return OUI[n.slice(0, 8).replace(/:/g, "").toUpperCase()] ?? "unknown vendor";
}
