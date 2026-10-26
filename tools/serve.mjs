// A static file server for the repository's root, for playing by hand and for the browser scripts that need one
// running (browser-shell, browser-0c). Python's `http.server` refuses some of the ~150 module requests a boot makes
// at once on Windows (about one boot in five there stalls on net::ERR_CONNECTION_REFUSED); this one doesn't.
//   node tools/serve.mjs [port]      (default 8130; 127.0.0.1 only; Ctrl+C stops it)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".md": "text/plain; charset=utf-8",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
const port = Number(process.argv[2]) || 8130;

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
server.listen(port, "127.0.0.1", () => console.log(`serving ${ROOT} at http://127.0.0.1:${port}/ (Ctrl+C stops it)`));
