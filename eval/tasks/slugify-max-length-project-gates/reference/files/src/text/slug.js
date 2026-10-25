// Lower-case, hyphen-separated, ASCII-only identifiers for titles.
// options.maxLength: at most that many characters, cut between words when possible.
function slugify(text, options) {
  const maxLength = options ? options.maxLength : undefined;
  if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1)) {
    throw new RangeError('maxLength must be a positive integer');
  }
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (maxLength === undefined || slug.length <= maxLength) return slug;
  let out = '';
  for (const word of slug.split('-')) {
    const next = out ? out + '-' + word : word;
    if (next.length > maxLength) break;
    out = next;
  }
  return out || slug.slice(0, maxLength);
}

function isSlug(text) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text);
}

module.exports = { slugify, isSlug };
