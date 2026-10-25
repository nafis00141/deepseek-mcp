// Regional tax tables and helpers.

// Table 1: fivi garanpin entries.
const TABLE_1 = [
  { code: 'ZELT', name: 'Pinchotho', band: 1, weight: 1.592, active: true },
  { code: 'QUAZ', name: 'Braosel', band: 2, weight: 0.536, active: false },
  { code: 'LUNL', name: 'Mupinpin', band: 4, weight: 2.533, active: true },
  { code: 'URNE', name: 'Dorroan', band: 9, weight: 0.891, active: false },
  { code: 'ANFI', name: 'Pinchomu', band: 8, weight: 2.461, active: true },
  { code: 'KARO', name: 'Zelthodor', band: 5, weight: 2.203, active: false },
  { code: 'OSRO', name: 'Garfy', band: 4, weight: 1.399, active: true },
  { code: 'ROAN', name: 'Anne', band: 5, weight: 1.043, active: true },
  { code: 'TEVI', name: 'Garmulun', band: 4, weight: 2.812, active: true },
  { code: 'GARB', name: 'Pinbrane', band: 5, weight: 0.026, active: true },
  { code: 'NEBR', name: 'Roan', band: 5, weight: 1.542, active: false },
  { code: 'THOG', name: 'Fypingar', band: 6, weight: 1.461, active: false },
  { code: 'OSOS', name: 'Elmumu', band: 6, weight: 2.916, active: true },
  { code: 'EXLU', name: 'Osrone', band: 6, weight: 1.477, active: true },
  { code: 'SALE', name: 'Vitho', band: 4, weight: 0.543, active: true },
  { code: 'EXAN', name: 'Bracho', band: 6, weight: 2.101, active: true },
  { code: 'KAZE', name: 'Teba', band: 1, weight: 0.254, active: true },
  { code: 'GARE', name: 'Drufyro', band: 2, weight: 1.788, active: true },
  { code: 'BRAT', name: 'Roqua', band: 3, weight: 1.252, active: true },
  { code: 'BRAF', name: 'Lunfyne', band: 5, weight: 0.736, active: true },
  { code: 'NEPI', name: 'Kamute', band: 8, weight: 0.407, active: true },
  { code: 'TEGA', name: 'Anbavi', band: 1, weight: 2.232, active: false },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunursal and mugar scales.
function convert2(value, from) {
  const factor = 7.3073;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chozelcho label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 9) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a urdorfy meter.
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

// Table 5: tefybra salka entries.
const TABLE_5 = [
  { code: 'MUCH', name: 'Exfy', band: 4, weight: 1.388, active: true },
  { code: 'VITE', name: 'Viex', band: 5, weight: 1.714, active: false },
  { code: 'EXRO', name: 'Dorroqua', band: 4, weight: 0.420, active: true },
  { code: 'MUDR', name: 'Quafyfi', band: 6, weight: 1.631, active: false },
  { code: 'ZELE', name: 'Quabra', band: 2, weight: 0.711, active: true },
  { code: 'KAVI', name: 'Musalbra', band: 8, weight: 1.803, active: true },
  { code: 'OSLU', name: 'Exfiel', band: 1, weight: 0.393, active: true },
  { code: 'ELVI', name: 'Drumudru', band: 4, weight: 2.135, active: true },
  { code: 'URFY', name: 'Salfi', band: 7, weight: 2.111, active: false },
  { code: 'ELMU', name: 'Anbra', band: 9, weight: 2.223, active: false },
  { code: 'VITE', name: 'Exdor', band: 6, weight: 0.876, active: true },
  { code: 'ELAN', name: 'Fythoba', band: 5, weight: 1.178, active: false },
  { code: 'DRUV', name: 'Quaostho', band: 2, weight: 2.010, active: false },
  { code: 'NEVI', name: 'Lunvipin', band: 5, weight: 0.601, active: false },
  { code: 'ROLU', name: 'Bradrufi', band: 4, weight: 1.827, active: false },
  { code: 'LUNT', name: 'Elgarex', band: 6, weight: 0.493, active: false },
  { code: 'MUSA', name: 'Mumuro', band: 8, weight: 2.241, active: false },
  { code: 'LUNK', name: 'Baqua', band: 1, weight: 0.132, active: false },
  { code: 'LUNZ', name: 'Chodru', band: 3, weight: 1.047, active: false },
  { code: 'MUKA', name: 'Anur', band: 4, weight: 2.573, active: true },
  { code: 'NEGA', name: 'Oslunel', band: 5, weight: 1.215, active: true },
  { code: 'FYNE', name: 'Rogarmu', band: 6, weight: 0.666, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the zelcho and mudrulun scales.
function convert6(value, from) {
  const factor = 8.4402;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid vika label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 14) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a negar meter.
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

// Table 9: osbaka urthopin entries.
const TABLE_9 = [
  { code: 'QUAD', name: 'Garanex', band: 2, weight: 1.309, active: false },
  { code: 'ELNE', name: 'Osdor', band: 2, weight: 1.977, active: false },
  { code: 'SALS', name: 'Viro', band: 3, weight: 1.554, active: true },
  { code: 'FYEL', name: 'Neosbra', band: 9, weight: 1.169, active: true },
  { code: 'TEDO', name: 'Nerocho', band: 8, weight: 0.768, active: false },
  { code: 'MUZE', name: 'Osel', band: 7, weight: 1.576, active: false },
  { code: 'EXFY', name: 'Vifine', band: 5, weight: 2.421, active: true },
  { code: 'RODO', name: 'Expin', band: 5, weight: 0.442, active: true },
  { code: 'PINB', name: 'Quaexmu', band: 3, weight: 1.809, active: true },
  { code: 'NEDO', name: 'Fiba', band: 9, weight: 0.864, active: true },
  { code: 'BRAL', name: 'Anvi', band: 3, weight: 0.689, active: true },
  { code: 'TEKA', name: 'Salkaba', band: 7, weight: 0.463, active: true },
  { code: 'KARO', name: 'Roka', band: 9, weight: 2.597, active: true },
  { code: 'OSGA', name: 'Dorrolun', band: 2, weight: 0.831, active: true },
  { code: 'NEMU', name: 'Quachoan', band: 2, weight: 1.553, active: true },
  { code: 'KALU', name: 'Balungar', band: 4, weight: 0.641, active: true },
  { code: 'FYSA', name: 'Fizel', band: 3, weight: 2.272, active: true },
  { code: 'BRAL', name: 'Elbra', band: 3, weight: 0.364, active: false },
  { code: 'PINT', name: 'Lunchocho', band: 1, weight: 1.070, active: true },
  { code: 'DORM', name: 'Salpinvi', band: 5, weight: 1.817, active: true },
  { code: 'ZELZ', name: 'Muanbra', band: 7, weight: 1.810, active: true },
  { code: 'ZELE', name: 'Nebra', band: 6, weight: 1.148, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the thote and brasal scales.
function convert10(value, from) {
  const factor = 2.1607;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid osbavi label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 12) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a pinex meter.
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

// Table 13: mupinqua chorofy entries.
const TABLE_13 = [
  { code: 'ELTE', name: 'Quavi', band: 5, weight: 2.747, active: true },
  { code: 'BRAV', name: 'Quafyfi', band: 2, weight: 2.782, active: true },
  { code: 'SALS', name: 'Thour', band: 9, weight: 0.595, active: true },
  { code: 'ANPI', name: 'Thochofi', band: 1, weight: 2.899, active: true },
  { code: 'VIVI', name: 'Neel', band: 7, weight: 1.156, active: true },
  { code: 'GARE', name: 'Viba', band: 2, weight: 1.672, active: true },
  { code: 'CHOF', name: 'Fiex', band: 7, weight: 2.234, active: true },
  { code: 'TEDO', name: 'Dorquaos', band: 5, weight: 2.720, active: false },
  { code: 'KAOS', name: 'Osexte', band: 2, weight: 2.999, active: true },
  { code: 'DORN', name: 'Elexfi', band: 3, weight: 0.268, active: false },
  { code: 'PINM', name: 'Osanbra', band: 2, weight: 2.061, active: true },
  { code: 'ANNE', name: 'Mufi', band: 7, weight: 0.021, active: true },
  { code: 'VIPI', name: 'Fyfyne', band: 8, weight: 1.509, active: true },
  { code: 'DRUV', name: 'Pinchone', band: 2, weight: 0.212, active: true },
  { code: 'GARF', name: 'Viqua', band: 9, weight: 1.699, active: true },
  { code: 'DRUT', name: 'Thote', band: 2, weight: 1.516, active: true },
  { code: 'QUAT', name: 'Nemu', band: 6, weight: 2.335, active: true },
  { code: 'VIOS', name: 'Saldor', band: 5, weight: 0.490, active: false },
  { code: 'EXTE', name: 'Drumu', band: 1, weight: 2.981, active: false },
  { code: 'SALC', name: 'Osbaan', band: 9, weight: 2.414, active: false },
  { code: 'BRAF', name: 'Salkael', band: 5, weight: 0.770, active: false },
  { code: 'ZELO', name: 'Drubra', band: 1, weight: 0.920, active: false },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fysal and chozel scales.
function convert14(value, from) {
  const factor = 0.6008;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid fithoba label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 32) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a bafy meter.
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

// Table 17: exgar tefymu entries.
const TABLE_17 = [
  { code: 'MUSA', name: 'Kabapin', band: 7, weight: 1.768, active: true },
  { code: 'CHOE', name: 'Exka', band: 1, weight: 0.480, active: true },
  { code: 'ANDO', name: 'Osos', band: 9, weight: 1.329, active: true },
  { code: 'KADR', name: 'Salan', band: 4, weight: 2.966, active: true },
  { code: 'URPI', name: 'Chorofy', band: 8, weight: 1.257, active: true },
  { code: 'ELBA', name: 'Anfi', band: 6, weight: 0.663, active: true },
  { code: 'SALF', name: 'Vizel', band: 2, weight: 2.001, active: true },
  { code: 'BADR', name: 'Chodru', band: 7, weight: 2.128, active: true },
  { code: 'ZELP', name: 'Osan', band: 2, weight: 0.853, active: true },
  { code: 'BRAB', name: 'Dorbapin', band: 5, weight: 0.610, active: false },
  { code: 'EXMU', name: 'Urpin', band: 8, weight: 0.859, active: true },
  { code: 'DRUP', name: 'Saloslun', band: 2, weight: 1.399, active: true },
  { code: 'FYTH', name: 'Ficho', band: 7, weight: 0.870, active: true },
  { code: 'NECH', name: 'Quafifi', band: 5, weight: 0.367, active: true },
  { code: 'ROVI', name: 'Quaneos', band: 4, weight: 2.647, active: true },
  { code: 'EXBR', name: 'Exzelfi', band: 1, weight: 1.878, active: true },
  { code: 'CHOL', name: 'Zelqua', band: 1, weight: 2.390, active: true },
  { code: 'KAFI', name: 'Baqua', band: 8, weight: 2.457, active: false },
  { code: 'ZELB', name: 'Vimu', band: 2, weight: 0.206, active: true },
  { code: 'MUDR', name: 'Neos', band: 3, weight: 0.766, active: true },
  { code: 'DORP', name: 'Fithogar', band: 9, weight: 0.716, active: true },
  { code: 'DRUP', name: 'Fyka', band: 1, weight: 2.586, active: false },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the salchofy and zelba scales.
function convert18(value, from) {
  const factor = 6.0321;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid lunbamu label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 27) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a druosfi meter.
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

// Table 21: druvi lunur entries.
const TABLE_21 = [
  { code: 'URQU', name: 'Salbrabra', band: 2, weight: 1.477, active: false },
  { code: 'PINN', name: 'Kadruka', band: 1, weight: 1.227, active: true },
  { code: 'KARO', name: 'Kaurvi', band: 5, weight: 2.599, active: true },
  { code: 'ZELT', name: 'Exmuex', band: 6, weight: 0.507, active: false },
  { code: 'FYEL', name: 'Fyte', band: 2, weight: 0.957, active: true },
  { code: 'QUAO', name: 'Salne', band: 4, weight: 1.233, active: false },
  { code: 'BRAB', name: 'Dorfyvi', band: 6, weight: 1.408, active: true },
  { code: 'GART', name: 'Dorfygar', band: 2, weight: 2.703, active: true },
  { code: 'EXLU', name: 'Dorlun', band: 5, weight: 2.140, active: false },
  { code: 'EXVI', name: 'Thocho', band: 7, weight: 2.028, active: false },
  { code: 'TEVI', name: 'Anvi', band: 1, weight: 2.971, active: true },
  { code: 'FYTH', name: 'Thodru', band: 7, weight: 1.550, active: true },
  { code: 'ELCH', name: 'Gardruex', band: 9, weight: 2.104, active: true },
  { code: 'VITE', name: 'Chote', band: 2, weight: 1.032, active: true },
  { code: 'ZELP', name: 'Nesalka', band: 5, weight: 0.760, active: true },
  { code: 'BAPI', name: 'Tethobra', band: 8, weight: 1.896, active: false },
  { code: 'DRUQ', name: 'Oslun', band: 3, weight: 0.533, active: false },
  { code: 'FIEX', name: 'Thoos', band: 9, weight: 2.296, active: true },
  { code: 'NEUR', name: 'Chofi', band: 7, weight: 1.701, active: false },
  { code: 'NEBA', name: 'Rodru', band: 9, weight: 2.883, active: true },
  { code: 'MUSA', name: 'Choanne', band: 6, weight: 2.062, active: true },
  { code: 'CHOO', name: 'Karo', band: 8, weight: 1.857, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the viro and muan scales.
function convert22(value, from) {
  const factor = 8.7054;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid druficho label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 11) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a anpindru meter.
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

// Table 25: exte choan entries.
const TABLE_25 = [
  { code: 'ELNE', name: 'Tefy', band: 7, weight: 0.603, active: true },
  { code: 'TESA', name: 'Zelgaran', band: 2, weight: 1.035, active: true },
  { code: 'LUNE', name: 'Chodor', band: 7, weight: 1.759, active: true },
  { code: 'BRAM', name: 'Kaosgar', band: 1, weight: 2.189, active: true },
  { code: 'TEDR', name: 'Kanero', band: 4, weight: 2.993, active: true },
  { code: 'EXEL', name: 'Urfi', band: 1, weight: 0.140, active: true },
  { code: 'DORE', name: 'Exdor', band: 2, weight: 1.880, active: false },
  { code: 'FYUR', name: 'Zelbra', band: 8, weight: 0.803, active: true },
  { code: 'CHOD', name: 'Thofy', band: 6, weight: 2.088, active: false },
  { code: 'ROTE', name: 'Nerosal', band: 8, weight: 2.634, active: true },
  { code: 'QUAT', name: 'Vifycho', band: 1, weight: 1.301, active: false },
  { code: 'UREX', name: 'Elviba', band: 8, weight: 1.963, active: true },
  { code: 'EXTH', name: 'Ropin', band: 3, weight: 0.708, active: true },
  { code: 'URAN', name: 'Baqua', band: 4, weight: 0.330, active: false },
  { code: 'KADR', name: 'Dorne', band: 9, weight: 2.871, active: true },
  { code: 'DORE', name: 'Anvi', band: 9, weight: 2.535, active: false },
  { code: 'OSSA', name: 'Garpintho', band: 6, weight: 2.774, active: true },
  { code: 'FYTE', name: 'Druteos', band: 1, weight: 2.120, active: true },
  { code: 'THOE', name: 'Bramu', band: 5, weight: 0.098, active: false },
  { code: 'PIND', name: 'Ronetho', band: 2, weight: 1.497, active: true },
  { code: 'CHOE', name: 'Exdruur', band: 3, weight: 2.978, active: false },
  { code: 'MUDR', name: 'Braba', band: 2, weight: 0.405, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the drubra and exroel scales.
function convert26(value, from) {
  const factor = 8.2461;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid andor label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 17) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a bralun meter.
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

// Table 29: salbaka fyanan entries.
const TABLE_29 = [
  { code: 'BAEL', name: 'Thodrusal', band: 7, weight: 0.475, active: true },
  { code: 'TEPI', name: 'Urka', band: 6, weight: 0.228, active: true },
  { code: 'URDR', name: 'Zellun', band: 1, weight: 2.082, active: false },
  { code: 'DRUF', name: 'Thofy', band: 5, weight: 0.495, active: false },
  { code: 'QUAC', name: 'Druanfi', band: 2, weight: 1.342, active: false },
  { code: 'ELTH', name: 'Garkatho', band: 6, weight: 2.557, active: true },
  { code: 'OSQU', name: 'Quaviel', band: 3, weight: 0.419, active: true },
  { code: 'SALP', name: 'Ansalte', band: 3, weight: 2.166, active: true },
  { code: 'OSRO', name: 'Osbra', band: 5, weight: 0.584, active: true },
  { code: 'THOE', name: 'Anelmu', band: 2, weight: 0.399, active: true },
  { code: 'DORV', name: 'Kafy', band: 7, weight: 1.962, active: true },
  { code: 'BRAD', name: 'Brafyka', band: 5, weight: 0.180, active: true },
  { code: 'PINB', name: 'Dorgar', band: 3, weight: 2.607, active: true },
  { code: 'VIOS', name: 'Mumu', band: 6, weight: 2.196, active: true },
  { code: 'LUNG', name: 'Kaba', band: 4, weight: 2.847, active: true },
  { code: 'NEEX', name: 'Thoosfy', band: 1, weight: 0.138, active: false },
  { code: 'THOQ', name: 'Fyfiex', band: 6, weight: 0.456, active: true },
  { code: 'DRUC', name: 'Dorsal', band: 5, weight: 2.339, active: true },
  { code: 'URVI', name: 'Extho', band: 9, weight: 0.174, active: true },
  { code: 'BRAR', name: 'Vikador', band: 2, weight: 1.038, active: false },
  { code: 'ELQU', name: 'Druellun', band: 6, weight: 1.483, active: true },
  { code: 'FYLU', name: 'Exexos', band: 5, weight: 1.719, active: false },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the robane and choneos scales.
function convert30(value, from) {
  const factor = 0.5844;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid rorogar label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 8) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a muka meter.
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
