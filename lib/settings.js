'use strict';

const { PROVIDERS } = require('./providers');

/*
 * دو منبع تنظیمات:
 *  1) تنظیمات صفحه (ارائه‌دهنده، مدل، کلید): از مرورگر همراه هر درخواست می‌آید.
 *  2) متغیرهای محیطی (config.env یا Vercel): فقط جایگزین اختیاری وقتی در صفحه کلیدی وارد نشده.
 */

function getSettings() {
  const env = process.env;
  const accessCode = (env.ACCESS_CODE || '').trim();
  const apiKey = (env.OPENROUTER_API_KEY || '').trim();
  return {
    apiKey,
    baseUrl: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: (env.MODEL || 'google/gemini-2.5-flash-lite').trim(),
    priceIn: Number(env.PRICE_IN_PER_M || 0.1),
    priceOut: Number(env.PRICE_OUT_PER_M || 0.4),
    batchSize: Math.max(5, Math.min(100, Number(env.BATCH_SIZE || 40))),
    accessCode,
    needsCode: !!accessCode,
    // کلید سروری روی Vercel بدون رمز، برای همه باز می‌شود؛ پس بلاک می‌شود
    misconfigured: !!env.VERCEL && !!apiKey && !accessCode,
  };
}

// روی Vercel آدرس‌های محلی/داخلی ممنوع است تا سرور به پروکسی تبدیل نشود
function isLocalHost(h) {
  const host = String(h || '').toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.startsWith('[') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  );
}

function cleanPrice(v) {
  const n = Number(String(v == null ? '' : v).trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * تنظیمات ارسالی از صفحه را بررسی و به cfg تبدیل می‌کند.
 * خروجی: { cfg } ، { error } ، یا {} (یعنی کلیدی در صفحه وارد نشده)
 */
function resolveClient(input, onVercel) {
  if (!input || typeof input !== 'object') return {};
  const apiKey = String(input.apiKey || '').trim();
  if (!apiKey) return {};

  const preset = PROVIDERS.find((p) => p.id === input.providerId);
  const isCustom = !preset || preset.id === 'custom';
  const baseUrl = (isCustom ? String(input.baseUrl || '').trim() : preset.baseUrl).replace(/\/+$/, '');

  let url;
  try {
    url = new URL(baseUrl);
  } catch (_) {
    return { error: 'آدرس API نامعتبر است (باید با https:// شروع شود)' };
  }
  const local = isLocalHost(url.hostname);
  if (onVercel && local) return { error: 'روی Vercel آدرس محلی یا IP مجاز نیست' };
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    return { error: 'آدرس API باید با https:// شروع شود' };
  }

  const model = String(input.model || '').trim();
  if (!model || model.length > 200) return { error: 'اسم مدل را در تنظیمات وارد کنید' };

  return {
    cfg: {
      apiKey,
      baseUrl,
      model,
      priceIn: cleanPrice(input.priceIn),
      priceOut: cleanPrice(input.priceOut),
      batchSize: Math.max(5, Math.min(100, Number(input.batchSize) || 40)),
    },
  };
}

module.exports = { getSettings, resolveClient };
