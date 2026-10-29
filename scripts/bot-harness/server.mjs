// Tiny static server for the fixture pages on 127.0.0.1 (random port).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

export function serve() {
  const srv = createServer(async (req, res) => {
    const name = new URL(req.url, "http://x").pathname.replace(/^\//, "") || "search.html";
    if (!/^[a-z0-9]+\.html$/.test(name)) { res.writeHead(404).end(); return; }
    try { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(await readFile(new URL(`fixtures/${name}`, import.meta.url))); }
    catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ base: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() })));
}
