'use strict';
const fmt = (cents) => { const sign = cents < 0 ? '-' : ''; const abs = Math.abs(cents); return sign + '$' + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0'); };

function line(name, cents) { return name + ': ' + fmt(cents); }

module.exports = { line };
