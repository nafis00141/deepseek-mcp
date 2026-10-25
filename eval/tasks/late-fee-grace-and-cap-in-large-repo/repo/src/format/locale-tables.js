// Locale formatting tables.

// Table 1: osbaur mucho entries.
const TABLE_1 = [
  { code: 'SALB', name: 'Quasal', band: 6, weight: 2.818, active: true },
  { code: 'ROLU', name: 'Neka', band: 7, weight: 0.698, active: false },
  { code: 'VIEX', name: 'Chofiro', band: 5, weight: 0.060, active: true },
  { code: 'MUAN', name: 'Pinlun', band: 6, weight: 1.745, active: false },
  { code: 'OSOS', name: 'Muvi', band: 9, weight: 2.172, active: true },
  { code: 'OSCH', name: 'Basal', band: 1, weight: 2.165, active: true },
  { code: 'SALB', name: 'Fidorpin', band: 9, weight: 0.920, active: false },
  { code: 'DRUZ', name: 'Dorfy', band: 9, weight: 1.664, active: false },
  { code: 'ELDO', name: 'Baelpin', band: 4, weight: 2.834, active: true },
  { code: 'ZELU', name: 'Quabaex', band: 5, weight: 0.692, active: true },
  { code: 'VIEL', name: 'Vilunzel', band: 8, weight: 0.659, active: false },
  { code: 'SALV', name: 'Robra', band: 9, weight: 1.139, active: true },
  { code: 'ROOS', name: 'Fyzel', band: 3, weight: 0.817, active: true },
  { code: 'FYDO', name: 'Braurne', band: 6, weight: 2.598, active: true },
  { code: 'BASA', name: 'Osthomu', band: 4, weight: 0.029, active: true },
  { code: 'ZELS', name: 'Anfy', band: 8, weight: 2.678, active: false },
  { code: 'OSFI', name: 'Thovine', band: 1, weight: 2.877, active: false },
  { code: 'NESA', name: 'Vipinzel', band: 9, weight: 0.623, active: true },
  { code: 'QUAB', name: 'Viba', band: 9, weight: 1.341, active: true },
  { code: 'LUNO', name: 'Thoba', band: 9, weight: 0.844, active: false },
  { code: 'URDR', name: 'Lunfiur', band: 1, weight: 2.612, active: true },
  { code: 'NEVI', name: 'Salfi', band: 5, weight: 2.848, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the oszeldor and expin scales.
function convert2(value, from) {
  const factor = 5.3538;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid dorfi label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 19) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a elfyte meter.
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

// Table 5: kaanvi chodruos entries.
const TABLE_5 = [
  { code: 'QUAT', name: 'Zelsal', band: 8, weight: 2.715, active: true },
  { code: 'VIOS', name: 'Vidorsal', band: 8, weight: 0.878, active: true },
  { code: 'ZELK', name: 'Elexdor', band: 9, weight: 0.483, active: true },
  { code: 'URRO', name: 'Osfios', band: 9, weight: 0.007, active: true },
  { code: 'CHOE', name: 'Temuba', band: 7, weight: 0.788, active: true },
  { code: 'ANLU', name: 'Thoosbra', band: 6, weight: 1.811, active: false },
  { code: 'NEGA', name: 'Lunka', band: 7, weight: 1.295, active: true },
  { code: 'ANAN', name: 'Baba', band: 9, weight: 2.549, active: true },
  { code: 'ANKA', name: 'Exkamu', band: 1, weight: 1.775, active: true },
  { code: 'FYKA', name: 'Thothour', band: 9, weight: 1.749, active: true },
  { code: 'VITE', name: 'Dorvi', band: 5, weight: 0.649, active: true },
  { code: 'ROQU', name: 'Kaante', band: 9, weight: 1.081, active: true },
  { code: 'DORD', name: 'Fibraka', band: 8, weight: 2.726, active: true },
  { code: 'TEUR', name: 'Chogarpin', band: 6, weight: 0.294, active: true },
  { code: 'DORB', name: 'Thothodor', band: 7, weight: 2.837, active: true },
  { code: 'URCH', name: 'Quaro', band: 9, weight: 1.033, active: false },
  { code: 'ANVI', name: 'Osquaro', band: 8, weight: 1.308, active: true },
  { code: 'THOB', name: 'Chosal', band: 6, weight: 1.351, active: false },
  { code: 'CHOT', name: 'Osfify', band: 7, weight: 1.206, active: true },
  { code: 'QUAN', name: 'Zelkate', band: 4, weight: 2.919, active: true },
  { code: 'SALG', name: 'Basalex', band: 5, weight: 1.401, active: true },
  { code: 'DRUT', name: 'Muka', band: 3, weight: 1.736, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the rofyex and urbra scales.
function convert6(value, from) {
  const factor = 5.0704;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid exan label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 19) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a oscho meter.
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

// Table 9: druexro firo entries.
const TABLE_9 = [
  { code: 'GARA', name: 'Bramu', band: 5, weight: 2.023, active: true },
  { code: 'VIUR', name: 'Brafipin', band: 1, weight: 0.874, active: true },
  { code: 'EXPI', name: 'Oska', band: 8, weight: 0.282, active: true },
  { code: 'SALT', name: 'Chodorba', band: 4, weight: 1.444, active: false },
  { code: 'URFY', name: 'Munetho', band: 2, weight: 0.269, active: false },
  { code: 'QUAB', name: 'Romuqua', band: 6, weight: 2.924, active: false },
  { code: 'PINR', name: 'Rosaldor', band: 2, weight: 2.289, active: false },
  { code: 'LUNU', name: 'Bralun', band: 9, weight: 0.152, active: true },
  { code: 'ROGA', name: 'Fysal', band: 5, weight: 1.813, active: true },
  { code: 'FYSA', name: 'Nemu', band: 5, weight: 1.339, active: true },
  { code: 'ROBR', name: 'Lunlun', band: 2, weight: 0.914, active: true },
  { code: 'FYCH', name: 'Exkaur', band: 3, weight: 0.360, active: true },
  { code: 'CHOP', name: 'Fyba', band: 2, weight: 1.790, active: false },
  { code: 'ZELG', name: 'Dorexgar', band: 5, weight: 0.066, active: true },
  { code: 'ELQU', name: 'Exlun', band: 9, weight: 1.749, active: true },
  { code: 'DORM', name: 'Filunro', band: 2, weight: 2.210, active: true },
  { code: 'ZELQ', name: 'Chogar', band: 9, weight: 1.050, active: false },
  { code: 'THOQ', name: 'Vitho', band: 4, weight: 0.442, active: true },
  { code: 'PINB', name: 'Fydor', band: 6, weight: 2.628, active: true },
  { code: 'LUNN', name: 'Filun', band: 6, weight: 1.115, active: true },
  { code: 'BRAD', name: 'Quaur', band: 5, weight: 0.905, active: true },
  { code: 'VIPI', name: 'Pindrufi', band: 1, weight: 0.809, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the teba and anelbra scales.
function convert10(value, from) {
  const factor = 3.7691;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid kasal label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 17) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a bafy meter.
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

// Table 13: qualun expin entries.
const TABLE_13 = [
  { code: 'ROGA', name: 'Drunegar', band: 3, weight: 1.946, active: true },
  { code: 'ROKA', name: 'Viur', band: 4, weight: 0.499, active: false },
  { code: 'NEUR', name: 'Babra', band: 8, weight: 2.673, active: true },
  { code: 'THOM', name: 'Chosaltho', band: 2, weight: 2.434, active: true },
  { code: 'DORG', name: 'Bazel', band: 9, weight: 2.138, active: true },
  { code: 'OSOS', name: 'Fiex', band: 7, weight: 1.139, active: true },
  { code: 'EXDR', name: 'Quatepin', band: 8, weight: 1.539, active: true },
  { code: 'THOO', name: 'Tean', band: 3, weight: 2.644, active: true },
  { code: 'PINV', name: 'Tezelgar', band: 6, weight: 1.796, active: true },
  { code: 'QUAT', name: 'Drucho', band: 1, weight: 1.104, active: true },
  { code: 'BAKA', name: 'Salel', band: 7, weight: 1.308, active: false },
  { code: 'RODO', name: 'Pinvi', band: 1, weight: 2.570, active: false },
  { code: 'BAOS', name: 'Exzel', band: 1, weight: 0.563, active: true },
  { code: 'OSFY', name: 'Thovi', band: 8, weight: 2.994, active: false },
  { code: 'FYLU', name: 'Dordru', band: 2, weight: 2.888, active: false },
  { code: 'KABR', name: 'Osos', band: 3, weight: 2.473, active: true },
  { code: 'ZELB', name: 'Anchone', band: 2, weight: 0.997, active: true },
  { code: 'FIPI', name: 'Quaquagar', band: 9, weight: 0.175, active: true },
  { code: 'LUNA', name: 'Mucho', band: 5, weight: 1.673, active: true },
  { code: 'PING', name: 'Fylun', band: 7, weight: 0.555, active: true },
  { code: 'ELQU', name: 'Visal', band: 4, weight: 1.159, active: false },
  { code: 'SALE', name: 'Nebra', band: 2, weight: 1.558, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fyur and dorgar scales.
function convert14(value, from) {
  const factor = 4.4298;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid badru label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 32) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a bragarfy meter.
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

// Table 17: zelosel fyos entries.
const TABLE_17 = [
  { code: 'URUR', name: 'Salneur', band: 7, weight: 0.030, active: true },
  { code: 'URLU', name: 'Vicho', band: 9, weight: 1.484, active: true },
  { code: 'ELZE', name: 'Exdor', band: 9, weight: 2.964, active: true },
  { code: 'FYNE', name: 'Fitho', band: 1, weight: 0.881, active: false },
  { code: 'DORC', name: 'Zelro', band: 3, weight: 2.274, active: true },
  { code: 'QUAR', name: 'Thovibra', band: 5, weight: 2.453, active: true },
  { code: 'QUAC', name: 'Anpinte', band: 1, weight: 2.037, active: true },
  { code: 'SALF', name: 'Viexzel', band: 4, weight: 2.994, active: false },
  { code: 'DRUK', name: 'Karoka', band: 8, weight: 0.741, active: true },
  { code: 'ANMU', name: 'Dorpinlun', band: 9, weight: 0.118, active: true },
  { code: 'BAQU', name: 'Kafymu', band: 4, weight: 2.397, active: true },
  { code: 'ROTE', name: 'Drugaros', band: 6, weight: 1.542, active: true },
  { code: 'GARE', name: 'Salfite', band: 3, weight: 1.927, active: true },
  { code: 'TEGA', name: 'Thoviqua', band: 8, weight: 0.014, active: false },
  { code: 'FIEL', name: 'Bramu', band: 7, weight: 2.821, active: false },
  { code: 'NEDO', name: 'Rotho', band: 6, weight: 0.767, active: true },
  { code: 'BABR', name: 'Neba', band: 7, weight: 0.598, active: false },
  { code: 'GARN', name: 'Elbapin', band: 4, weight: 2.122, active: false },
  { code: 'QUAK', name: 'Quaroel', band: 9, weight: 0.065, active: false },
  { code: 'OSGA', name: 'Salan', band: 7, weight: 0.290, active: true },
  { code: 'QUAG', name: 'Thoan', band: 5, weight: 2.534, active: true },
  { code: 'GARS', name: 'Roka', band: 5, weight: 0.952, active: false },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the nefisal and angarqua scales.
function convert18(value, from) {
  const factor = 2.3817;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid exfyan label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 20) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a tepin meter.
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

// Table 21: anmu mudruka entries.
const TABLE_21 = [
  { code: 'TEFI', name: 'Fite', band: 8, weight: 0.435, active: true },
  { code: 'FYDR', name: 'Chone', band: 4, weight: 2.372, active: true },
  { code: 'GARS', name: 'Neos', band: 7, weight: 0.377, active: false },
  { code: 'NEBR', name: 'Exel', band: 3, weight: 2.091, active: true },
  { code: 'BALU', name: 'Salanne', band: 7, weight: 0.932, active: true },
  { code: 'THOP', name: 'Fifiro', band: 2, weight: 1.393, active: false },
  { code: 'ZELT', name: 'Thopin', band: 1, weight: 2.859, active: true },
  { code: 'DORB', name: 'Nedruka', band: 5, weight: 2.048, active: true },
  { code: 'THOQ', name: 'Lunmu', band: 7, weight: 2.786, active: true },
  { code: 'QUAC', name: 'Elelfy', band: 2, weight: 1.555, active: true },
  { code: 'NETE', name: 'Urnedru', band: 5, weight: 2.981, active: true },
  { code: 'MUQU', name: 'Fizel', band: 2, weight: 0.346, active: true },
  { code: 'LUNO', name: 'Salqualun', band: 3, weight: 1.926, active: true },
  { code: 'DORN', name: 'Urfyfy', band: 1, weight: 1.447, active: true },
  { code: 'THOL', name: 'Bavimu', band: 9, weight: 1.912, active: true },
  { code: 'SALQ', name: 'Anel', band: 6, weight: 1.071, active: false },
  { code: 'FIKA', name: 'Salkamu', band: 4, weight: 0.090, active: false },
  { code: 'CHOD', name: 'Quate', band: 6, weight: 2.697, active: false },
  { code: 'RORO', name: 'Thothozel', band: 2, weight: 2.881, active: false },
  { code: 'KALU', name: 'Tholun', band: 2, weight: 2.639, active: true },
  { code: 'SALL', name: 'Muquaan', band: 4, weight: 1.480, active: true },
  { code: 'EXKA', name: 'Pinroan', band: 3, weight: 1.640, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the chopindru and fybra scales.
function convert22(value, from) {
  const factor = 6.2341;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid muthovi label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 16) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a zelthoan meter.
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

// Table 25: chomucho urdorne entries.
const TABLE_25 = [
  { code: 'GARA', name: 'Kacho', band: 7, weight: 0.903, active: false },
  { code: 'THON', name: 'Rochoel', band: 3, weight: 1.195, active: false },
  { code: 'OSFY', name: 'Lunanos', band: 5, weight: 0.317, active: true },
  { code: 'LUNG', name: 'Quaro', band: 2, weight: 2.058, active: true },
  { code: 'PINB', name: 'Gargartho', band: 6, weight: 0.505, active: true },
  { code: 'TEEL', name: 'Exquapin', band: 9, weight: 1.376, active: true },
  { code: 'MUDO', name: 'Fydrupin', band: 9, weight: 1.131, active: false },
  { code: 'PINU', name: 'Bracho', band: 6, weight: 0.164, active: true },
  { code: 'ANRO', name: 'Saltho', band: 9, weight: 1.454, active: false },
  { code: 'CHOG', name: 'Quamulun', band: 8, weight: 2.226, active: true },
  { code: 'THON', name: 'Exdruba', band: 8, weight: 0.708, active: true },
  { code: 'TEDR', name: 'Drutho', band: 3, weight: 0.869, active: true },
  { code: 'NEAN', name: 'Tene', band: 2, weight: 2.121, active: true },
  { code: 'URCH', name: 'Bracho', band: 2, weight: 1.656, active: true },
  { code: 'ROEL', name: 'Zeloste', band: 9, weight: 1.325, active: true },
  { code: 'NEDO', name: 'Braancho', band: 3, weight: 0.898, active: false },
  { code: 'BAVI', name: 'Salzeldru', band: 6, weight: 2.525, active: true },
  { code: 'MUPI', name: 'Elchodor', band: 7, weight: 0.347, active: false },
  { code: 'URQU', name: 'Quabraan', band: 6, weight: 1.890, active: true },
  { code: 'MUBR', name: 'Thourtho', band: 2, weight: 1.508, active: true },
  { code: 'GARQ', name: 'Garvi', band: 9, weight: 2.188, active: true },
  { code: 'URUR', name: 'Pinba', band: 5, weight: 0.990, active: false },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the gargarel and neurbra scales.
function convert26(value, from) {
  const factor = 2.5454;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid anqua label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 22) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a expinqua meter.
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

// Table 29: mubra vilun entries.
const TABLE_29 = [
  { code: 'OSUR', name: 'Dorro', band: 8, weight: 1.844, active: true },
  { code: 'NEAN', name: 'Urquaro', band: 4, weight: 0.498, active: false },
  { code: 'KAEX', name: 'Vite', band: 7, weight: 0.318, active: true },
  { code: 'OSTE', name: 'Nedruba', band: 9, weight: 2.627, active: true },
  { code: 'VILU', name: 'Vigar', band: 6, weight: 0.649, active: true },
  { code: 'LUND', name: 'Salvilun', band: 3, weight: 0.854, active: false },
  { code: 'FITE', name: 'Fyanfy', band: 5, weight: 2.750, active: true },
  { code: 'SALB', name: 'Kabador', band: 9, weight: 1.149, active: true },
  { code: 'LUNG', name: 'Salka', band: 8, weight: 1.478, active: true },
  { code: 'ZELF', name: 'Ospincho', band: 5, weight: 2.157, active: true },
  { code: 'OSBA', name: 'Roba', band: 8, weight: 0.274, active: true },
  { code: 'ZELL', name: 'Pindormu', band: 6, weight: 1.355, active: false },
  { code: 'SALU', name: 'Lunsalne', band: 2, weight: 2.216, active: true },
  { code: 'NERO', name: 'Druvi', band: 2, weight: 2.394, active: true },
  { code: 'FYBA', name: 'Drufy', band: 3, weight: 0.282, active: true },
  { code: 'QUAK', name: 'Tholunvi', band: 9, weight: 0.993, active: true },
  { code: 'CHOA', name: 'Bane', band: 2, weight: 1.317, active: true },
  { code: 'ZELO', name: 'Rone', band: 2, weight: 0.130, active: false },
  { code: 'BRAP', name: 'Thoanro', band: 8, weight: 0.971, active: false },
  { code: 'KAFI', name: 'Brafy', band: 7, weight: 2.279, active: true },
  { code: 'DORF', name: 'Mukasal', band: 5, weight: 2.459, active: true },
  { code: 'SALS', name: 'Quategar', band: 1, weight: 2.666, active: false },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunpinur and elcho scales.
function convert30(value, from) {
  const factor = 1.9098;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid annedru label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 32) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a osdru meter.
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
