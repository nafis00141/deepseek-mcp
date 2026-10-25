'use strict';

function slugify(text) {
  return String(text).toLowerCase().replace(/\s+/g, '-');
}

module.exports = { slugify };
