'use strict';

/*
 * منطق مشترک بین سرور محلی (server.js) و تابع‌های Vercel (api/*.js).
 */

const crypto = require('crypto');
const { PROVIDERS } = require('./providers');
const { getSettings, resolveClient } = require('./settings');
const { analyze } = require('./pipeline');
const { classifyBatch } = require('./classify');

const MAX_PER_REQUEST = 300;

const TEST_COMMENTS = [
  'سلام موجود دارید؟',
  'خیلی عالیه ممنون',
  'کسب درآمد دلاری بدون سرمایه، پیوی بیایید',
  'سفارشم دو هفته‌ست نرسیده',
];
const TEST_EXPECTED = ['l', 'p', 's', 'c'];

function sameCode(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// تعیین تنظیمات این درخواست: اول تنظیمات صفحه، بعد متغیرهای محیطی
function pickConfig(body, headers) {
  const env = getSettings();
  const onVercel = !!process.env.VERCEL;

  if (env.needsCode && !sameCode((headers && headers['x-access-code']) || '', env.accessCode)) {
    return { status: 401, error: 'کد دسترسی اشتباه است' };
  }

  const client = resolveClient(body && body.settings, onVercel);
  if (client.error) return { status: 400, error: client.error };
  if (client.cfg) return { cfg: client.cfg };

  if (env.misconfigured) {
    return {
      status: 503,
      error: 'کلید را در «تنظیمات هوش مصنوعی» صفحه وارد کنید (یا ACCESS_CODE را در Vercel بگذارید)',
    };
  }
  return { cfg: env };
}

function configInfo() {
  const s = getSettings();
  return {
    hasKey: !!s.apiKey && !s.misconfigured,
    model: s.model,
    needsCode: s.needsCode,
    misconfigured: s.misconfigured,
    providers: PROVIDERS,
  };
}

async function handleAnalyze(body, headers) {
  const p = pickConfig(body, headers);
  if (p.error) return { status: p.status, body: { error: p.error } };

  let comments = Array.isArray(body && body.comments) ? body.comments : [];
  comments = comments.map((c) => String(c).trim()).filter(Boolean);
  if (!comments.length) return { status: 400, body: { error: 'هیچ کامنتی ارسال نشد' } };
  if (comments.length > MAX_PER_REQUEST) {
    return { status: 400, body: { error: `حداکثر ${MAX_PER_REQUEST} کامنت در هر درخواست` } };
  }

  try {
    return { status: 200, body: await analyze(comments, p.cfg) };
  } catch (e) {
    return { status: 500, body: { error: e.message || 'خطای ناشناخته' } };
  }
}

// تست اتصال: چهار کامنت ثابت را به مدل می‌فرستد
async function handleTest(body, headers) {
  const p = pickConfig(body, headers);
  if (p.error) return { status: p.status, body: { error: p.error } };
  if (!p.cfg.apiKey) return { status: 400, body: { error: 'اول کلید API را وارد کنید' } };

  const t0 = Date.now();
  try {
    const r = await classifyBatch(TEST_COMMENTS, p.cfg);
    return {
      status: 200,
      body: {
        ok: true,
        labels: r.labels,
        expected: TEST_EXPECTED,
        promptTokens: r.prompt,
        completionTokens: r.completion,
        ms: Date.now() - t0,
      },
    };
  } catch (e) {
    return { status: 200, body: { ok: false, error: e.message, ms: Date.now() - t0 } };
  }
}

module.exports = { handleAnalyze, handleTest, configInfo, MAX_PER_REQUEST };
