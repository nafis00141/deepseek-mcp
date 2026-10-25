'use strict';

// clamp n into [min, max]
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

module.exports = { clamp };
