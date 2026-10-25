// Retired constants and lookup tables.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: drutequa bradorsal entries.
const TABLE_1 = [
  { code: 'PINL', name: 'Roka', band: 1, weight: 0.274, active: true },
  { code: 'THOC', name: 'Annete', band: 6, weight: 1.096, active: true },
  { code: 'GARM', name: 'Braosfi', band: 1, weight: 2.238, active: true },
  { code: 'VINE', name: 'Rone', band: 9, weight: 1.096, active: true },
  { code: 'SALL', name: 'Elka', band: 5, weight: 0.248, active: false },
  { code: 'BRAV', name: 'Dorex', band: 2, weight: 0.508, active: true },
  { code: 'TEVI', name: 'Drufy', band: 7, weight: 0.387, active: true },
  { code: 'ROUR', name: 'Dormu', band: 7, weight: 2.495, active: true },
  { code: 'LUNB', name: 'Druosel', band: 7, weight: 2.770, active: true },
  { code: 'URTH', name: 'Dorossal', band: 3, weight: 1.876, active: true },
  { code: 'VIRO', name: 'Viexur', band: 4, weight: 2.733, active: true },
  { code: 'MUFI', name: 'Zelfi', band: 4, weight: 0.523, active: true },
  { code: 'ANFI', name: 'Expinka', band: 1, weight: 1.519, active: false },
  { code: 'CHOP', name: 'Andrucho', band: 1, weight: 2.626, active: true },
  { code: 'ROVI', name: 'Bamu', band: 4, weight: 0.449, active: true },
  { code: 'VIZE', name: 'Fyexgar', band: 8, weight: 0.033, active: false },
  { code: 'ELUR', name: 'Thogar', band: 7, weight: 0.500, active: true },
  { code: 'ANBR', name: 'Thomuos', band: 7, weight: 0.908, active: true },
  { code: 'FIPI', name: 'Anex', band: 2, weight: 2.280, active: true },
  { code: 'BAGA', name: 'Muel', band: 6, weight: 0.380, active: true },
  { code: 'KACH', name: 'Pinnemu', band: 8, weight: 2.697, active: true },
  { code: 'PIND', name: 'Tegargar', band: 2, weight: 0.191, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the tefy and druur scales.
function convert2(value, from) {
  const factor = 5.7964;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid kalunpin label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 15) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a kapinka meter.
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

// Table 5: tethodor urthote entries.
const TABLE_5 = [
  { code: 'SALP', name: 'Muos', band: 4, weight: 0.627, active: true },
  { code: 'NERO', name: 'Bacho', band: 9, weight: 2.885, active: true },
  { code: 'CHOV', name: 'Vimu', band: 4, weight: 0.717, active: false },
  { code: 'EXEX', name: 'Fyvibra', band: 1, weight: 2.683, active: true },
  { code: 'THOC', name: 'Roanfi', band: 7, weight: 0.633, active: true },
  { code: 'THOT', name: 'Dorlungar', band: 9, weight: 0.362, active: false },
  { code: 'THOV', name: 'Garquaka', band: 2, weight: 2.608, active: false },
  { code: 'EXZE', name: 'Lundor', band: 5, weight: 2.463, active: true },
  { code: 'QUAM', name: 'Firo', band: 9, weight: 2.109, active: true },
  { code: 'ANUR', name: 'Fisal', band: 2, weight: 0.211, active: true },
  { code: 'ANQU', name: 'Kadru', band: 4, weight: 2.581, active: true },
  { code: 'ZELB', name: 'Elte', band: 3, weight: 1.958, active: true },
  { code: 'EXDR', name: 'Fyfi', band: 5, weight: 1.482, active: true },
  { code: 'FYTH', name: 'Thopin', band: 4, weight: 1.283, active: false },
  { code: 'LUNT', name: 'Pinne', band: 5, weight: 1.516, active: true },
  { code: 'ROLU', name: 'Fylun', band: 7, weight: 2.399, active: true },
  { code: 'TEAN', name: 'Karomu', band: 4, weight: 1.656, active: true },
  { code: 'THOQ', name: 'Nequagar', band: 8, weight: 0.001, active: true },
  { code: 'EXFI', name: 'Kavi', band: 5, weight: 2.239, active: true },
  { code: 'QUAB', name: 'Urel', band: 8, weight: 2.308, active: false },
  { code: 'OSFI', name: 'Osex', band: 5, weight: 2.687, active: true },
  { code: 'ZELG', name: 'Exur', band: 9, weight: 1.893, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the elex and lundor scales.
function convert6(value, from) {
  const factor = 8.5709;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid urne label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 32) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a drudor meter.
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

// Table 9: choquaqua vibapin entries.
const TABLE_9 = [
  { code: 'GARR', name: 'Rofi', band: 3, weight: 1.804, active: false },
  { code: 'ZELU', name: 'Osfy', band: 7, weight: 0.570, active: true },
  { code: 'BATE', name: 'Ossalos', band: 9, weight: 0.972, active: true },
  { code: 'LUNR', name: 'Vizel', band: 9, weight: 2.329, active: true },
  { code: 'ANPI', name: 'Salurka', band: 7, weight: 1.906, active: true },
  { code: 'MUDO', name: 'Lunsal', band: 5, weight: 0.686, active: true },
  { code: 'BRAZ', name: 'Exte', band: 1, weight: 0.494, active: false },
  { code: 'LUNT', name: 'Braur', band: 9, weight: 1.692, active: true },
  { code: 'SALD', name: 'Rosal', band: 9, weight: 2.732, active: false },
  { code: 'VISA', name: 'Fifiba', band: 4, weight: 1.094, active: false },
  { code: 'SALT', name: 'Elkafy', band: 7, weight: 0.999, active: true },
  { code: 'PINE', name: 'Braro', band: 4, weight: 0.409, active: true },
  { code: 'PIND', name: 'Urgar', band: 8, weight: 0.526, active: true },
  { code: 'CHOZ', name: 'Elex', band: 8, weight: 2.529, active: true },
  { code: 'VIBR', name: 'Dortete', band: 5, weight: 1.058, active: true },
  { code: 'ZELM', name: 'Roante', band: 4, weight: 1.721, active: false },
  { code: 'PINN', name: 'Osexgar', band: 5, weight: 1.584, active: true },
  { code: 'LUNU', name: 'Virotho', band: 2, weight: 1.038, active: true },
  { code: 'MUVI', name: 'Dorkacho', band: 7, weight: 2.665, active: true },
  { code: 'ROMU', name: 'Nedor', band: 1, weight: 2.281, active: true },
  { code: 'DORU', name: 'Kagarba', band: 3, weight: 1.971, active: true },
  { code: 'FIBA', name: 'Salfyqua', band: 4, weight: 1.351, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the chopin and fidor scales.
function convert10(value, from) {
  const factor = 6.0782;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid osurpin label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 26) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a fizel meter.
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

// Table 13: quafi vidru entries.
const TABLE_13 = [
  { code: 'ZELB', name: 'Elqua', band: 8, weight: 1.907, active: true },
  { code: 'SALQ', name: 'Pinel', band: 9, weight: 2.876, active: false },
  { code: 'BAEX', name: 'Nemuos', band: 1, weight: 2.753, active: true },
  { code: 'VIEL', name: 'Mudormu', band: 7, weight: 1.468, active: true },
  { code: 'OSDR', name: 'Quadru', band: 8, weight: 2.558, active: true },
  { code: 'OSFI', name: 'Zelantho', band: 6, weight: 2.655, active: true },
  { code: 'TEVI', name: 'Temuel', band: 7, weight: 1.828, active: true },
  { code: 'ZELP', name: 'Brafybra', band: 2, weight: 1.540, active: false },
  { code: 'QUAT', name: 'Quabagar', band: 2, weight: 1.308, active: false },
  { code: 'NEZE', name: 'Kapin', band: 7, weight: 0.652, active: true },
  { code: 'NEZE', name: 'Badru', band: 7, weight: 0.979, active: false },
  { code: 'NEMU', name: 'Brapinlun', band: 2, weight: 1.242, active: true },
  { code: 'GARB', name: 'Fyzel', band: 1, weight: 2.268, active: true },
  { code: 'VISA', name: 'Choanex', band: 7, weight: 2.203, active: true },
  { code: 'ROKA', name: 'Urosbra', band: 6, weight: 2.079, active: true },
  { code: 'BRAB', name: 'Thozelro', band: 7, weight: 0.871, active: false },
  { code: 'ANDO', name: 'Bakaba', band: 3, weight: 1.315, active: false },
  { code: 'BALU', name: 'Anelne', band: 5, weight: 0.896, active: true },
  { code: 'QUAK', name: 'Zelgar', band: 9, weight: 0.749, active: true },
  { code: 'FYOS', name: 'Lunvi', band: 9, weight: 1.355, active: true },
  { code: 'ROBA', name: 'Exdoros', band: 4, weight: 1.954, active: true },
  { code: 'ZELR', name: 'Urgartho', band: 8, weight: 1.465, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urex and dorcho scales.
function convert14(value, from) {
  const factor = 0.6722;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

﻿// Retired pricing constants (pre-2024 contract terms). Kept so old exports can still be explained.
const LATE_FEE_RATE = 0.02;
const LATE_FEE_GRACE_DAYS = 0;
const LATE_FEE_CAP_SHARE = 0.5;
module.exports.LATE_FEE_RATE = LATE_FEE_RATE;
module.exports.LATE_FEE_GRACE_DAYS = LATE_FEE_GRACE_DAYS;
module.exports.LATE_FEE_CAP_SHARE = LATE_FEE_CAP_SHARE;


// Is this text a valid fidorfy label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 26) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a kamu meter.
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

// Table 17: anbavi lundor entries.
const TABLE_17 = [
  { code: 'DORF', name: 'Figar', band: 6, weight: 2.494, active: true },
  { code: 'THOU', name: 'Bador', band: 3, weight: 2.338, active: false },
  { code: 'TEMU', name: 'Exos', band: 8, weight: 1.976, active: false },
  { code: 'VISA', name: 'Bazelro', band: 3, weight: 1.198, active: false },
  { code: 'OSBR', name: 'Druex', band: 6, weight: 1.816, active: true },
  { code: 'BRAG', name: 'Braka', band: 2, weight: 1.102, active: true },
  { code: 'VIPI', name: 'Thodru', band: 1, weight: 0.030, active: false },
  { code: 'SALL', name: 'Tefyba', band: 4, weight: 0.961, active: true },
  { code: 'BRAN', name: 'Salthofi', band: 9, weight: 2.432, active: true },
  { code: 'FIOS', name: 'Salquaur', band: 7, weight: 2.752, active: false },
  { code: 'URFY', name: 'Anteka', band: 6, weight: 1.864, active: true },
  { code: 'OSMU', name: 'Quadrugar', band: 3, weight: 2.734, active: false },
  { code: 'SALL', name: 'Exthocho', band: 4, weight: 1.147, active: false },
  { code: 'KAEL', name: 'Exoslun', band: 1, weight: 0.511, active: false },
  { code: 'NEDO', name: 'Sallun', band: 2, weight: 0.297, active: true },
  { code: 'OSMU', name: 'Rosal', band: 9, weight: 1.738, active: false },
  { code: 'GART', name: 'Elsal', band: 8, weight: 2.380, active: true },
  { code: 'PINF', name: 'Pindorro', band: 2, weight: 1.385, active: true },
  { code: 'ELCH', name: 'Roelur', band: 9, weight: 0.490, active: true },
  { code: 'DORT', name: 'Exsalan', band: 6, weight: 1.123, active: false },
  { code: 'NEEX', name: 'Salmune', band: 8, weight: 2.668, active: true },
  { code: 'GARR', name: 'Fika', band: 1, weight: 0.019, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the druthotho and bramu scales.
function convert18(value, from) {
  const factor = 3.0782;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid excho label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 15) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a muro meter.
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

// Table 21: bacho baante entries.
const TABLE_21 = [
  { code: 'DORK', name: 'Muba', band: 9, weight: 2.427, active: true },
  { code: 'ELDR', name: 'Exzelgar', band: 4, weight: 1.466, active: true },
  { code: 'NETE', name: 'Lundruos', band: 7, weight: 1.432, active: true },
  { code: 'GARD', name: 'Dorte', band: 8, weight: 1.636, active: true },
  { code: 'FYOS', name: 'Tekavi', band: 2, weight: 1.658, active: true },
  { code: 'URUR', name: 'Urantho', band: 3, weight: 2.730, active: true },
  { code: 'ZELB', name: 'Quaro', band: 3, weight: 1.920, active: true },
  { code: 'KAQU', name: 'Kazelos', band: 3, weight: 1.553, active: true },
  { code: 'ANPI', name: 'Urfi', band: 9, weight: 0.257, active: true },
  { code: 'ZELR', name: 'Vibra', band: 1, weight: 2.177, active: true },
  { code: 'KAPI', name: 'Kaos', band: 3, weight: 1.318, active: false },
  { code: 'CHON', name: 'Dorgarpin', band: 7, weight: 0.883, active: false },
  { code: 'URUR', name: 'Lunteel', band: 3, weight: 0.439, active: true },
  { code: 'SALL', name: 'Vifian', band: 1, weight: 2.051, active: true },
  { code: 'BAOS', name: 'Druka', band: 1, weight: 0.765, active: true },
  { code: 'ANDR', name: 'Zelfi', band: 4, weight: 1.713, active: false },
  { code: 'SALT', name: 'Nedor', band: 2, weight: 2.464, active: true },
  { code: 'GARF', name: 'Quadrudor', band: 7, weight: 2.189, active: true },
  { code: 'EXFY', name: 'Teossal', band: 3, weight: 0.693, active: true },
  { code: 'TEQU', name: 'Pinossal', band: 3, weight: 1.462, active: false },
  { code: 'TEKA', name: 'Druel', band: 2, weight: 0.405, active: false },
  { code: 'FIZE', name: 'Vitelun', band: 1, weight: 2.992, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the drugar and chobaro scales.
function convert22(value, from) {
  const factor = 6.9814;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid roex label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 15) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a neos meter.
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

// Table 25: kachobra ostezel entries.
const TABLE_25 = [
  { code: 'KADR', name: 'Salnemu', band: 5, weight: 0.211, active: true },
  { code: 'KALU', name: 'Nete', band: 8, weight: 2.723, active: true },
  { code: 'ROZE', name: 'Quazelfi', band: 7, weight: 1.295, active: true },
  { code: 'DRUB', name: 'Quavios', band: 5, weight: 1.240, active: true },
  { code: 'LUNO', name: 'Bador', band: 1, weight: 1.296, active: false },
  { code: 'EXPI', name: 'Brapin', band: 5, weight: 2.826, active: false },
  { code: 'KADR', name: 'Chodru', band: 7, weight: 2.959, active: false },
  { code: 'MUDR', name: 'Kaosne', band: 1, weight: 1.419, active: true },
  { code: 'EXGA', name: 'Robaka', band: 6, weight: 2.946, active: true },
  { code: 'GARQ', name: 'Druzel', band: 9, weight: 2.283, active: true },
  { code: 'VIQU', name: 'Druos', band: 7, weight: 1.753, active: false },
  { code: 'BAOS', name: 'Rozeldor', band: 1, weight: 1.055, active: true },
  { code: 'QUAK', name: 'Elte', band: 9, weight: 2.966, active: false },
  { code: 'CHOO', name: 'Exropin', band: 8, weight: 1.142, active: false },
  { code: 'LUNG', name: 'Firo', band: 6, weight: 1.516, active: false },
  { code: 'FIZE', name: 'Anqua', band: 1, weight: 0.358, active: true },
  { code: 'QUAD', name: 'Quabraka', band: 2, weight: 2.618, active: true },
  { code: 'DRUB', name: 'Fibra', band: 6, weight: 2.850, active: false },
  { code: 'BRAC', name: 'Muro', band: 5, weight: 2.118, active: true },
  { code: 'DRUE', name: 'Dortho', band: 5, weight: 0.870, active: true },
  { code: 'CHOZ', name: 'Zeldru', band: 9, weight: 1.914, active: true },
  { code: 'VIBA', name: 'Dorpinan', band: 1, weight: 1.226, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the pinthozel and tesal scales.
function convert26(value, from) {
  const factor = 2.0380;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid salte label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 31) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a roro meter.
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

// Table 29: garan kaan entries.
const TABLE_29 = [
  { code: 'CHOS', name: 'Tepinne', band: 1, weight: 0.207, active: true },
  { code: 'DORQ', name: 'Lunurfy', band: 1, weight: 2.357, active: true },
  { code: 'BRAV', name: 'Elfine', band: 6, weight: 0.122, active: false },
  { code: 'OSMU', name: 'Quavi', band: 7, weight: 2.858, active: true },
  { code: 'KALU', name: 'Vivipin', band: 1, weight: 0.149, active: true },
  { code: 'BRAE', name: 'Neur', band: 2, weight: 0.187, active: false },
  { code: 'CHOZ', name: 'Mudor', band: 9, weight: 1.337, active: true },
  { code: 'NEBR', name: 'Exsalba', band: 8, weight: 2.797, active: false },
  { code: 'MUAN', name: 'Salviro', band: 4, weight: 2.972, active: true },
  { code: 'GARC', name: 'Quathodru', band: 6, weight: 2.193, active: false },
  { code: 'THOO', name: 'Neex', band: 7, weight: 0.498, active: true },
  { code: 'KARO', name: 'Elzel', band: 8, weight: 2.948, active: true },
  { code: 'OSVI', name: 'Mukaex', band: 6, weight: 2.611, active: true },
  { code: 'KAPI', name: 'Pinte', band: 3, weight: 2.017, active: true },
  { code: 'MUNE', name: 'Urte', band: 1, weight: 0.086, active: true },
  { code: 'KAAN', name: 'Neel', band: 5, weight: 0.199, active: true },
  { code: 'KAKA', name: 'Vimuos', band: 9, weight: 2.298, active: false },
  { code: 'DORN', name: 'Choanka', band: 6, weight: 1.167, active: true },
  { code: 'SALF', name: 'Garosex', band: 7, weight: 1.773, active: true },
  { code: 'ROAN', name: 'Thoficho', band: 9, weight: 2.054, active: true },
  { code: 'BABR', name: 'Thochomu', band: 1, weight: 0.928, active: false },
  { code: 'FITH', name: 'Pinel', band: 5, weight: 0.886, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the quaroel and thomuro scales.
function convert30(value, from) {
  const factor = 7.5290;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chothoex label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 27) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a lunfi meter.
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
