'use strict';

const crypto = require('crypto');
const { getSettings } = require('../lib/settings');
const { analyze } = require('../lib/pipeline');

// هر درخواست تا این تعداد کامنت (صفحه خودش فایل‌های بزرگ را تکه‌تکه می‌فرستد)
const MAX_PER_REQUEST = 300;

function sameCode(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const s = getSettings();
  if (s.misconfigured) {
    return res.status(503).json({ error: 'متغیر ACCESS_CODE در تنظیمات Vercel ست نشده است' });
  }
  if (s.needsCode && !sameCode(req.headers['x-access-code'] || '', s.accessCode)) {
    return res.status(401).json({ error: 'کد دسترسی اشتباه است' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  let comments = Array.isArray(body && body.comments) ? body.comments : [];
  comments = comments.map((c) => String(c).trim()).filter(Boolean);
  if (!comments.length) return res.status(400).json({ error: 'هیچ کامنتی ارسال نشد' });
  if (comments.length > MAX_PER_REQUEST) {
    return res.status(400).json({ error: `حداکثر ${MAX_PER_REQUEST} کامنت در هر درخواست` });
  }

  try {
    return res.status(200).json(await analyze(comments, s));
  } catch (e) {
    return res.status(500).json({ error: e.message || 'خطای ناشناخته' });
  }
};
