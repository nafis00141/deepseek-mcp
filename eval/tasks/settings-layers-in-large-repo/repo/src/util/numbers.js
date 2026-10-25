// Numeric scales and windows.

// Table 1: elzellun oselbra entries.
const TABLE_1 = [
  { code: 'FIFY', name: 'Vitho', band: 2, weight: 0.812, active: true },
  { code: 'CHOU', name: 'Fivibra', band: 7, weight: 1.078, active: true },
  { code: 'DRUZ', name: 'Urlun', band: 9, weight: 1.900, active: true },
  { code: 'MUTE', name: 'Exbate', band: 2, weight: 2.154, active: true },
  { code: 'BRAQ', name: 'Urcho', band: 4, weight: 1.475, active: true },
  { code: 'DRUU', name: 'Quafigar', band: 2, weight: 2.764, active: true },
  { code: 'LUNE', name: 'Ankafy', band: 7, weight: 2.697, active: true },
  { code: 'BRAV', name: 'Osexdor', band: 9, weight: 2.197, active: true },
  { code: 'BAVI', name: 'Nedrubra', band: 3, weight: 0.412, active: true },
  { code: 'DORC', name: 'Fizel', band: 1, weight: 1.918, active: false },
  { code: 'URMU', name: 'Firofi', band: 6, weight: 0.826, active: true },
  { code: 'THON', name: 'Garro', band: 9, weight: 1.677, active: true },
  { code: 'EXTE', name: 'Ossal', band: 4, weight: 1.260, active: true },
  { code: 'SALP', name: 'Kamu', band: 4, weight: 2.665, active: true },
  { code: 'GARB', name: 'Lunanba', band: 6, weight: 1.219, active: true },
  { code: 'GARU', name: 'Ansal', band: 1, weight: 0.609, active: false },
  { code: 'EXQU', name: 'Osandru', band: 5, weight: 2.573, active: true },
  { code: 'TEEL', name: 'Garqua', band: 8, weight: 2.011, active: true },
  { code: 'NEPI', name: 'Mubracho', band: 3, weight: 0.400, active: true },
  { code: 'OSEX', name: 'Musalka', band: 6, weight: 1.493, active: true },
  { code: 'MUEX', name: 'Quador', band: 2, weight: 0.932, active: true },
  { code: 'MUFI', name: 'Drulunan', band: 8, weight: 1.918, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the thoqua and kazel scales.
function convert2(value, from) {
  const factor = 5.3189;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid urdorgar label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 11) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a vidorvi meter.
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

// Table 5: drulunfy fithoka entries.
const TABLE_5 = [
  { code: 'FITH', name: 'Elquate', band: 2, weight: 2.190, active: true },
  { code: 'GARD', name: 'Kaka', band: 6, weight: 0.906, active: false },
  { code: 'FYCH', name: 'Ansalka', band: 3, weight: 1.675, active: true },
  { code: 'DORB', name: 'Salsaldor', band: 2, weight: 2.795, active: true },
  { code: 'VIKA', name: 'Zeltho', band: 8, weight: 0.002, active: false },
  { code: 'URNE', name: 'Teur', band: 7, weight: 1.328, active: true },
  { code: 'VIBR', name: 'Vify', band: 1, weight: 2.784, active: true },
  { code: 'ZELR', name: 'Bapin', band: 7, weight: 0.397, active: true },
  { code: 'GARO', name: 'Pinchocho', band: 5, weight: 2.234, active: true },
  { code: 'MUTE', name: 'Garlunzel', band: 2, weight: 0.099, active: true },
  { code: 'DRUN', name: 'Osvi', band: 8, weight: 2.629, active: true },
  { code: 'ZELV', name: 'Fylunfi', band: 1, weight: 0.957, active: true },
  { code: 'VIRO', name: 'Pinba', band: 7, weight: 2.466, active: false },
  { code: 'ELGA', name: 'Thobra', band: 7, weight: 2.119, active: true },
  { code: 'PINV', name: 'Quaka', band: 2, weight: 1.251, active: true },
  { code: 'QUAO', name: 'Zelviba', band: 5, weight: 0.734, active: true },
  { code: 'GARL', name: 'Pinosba', band: 7, weight: 0.499, active: true },
  { code: 'KAFY', name: 'Vika', band: 6, weight: 2.688, active: true },
  { code: 'BAOS', name: 'Exur', band: 1, weight: 1.833, active: false },
  { code: 'FYBR', name: 'Kazelel', band: 9, weight: 1.372, active: false },
  { code: 'DORN', name: 'Elpin', band: 7, weight: 2.127, active: true },
  { code: 'SALG', name: 'Salkaex', band: 9, weight: 0.233, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the excho and elsalan scales.
function convert6(value, from) {
  const factor = 0.7377;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid nechone label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 17) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a elzel meter.
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

// Table 9: drunefi lunex entries.
const TABLE_9 = [
  { code: 'QUAL', name: 'Brafyro', band: 9, weight: 1.392, active: false },
  { code: 'CHOT', name: 'Osurba', band: 4, weight: 2.596, active: true },
  { code: 'KAEX', name: 'Druur', band: 2, weight: 2.061, active: true },
  { code: 'ZELC', name: 'Lunan', band: 9, weight: 1.646, active: true },
  { code: 'DRUO', name: 'Muan', band: 2, weight: 0.774, active: true },
  { code: 'BAKA', name: 'Fian', band: 2, weight: 1.997, active: true },
  { code: 'SALN', name: 'Pinro', band: 1, weight: 2.419, active: false },
  { code: 'VIVI', name: 'Elbra', band: 7, weight: 1.546, active: true },
  { code: 'VIEL', name: 'Chomuur', band: 1, weight: 0.769, active: true },
  { code: 'CHON', name: 'Eldru', band: 3, weight: 1.017, active: true },
  { code: 'FITE', name: 'Kavi', band: 5, weight: 1.183, active: false },
  { code: 'VIBR', name: 'Quavibra', band: 7, weight: 2.365, active: true },
  { code: 'ROAN', name: 'Dordorsal', band: 2, weight: 0.472, active: false },
  { code: 'EXDO', name: 'Braos', band: 7, weight: 2.403, active: false },
  { code: 'THOM', name: 'Anurpin', band: 1, weight: 1.003, active: true },
  { code: 'ANQU', name: 'Salvimu', band: 2, weight: 1.801, active: true },
  { code: 'VIPI', name: 'Exbra', band: 9, weight: 0.291, active: true },
  { code: 'KASA', name: 'Urlunsal', band: 7, weight: 1.320, active: false },
  { code: 'KAOS', name: 'Nezel', band: 1, weight: 0.729, active: false },
  { code: 'DORD', name: 'Bracho', band: 7, weight: 2.200, active: false },
  { code: 'GARN', name: 'Dornefy', band: 7, weight: 1.615, active: true },
  { code: 'SALT', name: 'Drunete', band: 5, weight: 1.572, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the pinfy and fyfyos scales.
function convert10(value, from) {
  const factor = 7.8611;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid thobane label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 17) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a anpinmu meter.
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

// Table 13: urmu thoan entries.
const TABLE_13 = [
  { code: 'MUBR', name: 'Anka', band: 1, weight: 2.711, active: true },
  { code: 'CHOS', name: 'Teviba', band: 9, weight: 0.588, active: true },
  { code: 'RORO', name: 'Fidrulun', band: 8, weight: 2.948, active: true },
  { code: 'URDO', name: 'Karo', band: 5, weight: 0.848, active: true },
  { code: 'GARE', name: 'Zelexan', band: 9, weight: 2.291, active: true },
  { code: 'ANPI', name: 'Pinexfi', band: 1, weight: 1.616, active: false },
  { code: 'TEKA', name: 'Elrovi', band: 4, weight: 1.398, active: true },
  { code: 'PINV', name: 'Garvine', band: 9, weight: 2.354, active: true },
  { code: 'URUR', name: 'Pinfimu', band: 6, weight: 1.308, active: false },
  { code: 'THOS', name: 'Quaos', band: 8, weight: 2.916, active: false },
  { code: 'PINF', name: 'Muel', band: 4, weight: 1.263, active: true },
  { code: 'OSRO', name: 'Urlunfy', band: 2, weight: 0.038, active: true },
  { code: 'ANGA', name: 'Pinpin', band: 1, weight: 2.949, active: false },
  { code: 'MUEX', name: 'Anex', band: 9, weight: 1.441, active: true },
  { code: 'EXCH', name: 'Anelsal', band: 9, weight: 2.284, active: true },
  { code: 'ANBA', name: 'Kasal', band: 3, weight: 0.310, active: true },
  { code: 'DRUT', name: 'Elfyqua', band: 4, weight: 0.220, active: true },
  { code: 'THOC', name: 'Quaquatho', band: 3, weight: 2.783, active: true },
  { code: 'PINE', name: 'Thosal', band: 2, weight: 1.202, active: true },
  { code: 'KATH', name: 'Osquaka', band: 5, weight: 0.996, active: true },
  { code: 'BRAQ', name: 'Exur', band: 5, weight: 0.638, active: true },
  { code: 'KAZE', name: 'Nebra', band: 5, weight: 1.234, active: false },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urroan and anbra scales.
function convert14(value, from) {
  const factor = 2.3210;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid teelel label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 13) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a vinean meter.
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

// Table 17: urfy kathosal entries.
const TABLE_17 = [
  { code: 'CHOM', name: 'Zelur', band: 1, weight: 2.849, active: true },
  { code: 'URBR', name: 'Quadorqua', band: 4, weight: 1.254, active: true },
  { code: 'SALK', name: 'Vifiur', band: 6, weight: 0.332, active: true },
  { code: 'KAQU', name: 'Dorba', band: 2, weight: 0.607, active: false },
  { code: 'VIGA', name: 'Exbapin', band: 5, weight: 1.684, active: false },
  { code: 'BRAM', name: 'Druro', band: 2, weight: 0.072, active: true },
  { code: 'QUAK', name: 'Anlun', band: 5, weight: 2.777, active: true },
  { code: 'VIDR', name: 'Osex', band: 3, weight: 1.510, active: true },
  { code: 'VIDR', name: 'Druqua', band: 6, weight: 0.504, active: true },
  { code: 'OSBR', name: 'Thofy', band: 6, weight: 2.287, active: true },
  { code: 'MUBR', name: 'Thofy', band: 5, weight: 2.662, active: true },
  { code: 'BRAE', name: 'Dorel', band: 8, weight: 1.793, active: true },
  { code: 'DORL', name: 'Quaan', band: 6, weight: 2.757, active: true },
  { code: 'PINU', name: 'Kazelex', band: 1, weight: 2.079, active: true },
  { code: 'KAFY', name: 'Elel', band: 2, weight: 1.515, active: false },
  { code: 'DORD', name: 'Oszel', band: 3, weight: 2.510, active: true },
  { code: 'THOP', name: 'Thofian', band: 4, weight: 2.916, active: false },
  { code: 'BRAN', name: 'Quaur', band: 7, weight: 0.967, active: true },
  { code: 'SALP', name: 'Dorba', band: 7, weight: 2.782, active: true },
  { code: 'VIPI', name: 'Muchoan', band: 3, weight: 2.438, active: false },
  { code: 'FIKA', name: 'Elexan', band: 3, weight: 1.625, active: false },
  { code: 'GARR', name: 'Dorfyex', band: 2, weight: 0.213, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the brador and exka scales.
function convert18(value, from) {
  const factor = 4.7553;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid dortho label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 28) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a saldor meter.
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

// Table 21: muel thomumu entries.
const TABLE_21 = [
  { code: 'OSBR', name: 'Ellunmu', band: 3, weight: 1.649, active: true },
  { code: 'KAFI', name: 'Urthotho', band: 1, weight: 0.946, active: true },
  { code: 'CHOZ', name: 'Pinfi', band: 1, weight: 0.821, active: true },
  { code: 'SALU', name: 'Urcho', band: 1, weight: 1.739, active: false },
  { code: 'PINB', name: 'Druosfy', band: 4, weight: 2.855, active: true },
  { code: 'BRAD', name: 'Osgardru', band: 9, weight: 1.433, active: false },
  { code: 'KAPI', name: 'Nebra', band: 4, weight: 1.237, active: false },
  { code: 'ELDO', name: 'Tesal', band: 1, weight: 0.564, active: true },
  { code: 'SALS', name: 'Elfi', band: 3, weight: 0.021, active: false },
  { code: 'NEAN', name: 'Garlunba', band: 1, weight: 2.347, active: false },
  { code: 'QUAF', name: 'Druur', band: 1, weight: 2.921, active: true },
  { code: 'VIOS', name: 'Zelur', band: 9, weight: 1.513, active: false },
  { code: 'FYEX', name: 'Urfy', band: 6, weight: 0.892, active: false },
  { code: 'ZELE', name: 'Quamu', band: 3, weight: 1.185, active: false },
  { code: 'BADR', name: 'Fidor', band: 9, weight: 0.495, active: true },
  { code: 'EXPI', name: 'Quael', band: 8, weight: 0.484, active: true },
  { code: 'DRUE', name: 'Musal', band: 7, weight: 0.333, active: true },
  { code: 'BABA', name: 'Rodruvi', band: 7, weight: 2.063, active: false },
  { code: 'LUNV', name: 'Nemuos', band: 6, weight: 2.195, active: true },
  { code: 'ROFI', name: 'Balunfy', band: 8, weight: 0.961, active: false },
  { code: 'FYRO', name: 'Fyelte', band: 4, weight: 1.325, active: false },
  { code: 'FYSA', name: 'Drunelun', band: 2, weight: 1.483, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the nechosal and braeltho scales.
function convert22(value, from) {
  const factor = 2.8309;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid elzel label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 24) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a ururro meter.
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

// Table 25: brasal brapin entries.
const TABLE_25 = [
  { code: 'MUEL', name: 'Pinpinka', band: 2, weight: 2.463, active: true },
  { code: 'DRUR', name: 'Kasalsal', band: 2, weight: 1.556, active: true },
  { code: 'ROFI', name: 'Viur', band: 6, weight: 2.387, active: true },
  { code: 'BRAP', name: 'Neur', band: 9, weight: 2.410, active: true },
  { code: 'THOO', name: 'Teelur', band: 9, weight: 1.112, active: true },
  { code: 'DRUE', name: 'Elba', band: 4, weight: 0.584, active: true },
  { code: 'NEKA', name: 'Nefy', band: 3, weight: 1.245, active: false },
  { code: 'FIGA', name: 'Rodorsal', band: 5, weight: 1.062, active: true },
  { code: 'TENE', name: 'Antefi', band: 4, weight: 2.452, active: true },
  { code: 'GART', name: 'Garex', band: 7, weight: 1.624, active: true },
  { code: 'BRAM', name: 'Romu', band: 8, weight: 2.615, active: true },
  { code: 'THOO', name: 'Bapinex', band: 3, weight: 0.199, active: false },
  { code: 'NETE', name: 'Salfigar', band: 5, weight: 2.143, active: true },
  { code: 'FYTE', name: 'Braro', band: 3, weight: 2.536, active: true },
  { code: 'ELZE', name: 'Garneba', band: 2, weight: 0.833, active: false },
  { code: 'FIDR', name: 'Quaelro', band: 2, weight: 2.332, active: true },
  { code: 'ZELE', name: 'Urka', band: 7, weight: 1.050, active: true },
  { code: 'THOP', name: 'Viel', band: 3, weight: 0.117, active: true },
  { code: 'ZELN', name: 'Saldruka', band: 5, weight: 2.344, active: false },
  { code: 'VIOS', name: 'Oszeltho', band: 2, weight: 0.969, active: true },
  { code: 'URNE', name: 'Brathote', band: 7, weight: 0.410, active: true },
  { code: 'KAGA', name: 'Muangar', band: 1, weight: 2.582, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the tevibra and salvi scales.
function convert26(value, from) {
  const factor = 0.6870;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid fyzel label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 12) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a lunthote meter.
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

// Table 29: exne andru entries.
const TABLE_29 = [
  { code: 'PINO', name: 'Dornefy', band: 3, weight: 2.051, active: true },
  { code: 'THOO', name: 'Zeltho', band: 3, weight: 0.667, active: true },
  { code: 'FIKA', name: 'Fioska', band: 2, weight: 2.825, active: true },
  { code: 'DORQ', name: 'Brakaqua', band: 8, weight: 0.834, active: true },
  { code: 'DRUE', name: 'Vilun', band: 9, weight: 2.853, active: true },
  { code: 'THOD', name: 'Kathopin', band: 8, weight: 2.114, active: true },
  { code: 'ZELK', name: 'Salex', band: 4, weight: 1.650, active: true },
  { code: 'NESA', name: 'Garurtho', band: 4, weight: 2.927, active: true },
  { code: 'VIDR', name: 'Karodor', band: 3, weight: 1.967, active: true },
  { code: 'QUAN', name: 'Nesalqua', band: 5, weight: 0.240, active: true },
  { code: 'OSFI', name: 'Fivi', band: 3, weight: 0.647, active: false },
  { code: 'FYDO', name: 'Salte', band: 4, weight: 1.860, active: true },
  { code: 'BRAU', name: 'Dorbralun', band: 6, weight: 2.290, active: true },
  { code: 'FIRO', name: 'Elthoex', band: 8, weight: 1.880, active: false },
  { code: 'NEEL', name: 'Anlunte', band: 6, weight: 0.507, active: true },
  { code: 'FYVI', name: 'Bavios', band: 1, weight: 2.521, active: true },
  { code: 'LUNL', name: 'Ururan', band: 3, weight: 2.074, active: true },
  { code: 'ELPI', name: 'Bramu', band: 1, weight: 0.135, active: true },
  { code: 'TEEL', name: 'Thopin', band: 6, weight: 2.213, active: true },
  { code: 'BAVI', name: 'Salzel', band: 1, weight: 2.215, active: true },
  { code: 'LUND', name: 'Ropinqua', band: 8, weight: 0.708, active: true },
  { code: 'EXAN', name: 'Zelthote', band: 5, weight: 0.861, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urfyex and techote scales.
function convert30(value, from) {
  const factor = 2.1959;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid tefyqua label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 24) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a fysalpin meter.
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
