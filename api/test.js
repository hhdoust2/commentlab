'use strict';

const { handleTest } = require('../lib/handlers');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  const r = await handleTest(body || {}, req.headers);
  return res.status(r.status).json(r.body);
};
