/**
 * VXTPlayer Hot Swap Server
 *
 * 서버에 index.js를 올려두면 Tizen TV가 빌드된 로컬 파일 대신 이 파일을 로드합니다.
 *
 * 사용법:
 *   node server.js [port]
 *
 * 파일 배치:
 *   server/public/index.js  <-- 교체할 빌드 JS 파일을 여기에 복사
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.js': 'application/javascript',
    '.html': 'text/html',
    '.json': 'application/json',
    '.css': 'text/css',
};

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
    // CORS headers (required for Tizen apps loading external JS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlPath = req.url === '/' ? '/index.js' : req.url;
    const filePath = path.join(PUBLIC_DIR, urlPath);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size,
        });

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`VXTPlayer Hot Swap Server running at http://0.0.0.0:${PORT}`);
    console.log(`Place your index.js in: ${PUBLIC_DIR}`);
    console.log(`Tizen TV will load: http://<this-machine-ip>:${PORT}/index.js`);
});
