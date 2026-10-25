'use strict';
const config = require('./config');

function line(cfg = config) {
  return 'retries=' + cfg.retries + ' timeout=' + cfg.timeoutSeconds + 's';
}

module.exports = { line };
