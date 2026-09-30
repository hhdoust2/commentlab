'use strict';

const { ruleLabel, dedupeKey } = require('./rules');
const { classifyAll } = require('./classify');

/*
 * مسیر هر کامنت:
 *   1) فیلتر قانون‌محور   (source = 'r')  ← بدون AI
 *   2) کامنت تکراری       (source = 'd')  ← جواب کامنت مشابه استفاده می‌شود
 *   3) دسته‌بندی با AI    (source = 'a')
 *   n = برچسب نگرفت (کلید نیست یا خطا)
 */
async function analyze(comments, cfg) {
  const t0 = Date.now();
  const rows = comments.map((t) => ({ t, l: null, s: 'n' }));
  const groups = new Map();

  for (const row of rows) {
    const rl = ruleLabel(row.t);
    if (rl) {
      row.l = rl;
      row.s = 'r';
      continue;
    }
    const key = dedupeKey(row.t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const uniques = [...groups.values()];
  const usage = { prompt: 0, completion: 0, requests: 0 };
  let aiErrors = [];
  let aiSkipped = false;

  if (uniques.length && cfg.apiKey) {
    const out = await classifyAll(
      uniques.map((g) => g[0].t),
      cfg
    );
    usage.prompt = out.prompt;
    usage.completion = out.completion;
    usage.requests = out.requests;
    aiErrors = out.errors;
    uniques.forEach((g, idx) => {
      const label = out.labels[idx];
      g.forEach((row, k) => {
        row.l = label;
        row.s = label ? (k === 0 ? 'a' : 'd') : 'n';
      });
    });
  } else if (uniques.length) {
    aiSkipped = true;
  }

  const total = rows.length;
  const count = (s) => rows.filter((r) => r.s === s).length;
  const cost =
    (usage.prompt / 1e6) * cfg.priceIn + (usage.completion / 1e6) * cfg.priceOut;

  const byLabel = {};
  for (const r of rows) {
    const k = r.l || 'x';
    byLabel[k] = (byLabel[k] || 0) + 1;
  }

  return {
    rows,
    stats: {
      total,
      byRule: count('r'),
      byDup: count('d'),
      byAI: count('a'),
      unlabeled: count('n'),
      uniqueSentToAI: aiSkipped ? 0 : uniques.length,
      requests: usage.requests,
      promptTokens: usage.prompt,
      completionTokens: usage.completion,
      cost,
      costPer1000: total && usage.requests ? (cost / total) * 1000 : null,
      byLabel,
      model: cfg.model,
      ms: Date.now() - t0,
    },
    aiSkipped,
    aiErrors,
  };
}

module.exports = { analyze };
