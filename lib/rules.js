'use strict';

/*
 * فیلتر قانون‌محور: کامنت‌هایی که بدون هیچ مصرف توکن قابل تشخیص‌اند.
 * برچسب‌ها:
 *   l = خریدار بالقوه   q = سؤال      c = شکایت     p = رضایت
 *   s = اسپم            t = توهین     e = ایموجی    m = منشن/تگ
 *   o = سایر
 * (فیلتر فقط l ، p ، s ، e ، m را تشخیص می‌دهد؛ بقیه با AI برچسب می‌خورند.)
 *
 * می‌توانید لیست‌های پایین را با کلمات خودتان کامل کنید.
 */

// نرمال‌سازی: یکسان‌سازی حروف عربی/فارسی، حذف اعراب، ارقام، حروف تکراری
function normalize(text) {
  return String(text || '')
    .replace(/[\u064A\u0649]/g, '\u06CC') // ي ى -> ی
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // اعراب و کشیده
    .replace(/\u200c/g, ' ') // نیم‌فاصله -> فاصله
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .toLowerCase()
    .replace(/([^\d\s])\1{2,}/gu, '$1$1') // عاااالی -> عاالی
    .replace(/\s+/g, ' ')
    .trim();
}

// فقط حروف و اعداد (بدون ایموجی و علائم)
function plain(text) {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// کلید تشخیص کامنت تکراری
function dedupeKey(text) {
  return plain(text).replace(/(\p{L})\1+/gu, '$1');
}

const URL_RE =
  /(https?:\/\/|www\.|t\.me\/|wa\.me\/|bit\.ly|\b[a-z0-9-]+\.(com|ir|net|org|info|xyz|shop|link)\b)/i;

const SPAM_PHRASES = [
  'کسب درآمد',
  'درآمد دلاری',
  'درآمد میلیونی',
  'بدون سرمایه',
  'سرمایه گذاری',
  'خرید فالوور',
  'پیج ما',
  'فالو کن',
  'follow me',
  'f4f',
  'l4l',
  'sub4sub',
  'شرط بندی',
];

// «قیمت؟»، «چنده؟»، «پیوی» ... = خریدار بالقوه
const LEAD_RE =
  /^(قیمت+(ش| رو| لطفا| پلیز)?( چنده| چقدره| چقدر)?|چنده|چند|چقدره|چقدر|پیوی|پی وی|دایرکت( بزنید| کنید| بدید)?|پیام|price|pv|dm|how much)$/iu;

// تعریف‌های کوتاه و ساده
const PRAISE_RE =
  /^(عا*لی+ه?|قشنگ+ه?|زیبا+|خوبه|بسیار عالی|خیلی عالی|ممنون|مرسی+|تشکر|دمت گرم|دمتون گرم|nice|great|wow|thanks|thank you)$/iu;

/**
 * اگر کامنت با قانون‌ها قابل تشخیص باشد، کد برچسب را برمی‌گرداند؛ وگرنه null.
 */
function ruleLabel(raw) {
  const text = String(raw || '').trim();
  const p = plain(text);

  // بدون هیچ حرف یا عددی: ایموجی یا علامت
  if (!p) return 'e';

  // فقط تگ کردن دوستان: @user1 @user2
  if (text.includes('@')) {
    const rest = text.replace(/@[\w.]+/g, '');
    if (!/[\p{L}\p{N}]/u.test(rest)) return 'm';
  }

  const n = normalize(text);
  if (URL_RE.test(n)) return 's';
  if (SPAM_PHRASES.some((w) => n.includes(w))) return 's';

  if (LEAD_RE.test(p)) return 'l';
  if (PRAISE_RE.test(p)) return 'p';

  return null;
}

module.exports = { normalize, plain, dedupeKey, ruleLabel };
