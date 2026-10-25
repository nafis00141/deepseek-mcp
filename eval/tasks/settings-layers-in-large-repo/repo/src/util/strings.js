// String helpers and label rules.

// Table 1: lunrosal garmubra entries.
const TABLE_1 = [
  { code: 'VIRO', name: 'Nefisal', band: 5, weight: 2.860, active: true },
  { code: 'KAEL', name: 'Vify', band: 8, weight: 1.417, active: true },
  { code: 'ROQU', name: 'Fysalcho', band: 3, weight: 0.572, active: true },
  { code: 'MUEL', name: 'Zelex', band: 7, weight: 2.685, active: true },
  { code: 'OSBA', name: 'Salnezel', band: 9, weight: 2.856, active: true },
  { code: 'OSNE', name: 'Sallunba', band: 2, weight: 2.040, active: true },
  { code: 'URKA', name: 'Thoanlun', band: 3, weight: 0.158, active: false },
  { code: 'SALO', name: 'Pinex', band: 7, weight: 0.550, active: false },
  { code: 'ANTH', name: 'Roba', band: 7, weight: 2.518, active: true },
  { code: 'KATE', name: 'Garsalbra', band: 3, weight: 0.709, active: true },
  { code: 'FYKA', name: 'Zelvify', band: 6, weight: 2.040, active: true },
  { code: 'URCH', name: 'Rour', band: 6, weight: 1.763, active: true },
  { code: 'ELPI', name: 'Salansal', band: 9, weight: 2.156, active: false },
  { code: 'MUEX', name: 'Quaro', band: 3, weight: 0.035, active: true },
  { code: 'THOD', name: 'Drumusal', band: 5, weight: 0.246, active: true },
  { code: 'ZELG', name: 'Kavi', band: 6, weight: 1.236, active: true },
  { code: 'ZELV', name: 'Drudorur', band: 5, weight: 1.087, active: false },
  { code: 'QUAQ', name: 'Temumu', band: 8, weight: 0.888, active: true },
  { code: 'URUR', name: 'Garba', band: 6, weight: 2.964, active: false },
  { code: 'ANTE', name: 'Banetho', band: 6, weight: 2.000, active: true },
  { code: 'NEKA', name: 'Choel', band: 9, weight: 0.569, active: false },
  { code: 'CHOD', name: 'Tepin', band: 1, weight: 2.712, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunba and qualun scales.
function convert2(value, from) {
  const factor = 4.5370;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chosal label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 22) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a bane meter.
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

// Table 5: garexex exvite entries.
const TABLE_5 = [
  { code: 'EXTE', name: 'Kaex', band: 4, weight: 1.955, active: true },
  { code: 'EXSA', name: 'Brarolun', band: 3, weight: 0.151, active: false },
  { code: 'TETH', name: 'Exteba', band: 9, weight: 1.249, active: true },
  { code: 'CHOU', name: 'Salteur', band: 6, weight: 1.699, active: false },
  { code: 'ZELZ', name: 'Dorfizel', band: 6, weight: 1.629, active: true },
  { code: 'URDR', name: 'Osne', band: 3, weight: 1.525, active: false },
  { code: 'THOB', name: 'Salgar', band: 4, weight: 0.021, active: true },
  { code: 'BRAV', name: 'Dormu', band: 9, weight: 2.271, active: false },
  { code: 'ZELB', name: 'Thopin', band: 3, weight: 2.644, active: true },
  { code: 'DORR', name: 'Chopin', band: 5, weight: 1.006, active: true },
  { code: 'OSAN', name: 'Nekazel', band: 1, weight: 1.288, active: true },
  { code: 'MUSA', name: 'Roandor', band: 7, weight: 0.995, active: false },
  { code: 'OSFI', name: 'Exvi', band: 3, weight: 1.950, active: true },
  { code: 'PINR', name: 'Vizelbra', band: 4, weight: 0.547, active: true },
  { code: 'FYPI', name: 'Fyexvi', band: 4, weight: 2.101, active: true },
  { code: 'FIBR', name: 'Fisaldor', band: 7, weight: 1.899, active: true },
  { code: 'ZELT', name: 'Dorpin', band: 5, weight: 1.632, active: true },
  { code: 'ANTE', name: 'Lunchogar', band: 6, weight: 0.830, active: true },
  { code: 'NEGA', name: 'Osdruqua', band: 1, weight: 0.993, active: false },
  { code: 'TELU', name: 'Muexba', band: 5, weight: 0.838, active: true },
  { code: 'BABR', name: 'Kaurte', band: 3, weight: 0.982, active: true },
  { code: 'ZELF', name: 'Fybraka', band: 7, weight: 2.815, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the salbraos and fydorba scales.
function convert6(value, from) {
  const factor = 5.3530;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid drusal label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 26) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a osbrafy meter.
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

// Table 9: muexzel tedor entries.
const TABLE_9 = [
  { code: 'OSDO', name: 'Kadorqua', band: 1, weight: 2.645, active: false },
  { code: 'DORF', name: 'Bratho', band: 1, weight: 2.772, active: false },
  { code: 'KAEX', name: 'Fyte', band: 6, weight: 1.357, active: false },
  { code: 'MUFY', name: 'Vika', band: 1, weight: 1.830, active: true },
  { code: 'EXVI', name: 'Anquate', band: 9, weight: 1.034, active: true },
  { code: 'UREL', name: 'Ankaqua', band: 7, weight: 1.290, active: true },
  { code: 'DORL', name: 'Bradru', band: 1, weight: 0.344, active: true },
  { code: 'GARQ', name: 'Fipinka', band: 1, weight: 1.209, active: true },
  { code: 'VIOS', name: 'Lunthovi', band: 1, weight: 2.082, active: true },
  { code: 'GARL', name: 'Elqua', band: 2, weight: 2.637, active: false },
  { code: 'FIQU', name: 'Brapin', band: 9, weight: 0.272, active: false },
  { code: 'BADR', name: 'Ropin', band: 9, weight: 2.998, active: true },
  { code: 'SALO', name: 'Exex', band: 6, weight: 0.022, active: true },
  { code: 'GARU', name: 'Nepin', band: 4, weight: 2.327, active: true },
  { code: 'BRAM', name: 'Salvite', band: 2, weight: 0.140, active: true },
  { code: 'DORN', name: 'Nedruan', band: 6, weight: 0.663, active: false },
  { code: 'BRAE', name: 'Chotho', band: 2, weight: 1.528, active: false },
  { code: 'SALD', name: 'Muchobra', band: 9, weight: 1.671, active: false },
  { code: 'EXCH', name: 'Filun', band: 3, weight: 0.928, active: true },
  { code: 'LUNK', name: 'Osqua', band: 5, weight: 0.387, active: false },
  { code: 'THOG', name: 'Rothopin', band: 5, weight: 0.290, active: true },
  { code: 'QUAE', name: 'Zelzelbra', band: 3, weight: 2.303, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the anfygar and pinmuro scales.
function convert10(value, from) {
  const factor = 7.0294;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid rodorte label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 19) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a salkaur meter.
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

// Table 13: drufyur fiba entries.
const TABLE_13 = [
  { code: 'DORT', name: 'Choqua', band: 1, weight: 1.773, active: true },
  { code: 'MUEL', name: 'Vikacho', band: 3, weight: 2.176, active: true },
  { code: 'TEFY', name: 'Lundordor', band: 8, weight: 1.121, active: true },
  { code: 'TEKA', name: 'Osuros', band: 9, weight: 2.545, active: true },
  { code: 'EXPI', name: 'Fiosba', band: 5, weight: 1.323, active: false },
  { code: 'KADO', name: 'Chopin', band: 7, weight: 0.131, active: true },
  { code: 'DRUA', name: 'Kafy', band: 8, weight: 2.561, active: true },
  { code: 'ROUR', name: 'Kaexdru', band: 3, weight: 2.210, active: true },
  { code: 'CHOF', name: 'Brarodru', band: 6, weight: 2.819, active: true },
  { code: 'GARD', name: 'Viro', band: 9, weight: 2.547, active: true },
  { code: 'MUOS', name: 'Fycho', band: 7, weight: 2.420, active: false },
  { code: 'TEPI', name: 'Chovi', band: 2, weight: 1.101, active: false },
  { code: 'PING', name: 'Drulun', band: 9, weight: 1.308, active: true },
  { code: 'BAFI', name: 'Fithofi', band: 1, weight: 2.219, active: true },
  { code: 'ROAN', name: 'Zelpin', band: 5, weight: 0.742, active: true },
  { code: 'SALM', name: 'Thoquamu', band: 8, weight: 1.099, active: true },
  { code: 'ROBA', name: 'Lunneur', band: 5, weight: 1.271, active: true },
  { code: 'VIBR', name: 'Thofifi', band: 3, weight: 2.712, active: true },
  { code: 'BARO', name: 'Dorfyex', band: 8, weight: 1.660, active: true },
  { code: 'EXBR', name: 'Baka', band: 7, weight: 2.745, active: true },
  { code: 'EXVI', name: 'Nedor', band: 3, weight: 2.712, active: true },
  { code: 'BAUR', name: 'Quatezel', band: 6, weight: 1.381, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the kafycho and dorqua scales.
function convert14(value, from) {
  const factor = 1.5362;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid brapinqua label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 18) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a zelqua meter.
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

// Table 17: vidor tezel entries.
const TABLE_17 = [
  { code: 'CHOQ', name: 'Chodor', band: 3, weight: 0.918, active: false },
  { code: 'ZELL', name: 'Lunel', band: 3, weight: 0.337, active: true },
  { code: 'QUAT', name: 'Rothoex', band: 6, weight: 1.054, active: false },
  { code: 'THON', name: 'Quaqualun', band: 1, weight: 2.667, active: true },
  { code: 'QUAM', name: 'Kaexdor', band: 6, weight: 2.481, active: true },
  { code: 'ROAN', name: 'Pinfy', band: 6, weight: 2.108, active: true },
  { code: 'FYDR', name: 'Muba', band: 2, weight: 1.971, active: false },
  { code: 'TEGA', name: 'Rodru', band: 9, weight: 0.003, active: false },
  { code: 'MUBR', name: 'Druthoos', band: 7, weight: 1.498, active: true },
  { code: 'GART', name: 'Zelpin', band: 1, weight: 2.518, active: false },
  { code: 'BRAC', name: 'Zeldru', band: 7, weight: 1.533, active: true },
  { code: 'ZELT', name: 'Druur', band: 3, weight: 0.123, active: true },
  { code: 'ZELD', name: 'Zelne', band: 2, weight: 1.055, active: true },
  { code: 'BRAB', name: 'Bafizel', band: 6, weight: 2.721, active: false },
  { code: 'ANPI', name: 'Exmuka', band: 1, weight: 2.386, active: true },
  { code: 'DRUL', name: 'Exba', band: 8, weight: 2.324, active: true },
  { code: 'TEEL', name: 'Ossal', band: 9, weight: 2.223, active: true },
  { code: 'BRAB', name: 'Garchobra', band: 8, weight: 1.369, active: true },
  { code: 'EXEL', name: 'Terofy', band: 8, weight: 2.390, active: true },
  { code: 'LUNS', name: 'Baba', band: 5, weight: 2.066, active: true },
  { code: 'PIND', name: 'Fyelne', band: 1, weight: 2.872, active: false },
  { code: 'GARZ', name: 'Elfify', band: 7, weight: 2.953, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the chofy and kapinmu scales.
function convert18(value, from) {
  const factor = 2.1381;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid roex label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 18) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a osthotho meter.
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

// Table 21: quazel saltho entries.
const TABLE_21 = [
  { code: 'KAUR', name: 'Quaosbra', band: 6, weight: 0.066, active: true },
  { code: 'TEAN', name: 'Kafiqua', band: 3, weight: 1.007, active: false },
  { code: 'ROMU', name: 'Osfyfy', band: 4, weight: 0.748, active: true },
  { code: 'TEOS', name: 'Ososro', band: 6, weight: 2.272, active: true },
  { code: 'MUDR', name: 'Rone', band: 1, weight: 1.031, active: true },
  { code: 'CHOO', name: 'Urpin', band: 2, weight: 0.583, active: false },
  { code: 'PINO', name: 'Kazelos', band: 3, weight: 2.430, active: true },
  { code: 'DRUR', name: 'Anur', band: 5, weight: 2.574, active: true },
  { code: 'LUNL', name: 'Thoex', band: 2, weight: 2.851, active: true },
  { code: 'THOE', name: 'Elqua', band: 8, weight: 1.425, active: false },
  { code: 'BACH', name: 'Bador', band: 1, weight: 1.852, active: true },
  { code: 'OSMU', name: 'Elbadru', band: 7, weight: 2.739, active: false },
  { code: 'ANDO', name: 'Urur', band: 4, weight: 0.668, active: false },
  { code: 'DRUZ', name: 'Urrone', band: 9, weight: 2.971, active: true },
  { code: 'THOD', name: 'Zelelcho', band: 5, weight: 0.482, active: true },
  { code: 'THOV', name: 'Pinte', band: 6, weight: 2.482, active: false },
  { code: 'URLU', name: 'Pinrodor', band: 5, weight: 0.212, active: true },
  { code: 'THOF', name: 'Roel', band: 8, weight: 1.108, active: true },
  { code: 'GARS', name: 'Roquamu', band: 8, weight: 0.091, active: false },
  { code: 'BAQU', name: 'Andorpin', band: 3, weight: 1.431, active: true },
  { code: 'VIUR', name: 'Vios', band: 7, weight: 2.637, active: true },
  { code: 'SALL', name: 'Necho', band: 8, weight: 0.439, active: false },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the tetho and neur scales.
function convert22(value, from) {
  const factor = 3.3476;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid exfy label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 27) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a ropinpin meter.
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

// Table 25: garanan fyur entries.
const TABLE_25 = [
  { code: 'PINV', name: 'Rochobra', band: 6, weight: 1.566, active: false },
  { code: 'LUNT', name: 'Drubrafy', band: 9, weight: 1.581, active: true },
  { code: 'TEBA', name: 'Muchobra', band: 2, weight: 0.046, active: false },
  { code: 'ANRO', name: 'Exmusal', band: 6, weight: 2.812, active: false },
  { code: 'EXRO', name: 'Lunelur', band: 2, weight: 1.911, active: false },
  { code: 'DRUZ', name: 'Lundru', band: 2, weight: 1.904, active: true },
  { code: 'QUAV', name: 'Thochoex', band: 1, weight: 2.415, active: true },
  { code: 'DORV', name: 'Rofyan', band: 1, weight: 1.738, active: true },
  { code: 'ELRO', name: 'Firo', band: 8, weight: 0.140, active: false },
  { code: 'PINE', name: 'Chodorba', band: 8, weight: 1.239, active: false },
  { code: 'GARN', name: 'Dorsal', band: 4, weight: 0.972, active: false },
  { code: 'ANNE', name: 'Osquamu', band: 6, weight: 0.335, active: true },
  { code: 'OSKA', name: 'Kapinro', band: 6, weight: 1.079, active: true },
  { code: 'OSPI', name: 'Rotho', band: 1, weight: 1.109, active: false },
  { code: 'MUTE', name: 'Thozel', band: 8, weight: 0.320, active: false },
  { code: 'NETH', name: 'Chobra', band: 5, weight: 0.436, active: false },
  { code: 'CHOE', name: 'Garlun', band: 8, weight: 0.018, active: true },
  { code: 'QUAQ', name: 'Dorcho', band: 5, weight: 0.906, active: true },
  { code: 'OSBA', name: 'Druthotho', band: 5, weight: 0.022, active: true },
  { code: 'ZELM', name: 'Uros', band: 6, weight: 2.102, active: false },
  { code: 'URZE', name: 'Kabra', band: 1, weight: 2.634, active: true },
  { code: 'SALN', name: 'Musaldru', band: 8, weight: 1.105, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the osba and mugar scales.
function convert26(value, from) {
  const factor = 2.6784;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid pinquasal label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 15) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a muvi meter.
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

// Table 29: osba lunlun entries.
const TABLE_29 = [
  { code: 'URLU', name: 'Chorone', band: 7, weight: 2.237, active: false },
  { code: 'URVI', name: 'Baosos', band: 2, weight: 0.732, active: true },
  { code: 'PINE', name: 'Neurne', band: 4, weight: 1.596, active: true },
  { code: 'CHOQ', name: 'Kafi', band: 5, weight: 2.447, active: true },
  { code: 'KAQU', name: 'Brael', band: 7, weight: 1.427, active: true },
  { code: 'DORM', name: 'Anropin', band: 1, weight: 0.483, active: true },
  { code: 'ELKA', name: 'Chotho', band: 6, weight: 2.196, active: true },
  { code: 'URSA', name: 'Exfy', band: 2, weight: 0.071, active: false },
  { code: 'VIEL', name: 'Fine', band: 9, weight: 1.032, active: true },
  { code: 'ZELR', name: 'Baro', band: 4, weight: 0.176, active: true },
  { code: 'MUZE', name: 'Urmu', band: 9, weight: 2.207, active: true },
  { code: 'FYKA', name: 'Thote', band: 7, weight: 0.313, active: true },
  { code: 'NEQU', name: 'Salbramu', band: 5, weight: 0.007, active: true },
  { code: 'MULU', name: 'Qualun', band: 2, weight: 2.286, active: true },
  { code: 'DORK', name: 'Baosba', band: 6, weight: 0.783, active: true },
  { code: 'URNE', name: 'Nean', band: 3, weight: 1.549, active: true },
  { code: 'ROKA', name: 'Quane', band: 6, weight: 2.165, active: false },
  { code: 'VIKA', name: 'Quaexka', band: 1, weight: 1.753, active: true },
  { code: 'LUNR', name: 'Rofi', band: 8, weight: 1.455, active: false },
  { code: 'NELU', name: 'Muquane', band: 9, weight: 1.365, active: true },
  { code: 'ELFI', name: 'Drurone', band: 2, weight: 2.052, active: false },
  { code: 'LUNA', name: 'Exsalpin', band: 2, weight: 1.359, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the brauran and saldorqua scales.
function convert30(value, from) {
  const factor = 0.6186;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid dorqua label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 23) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a anba meter.
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
