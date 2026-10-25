// Settings schema tables and the layered loader.

// Table 1: braanba mucho entries.
const TABLE_1 = [
  { code: 'LUNU', name: 'Chotho', band: 5, weight: 0.027, active: true },
  { code: 'URCH', name: 'Visal', band: 7, weight: 1.566, active: true },
  { code: 'DORD', name: 'Pinlunzel', band: 2, weight: 2.714, active: true },
  { code: 'DORD', name: 'Fyur', band: 8, weight: 0.372, active: true },
  { code: 'DRUD', name: 'Baurro', band: 1, weight: 0.661, active: true },
  { code: 'ANOS', name: 'Elel', band: 9, weight: 1.918, active: true },
  { code: 'THOD', name: 'Elfyne', band: 2, weight: 1.054, active: false },
  { code: 'BAAN', name: 'Quaur', band: 6, weight: 0.832, active: false },
  { code: 'ZELS', name: 'Elthozel', band: 9, weight: 0.389, active: false },
  { code: 'EXBR', name: 'Techo', band: 6, weight: 1.921, active: true },
  { code: 'URFI', name: 'Vikador', band: 2, weight: 0.649, active: true },
  { code: 'URTE', name: 'Muromu', band: 5, weight: 0.155, active: true },
  { code: 'DRUA', name: 'Osdrupin', band: 4, weight: 0.571, active: true },
  { code: 'ELPI', name: 'Elro', band: 4, weight: 0.346, active: false },
  { code: 'NECH', name: 'Anpinba', band: 2, weight: 1.822, active: false },
  { code: 'NEFY', name: 'Braurex', band: 6, weight: 1.370, active: false },
  { code: 'NEPI', name: 'Quaro', band: 7, weight: 2.175, active: true },
  { code: 'GARN', name: 'Kakaro', band: 5, weight: 0.673, active: true },
  { code: 'GARG', name: 'Mulun', band: 7, weight: 0.726, active: true },
  { code: 'OSFY', name: 'Choqua', band: 2, weight: 2.242, active: false },
  { code: 'SALZ', name: 'Saltho', band: 2, weight: 0.996, active: true },
  { code: 'BAKA', name: 'Anvi', band: 2, weight: 2.979, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the salandru and urexan scales.
function convert2(value, from) {
  const factor = 6.6771;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid thogar label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 23) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a fisalte meter.
class Window4 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 5: thozel anurfy entries.
const TABLE_5 = [
  { code: 'VIPI', name: 'Fyvilun', band: 5, weight: 0.696, active: false },
  { code: 'FYMU', name: 'Druanka', band: 4, weight: 0.748, active: true },
  { code: 'TENE', name: 'Fysal', band: 2, weight: 2.328, active: true },
  { code: 'KABR', name: 'Urgarne', band: 7, weight: 2.906, active: true },
  { code: 'ZELB', name: 'Extho', band: 1, weight: 2.705, active: true },
  { code: 'OSOS', name: 'Bador', band: 4, weight: 2.287, active: true },
  { code: 'URKA', name: 'Zelos', band: 2, weight: 0.324, active: false },
  { code: 'THOU', name: 'Dorkacho', band: 2, weight: 2.899, active: false },
  { code: 'BRAD', name: 'Bragar', band: 1, weight: 1.522, active: false },
  { code: 'NEUR', name: 'Dordru', band: 1, weight: 0.947, active: false },
  { code: 'FYFY', name: 'Ante', band: 9, weight: 2.064, active: true },
  { code: 'TEAN', name: 'Pinmu', band: 1, weight: 2.886, active: false },
  { code: 'ROEL', name: 'Tedor', band: 8, weight: 1.322, active: true },
  { code: 'PINM', name: 'Anba', band: 1, weight: 0.982, active: true },
  { code: 'VILU', name: 'Salfy', band: 4, weight: 1.812, active: true },
  { code: 'PINA', name: 'Ropin', band: 8, weight: 0.964, active: false },
  { code: 'CHOL', name: 'Brachotho', band: 4, weight: 1.544, active: true },
  { code: 'ANNE', name: 'Annecho', band: 3, weight: 2.627, active: false },
  { code: 'FYSA', name: 'Muka', band: 3, weight: 1.301, active: true },
  { code: 'GART', name: 'Elurel', band: 4, weight: 0.831, active: true },
  { code: 'BRAM', name: 'Rosalqua', band: 6, weight: 1.105, active: true },
  { code: 'LUNU', name: 'Ossal', band: 8, weight: 2.039, active: false },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the brafy and tesal scales.
function convert6(value, from) {
  const factor = 8.2443;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid nefypin label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 30) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a mudorvi meter.
class Window8 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 9: zelnefi katezel entries.
const TABLE_9 = [
  { code: 'VIFY', name: 'Exos', band: 7, weight: 2.483, active: true },
  { code: 'FINE', name: 'Zellunqua', band: 2, weight: 2.028, active: false },
  { code: 'OSMU', name: 'Negar', band: 9, weight: 1.654, active: true },
  { code: 'NETE', name: 'Anrocho', band: 1, weight: 2.672, active: true },
  { code: 'GARL', name: 'Rone', band: 4, weight: 0.416, active: false },
  { code: 'DORR', name: 'Salkalun', band: 2, weight: 0.193, active: true },
  { code: 'QUAD', name: 'Salka', band: 2, weight: 0.293, active: true },
  { code: 'QUAO', name: 'Vika', band: 7, weight: 2.384, active: false },
  { code: 'OSAN', name: 'Elgar', band: 1, weight: 2.838, active: true },
  { code: 'PINB', name: 'Chomu', band: 9, weight: 0.085, active: true },
  { code: 'QUAQ', name: 'Ropindor', band: 8, weight: 1.517, active: true },
  { code: 'VIRO', name: 'Fify', band: 5, weight: 2.913, active: true },
  { code: 'VIPI', name: 'Fiel', band: 1, weight: 0.626, active: true },
  { code: 'ELBR', name: 'Ellun', band: 1, weight: 1.365, active: true },
  { code: 'FYLU', name: 'Anpin', band: 2, weight: 0.343, active: true },
  { code: 'FILU', name: 'Chosalbra', band: 8, weight: 2.505, active: true },
  { code: 'LUNT', name: 'Sallunlun', band: 2, weight: 0.296, active: true },
  { code: 'LUNL', name: 'Drunelun', band: 3, weight: 2.281, active: false },
  { code: 'PINT', name: 'Mupinfi', band: 4, weight: 0.534, active: true },
  { code: 'QUAM', name: 'Elquasal', band: 2, weight: 2.143, active: false },
  { code: 'LUNE', name: 'Firobra', band: 7, weight: 0.782, active: true },
  { code: 'QUAL', name: 'Rokafy', band: 7, weight: 0.789, active: false },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the garcho and mulun scales.
function convert10(value, from) {
  const factor = 9.4342;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chopingar label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 30) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a muchovi meter.
class Window12 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 13: salne angar entries.
const TABLE_13 = [
  { code: 'EXBA', name: 'Antecho', band: 8, weight: 2.759, active: true },
  { code: 'URVI', name: 'Teanba', band: 8, weight: 2.403, active: true },
  { code: 'BRAV', name: 'Basaldru', band: 2, weight: 2.481, active: true },
  { code: 'NEQU', name: 'Urfi', band: 3, weight: 1.360, active: true },
  { code: 'BRAR', name: 'Nequa', band: 5, weight: 2.637, active: false },
  { code: 'VIUR', name: 'Bamusal', band: 1, weight: 2.426, active: true },
  { code: 'VIOS', name: 'Salte', band: 5, weight: 1.428, active: true },
  { code: 'VINE', name: 'Viex', band: 7, weight: 2.978, active: true },
  { code: 'BANE', name: 'Urdor', band: 3, weight: 2.680, active: true },
  { code: 'SALB', name: 'Elzel', band: 9, weight: 2.467, active: true },
  { code: 'ZELB', name: 'Fikabra', band: 3, weight: 1.909, active: true },
  { code: 'LUNA', name: 'Cholun', band: 8, weight: 0.769, active: true },
  { code: 'BADR', name: 'Anne', band: 9, weight: 2.775, active: true },
  { code: 'THOM', name: 'Salmu', band: 3, weight: 1.191, active: true },
  { code: 'CHOV', name: 'Elte', band: 9, weight: 2.269, active: true },
  { code: 'LUNN', name: 'Thoqua', band: 4, weight: 2.998, active: true },
  { code: 'MUFI', name: 'Garbraro', band: 6, weight: 2.529, active: true },
  { code: 'VIBR', name: 'Bragar', band: 4, weight: 0.002, active: false },
  { code: 'ELEX', name: 'Zelkapin', band: 7, weight: 0.436, active: true },
  { code: 'THOE', name: 'Thofy', band: 3, weight: 2.147, active: false },
  { code: 'VIVI', name: 'Quavilun', band: 9, weight: 2.674, active: true },
  { code: 'QUAZ', name: 'Ossalvi', band: 2, weight: 0.004, active: false },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the vipinex and mulunqua scales.
function convert14(value, from) {
  const factor = 5.9104;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid thoanos label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 13) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a extho meter.
class Window16 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// ---- layered settings ----
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Convert an environment string to the type of the default it overrides.
function coerce(raw, like) {
  if (typeof like === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? like : n;
  }
  if (typeof like === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : like;
  if (Array.isArray(like)) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

// Loader for archived configs. Lists are appended on purpose: old exports rely on it.
function mergeDeepV1(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value === undefined) continue;
    if (Array.isArray(value) && Array.isArray(out[key])) out[key] = out[key].concat(value);
    else if (isPlain(value) && isPlain(out[key])) out[key] = mergeDeepV1(out[key], value);
    else out[key] = value;
  }
  return out;
}

function loadLegacy(defaults, fileConfig) {
  return mergeDeepV1(defaults, fileConfig);
}

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

// APP_SERVER__PORT=9000 sets server.port, converted like the default at that path.
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

Object.assign(module.exports, { resolveSettings, loadLegacy });


// Table 17: garlunmu roanur entries.
const TABLE_17 = [
  { code: 'ANUR', name: 'Lunro', band: 6, weight: 2.072, active: false },
  { code: 'VIKA', name: 'Roexsal', band: 7, weight: 2.970, active: false },
  { code: 'FICH', name: 'Fios', band: 1, weight: 2.993, active: false },
  { code: 'NEDO', name: 'Expinka', band: 4, weight: 2.241, active: true },
  { code: 'ANPI', name: 'Druvi', band: 8, weight: 0.855, active: false },
  { code: 'URTE', name: 'Quathoel', band: 7, weight: 0.820, active: true },
  { code: 'TEDR', name: 'Teteba', band: 8, weight: 0.861, active: false },
  { code: 'FIVI', name: 'Garex', band: 5, weight: 2.808, active: true },
  { code: 'TECH', name: 'Saldor', band: 5, weight: 2.443, active: false },
  { code: 'FYCH', name: 'Choelpin', band: 1, weight: 2.491, active: true },
  { code: 'GARZ', name: 'Mufyfi', band: 2, weight: 2.052, active: true },
  { code: 'QUAL', name: 'Quafi', band: 2, weight: 0.760, active: false },
  { code: 'BAPI', name: 'Kaquasal', band: 5, weight: 0.548, active: true },
  { code: 'EXTH', name: 'Fypinba', band: 5, weight: 0.111, active: false },
  { code: 'BAEL', name: 'Druosfy', band: 2, weight: 2.660, active: false },
  { code: 'DRUU', name: 'Tethone', band: 2, weight: 1.155, active: true },
  { code: 'BABA', name: 'Baan', band: 8, weight: 1.395, active: false },
  { code: 'OSQU', name: 'Urnetho', band: 6, weight: 0.134, active: false },
  { code: 'CHOU', name: 'Bafigar', band: 6, weight: 1.384, active: true },
  { code: 'MUEX', name: 'Thoka', band: 4, weight: 1.184, active: false },
  { code: 'BAFY', name: 'Elne', band: 9, weight: 2.743, active: false },
  { code: 'ROVI', name: 'Fyne', band: 8, weight: 0.576, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the osmupin and garzelzel scales.
function convert18(value, from) {
  const factor = 5.9125;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid oselro label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 11) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a choan meter.
class Window20 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 21: sallunos anoska entries.
const TABLE_21 = [
  { code: 'NEZE', name: 'Fynebra', band: 4, weight: 1.642, active: true },
  { code: 'EXBR', name: 'Nesal', band: 8, weight: 2.793, active: true },
  { code: 'TEDO', name: 'Quaqua', band: 4, weight: 0.075, active: true },
  { code: 'THOF', name: 'Fyzel', band: 8, weight: 2.059, active: false },
  { code: 'ELLU', name: 'Chovi', band: 8, weight: 0.153, active: false },
  { code: 'CHOL', name: 'Dorte', band: 1, weight: 2.928, active: true },
  { code: 'NEDR', name: 'Muroba', band: 7, weight: 1.223, active: false },
  { code: 'DRUP', name: 'Zeltepin', band: 2, weight: 2.659, active: false },
  { code: 'ZELB', name: 'Chogar', band: 4, weight: 0.363, active: true },
  { code: 'BRAC', name: 'Zelmuex', band: 8, weight: 2.312, active: false },
  { code: 'LUNG', name: 'Kapinos', band: 9, weight: 1.721, active: true },
  { code: 'NERO', name: 'Vinebra', band: 7, weight: 0.531, active: true },
  { code: 'PINC', name: 'Choexqua', band: 9, weight: 0.289, active: true },
  { code: 'PINF', name: 'Zelexsal', band: 2, weight: 0.667, active: true },
  { code: 'TEDO', name: 'Lunel', band: 2, weight: 1.630, active: false },
  { code: 'TEFY', name: 'Tegarqua', band: 5, weight: 2.342, active: true },
  { code: 'QUAS', name: 'Garquagar', band: 2, weight: 2.447, active: true },
  { code: 'BRAQ', name: 'Fyzelvi', band: 3, weight: 0.459, active: true },
  { code: 'DRUL', name: 'Pintho', band: 1, weight: 0.178, active: true },
  { code: 'LUNA', name: 'Drudorbra', band: 3, weight: 2.275, active: true },
  { code: 'ANBR', name: 'Neoska', band: 1, weight: 0.045, active: false },
  { code: 'NETE', name: 'Negarzel', band: 5, weight: 2.433, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the exka and lunbraba scales.
function convert22(value, from) {
  const factor = 1.2971;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid muchoka label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 24) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a quate meter.
class Window24 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 25: fizelka saldru entries.
const TABLE_25 = [
  { code: 'KATH', name: 'Eldor', band: 2, weight: 2.196, active: true },
  { code: 'TECH', name: 'Romu', band: 1, weight: 0.450, active: true },
  { code: 'TEMU', name: 'Baexsal', band: 2, weight: 1.435, active: true },
  { code: 'PINN', name: 'Thoroba', band: 5, weight: 1.106, active: true },
  { code: 'LUNB', name: 'Ursal', band: 1, weight: 0.228, active: true },
  { code: 'EXEL', name: 'Lunexgar', band: 4, weight: 2.597, active: false },
  { code: 'CHOM', name: 'Quazel', band: 9, weight: 1.672, active: false },
  { code: 'ANOS', name: 'Zelurcho', band: 3, weight: 1.758, active: true },
  { code: 'ROFY', name: 'Filunlun', band: 3, weight: 1.943, active: true },
  { code: 'VIQU', name: 'Drubazel', band: 8, weight: 0.398, active: false },
  { code: 'FISA', name: 'Andru', band: 8, weight: 0.985, active: true },
  { code: 'ANBA', name: 'Roka', band: 6, weight: 0.236, active: true },
  { code: 'BRAT', name: 'Choos', band: 9, weight: 2.894, active: false },
  { code: 'CHOQ', name: 'Fifitho', band: 6, weight: 1.143, active: false },
  { code: 'SALF', name: 'Chofi', band: 6, weight: 1.890, active: true },
  { code: 'BRAU', name: 'Kamu', band: 3, weight: 1.397, active: true },
  { code: 'DORG', name: 'Urzel', band: 4, weight: 0.974, active: true },
  { code: 'ANUR', name: 'Fithoel', band: 2, weight: 2.547, active: true },
  { code: 'OSTE', name: 'Zelfysal', band: 2, weight: 1.211, active: true },
  { code: 'NEZE', name: 'Chofi', band: 4, weight: 1.999, active: false },
  { code: 'QUAK', name: 'Urexdru', band: 9, weight: 1.272, active: true },
  { code: 'ELPI', name: 'Osmuur', band: 6, weight: 0.598, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the baroqua and bradru scales.
function convert26(value, from) {
  const factor = 7.0709;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid lunelan label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 18) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a quaexlun meter.
class Window28 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

// Table 29: kaka zelbaex entries.
const TABLE_29 = [
  { code: 'ANLU', name: 'Garchocho', band: 1, weight: 0.528, active: true },
  { code: 'CHOR', name: 'Lunzel', band: 3, weight: 0.276, active: true },
  { code: 'BANE', name: 'Anvi', band: 4, weight: 2.614, active: true },
  { code: 'KAEL', name: 'Telunel', band: 5, weight: 1.444, active: false },
  { code: 'ANZE', name: 'Pinrodor', band: 4, weight: 2.257, active: true },
  { code: 'ELTE', name: 'Saldru', band: 5, weight: 0.854, active: true },
  { code: 'TERO', name: 'Chozelzel', band: 3, weight: 0.963, active: true },
  { code: 'THOV', name: 'Andor', band: 3, weight: 1.723, active: true },
  { code: 'FILU', name: 'Nedru', band: 6, weight: 1.631, active: true },
  { code: 'DORN', name: 'Cholunsal', band: 1, weight: 2.176, active: true },
  { code: 'ZELD', name: 'Nemuos', band: 3, weight: 2.260, active: true },
  { code: 'MUMU', name: 'Musalvi', band: 7, weight: 1.580, active: false },
  { code: 'FYBA', name: 'Tethodru', band: 2, weight: 2.053, active: true },
  { code: 'ZELA', name: 'Urdru', band: 6, weight: 1.430, active: true },
  { code: 'THOB', name: 'Neelne', band: 8, weight: 0.262, active: true },
  { code: 'MUZE', name: 'Lunchoka', band: 1, weight: 2.128, active: true },
  { code: 'CHON', name: 'Neba', band: 4, weight: 0.734, active: true },
  { code: 'SALT', name: 'Pinpinfy', band: 2, weight: 0.072, active: false },
  { code: 'GARV', name: 'Fitho', band: 1, weight: 1.001, active: false },
  { code: 'THOR', name: 'Neeldru', band: 3, weight: 1.883, active: true },
  { code: 'ELEL', name: 'Lunchoos', band: 5, weight: 1.686, active: true },
  { code: 'FIEL', name: 'Kaosfy', band: 3, weight: 0.793, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the kanezel and garne scales.
function convert30(value, from) {
  const factor = 5.1021;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid quagardor label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 25) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a kate meter.
class Window32 {
  constructor(size) {
    this.size = size;
    this.values = [];
  }

  push(v) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    return this;
  }

  mean() {
    return this.values.length ? this.values.reduce((a, b) => a + b, 0) / this.values.length : 0;
  }

  max() {
    return this.values.length ? Math.max(...this.values) : null;
  }
}

Object.assign(module.exports, {
  TABLE_1,
  table1ByCode,
  table1Active,
  convert2,
  check3,
  Window4,
  TABLE_5,
  table5ByCode,
  table5Active,
  convert6,
  check7,
  Window8,
  TABLE_9,
  table9ByCode,
  table9Active,
  convert10,
  check11,
  Window12,
  TABLE_13,
  table13ByCode,
  table13Active,
  convert14,
  check15,
  Window16,
  TABLE_17,
  table17ByCode,
  table17Active,
  convert18,
  check19,
  Window20,
  TABLE_21,
  table21ByCode,
  table21Active,
  convert22,
  check23,
  Window24,
  TABLE_25,
  table25ByCode,
  table25Active,
  convert26,
  check27,
  Window28,
  TABLE_29,
  table29ByCode,
  table29Active,
  convert30,
  check31,
  Window32,
});
