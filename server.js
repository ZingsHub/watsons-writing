/* Tiny static file server for Railway. No dependencies. It only reads files from public/; nothing is ever received or stored. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};

/* The app is one page with one inline <script>. The Content-Security-Policy allows that script by its SHA-256 hash (worked out from
   index.html, so it stays right after every change), and nothing else: no other scripts, no other sites, no frames, no plugins.
   Inline styles are allowed (the page builds its pictures with style attributes); pictures and sounds may be data:/blob: (the saved
   drawing, the silent clip that unlocks audio). The Google Form is a plain link that opens in a new tab: links are not limited by CSP. */
let cspFor = { mtime: -1, value: '' };
function csp() {
  const file = path.join(ROOT, 'index.html');
  let st; try { st = fs.statSync(file); } catch (e) { return cspFor.value; }
  if (st.mtimeMs !== cspFor.mtime) {
    const html = fs.readFileSync(file, 'utf8'), hashes = [];
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      const code = m[1].replace(/\r\n?/g, '\n');   /* browsers hash it with plain line feeds */
      hashes.push("'sha256-" + crypto.createHash('sha256').update(code, 'utf8').digest('base64') + "'");
    }
    cspFor = { mtime: st.mtimeMs, value: [
      "default-src 'self'", "script-src 'self' " + hashes.join(' '), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
      "media-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'",
      "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "frame-ancestors 'none'"
    ].join('; ') };
  }
  return cspFor.value;
}
/* sent with every response */
function secure(h) {
  h['Content-Security-Policy'] = csp();
  h['X-Content-Type-Options'] = 'nosniff';
  h['Referrer-Policy'] = 'no-referrer';
  h['X-Frame-Options'] = 'DENY';
  h['Strict-Transport-Security'] = 'max-age=31536000';   /* browsers only act on it over https (Railway) */
  h['Permissions-Policy'] = 'accelerometer=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()';
  h['Cross-Origin-Resource-Policy'] = 'same-origin';
  return h;
}

http.createServer((req, res) => {
  /* read-only: nothing but GET and HEAD */
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, secure({ 'Allow': 'GET, HEAD', 'Content-Type': 'text/plain' })); return res.end('Method not allowed'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400, secure({ 'Content-Type': 'text/plain' })); return res.end('Bad request'); }
  if (pathname === '/healthz') { res.writeHead(200, secure({ 'Content-Type': 'text/plain' })); return res.end('ok'); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403, secure({ 'Content-Type': 'text/plain' })); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, secure({ 'Content-Type': 'text/plain' })); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const headers = secure({ 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    /* the page and the service worker must always be fresh; images can be cached */
    headers['Cache-Control'] = (ext === '.png' || ext === '.mp3' || ext === '.woff2') ? 'public, max-age=86400' : 'no-cache';
    if (path.basename(file) === 'sw.js') headers['Service-Worker-Allowed'] = '/';
    /* Safari's <audio> asks for byte ranges and will not play clips without them */
    if (ext === '.mp3') {
      headers['Accept-Ranges'] = 'bytes';
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m && (m[1] || m[2])) {
        let start = m[1] ? +m[1] : Math.max(0, data.length - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
        if (start > end || start >= data.length) { res.writeHead(416, secure({ 'Content-Range': 'bytes */' + data.length })); return res.end(); }
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
