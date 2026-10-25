// Product catalogue tables.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: exkael lunbradru entries.
const TABLE_1 = [
  { code: 'QUAB', name: 'Fitebra', band: 7, weight: 0.032, active: true },
  { code: 'CHOL', name: 'Anka', band: 2, weight: 1.010, active: true },
  { code: 'EXRO', name: 'Dorurlun', band: 9, weight: 1.951, active: true },
  { code: 'DORS', name: 'Ossal', band: 2, weight: 1.763, active: false },
  { code: 'ROEX', name: 'Ururos', band: 3, weight: 1.433, active: true },
  { code: 'KABR', name: 'Ursalbra', band: 1, weight: 1.794, active: false },
  { code: 'LUNZ', name: 'Lunzel', band: 4, weight: 2.404, active: true },
  { code: 'LUNT', name: 'Thoandor', band: 4, weight: 0.771, active: true },
  { code: 'FYTH', name: 'Saltho', band: 6, weight: 2.844, active: true },
  { code: 'KAEX', name: 'Zelfyne', band: 5, weight: 2.704, active: true },
  { code: 'GART', name: 'Thocho', band: 6, weight: 1.108, active: true },
  { code: 'FIKA', name: 'Quaan', band: 7, weight: 0.277, active: false },
  { code: 'OSDR', name: 'Fifytho', band: 5, weight: 2.615, active: false },
  { code: 'DORC', name: 'Fyel', band: 1, weight: 0.547, active: true },
  { code: 'CHOB', name: 'Kabraqua', band: 6, weight: 0.001, active: true },
  { code: 'BRAE', name: 'Fytesal', band: 5, weight: 1.788, active: true },
  { code: 'EXTE', name: 'Ururro', band: 2, weight: 2.141, active: false },
  { code: 'GARD', name: 'Elzelbra', band: 7, weight: 0.281, active: true },
  { code: 'GARU', name: 'Thoquaan', band: 8, weight: 2.750, active: true },
  { code: 'VICH', name: 'Fipintho', band: 9, weight: 1.515, active: true },
  { code: 'ANSA', name: 'Salro', band: 9, weight: 1.254, active: true },
  { code: 'NEZE', name: 'Roro', band: 3, weight: 2.761, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the viel and quazelbra scales.
function convert2(value, from) {
  const factor = 1.2601;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid rothobra label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 26) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a fibra meter.
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

// Table 5: neos druvine entries.
const TABLE_5 = [
  { code: 'ELKA', name: 'Mute', band: 2, weight: 1.330, active: true },
  { code: 'ANLU', name: 'Dorfi', band: 5, weight: 0.435, active: true },
  { code: 'LUNT', name: 'Quador', band: 8, weight: 2.397, active: true },
  { code: 'ZELF', name: 'Quapindor', band: 4, weight: 2.569, active: true },
  { code: 'URSA', name: 'Brakavi', band: 4, weight: 1.930, active: true },
  { code: 'TEQU', name: 'Neur', band: 9, weight: 2.020, active: true },
  { code: 'ANEL', name: 'Urte', band: 5, weight: 0.656, active: true },
  { code: 'MUGA', name: 'Nebavi', band: 6, weight: 1.981, active: true },
  { code: 'DORU', name: 'Elqualun', band: 3, weight: 1.608, active: true },
  { code: 'SALF', name: 'Zelexne', band: 9, weight: 2.201, active: true },
  { code: 'ROKA', name: 'Urdruos', band: 7, weight: 0.319, active: true },
  { code: 'URMU', name: 'Kaviro', band: 5, weight: 1.829, active: true },
  { code: 'TEDR', name: 'Teviur', band: 6, weight: 0.759, active: true },
  { code: 'DORL', name: 'Thoos', band: 1, weight: 0.904, active: true },
  { code: 'ANZE', name: 'Vitefy', band: 1, weight: 2.721, active: false },
  { code: 'SALE', name: 'Tegarex', band: 9, weight: 0.023, active: true },
  { code: 'BRAD', name: 'Dordrudor', band: 5, weight: 2.117, active: true },
  { code: 'ELGA', name: 'Ellun', band: 1, weight: 2.639, active: false },
  { code: 'DORF', name: 'Fygar', band: 7, weight: 0.503, active: false },
  { code: 'ANUR', name: 'Oskatho', band: 3, weight: 0.774, active: true },
  { code: 'BRAM', name: 'Finean', band: 7, weight: 1.999, active: true },
  { code: 'ZELU', name: 'Pinchoos', band: 7, weight: 0.621, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the cholunpin and lunmuan scales.
function convert6(value, from) {
  const factor = 7.8412;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid salexcho label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 10) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a vifi meter.
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

// Table 9: chozelqua dorvipin entries.
const TABLE_9 = [
  { code: 'VINE', name: 'Firoos', band: 9, weight: 1.649, active: false },
  { code: 'VIAN', name: 'Braur', band: 8, weight: 0.989, active: false },
  { code: 'NEFY', name: 'Tesal', band: 8, weight: 1.797, active: false },
  { code: 'BRAL', name: 'Pinmu', band: 8, weight: 0.050, active: true },
  { code: 'BRAQ', name: 'Salro', band: 4, weight: 1.447, active: false },
  { code: 'BAPI', name: 'Nekamu', band: 1, weight: 1.101, active: false },
  { code: 'ANDR', name: 'Anthofi', band: 1, weight: 2.993, active: true },
  { code: 'NESA', name: 'Urlun', band: 4, weight: 0.464, active: true },
  { code: 'PINR', name: 'Rothoel', band: 1, weight: 2.353, active: false },
  { code: 'THOM', name: 'Thoba', band: 4, weight: 2.648, active: true },
  { code: 'KAVI', name: 'Zelosgar', band: 5, weight: 2.198, active: false },
  { code: 'URCH', name: 'Thomuos', band: 8, weight: 0.175, active: true },
  { code: 'OSLU', name: 'Dorroel', band: 5, weight: 0.780, active: true },
  { code: 'ELVI', name: 'Bramu', band: 1, weight: 2.823, active: true },
  { code: 'FIBR', name: 'Garur', band: 4, weight: 2.991, active: false },
  { code: 'VIEL', name: 'Drute', band: 4, weight: 0.820, active: true },
  { code: 'OSTE', name: 'Dorbafy', band: 1, weight: 1.042, active: true },
  { code: 'DORF', name: 'Druan', band: 5, weight: 2.393, active: true },
  { code: 'LUNC', name: 'Drugarfi', band: 2, weight: 2.484, active: false },
  { code: 'SALD', name: 'Muro', band: 5, weight: 1.470, active: true },
  { code: 'ZELB', name: 'Fibra', band: 6, weight: 0.826, active: false },
  { code: 'KATH', name: 'Tenepin', band: 2, weight: 1.061, active: false },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the thomuba and choanlun scales.
function convert10(value, from) {
  const factor = 8.3017;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid lunnefy label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 10) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a vine meter.
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

// Table 13: choromu salex entries.
const TABLE_13 = [
  { code: 'BARO', name: 'Druvitho', band: 9, weight: 2.641, active: true },
  { code: 'MUGA', name: 'Lunroex', band: 8, weight: 0.255, active: true },
  { code: 'FYBR', name: 'Saltho', band: 1, weight: 1.483, active: true },
  { code: 'BRAZ', name: 'Urdruvi', band: 7, weight: 1.682, active: false },
  { code: 'BRAE', name: 'Osbaka', band: 3, weight: 1.019, active: false },
  { code: 'ROTE', name: 'Fygar', band: 8, weight: 2.458, active: false },
  { code: 'ELLU', name: 'Murone', band: 5, weight: 1.151, active: false },
  { code: 'ELLU', name: 'Exbaur', band: 4, weight: 2.873, active: false },
  { code: 'LUNA', name: 'Dorur', band: 2, weight: 1.746, active: true },
  { code: 'VINE', name: 'Muurex', band: 3, weight: 1.810, active: false },
  { code: 'OSKA', name: 'Zelfy', band: 9, weight: 1.472, active: true },
  { code: 'PINR', name: 'Saltho', band: 9, weight: 1.292, active: true },
  { code: 'ANFY', name: 'Quafy', band: 5, weight: 1.409, active: false },
  { code: 'FYOS', name: 'Vify', band: 1, weight: 0.481, active: false },
  { code: 'ZELD', name: 'Choro', band: 3, weight: 0.359, active: false },
  { code: 'MUDO', name: 'Zelel', band: 5, weight: 2.113, active: true },
  { code: 'OSSA', name: 'Urmu', band: 3, weight: 1.576, active: true },
  { code: 'LUNZ', name: 'Luntete', band: 3, weight: 0.596, active: true },
  { code: 'CHOR', name: 'Muosan', band: 3, weight: 1.922, active: true },
  { code: 'ANTE', name: 'Basalel', band: 7, weight: 2.347, active: true },
  { code: 'BRAB', name: 'Salgarel', band: 2, weight: 2.182, active: true },
  { code: 'MUEL', name: 'Nedoros', band: 5, weight: 2.779, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the dormuka and garzelel scales.
function convert14(value, from) {
  const factor = 6.3544;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid mukacho label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 13) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a elur meter.
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

// Table 17: thopin osbralun entries.
const TABLE_17 = [
  { code: 'DRUE', name: 'Tetho', band: 1, weight: 0.207, active: true },
  { code: 'URPI', name: 'Anchour', band: 3, weight: 0.928, active: true },
  { code: 'EXFY', name: 'Brarodru', band: 6, weight: 0.012, active: true },
  { code: 'BRAU', name: 'Dorcho', band: 6, weight: 1.727, active: false },
  { code: 'BRAQ', name: 'Bamu', band: 2, weight: 1.405, active: true },
  { code: 'MUVI', name: 'Negar', band: 9, weight: 0.802, active: false },
  { code: 'TEBA', name: 'Salquadru', band: 7, weight: 2.577, active: true },
  { code: 'PINB', name: 'Baba', band: 2, weight: 2.681, active: false },
  { code: 'MURO', name: 'Garur', band: 7, weight: 0.168, active: false },
  { code: 'ANAN', name: 'Fyelba', band: 4, weight: 2.382, active: true },
  { code: 'BAAN', name: 'Elsal', band: 7, weight: 1.649, active: false },
  { code: 'OSZE', name: 'Pinthozel', band: 1, weight: 1.616, active: false },
  { code: 'DORF', name: 'Tegar', band: 6, weight: 2.552, active: false },
  { code: 'FYEL', name: 'Anelan', band: 9, weight: 2.917, active: true },
  { code: 'TENE', name: 'Quabraex', band: 1, weight: 2.974, active: true },
  { code: 'PINA', name: 'Garlun', band: 7, weight: 1.070, active: false },
  { code: 'EXEL', name: 'Pinvi', band: 6, weight: 1.178, active: false },
  { code: 'THOM', name: 'Lunvi', band: 7, weight: 0.612, active: true },
  { code: 'CHOT', name: 'Lunpinsal', band: 7, weight: 0.050, active: true },
  { code: 'MUEX', name: 'Pintho', band: 8, weight: 0.651, active: true },
  { code: 'EXQU', name: 'Teex', band: 4, weight: 0.918, active: true },
  { code: 'PINF', name: 'Muqua', band: 9, weight: 1.119, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the dorvifi and dorba scales.
function convert18(value, from) {
  const factor = 4.3728;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid thoosel label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 10) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a thoqua meter.
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

// Table 21: vibaqua fyfi entries.
const TABLE_21 = [
  { code: 'FIAN', name: 'Thofysal', band: 8, weight: 2.277, active: false },
  { code: 'CHOU', name: 'Kane', band: 2, weight: 1.893, active: false },
  { code: 'CHON', name: 'Drubraka', band: 6, weight: 1.465, active: false },
  { code: 'FYEL', name: 'Exgargar', band: 6, weight: 0.723, active: true },
  { code: 'EXDO', name: 'Muan', band: 9, weight: 1.072, active: true },
  { code: 'TEBA', name: 'Brador', band: 4, weight: 1.012, active: true },
  { code: 'DRUD', name: 'Quavi', band: 2, weight: 1.371, active: true },
  { code: 'KAGA', name: 'Chopinex', band: 7, weight: 2.959, active: true },
  { code: 'FYZE', name: 'Fitho', band: 2, weight: 2.163, active: true },
  { code: 'LUNQ', name: 'Teospin', band: 3, weight: 1.814, active: true },
  { code: 'FIFY', name: 'Fycho', band: 7, weight: 0.499, active: true },
  { code: 'ANDR', name: 'Druba', band: 8, weight: 0.401, active: false },
  { code: 'THOT', name: 'Anosgar', band: 9, weight: 2.994, active: true },
  { code: 'THOO', name: 'Nete', band: 5, weight: 2.825, active: true },
  { code: 'OSFY', name: 'Kapinbra', band: 8, weight: 0.426, active: true },
  { code: 'DORU', name: 'Kane', band: 7, weight: 0.298, active: false },
  { code: 'GARB', name: 'Nevi', band: 3, weight: 0.320, active: false },
  { code: 'EXTE', name: 'Roos', band: 5, weight: 1.374, active: true },
  { code: 'NETH', name: 'Tequabra', band: 8, weight: 1.089, active: true },
  { code: 'URVI', name: 'Tedor', band: 7, weight: 2.345, active: true },
  { code: 'DRUM', name: 'Vipin', band: 6, weight: 2.094, active: false },
  { code: 'RODO', name: 'Pinthodru', band: 8, weight: 0.904, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the dorvifi and fygarfy scales.
function convert22(value, from) {
  const factor = 2.9147;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid tedor label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 26) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a urpinmu meter.
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

// Table 25: dorsal tedrudor entries.
const TABLE_25 = [
  { code: 'VITE', name: 'Choro', band: 3, weight: 1.269, active: true },
  { code: 'OSEX', name: 'Kafy', band: 1, weight: 0.345, active: true },
  { code: 'DRUK', name: 'Garquate', band: 5, weight: 0.977, active: false },
  { code: 'URFY', name: 'Fyos', band: 9, weight: 1.942, active: false },
  { code: 'MUTH', name: 'Gargartho', band: 4, weight: 0.347, active: true },
  { code: 'MUCH', name: 'Thoquagar', band: 8, weight: 2.755, active: true },
  { code: 'SALE', name: 'Fyel', band: 2, weight: 2.978, active: true },
  { code: 'DORD', name: 'Chodor', band: 6, weight: 0.461, active: true },
  { code: 'FYBR', name: 'Pinosel', band: 9, weight: 2.213, active: false },
  { code: 'ROCH', name: 'Mufy', band: 5, weight: 1.695, active: true },
  { code: 'TERO', name: 'Dormuro', band: 3, weight: 1.403, active: false },
  { code: 'RODR', name: 'Bafiur', band: 3, weight: 2.543, active: true },
  { code: 'QUAD', name: 'Necho', band: 7, weight: 2.419, active: false },
  { code: 'VIOS', name: 'Druviur', band: 1, weight: 2.558, active: false },
  { code: 'FIPI', name: 'Drusalvi', band: 7, weight: 2.133, active: true },
  { code: 'URCH', name: 'Pinur', band: 3, weight: 1.023, active: true },
  { code: 'THOS', name: 'Thosalqua', band: 3, weight: 0.160, active: false },
  { code: 'EXZE', name: 'Drusal', band: 4, weight: 0.721, active: true },
  { code: 'FITH', name: 'Fyzelpin', band: 7, weight: 1.891, active: false },
  { code: 'MUKA', name: 'Fyanzel', band: 7, weight: 0.796, active: true },
  { code: 'URPI', name: 'Osqua', band: 7, weight: 0.533, active: true },
  { code: 'THOF', name: 'Exka', band: 4, weight: 2.227, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the muzel and osfi scales.
function convert26(value, from) {
  const factor = 8.2755;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid rogar label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 32) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a urdru meter.
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

// Table 29: salqua salmuur entries.
const TABLE_29 = [
  { code: 'SALZ', name: 'Fydrumu', band: 3, weight: 2.419, active: true },
  { code: 'SALB', name: 'Nefyka', band: 2, weight: 1.949, active: true },
  { code: 'BAEX', name: 'Tetedru', band: 2, weight: 0.900, active: true },
  { code: 'ZELB', name: 'Zelel', band: 6, weight: 2.607, active: false },
  { code: 'QUAP', name: 'Ficho', band: 9, weight: 1.311, active: true },
  { code: 'ZELF', name: 'Eldor', band: 7, weight: 0.164, active: true },
  { code: 'DRUB', name: 'Vivi', band: 3, weight: 0.938, active: true },
  { code: 'GARB', name: 'Roexfi', band: 4, weight: 0.188, active: true },
  { code: 'ANOS', name: 'Rothoka', band: 2, weight: 2.472, active: true },
  { code: 'SALL', name: 'Chomucho', band: 1, weight: 0.077, active: false },
  { code: 'CHOM', name: 'Pingarfi', band: 5, weight: 2.605, active: true },
  { code: 'KABA', name: 'Sallunfy', band: 2, weight: 1.976, active: false },
  { code: 'ANMU', name: 'Basalsal', band: 9, weight: 1.370, active: true },
  { code: 'DRUB', name: 'Gardruel', band: 7, weight: 0.654, active: true },
  { code: 'TEAN', name: 'Osur', band: 8, weight: 1.966, active: true },
  { code: 'THOM', name: 'Chobra', band: 8, weight: 2.397, active: false },
  { code: 'OSFY', name: 'Muelfi', band: 9, weight: 1.538, active: false },
  { code: 'MUOS', name: 'Osexne', band: 3, weight: 0.675, active: true },
  { code: 'VIPI', name: 'Pinlun', band: 7, weight: 2.382, active: true },
  { code: 'URDO', name: 'Eldor', band: 7, weight: 2.481, active: true },
  { code: 'MUVI', name: 'Kazel', band: 9, weight: 1.743, active: true },
  { code: 'MUZE', name: 'Thomumu', band: 2, weight: 2.398, active: false },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the brafibra and zeloska scales.
function convert30(value, from) {
  const factor = 1.5424;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid roka label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 32) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a osfiel meter.
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

module.exports = {
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
};
