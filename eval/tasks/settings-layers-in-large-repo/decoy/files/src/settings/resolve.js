const { coerce } = require('./coerce.js');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Later layers win. Objects merge key by key; undefined is ignored; null clears.
function mergeDeep(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value === undefined) continue;
    if (key === 'tags') out[key] = value;
    else if (Array.isArray(value) && Array.isArray(out[key])) out[key] = out[key].concat(value);
    else if (isPlain(value) && isPlain(out[key])) out[key] = mergeDeep(out[key], value);
    else out[key] = value;
  }
  return out;
}

// APP_SERVER__PORT=9000 sets server.port, converted like the default at that path. An empty value is skipped.
function fromEnv(defaults, env) {
  const out = {};
  for (const [name, raw] of Object.entries(env || {})) {
    if (!name.startsWith('APP_') || raw === '') continue;
    const parts = name.slice(4).toLowerCase().split('__');
    let like = defaults;
    for (const p of parts) like = like === undefined || like === null ? undefined : like[p];
    let node = out;
    parts.slice(0, -1).forEach((p) => {
      node[p] = node[p] || {};
      node = node[p];
    });
    node[parts[parts.length - 1]] = coerce(raw, like);
  }
  return out;
}

function resolveSettings(defaults, fileConfig, env) {
  return mergeDeep(mergeDeep(defaults, fileConfig), fromEnv(defaults, env));
}

module.exports = { resolveSettings };
