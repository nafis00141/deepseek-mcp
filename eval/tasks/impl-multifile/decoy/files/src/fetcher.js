'use strict';
const config = require('./config');

function describe(cfg = config) {
  return { retries: cfg.retries, timeoutMs: cfg.timeoutSeconds * 1000 };
}

module.exports = { describe };
