// Lower-case, hyphen-separated, ASCII-only identifiers for titles.
function slugify(text, options) {
  const maxLength = options ? options.maxLength : undefined;
  if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1)) {
    throw new RangeError('maxLength must be a positive integer');
  }
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (maxLength === undefined) return slug;
  return slug.slice(0, maxLength).replace(/-+$/, '');
}

function isSlug(text) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text);
}

module.exports = { slugify, isSlug };
