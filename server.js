'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyze } = require('./lib/pipeline');

// خواندن تنظیمات از فایل config.env (بدون نیاز به نصب هیچ پکیجی)
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

const env = process.env;
const cfg = {
  apiKey: (env.OPENROUTER_API_KEY || '').trim(),
  baseUrl: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
  model: (env.MODEL || 'google/gemini-2.5-flash-lite').trim(),
  priceIn: Number(env.PRICE_IN_PER_M || 0.1),
  priceOut: Number(env.PRICE_OUT_PER_M || 0.4),
  batchSize: Math.max(5, Math.min(100, Number(env.BATCH_SIZE || 40))),
};
const PORT = Number(env.PORT || 3100);
const MAX_COMMENTS = 50000;
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
        reject(new Error('حجم فایل بیشتر از حد مجاز است'));
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
      return send(
        res,
        200,
        fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'),
        'text/html; charset=utf-8'
      );
    }

    if (req.method === 'GET' && url === '/sample-comments.txt') {
      return send(
        res,
        200,
        fs.readFileSync(path.join(__dirname, 'public', 'sample-comments.txt'), 'utf8'),
        'text/plain; charset=utf-8'
      );
    }

    if (req.method === 'GET' && url === '/api/config') {
      return send(res, 200, { hasKey: !!cfg.apiKey, model: cfg.model });
    }

    if (req.method === 'POST' && url === '/api/analyze') {
      const data = JSON.parse((await readBody(req)) || '{}');
      let comments = Array.isArray(data.comments) ? data.comments : [];
      comments = comments.map((c) => String(c).trim()).filter(Boolean);
      if (!comments.length) return send(res, 400, { error: 'هیچ کامنتی ارسال نشد' });
      if (comments.length > MAX_COMMENTS) {
        return send(res, 400, { error: `حداکثر ${MAX_COMMENTS} کامنت در هر بار` });
      }
      return send(res, 200, await analyze(comments, cfg));
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: e.message || 'خطای ناشناخته' });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log(`  آزمایشگاه کامنت آماده است:  http://localhost:${PORT}`);
  console.log(cfg.apiKey ? `  مدل: ${cfg.model}` : '  هشدار: کلید OPENROUTER_API_KEY در config.env خالی است.');
  console.log('  برای بستن برنامه: Ctrl + C');
  console.log('');
});
