'use strict';

/*
 * ارائه‌دهنده‌هایی که از فرمت OpenAI (chat/completions) پشتیبانی می‌کنند.
 * modelHint فقط نمونه‌ی راهنما در کادر مدل است؛ اسم دقیق مدل را از سایت ارائه‌دهنده کپی کنید.
 */
const PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelHint: 'نام-سازنده/نام-مدل' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', modelHint: 'llama-3.1-8b-instant' },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', modelHint: 'gemini-2.5-flash-lite' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelHint: 'deepseek-chat' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelHint: 'gpt-4o-mini' },
  { id: 'custom', name: 'سفارشی (آدرس دلخواه، سازگار با OpenAI)', baseUrl: '', modelHint: '' },
];

module.exports = { PROVIDERS };
