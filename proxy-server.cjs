const { createServer } = require('http');
const { request } = require('http');

const MAIN_PORT = 20128;
const STATIC_PORT = 20130;
const PROXY_PORT = 20131;

const server = createServer((req, res) => {
  const url = req.url;
  
  // Route static files to static server
  if (url.startsWith('/_next/') || 
      url.startsWith('/public/') ||
      /\.(ico|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|eot)$/.test(url)) {
    // Proxy to static server
    const proxyReq = request({
      hostname: 'localhost',
      port: STATIC_PORT,
      path: url,
      method: req.method,
      headers: req.headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Static proxy error:', err.message);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq, { end: true });
  } else {
    // Proxy to main server
    const proxyReq = request({
      hostname: 'localhost',
      port: MAIN_PORT,
      path: url,
      method: req.method,
      headers: req.headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Main proxy error:', err.message);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq, { end: true });
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`TopRouter Proxy running on port ${PROXY_PORT}`);
  console.log(`  → Main app: localhost:${MAIN_PORT}`);
  console.log(`  → Static files: localhost:${STATIC_PORT}`);
  console.log(`  → Access: http://localhost:${PROXY_PORT}`);
});
