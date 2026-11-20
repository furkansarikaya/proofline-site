// Local static server for dist/, used by the browser checks (tests/axe.mjs) and the node tests. Binds 127.0.0.1 only.
//   import { startServer } from './serve-dist.mjs';  const { url, close } = await startServer({ root: 'dist' });
//   node scripts/serve-dist.mjs [root]               prints the URL and serves until stopped
// Semantics: GET and HEAD only; /x/ serves x/index.html; /x for a directory answers 308 to /x/; no other file mapping;
// a missing file answers 404 with the body of root/404.html; a path that leaves root answers 404. Vercel header rules are out of scope.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

export async function startServer({ root = 'dist', port = 0 } = {}) {
  const base = resolve(root);

  function send(res, method, status, type, body, extra = {}) {
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': body.length, ...extra });
    res.end(method === 'HEAD' ? undefined : body);
  }

  function notFound(res, method) {
    const page = join(base, '404.html');
    send(res, method, 404, TYPES['.html'], existsSync(page) ? readFileSync(page) : Buffer.from('Not found'));
  }

  const server = createServer((req, res) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return send(res, method, 405, TYPES['.txt'], Buffer.from('Method not allowed'), { Allow: 'GET, HEAD' });
    const rawPath = (req.url ?? '/').split('?')[0].split('#')[0];
    let path;
    try { path = decodeURIComponent(rawPath); } catch { return notFound(res, method); }
    if (!path.startsWith('/') || path.includes('\0')) return notFound(res, method);
    const target = resolve(base, `.${path}`);
    if (target !== base && !target.startsWith(base + sep)) return notFound(res, method);
    let file = target;
    if (existsSync(target) && statSync(target).isDirectory()) {
      if (!path.endsWith('/')) return send(res, method, 308, TYPES['.txt'], Buffer.alloc(0), { Location: `/${rawPath.replace(/^\/+/, '')}/` });
      file = join(target, 'index.html');
    } else if (path.endsWith('/')) {
      return notFound(res, method);
    }
    if (!existsSync(file) || !statSync(file).isFile()) return notFound(res, method);
    send(res, method, 200, TYPES[extname(file)] ?? 'application/octet-stream', readFileSync(file));
  });

  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', done);
  });
  const { port: bound } = server.address();
  return {
    url: `http://127.0.0.1:${bound}`,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections();
    }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer({ root: process.argv[2] ?? 'dist' });
  console.log(url);
}
