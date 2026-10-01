'use strict';

const { configInfo } = require('../lib/handlers');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(configInfo());
};
