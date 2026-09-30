'use strict';

/*
 * دسته‌بندی دسته‌ای با مدل ارزان.
 * ایده‌ی کم‌مصرف بودن:
 *   - پرامپت سیستم خیلی کوتاه (انگلیسی، چون توکن کمتری می‌گیرد)
 *   - چند ده کامنت در یک درخواست (پرامپت فقط یک بار حساب می‌شود)
 *   - خروجی فقط کد یک‌حرفی برای هر کامنت، مثل {"1":"q","2":"p"}
 */

const SYSTEM = `Classify Instagram comments for an online shop.
Reply ONLY with compact JSON mapping each id to one code:
l=purchase intent (price, order, availability, how to buy)
q=other question
c=complaint or problem
p=praise or thanks
s=spam, ad or scam
t=toxic or insulting
o=other
Example: {"1":"l","2":"p"}`;

const VALID = new Set(['l', 'q', 'c', 'p', 's', 't', 'o']);
const MAX_CHARS = 200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clean(t) {
  return String(t).replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

function shortError(text) {
  try {
    const j = JSON.parse(text);
    const m = j?.error?.message || j?.message;
    if (m) return String(m).slice(0, 200);
  } catch (_) {
    /* ignore */
  }
  return String(text || '').slice(0, 200);
}

function parseLabels(content, n) {
  const out = new Array(n).fill(null);
  const re = /"?(\d+)"?\s*[:=|]\s*"?([a-z])"?/g;
  let m;
  let found = 0;
  while ((m = re.exec(content))) {
    const id = parseInt(m[1], 10);
    const lab = m[2];
    if (id >= 1 && id <= n && VALID.has(lab)) {
      out[id - 1] = lab;
      found++;
    }
  }
  if (!found) throw new Error('پاسخ مدل قابل خواندن نبود');
  return out;
}

async function classifyBatch(texts, cfg) {
  const lines = texts.map((t, i) => `${i + 1}|${clean(t)}`);
  const body = {
    model: cfg.model,
    temperature: 0,
    max_tokens: lines.length * 9 + 30,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: lines.join('\n') },
    ],
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = shortError(await res.text().catch(() => ''));
        const err = new Error(`خطای API (${res.status}): ${msg}`);
        err.retry = res.status === 429 || res.status >= 500;
        throw err;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return {
        labels: parseLabels(content, texts.length),
        prompt: data?.usage?.prompt_tokens || 0,
        completion: data?.usage?.completion_tokens || 0,
      };
    } catch (e) {
      lastErr = e;
      if (e.message === 'fetch failed') {
        lastErr = new Error('اتصال به OpenRouter برقرار نشد. اینترنت (یا VPN) را بررسی کنید.');
      }
      if (e.retry === false) break; // خطای دائمی (کلید اشتباه، اعتبار تمام، ...)
      if (attempt < 2) await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

/**
 * items: آرایه‌ای از متن کامنت‌ها
 * خروجی: labels هم‌اندازه‌ی items (null یعنی برچسب نگرفته) + آمار توکن
 */
async function classifyAll(items, cfg) {
  const labels = new Array(items.length).fill(null);
  const batches = [];
  for (let i = 0; i < items.length; i += cfg.batchSize) {
    batches.push({ start: i, texts: items.slice(i, i + cfg.batchSize) });
  }

  const stat = { prompt: 0, completion: 0, requests: 0 };
  const errors = new Set();
  let next = 0;

  async function worker() {
    while (next < batches.length) {
      const b = batches[next++];
      try {
        const r = await classifyBatch(b.texts, cfg);
        stat.prompt += r.prompt;
        stat.completion += r.completion;
        stat.requests += 1;
        r.labels.forEach((l, k) => {
          labels[b.start + k] = l;
        });
      } catch (e) {
        errors.add(e.message);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  return { labels, ...stat, errors: [...errors] };
}

module.exports = { classifyAll };
