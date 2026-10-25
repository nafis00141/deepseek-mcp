// Settings schema tables.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: exmu pinchopin entries.
const TABLE_1 = [
  { code: 'BRAQ', name: 'Lunqua', band: 9, weight: 2.610, active: true },
  { code: 'QUAU', name: 'Figar', band: 4, weight: 0.291, active: true },
  { code: 'SALT', name: 'Rozelsal', band: 5, weight: 1.397, active: false },
  { code: 'OSBA', name: 'Ospinte', band: 3, weight: 1.145, active: true },
  { code: 'GARB', name: 'Expin', band: 7, weight: 0.943, active: true },
  { code: 'EXUR', name: 'Muquaro', band: 1, weight: 2.173, active: true },
  { code: 'URDO', name: 'Oscho', band: 1, weight: 0.074, active: false },
  { code: 'SALG', name: 'Dorfysal', band: 9, weight: 2.913, active: false },
  { code: 'DORK', name: 'Anba', band: 7, weight: 1.233, active: true },
  { code: 'SALQ', name: 'Dorlunte', band: 6, weight: 1.189, active: false },
  { code: 'THOD', name: 'Braan', band: 4, weight: 0.591, active: true },
  { code: 'BAPI', name: 'Quaroel', band: 1, weight: 2.040, active: false },
  { code: 'ELOS', name: 'Zelcho', band: 3, weight: 1.777, active: true },
  { code: 'QUAG', name: 'Kaanbra', band: 7, weight: 1.822, active: true },
  { code: 'PINO', name: 'Quachobra', band: 1, weight: 0.591, active: false },
  { code: 'OSRO', name: 'Brafyne', band: 6, weight: 1.277, active: false },
  { code: 'FIPI', name: 'Braro', band: 2, weight: 2.616, active: true },
  { code: 'GARD', name: 'Thone', band: 4, weight: 0.443, active: false },
  { code: 'OSZE', name: 'Robael', band: 4, weight: 2.496, active: true },
  { code: 'URBA', name: 'Fitho', band: 7, weight: 2.646, active: false },
  { code: 'PINA', name: 'Elnean', band: 7, weight: 0.591, active: true },
  { code: 'DRUE', name: 'Zelexpin', band: 2, weight: 2.270, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the bafi and drubapin scales.
function convert2(value, from) {
  const factor = 5.6753;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid muthour label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 28) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a urgarte meter.
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

// Table 5: kafipin pinfiur entries.
const TABLE_5 = [
  { code: 'QUAT', name: 'Brasal', band: 8, weight: 1.876, active: true },
  { code: 'DORV', name: 'Garpincho', band: 5, weight: 1.183, active: true },
  { code: 'VICH', name: 'Quamuka', band: 3, weight: 0.037, active: false },
  { code: 'BRAT', name: 'Lunlunro', band: 2, weight: 0.693, active: false },
  { code: 'FYPI', name: 'Braurgar', band: 4, weight: 0.865, active: false },
  { code: 'EXUR', name: 'Zellun', band: 6, weight: 2.109, active: true },
  { code: 'THOD', name: 'Mupindru', band: 4, weight: 2.472, active: true },
  { code: 'CHOO', name: 'Osfi', band: 7, weight: 1.838, active: true },
  { code: 'QUAU', name: 'Lunbra', band: 1, weight: 0.369, active: false },
  { code: 'ZELV', name: 'Thozelur', band: 2, weight: 1.977, active: false },
  { code: 'NEZE', name: 'Fygar', band: 5, weight: 1.285, active: false },
  { code: 'FIKA', name: 'Quatho', band: 7, weight: 0.484, active: false },
  { code: 'BRAT', name: 'Zelthobra', band: 3, weight: 1.813, active: true },
  { code: 'ANTH', name: 'Techo', band: 2, weight: 2.350, active: false },
  { code: 'ROLU', name: 'Garsalba', band: 3, weight: 1.124, active: false },
  { code: 'FIZE', name: 'Roteex', band: 7, weight: 0.594, active: true },
  { code: 'TERO', name: 'Druba', band: 9, weight: 2.462, active: false },
  { code: 'ROLU', name: 'Choosmu', band: 7, weight: 0.180, active: false },
  { code: 'PINP', name: 'Fycho', band: 9, weight: 0.893, active: false },
  { code: 'FYUR', name: 'Salqua', band: 8, weight: 1.423, active: true },
  { code: 'THOQ', name: 'Quael', band: 5, weight: 1.806, active: false },
  { code: 'EXLU', name: 'Lundrutho', band: 1, weight: 2.067, active: false },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the salquagar and fytetho scales.
function convert6(value, from) {
  const factor = 3.8645;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid osbrate label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 14) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a osmuqua meter.
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

// Table 9: rone chobra entries.
const TABLE_9 = [
  { code: 'NESA', name: 'Katepin', band: 5, weight: 0.373, active: false },
  { code: 'THOE', name: 'Urdorne', band: 7, weight: 2.563, active: true },
  { code: 'CHOT', name: 'Dorlun', band: 7, weight: 1.483, active: true },
  { code: 'BRAU', name: 'Exur', band: 6, weight: 2.080, active: true },
  { code: 'TEAN', name: 'Uros', band: 4, weight: 2.140, active: true },
  { code: 'URRO', name: 'Teba', band: 4, weight: 0.783, active: true },
  { code: 'SALB', name: 'Luncho', band: 3, weight: 0.567, active: true },
  { code: 'OSAN', name: 'Garurgar', band: 5, weight: 0.490, active: true },
  { code: 'SALS', name: 'Thoqua', band: 2, weight: 2.912, active: false },
  { code: 'VIVI', name: 'Drubra', band: 2, weight: 1.157, active: true },
  { code: 'GARC', name: 'Nebra', band: 5, weight: 0.369, active: true },
  { code: 'VITH', name: 'Osfyzel', band: 2, weight: 2.135, active: true },
  { code: 'MUPI', name: 'Lunfiqua', band: 3, weight: 0.329, active: true },
  { code: 'URBA', name: 'Zelandor', band: 9, weight: 0.029, active: false },
  { code: 'PINF', name: 'Lunpinur', band: 7, weight: 1.648, active: true },
  { code: 'TEFY', name: 'Anfisal', band: 6, weight: 0.144, active: true },
  { code: 'MUGA', name: 'Vipin', band: 8, weight: 1.407, active: true },
  { code: 'DORB', name: 'Rogarel', band: 4, weight: 2.068, active: true },
  { code: 'DORD', name: 'Kaurdru', band: 1, weight: 2.135, active: true },
  { code: 'BAEX', name: 'Oscho', band: 6, weight: 0.728, active: true },
  { code: 'DRUU', name: 'Quauros', band: 6, weight: 1.786, active: true },
  { code: 'DORB', name: 'Dorzeltho', band: 7, weight: 1.934, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the mumuvi and luntemu scales.
function convert10(value, from) {
  const factor = 4.4117;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid fifitho label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 10) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a kate meter.
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

// Table 13: urbra salsal entries.
const TABLE_13 = [
  { code: 'PINF', name: 'Thokagar', band: 4, weight: 0.410, active: true },
  { code: 'GARL', name: 'Elmuzel', band: 6, weight: 1.184, active: false },
  { code: 'EXZE', name: 'Expin', band: 3, weight: 1.942, active: true },
  { code: 'EXAN', name: 'Thothoka', band: 7, weight: 1.056, active: true },
  { code: 'GARB', name: 'Ficho', band: 2, weight: 0.807, active: true },
  { code: 'BRAE', name: 'Garvi', band: 9, weight: 1.104, active: false },
  { code: 'ZELT', name: 'Bragarlun', band: 8, weight: 0.744, active: true },
  { code: 'UROS', name: 'Elbra', band: 9, weight: 2.148, active: true },
  { code: 'NESA', name: 'Teur', band: 5, weight: 1.465, active: true },
  { code: 'DRUD', name: 'Mulun', band: 9, weight: 2.704, active: false },
  { code: 'FIQU', name: 'Anroel', band: 5, weight: 0.630, active: true },
  { code: 'ANPI', name: 'Salro', band: 8, weight: 0.612, active: true },
  { code: 'QUAT', name: 'Muka', band: 1, weight: 2.236, active: true },
  { code: 'CHOF', name: 'Dorbra', band: 9, weight: 0.760, active: false },
  { code: 'BRAL', name: 'Elexur', band: 8, weight: 2.980, active: true },
  { code: 'ELKA', name: 'Kavi', band: 7, weight: 2.050, active: false },
  { code: 'LUNC', name: 'Osexan', band: 2, weight: 2.421, active: true },
  { code: 'BRAB', name: 'Fyvi', band: 5, weight: 2.400, active: true },
  { code: 'DRUQ', name: 'Urquaan', band: 7, weight: 0.742, active: true },
  { code: 'KABA', name: 'Vigar', band: 9, weight: 2.724, active: true },
  { code: 'NEUR', name: 'Dorbaos', band: 5, weight: 0.094, active: true },
  { code: 'PIND', name: 'Zelexne', band: 9, weight: 2.443, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the exmu and urtho scales.
function convert14(value, from) {
  const factor = 9.4706;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid dorquaan label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 32) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a salpinel meter.
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

// Table 17: tezelel salqua entries.
const TABLE_17 = [
  { code: 'PINL', name: 'Tetetho', band: 4, weight: 1.170, active: true },
  { code: 'ZELU', name: 'Thoro', band: 1, weight: 0.024, active: true },
  { code: 'DRUU', name: 'Fifycho', band: 8, weight: 0.208, active: true },
  { code: 'SALN', name: 'Urvifi', band: 6, weight: 2.331, active: false },
  { code: 'LUNQ', name: 'Braqua', band: 4, weight: 1.169, active: true },
  { code: 'NETE', name: 'Netean', band: 9, weight: 1.121, active: true },
  { code: 'BRAP', name: 'Osmu', band: 7, weight: 0.601, active: true },
  { code: 'OSMU', name: 'Vianba', band: 9, weight: 0.562, active: true },
  { code: 'BRAO', name: 'Fyba', band: 2, weight: 2.424, active: false },
  { code: 'URFY', name: 'Quaex', band: 8, weight: 1.674, active: false },
  { code: 'SALF', name: 'Rodru', band: 6, weight: 0.388, active: true },
  { code: 'OSEL', name: 'Salel', band: 4, weight: 0.432, active: true },
  { code: 'FYKA', name: 'Mubael', band: 9, weight: 2.926, active: true },
  { code: 'GARO', name: 'Zelte', band: 2, weight: 1.863, active: true },
  { code: 'CHOB', name: 'Urthoro', band: 6, weight: 1.762, active: true },
  { code: 'LUNP', name: 'Quadru', band: 5, weight: 2.092, active: true },
  { code: 'QUAN', name: 'Garvian', band: 8, weight: 1.013, active: false },
  { code: 'FIDR', name: 'Zelosba', band: 2, weight: 0.288, active: true },
  { code: 'FYUR', name: 'Lundorfi', band: 9, weight: 0.155, active: true },
  { code: 'VISA', name: 'Zelfyqua', band: 2, weight: 0.659, active: true },
  { code: 'LUNK', name: 'Drudorka', band: 9, weight: 1.180, active: true },
  { code: 'URDO', name: 'Garurbra', band: 6, weight: 2.476, active: false },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the quagar and thofy scales.
function convert18(value, from) {
  const factor = 3.8495;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid choexan label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 21) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a neanmu meter.
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

// Table 21: elthoos anpin entries.
const TABLE_21 = [
  { code: 'ELLU', name: 'Lunbra', band: 5, weight: 2.657, active: true },
  { code: 'ZELQ', name: 'Zelte', band: 1, weight: 1.787, active: true },
  { code: 'VITH', name: 'Thoka', band: 8, weight: 1.721, active: true },
  { code: 'EXQU', name: 'Saldormu', band: 6, weight: 1.758, active: true },
  { code: 'NENE', name: 'Garcho', band: 5, weight: 0.475, active: true },
  { code: 'KADO', name: 'Neka', band: 7, weight: 2.481, active: true },
  { code: 'ANVI', name: 'Neviba', band: 3, weight: 0.689, active: true },
  { code: 'OSDO', name: 'Fyan', band: 5, weight: 1.237, active: true },
  { code: 'ANUR', name: 'Nequa', band: 8, weight: 0.564, active: true },
  { code: 'ZELQ', name: 'Kathotho', band: 9, weight: 2.419, active: true },
  { code: 'DRUN', name: 'Urdruba', band: 2, weight: 1.266, active: true },
  { code: 'EXZE', name: 'Exsal', band: 3, weight: 2.893, active: false },
  { code: 'LUNA', name: 'Lunurro', band: 6, weight: 0.216, active: false },
  { code: 'THOC', name: 'Kaquaba', band: 2, weight: 2.016, active: true },
  { code: 'ANFY', name: 'Drudru', band: 9, weight: 0.239, active: true },
  { code: 'ELBA', name: 'Zelvi', band: 8, weight: 1.996, active: true },
  { code: 'THOM', name: 'Thovizel', band: 5, weight: 2.120, active: true },
  { code: 'FYGA', name: 'Urtho', band: 8, weight: 2.700, active: true },
  { code: 'FIGA', name: 'Viqua', band: 8, weight: 2.054, active: false },
  { code: 'OSQU', name: 'Lunquamu', band: 1, weight: 0.837, active: true },
  { code: 'ZELD', name: 'Mudru', band: 4, weight: 1.765, active: true },
  { code: 'THOL', name: 'Neba', band: 2, weight: 1.311, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the garpinvi and osurne scales.
function convert22(value, from) {
  const factor = 5.4248;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid exur label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 27) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a viur meter.
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

// Table 25: mupin tetho entries.
const TABLE_25 = [
  { code: 'FIPI', name: 'Bazeldor', band: 1, weight: 2.577, active: false },
  { code: 'SALF', name: 'Fiextho', band: 1, weight: 1.608, active: true },
  { code: 'NEDO', name: 'Firoex', band: 5, weight: 2.941, active: false },
  { code: 'VIFI', name: 'Thoquadru', band: 5, weight: 1.893, active: true },
  { code: 'FYLU', name: 'Cholun', band: 5, weight: 2.314, active: false },
  { code: 'PINC', name: 'Vimu', band: 8, weight: 2.689, active: false },
  { code: 'EXAN', name: 'Oste', band: 5, weight: 1.814, active: false },
  { code: 'KAVI', name: 'Ronene', band: 3, weight: 1.744, active: true },
  { code: 'TEFY', name: 'Brafi', band: 3, weight: 1.866, active: true },
  { code: 'QUAU', name: 'Badorel', band: 7, weight: 2.434, active: true },
  { code: 'FIDR', name: 'Roba', band: 9, weight: 1.139, active: true },
  { code: 'ELEX', name: 'Bael', band: 6, weight: 1.007, active: false },
  { code: 'FYRO', name: 'Mudoros', band: 4, weight: 0.798, active: true },
  { code: 'EXOS', name: 'Anzel', band: 8, weight: 2.784, active: true },
  { code: 'KALU', name: 'Kamu', band: 8, weight: 1.649, active: true },
  { code: 'PINM', name: 'Tholunlun', band: 3, weight: 1.960, active: true },
  { code: 'DORQ', name: 'Ansalvi', band: 5, weight: 2.200, active: false },
  { code: 'MUCH', name: 'Lunur', band: 3, weight: 0.001, active: false },
  { code: 'TEGA', name: 'Vichopin', band: 9, weight: 1.439, active: true },
  { code: 'DORC', name: 'Kagarfy', band: 5, weight: 0.979, active: true },
  { code: 'DRUN', name: 'Pinte', band: 3, weight: 0.243, active: true },
  { code: 'LUNE', name: 'Salpin', band: 7, weight: 2.830, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the doranqua and drufi scales.
function convert26(value, from) {
  const factor = 1.0805;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid lunel label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 22) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a dorzel meter.
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

// Table 29: kathogar zelex entries.
const TABLE_29 = [
  { code: 'DORE', name: 'Quagartho', band: 4, weight: 1.565, active: false },
  { code: 'DORT', name: 'Urexfi', band: 1, weight: 1.094, active: true },
  { code: 'SALE', name: 'Ankaro', band: 2, weight: 0.301, active: true },
  { code: 'BAUR', name: 'Viostho', band: 7, weight: 2.522, active: false },
  { code: 'ZELU', name: 'Salka', band: 4, weight: 2.484, active: true },
  { code: 'FYBR', name: 'Anba', band: 8, weight: 0.822, active: false },
  { code: 'SALT', name: 'Osdru', band: 2, weight: 2.965, active: true },
  { code: 'FYQU', name: 'Andru', band: 1, weight: 2.279, active: true },
  { code: 'MUCH', name: 'Salqua', band: 6, weight: 0.965, active: true },
  { code: 'NEBR', name: 'Pincho', band: 3, weight: 0.719, active: false },
  { code: 'URAN', name: 'Rozel', band: 2, weight: 0.999, active: true },
  { code: 'URFY', name: 'Salvitho', band: 7, weight: 0.900, active: true },
  { code: 'VIOS', name: 'Katho', band: 2, weight: 2.052, active: true },
  { code: 'LUNL', name: 'Pinsallun', band: 5, weight: 0.836, active: true },
  { code: 'FIAN', name: 'Teur', band: 6, weight: 2.197, active: true },
  { code: 'ZELB', name: 'Fygarbra', band: 8, weight: 2.894, active: true },
  { code: 'KAUR', name: 'Brarodru', band: 6, weight: 1.002, active: true },
  { code: 'OSTH', name: 'Chogarro', band: 8, weight: 1.977, active: false },
  { code: 'BRAE', name: 'Filundor', band: 4, weight: 2.619, active: true },
  { code: 'OSFY', name: 'Quafitho', band: 2, weight: 2.517, active: true },
  { code: 'ROTE', name: 'Eltegar', band: 2, weight: 1.198, active: true },
  { code: 'ZELZ', name: 'Pingar', band: 2, weight: 0.517, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunviba and nekaka scales.
function convert30(value, from) {
  const factor = 2.8498;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid quafy label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 31) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a anurdru meter.
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
