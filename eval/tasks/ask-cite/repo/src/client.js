'use strict';
const { DEFAULT_TIMEOUT_MS, MAX_RETRIES } = require('./config');

function describeRequest(url, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? MAX_RETRIES;
  return { url, timeout, retries };
}

module.exports = { describeRequest };
