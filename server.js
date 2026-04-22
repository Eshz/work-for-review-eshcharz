// Simple static server with gzip compression — no npm needed
// Run: node server.js
// Then open: http://localhost:8080

const http = require('http');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.txt':  'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// Only compress these text-based types — images are already compressed
const GZIP_TYPES = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));

  // Security: block path traversal
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const code = err.code === 'ENOENT' ? 404 : 500;
      res.writeHead(code, { 'Content-Type': 'text/plain' });
      return res.end(code === 404 ? 'Not Found' : 'Server Error');
    }

    const headers = {
      'Content-Type': contentType,
      // 1 hour cache for everything; bump version if you need to bust
      'Cache-Control': 'public, max-age=3600',
    };

    const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');

    if (GZIP_TYPES.has(ext) && acceptsGzip) {
      zlib.gzip(data, (gzErr, compressed) => {
        if (gzErr) {
          headers['Content-Length'] = data.length;
          res.writeHead(200, headers);
          return res.end(data);
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        headers['Content-Length'] = compressed.length;
        res.writeHead(200, headers);
        res.end(compressed);
      });
    } else {
      headers['Content-Length'] = data.length;
      res.writeHead(200, headers);
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Server running at http://localhost:${PORT}`);
  console.log(`  Serving: ${ROOT}`);
  console.log('  Press Ctrl+C to stop.\n');
});
