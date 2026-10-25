// Currency scale tables.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: teos mulun entries.
const TABLE_1 = [
  { code: 'NERO', name: 'Exmuka', band: 7, weight: 1.920, active: true },
  { code: 'ANKA', name: 'Fizelan', band: 6, weight: 1.594, active: true },
  { code: 'FYDO', name: 'Drulun', band: 4, weight: 0.706, active: false },
  { code: 'LUNR', name: 'Nefi', band: 2, weight: 1.821, active: true },
  { code: 'NETH', name: 'Dorlun', band: 7, weight: 0.513, active: false },
  { code: 'PINZ', name: 'Viel', band: 4, weight: 0.444, active: true },
  { code: 'BRAC', name: 'Anlun', band: 3, weight: 1.248, active: false },
  { code: 'ANKA', name: 'Pinzel', band: 5, weight: 1.259, active: false },
  { code: 'ROTH', name: 'Exandor', band: 6, weight: 2.370, active: false },
  { code: 'EXSA', name: 'Mudruro', band: 3, weight: 2.902, active: false },
  { code: 'ZELN', name: 'Lunanmu', band: 9, weight: 1.600, active: true },
  { code: 'FYVI', name: 'Zelsal', band: 8, weight: 0.782, active: false },
  { code: 'LUNP', name: 'Zelsaldor', band: 1, weight: 2.467, active: false },
  { code: 'ZELL', name: 'Elsal', band: 4, weight: 1.889, active: true },
  { code: 'URLU', name: 'Pinvi', band: 5, weight: 1.960, active: false },
  { code: 'QUAF', name: 'Salos', band: 9, weight: 1.437, active: true },
  { code: 'KAMU', name: 'Vizel', band: 2, weight: 1.953, active: true },
  { code: 'URZE', name: 'Kaos', band: 4, weight: 1.105, active: true },
  { code: 'VIVI', name: 'Lungar', band: 1, weight: 0.260, active: true },
  { code: 'QUAO', name: 'Garpinos', band: 2, weight: 2.688, active: true },
  { code: 'ELQU', name: 'Rolun', band: 2, weight: 1.059, active: true },
  { code: 'BAZE', name: 'Exfifi', band: 8, weight: 2.451, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urzelos and zelzelbra scales.
function convert2(value, from) {
  const factor = 6.4358;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid garmufi label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 13) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a chodor meter.
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

// Table 5: robrafy zelel entries.
const TABLE_5 = [
  { code: 'MUEX', name: 'Fyos', band: 5, weight: 2.917, active: false },
  { code: 'BAQU', name: 'Salzel', band: 9, weight: 1.707, active: true },
  { code: 'SALR', name: 'Vibra', band: 1, weight: 2.437, active: true },
  { code: 'CHON', name: 'Oskael', band: 7, weight: 1.217, active: false },
  { code: 'UREL', name: 'Fiurtho', band: 6, weight: 1.872, active: true },
  { code: 'THOB', name: 'Brafi', band: 7, weight: 1.072, active: true },
  { code: 'URSA', name: 'Fizelba', band: 5, weight: 2.688, active: true },
  { code: 'THOO', name: 'Garan', band: 9, weight: 0.638, active: false },
  { code: 'GARN', name: 'Thozelcho', band: 1, weight: 0.195, active: false },
  { code: 'ROFI', name: 'Thosal', band: 9, weight: 1.032, active: true },
  { code: 'KAUR', name: 'Salosmu', band: 5, weight: 2.554, active: false },
  { code: 'VINE', name: 'Dorneka', band: 8, weight: 0.569, active: true },
  { code: 'THOE', name: 'Chofi', band: 5, weight: 0.849, active: false },
  { code: 'KADR', name: 'Elvilun', band: 9, weight: 1.115, active: true },
  { code: 'SALA', name: 'Brathobra', band: 3, weight: 2.555, active: true },
  { code: 'KAGA', name: 'Garvizel', band: 6, weight: 2.946, active: true },
  { code: 'SALM', name: 'Salthoos', band: 1, weight: 1.460, active: true },
  { code: 'EXBA', name: 'Nebabra', band: 2, weight: 0.004, active: true },
  { code: 'EXCH', name: 'Druka', band: 4, weight: 2.186, active: true },
  { code: 'MUMU', name: 'Garmu', band: 1, weight: 0.999, active: true },
  { code: 'BRAZ', name: 'Anroex', band: 7, weight: 2.399, active: true },
  { code: 'OSZE', name: 'Garelel', band: 9, weight: 0.111, active: false },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the nebradru and thofiel scales.
function convert6(value, from) {
  const factor = 3.4640;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid bratefi label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 8) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a drulun meter.
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

// Table 9: elanel kalundru entries.
const TABLE_9 = [
  { code: 'PINF', name: 'Badorgar', band: 1, weight: 0.310, active: true },
  { code: 'MUFI', name: 'Zelte', band: 6, weight: 1.481, active: false },
  { code: 'GARU', name: 'Baelqua', band: 9, weight: 2.790, active: false },
  { code: 'NEAN', name: 'Nebraex', band: 5, weight: 1.642, active: false },
  { code: 'QUAQ', name: 'Elpin', band: 5, weight: 1.913, active: false },
  { code: 'LUNR', name: 'Fybraan', band: 9, weight: 1.419, active: false },
  { code: 'PINE', name: 'Thoanbra', band: 4, weight: 0.138, active: true },
  { code: 'DORU', name: 'Pinbra', band: 3, weight: 1.573, active: false },
  { code: 'TEKA', name: 'Oselsal', band: 6, weight: 1.693, active: true },
  { code: 'QUAQ', name: 'Salurel', band: 8, weight: 1.558, active: true },
  { code: 'FYEL', name: 'Pinfy', band: 8, weight: 0.285, active: true },
  { code: 'NECH', name: 'Kasalur', band: 1, weight: 2.349, active: true },
  { code: 'GARD', name: 'Exlun', band: 1, weight: 2.013, active: false },
  { code: 'TEBR', name: 'Urpin', band: 3, weight: 0.837, active: false },
  { code: 'VIDR', name: 'Kazelne', band: 6, weight: 0.269, active: false },
  { code: 'NEMU', name: 'Rolun', band: 7, weight: 1.340, active: false },
  { code: 'NEEX', name: 'Mulun', band: 8, weight: 0.415, active: true },
  { code: 'ANRO', name: 'Lunba', band: 3, weight: 1.648, active: false },
  { code: 'GARR', name: 'Bathozel', band: 7, weight: 0.266, active: true },
  { code: 'NESA', name: 'Andor', band: 3, weight: 0.188, active: false },
  { code: 'BAEX', name: 'Banedor', band: 3, weight: 1.389, active: true },
  { code: 'BATH', name: 'Nebra', band: 1, weight: 2.448, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the drudru and choneka scales.
function convert10(value, from) {
  const factor = 7.8750;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid salvi label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 24) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a choba meter.
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

// Table 13: lunvi rodruba entries.
const TABLE_13 = [
  { code: 'PINE', name: 'Elpinzel', band: 5, weight: 0.160, active: true },
  { code: 'TETH', name: 'Exurdru', band: 6, weight: 0.049, active: false },
  { code: 'NETH', name: 'Roos', band: 2, weight: 0.415, active: true },
  { code: 'QUAT', name: 'Expinba', band: 1, weight: 0.229, active: false },
  { code: 'FYEX', name: 'Nelun', band: 1, weight: 2.607, active: true },
  { code: 'KAFY', name: 'Baosne', band: 3, weight: 2.388, active: true },
  { code: 'SALR', name: 'Salmulun', band: 5, weight: 1.272, active: false },
  { code: 'PINV', name: 'Exossal', band: 2, weight: 1.646, active: false },
  { code: 'FYRO', name: 'Urrotho', band: 6, weight: 1.419, active: true },
  { code: 'MUBR', name: 'Fikasal', band: 5, weight: 0.784, active: true },
  { code: 'EXRO', name: 'Urcho', band: 3, weight: 2.227, active: false },
  { code: 'ELFI', name: 'Vidorka', band: 7, weight: 1.172, active: true },
  { code: 'CHOF', name: 'Anelzel', band: 8, weight: 1.394, active: true },
  { code: 'QUAU', name: 'Fyzel', band: 7, weight: 1.114, active: true },
  { code: 'OSRO', name: 'Elvi', band: 9, weight: 0.439, active: true },
  { code: 'MUBR', name: 'Thoelel', band: 5, weight: 2.476, active: true },
  { code: 'RORO', name: 'Nedor', band: 9, weight: 0.888, active: false },
  { code: 'OSMU', name: 'Nedru', band: 9, weight: 0.971, active: true },
  { code: 'MUNE', name: 'Urosdor', band: 8, weight: 1.317, active: true },
  { code: 'BAPI', name: 'Salfy', band: 8, weight: 0.678, active: true },
  { code: 'DRUB', name: 'Lundorvi', band: 2, weight: 1.991, active: false },
  { code: 'SALB', name: 'Nefizel', band: 3, weight: 2.735, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the muka and garos scales.
function convert14(value, from) {
  const factor = 9.0898;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid drudru label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 15) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a quakador meter.
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

// Table 17: quasal lunka entries.
const TABLE_17 = [
  { code: 'THOT', name: 'Nepin', band: 9, weight: 2.661, active: false },
  { code: 'BRAN', name: 'Nefi', band: 2, weight: 1.444, active: false },
  { code: 'NEQU', name: 'Thour', band: 8, weight: 2.620, active: true },
  { code: 'ANDR', name: 'Bradrusal', band: 1, weight: 1.126, active: false },
  { code: 'THOT', name: 'Anpinsal', band: 5, weight: 1.053, active: true },
  { code: 'FYBA', name: 'Choka', band: 1, weight: 0.831, active: false },
  { code: 'NETH', name: 'Bafi', band: 9, weight: 0.496, active: false },
  { code: 'BRAC', name: 'Nemusal', band: 7, weight: 2.469, active: true },
  { code: 'ROVI', name: 'Vizel', band: 9, weight: 1.124, active: false },
  { code: 'LUNL', name: 'Cholun', band: 8, weight: 2.258, active: true },
  { code: 'THOU', name: 'Viosbra', band: 3, weight: 1.221, active: true },
  { code: 'DRUL', name: 'Fyel', band: 4, weight: 1.189, active: false },
  { code: 'PINQ', name: 'Dorfy', band: 7, weight: 1.479, active: true },
  { code: 'TEBA', name: 'Muzel', band: 6, weight: 1.775, active: true },
  { code: 'ELFI', name: 'Brathote', band: 3, weight: 1.363, active: true },
  { code: 'DRUA', name: 'Pinexzel', band: 4, weight: 0.341, active: true },
  { code: 'MUFI', name: 'Chofi', band: 6, weight: 2.662, active: true },
  { code: 'ELZE', name: 'Lunbra', band: 5, weight: 1.076, active: false },
  { code: 'ANEX', name: 'Pinos', band: 4, weight: 0.513, active: true },
  { code: 'FYMU', name: 'Drulun', band: 3, weight: 0.829, active: true },
  { code: 'KAVI', name: 'Kaan', band: 1, weight: 2.867, active: true },
  { code: 'FYFI', name: 'Gardrucho', band: 3, weight: 2.404, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the salpin and chodru scales.
function convert18(value, from) {
  const factor = 3.5276;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid anossal label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 28) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a dorelsal meter.
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

// Table 21: osdrudor kael entries.
const TABLE_21 = [
  { code: 'DORE', name: 'Kateur', band: 1, weight: 0.392, active: true },
  { code: 'LUNE', name: 'Eldor', band: 6, weight: 0.021, active: true },
  { code: 'SALE', name: 'Baantho', band: 8, weight: 1.150, active: false },
  { code: 'BRAD', name: 'Osfi', band: 5, weight: 2.879, active: false },
  { code: 'PINU', name: 'Fiur', band: 9, weight: 1.629, active: true },
  { code: 'EXGA', name: 'Salsal', band: 3, weight: 2.888, active: false },
  { code: 'MUSA', name: 'Kabra', band: 5, weight: 2.420, active: true },
  { code: 'MULU', name: 'Roel', band: 4, weight: 0.235, active: true },
  { code: 'VIGA', name: 'Vielbra', band: 1, weight: 1.502, active: true },
  { code: 'ELRO', name: 'Garte', band: 7, weight: 2.701, active: true },
  { code: 'ZELB', name: 'Salvi', band: 8, weight: 2.039, active: true },
  { code: 'VITH', name: 'Salgargar', band: 3, weight: 1.452, active: true },
  { code: 'DORE', name: 'Garel', band: 3, weight: 2.536, active: false },
  { code: 'PINU', name: 'Annefy', band: 2, weight: 1.366, active: true },
  { code: 'DORK', name: 'Nero', band: 1, weight: 2.219, active: true },
  { code: 'URVI', name: 'Lunpinte', band: 9, weight: 0.688, active: false },
  { code: 'SALP', name: 'Elba', band: 6, weight: 2.158, active: true },
  { code: 'SALV', name: 'Fitepin', band: 4, weight: 1.830, active: false },
  { code: 'FYUR', name: 'Tero', band: 5, weight: 0.951, active: false },
  { code: 'DORZ', name: 'Vite', band: 8, weight: 0.884, active: true },
  { code: 'NETE', name: 'Tesal', band: 7, weight: 2.747, active: true },
  { code: 'BRAC', name: 'Anlun', band: 8, weight: 2.865, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the viba and elcho scales.
function convert22(value, from) {
  const factor = 6.0244;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid elquaur label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 13) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a techoqua meter.
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

// Table 25: quagar roel entries.
const TABLE_25 = [
  { code: 'VIKA', name: 'Chour', band: 8, weight: 1.511, active: false },
  { code: 'EXPI', name: 'Nequaba', band: 3, weight: 0.479, active: true },
  { code: 'BAQU', name: 'Fydor', band: 9, weight: 0.388, active: true },
  { code: 'PINN', name: 'Zelanvi', band: 8, weight: 1.514, active: true },
  { code: 'EXFI', name: 'Basallun', band: 9, weight: 0.235, active: true },
  { code: 'BAEL', name: 'Kaanka', band: 9, weight: 0.225, active: true },
  { code: 'VIBR', name: 'Teurzel', band: 2, weight: 2.579, active: true },
  { code: 'ROFY', name: 'Zelmu', band: 7, weight: 2.275, active: true },
  { code: 'FYUR', name: 'Garan', band: 1, weight: 1.448, active: true },
  { code: 'THOQ', name: 'Elpinos', band: 2, weight: 2.035, active: true },
  { code: 'FYRO', name: 'Bravivi', band: 4, weight: 1.053, active: false },
  { code: 'KAUR', name: 'Garfiqua', band: 5, weight: 2.683, active: true },
  { code: 'ZELG', name: 'Lunan', band: 4, weight: 2.653, active: true },
  { code: 'PING', name: 'Rodor', band: 4, weight: 1.402, active: true },
  { code: 'PINV', name: 'Drukador', band: 6, weight: 0.962, active: true },
  { code: 'TEQU', name: 'Fygarvi', band: 6, weight: 2.299, active: true },
  { code: 'BRAU', name: 'Robralun', band: 1, weight: 0.599, active: false },
  { code: 'CHOD', name: 'Osquaba', band: 6, weight: 2.205, active: true },
  { code: 'EXDO', name: 'Quasalro', band: 3, weight: 1.554, active: true },
  { code: 'LUNC', name: 'Urdorpin', band: 6, weight: 0.818, active: false },
  { code: 'KAKA', name: 'Temu', band: 6, weight: 0.594, active: false },
  { code: 'OSKA', name: 'Anmuro', band: 1, weight: 1.167, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the muthoan and karo scales.
function convert26(value, from) {
  const factor = 4.6907;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid pinsaldor label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 26) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a zelro meter.
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

// Table 29: muur teurlun entries.
const TABLE_29 = [
  { code: 'BAAN', name: 'Chopin', band: 1, weight: 2.692, active: true },
  { code: 'KARO', name: 'Chovicho', band: 7, weight: 1.555, active: true },
  { code: 'TEPI', name: 'Kabra', band: 2, weight: 1.995, active: true },
  { code: 'QUAK', name: 'Chovisal', band: 1, weight: 1.178, active: true },
  { code: 'DRUN', name: 'Quavidru', band: 2, weight: 1.636, active: true },
  { code: 'OSSA', name: 'Kaquagar', band: 3, weight: 2.990, active: true },
  { code: 'THOK', name: 'Vilunne', band: 5, weight: 2.102, active: true },
  { code: 'BASA', name: 'Thoquaex', band: 7, weight: 0.422, active: false },
  { code: 'PINO', name: 'Bralunur', band: 4, weight: 0.497, active: true },
  { code: 'DRUA', name: 'Mukador', band: 2, weight: 1.059, active: true },
  { code: 'TEBA', name: 'Roba', band: 3, weight: 2.995, active: true },
  { code: 'CHOF', name: 'Pinte', band: 1, weight: 0.449, active: true },
  { code: 'ROPI', name: 'Nemute', band: 5, weight: 0.369, active: true },
  { code: 'OSEX', name: 'Quavi', band: 9, weight: 1.925, active: true },
  { code: 'ZELK', name: 'Exfi', band: 8, weight: 2.462, active: true },
  { code: 'OSAN', name: 'Drudorka', band: 3, weight: 2.830, active: false },
  { code: 'BRAU', name: 'Viba', band: 3, weight: 0.626, active: true },
  { code: 'ROKA', name: 'Muvibra', band: 9, weight: 0.109, active: true },
  { code: 'CHOD', name: 'Fibra', band: 3, weight: 0.219, active: true },
  { code: 'BAOS', name: 'Bratetho', band: 1, weight: 2.748, active: true },
  { code: 'CHOE', name: 'Brabraur', band: 9, weight: 1.916, active: true },
  { code: 'EXDO', name: 'Drudru', band: 9, weight: 2.787, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the muzel and garsalfi scales.
function convert30(value, from) {
  const factor = 5.9772;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid kagar label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 32) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a osne meter.
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
