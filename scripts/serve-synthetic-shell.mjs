// Isolated static fixture only: no application server, dotenv, credentials, providers or API routes.
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = fs.realpathSync(path.resolve('qa/synthetic-shell/artifacts'));
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch { res.writeHead(400); res.end(); return; }
  const candidate = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
  if (!candidate.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
  try {
    const file = fs.realpathSync(candidate);
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)];
    if (!type) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', type); res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
server.listen(4179, '127.0.0.1', () => console.log('Synthetic shell only: http://127.0.0.1:4179'));
process.on('SIGINT', () => server.close());
