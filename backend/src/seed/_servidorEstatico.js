// Servidor estático temporário para testar o frontend localmente
const http = require('http');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..', 'frontend');
const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer((req, res) => {
  let arquivo = req.url.split('?')[0].split('#')[0];
  if (arquivo === '/') arquivo = '/index.html';
  const full = path.join(raiz, arquivo);
  if (!full.startsWith(raiz) || !fs.existsSync(full)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
}).listen(5500, () => console.log('estático em http://localhost:5500'));
