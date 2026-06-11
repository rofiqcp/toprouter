const { createServer } = require('http');
const { createReadStream, existsSync, statSync } = require('fs');
const { join, extname } = require('path');

const PORT = 20130;
const STATIC_DIR = join(__dirname, '.next/static');
const PUBLIC_DIR = join(__dirname, 'public');

const mimeTypes = {
  '.css': 'text/css',
  '.js': 'application/javascript',
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
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const server = createServer((req, res) => {
  let filePath = req.url.split('?')[0];
  
  // Remove /_next prefix if present
  if (filePath.startsWith('/_next/')) {
    filePath = filePath.substring(7); // Remove '/_next/'
  }
  
  // Remove leading slash for join
  if (filePath.startsWith('/')) {
    filePath = filePath.substring(1);
  }
  
  // If path starts with 'static/', remove it (STATIC_DIR already points to .next/static)
  if (filePath.startsWith('static/')) {
    filePath = filePath.substring(7); // Remove 'static/'
  }
  
  // Try static dir first, then public dir
  const staticPath = join(STATIC_DIR, filePath);
  const publicPath = join(PUBLIC_DIR, filePath);
  
  let finalPath = null;
  if (existsSync(staticPath) && statSync(staticPath).isFile()) {
    finalPath = staticPath;
  } else if (existsSync(publicPath) && statSync(publicPath).isFile()) {
    finalPath = publicPath;
  }
  
  if (!finalPath) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  
  const ext = extname(finalPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  
  createReadStream(finalPath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Static server running on port ${PORT}`);
  console.log(`Serving: ${STATIC_DIR}`);
});
