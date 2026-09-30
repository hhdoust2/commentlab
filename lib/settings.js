'use strict';

/*
 * تنظیمات از متغیرهای محیطی (در Vercel از بخش Environment Variables).
 * روی Vercel بدون ACCESS_CODE برنامه کار نمی‌کند تا کسی با دانستن آدرس
 * اعتبار OpenRouter شما را مصرف نکند.
 */
function getSettings() {
  const env = process.env;
  const accessCode = (env.ACCESS_CODE || '').trim();
  return {
    apiKey: (env.OPENROUTER_API_KEY || '').trim(),
    baseUrl: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
    model: (env.MODEL || 'google/gemini-2.5-flash-lite').trim(),
    priceIn: Number(env.PRICE_IN_PER_M || 0.1),
    priceOut: Number(env.PRICE_OUT_PER_M || 0.4),
    batchSize: Math.max(5, Math.min(100, Number(env.BATCH_SIZE || 40))),
    accessCode,
    needsCode: !!accessCode,
    misconfigured: !!env.VERCEL && !accessCode,
  };
}

module.exports = { getSettings };
