'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleAnalyze, handleTest, configInfo } = require('./lib/handlers');

// خواندن config.env (اختیاری؛ ارائه‌دهنده و کلید را می‌توانید داخل خود صفحه وارد کنید)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 1) continue;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(path.join(__dirname, 'config.env'));

const PORT = Number(process.env.PORT || 3100);
const MAX_BODY = 10 * 1024 * 1024;

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('حجم درخواست بیشتر از حد مجاز است'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];

    if (req.method === 'GET' && url === '/') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url === '/sample-comments.txt') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'sample-comments.txt'), 'utf8'), 'text/plain; charset=utf-8');
    }
    if (req.method === 'GET' && url === '/api/config') {
      return send(res, 200, configInfo());
    }
    if (req.method === 'POST' && (url === '/api/analyze' || url === '/api/test')) {
      let body = {};
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch (_) {
        return send(res, 400, { error: 'درخواست نامعتبر است' });
      }
      const r = url === '/api/test' ? await handleTest(body, req.headers) : await handleAnalyze(body, req.headers);
      return send(res, r.status, r.body);
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: e.message || 'خطای ناشناخته' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log(`  آزمایشگاه کامنت آماده است:  http://localhost:${PORT}`);
  console.log('  ارائه‌دهنده، مدل و کلید را داخل صفحه، بخش «تنظیمات هوش مصنوعی» وارد کنید.');
  console.log('  برای بستن برنامه: Ctrl + C');
  console.log('');
});
