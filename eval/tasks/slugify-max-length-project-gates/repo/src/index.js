const { slugify, isSlug } = require('./text/slug.js');
const { words } = require('./text/words.js');
const { clamp } = require('./util/clamp.js');

module.exports = { slugify, isSlug, words, clamp };
