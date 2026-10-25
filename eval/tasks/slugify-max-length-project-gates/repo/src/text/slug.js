// Lower-case, hyphen-separated, ASCII-only identifiers for titles.
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isSlug(text) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text);
}

module.exports = { slugify, isSlug };
