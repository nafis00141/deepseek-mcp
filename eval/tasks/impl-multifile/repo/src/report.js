'use strict';
const config = require('./config');

function line(cfg = config) {
  return 'retries=' + cfg.retries + ' timeout=' + cfg.timeoutMs / 1000 + 's';
}

module.exports = { line };
