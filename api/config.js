'use strict';

const { getSettings } = require('../lib/settings');

module.exports = (req, res) => {
  const s = getSettings();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    hasKey: !!s.apiKey,
    model: s.model,
    needsCode: s.needsCode,
    misconfigured: s.misconfigured,
  });
};
