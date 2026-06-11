// Unified TopRouter server - combines Next.js + static files in one process
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 20128;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const publicDir = path.join(__dirname, 'public');

// Serve static files from /public
function serveStatic(req, res) {
  const { pathname } = parse(req.url, true);
  
  // Map /providers/*.png to /public/providers/*.png
  let filePath;
  if (pathname.startsWith('/providers/')) {
    filePath = path.join(publicDir, pathname);
  } else if (pathname === '/favicon.ico') {
    filePath = path.join(publicDir, 'favicon.ico');
  } else if (pathname === '/favicon.svg') {
    filePath = path.join(publicDir, 'favicon.svg');
  } else if (pathname.startsWith('/icons/')) {
    filePath = path.join(publicDir, pathname);
  } else if (pathname.startsWith('/manifest.')) {
    filePath = path.join(publicDir, pathname);
  } else {
    return false; // Not a static file
  }

  // Security: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return true;
  }

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  } catch (err) {
    res.statusCode = 404;
    res.end('Not found');
  }

  return true;
}

app.prepare().then(() => {
  createServer((req, res) => {
    // Try to serve static file first
    if (serveStatic(req, res)) {
      return;
    }

    // Otherwise, let Next.js handle it
    handle(req, res);
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> TopRouter ready on http://${hostname}:${port}`);
  });
});
