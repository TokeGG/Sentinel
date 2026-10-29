// Lab data sources: reference data for reporting and triage only (never scanning).
import { arr, cap, enc, has, json, obj, str, type DataSource } from "./types.ts";

export const LAB_SOURCES: DataSource[] = [
  {
    id: "nvd", category: "lab", name: "NVD CVE API 2.0", about: "NIST vulnerability records by keyword (key optional, rate-limited without one).", sample: "openssl", keyOptional: true,
    request: (q) => ({ url: `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${enc(q)}&resultsPerPage=10` }),
    parse: (t) => cap(arr(obj(json(t)).vulnerabilities).map((v) => {
      const c = obj(obj(v).cve), m = obj(c.metrics);
      const score = str(obj(obj(arr(m.cvssMetricV31)[0]).cvssData).baseScore);
      const d = str(obj(arr(c.descriptions).find((x) => obj(x).lang === "en")).value);
      return { title: str(c.id), detail: `${score ? `CVSS ${score} · ` : ""}${d.slice(0, 200)}`, url: `https://nvd.nist.gov/vuln/detail/${str(c.id)}` };
    })),
  },
  {
    id: "cisa-kev", category: "lab", name: "CISA KEV catalog", about: "CISA's catalog of vulnerabilities seen used in the wild (one JSON file, filtered locally).", sample: "microsoft",
    request: () => ({ url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" }),
    parse: (t, q) => cap(arr(obj(json(t)).vulnerabilities).map(obj)
      .filter((v) => has(`${str(v.cveID)} ${str(v.vendorProject)} ${str(v.product)} ${str(v.vulnerabilityName)}`, q))
      .map((v) => ({ title: `${str(v.cveID)} ${str(v.vendorProject)} ${str(v.product)}`, detail: `${str(v.vulnerabilityName)} · added ${str(v.dateAdded)}` }))),
  },
  {
    id: "osv", category: "lab", name: "OSV.dev", about: "Open-source package advisories. Query: name or ecosystem:name (default npm).", sample: "npm:lodash",
    request: (q) => {
      const [eco, name] = q.includes(":") ? q.split(":", 2) : ["npm", q];
      return { url: "https://api.osv.dev/v1/query", method: "POST", body: JSON.stringify({ package: { name: name.trim(), ecosystem: eco.trim() } }) };
    },
    parse: (t) => cap(arr(obj(json(t)).vulns).map(obj).map((v) => ({ title: str(v.id), detail: str(v.summary).slice(0, 200), url: `https://osv.dev/vulnerability/${str(v.id)}` }))),
  },
];
