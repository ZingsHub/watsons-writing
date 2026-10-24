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
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
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
    headers['Cache-Control'] = (ext === '.png' || ext === '.mp3' || ext === '.woff2') ? 'public, max-age=86400' : 'no-cache';
    if (path.basename(file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    /* Safari's <audio> asks for byte ranges and will not play clips without them */
    if (ext === '.mp3') {
      headers['Accept-Ranges'] = 'bytes';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        let start = m[1] ? +m[1] : Math.max(0, data.length - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
        if (start > end || start >= data.length) { res.writeHead(416, { 'Content-Range': 'bytes */' + data.length }); return res.end(); }
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + data.length;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers); return res.end(data.subarray(start, end + 1));
      }
    }
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
