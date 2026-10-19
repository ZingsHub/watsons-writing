/* Tiny static file server for Railway. No dependencies. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    /* the page and the service worker must always be fresh; images can be cached */
    headers['Cache-Control'] = (ext === '.png' || ext === '.mp3') ? 'public, max-age=86400' : 'no-cache';
    if (path.basename(file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    const compressible = ['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt'].includes(ext);
    if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      zlib.gzip(data, (e, z) => {
        if (e) { res.writeHead(200, headers); return res.end(data); }
        headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers); res.end(z);
      });
    } else { res.writeHead(200, headers); res.end(data); }
  });
}).listen(PORT, '0.0.0.0', () => console.log('Watson\'s Writing listening on ' + PORT));
