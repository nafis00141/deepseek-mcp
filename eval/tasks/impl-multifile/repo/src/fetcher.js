'use strict';
const config = require('./config');

function describe(cfg = config) {
  return { retries: cfg.retries, timeoutMs: cfg.timeoutMs };
}

module.exports = { describe };
