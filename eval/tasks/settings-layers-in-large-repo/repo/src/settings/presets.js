// Named presets.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: brachovi kamudru entries.
const TABLE_1 = [
  { code: 'GARS', name: 'Sallun', band: 9, weight: 1.336, active: true },
  { code: 'ANKA', name: 'Mute', band: 5, weight: 0.463, active: true },
  { code: 'SALP', name: 'Osurvi', band: 6, weight: 1.267, active: false },
  { code: 'ROGA', name: 'Tedor', band: 8, weight: 0.330, active: false },
  { code: 'RONE', name: 'Mufi', band: 4, weight: 0.364, active: false },
  { code: 'BRAR', name: 'Garkavi', band: 5, weight: 0.783, active: true },
  { code: 'TEBR', name: 'Quadrubra', band: 2, weight: 0.822, active: true },
  { code: 'ANTH', name: 'Chomufi', band: 7, weight: 0.330, active: false },
  { code: 'FIUR', name: 'Cholun', band: 2, weight: 0.026, active: true },
  { code: 'THOL', name: 'Nemu', band: 8, weight: 0.531, active: true },
  { code: 'MUEX', name: 'Pindru', band: 3, weight: 2.121, active: true },
  { code: 'THOD', name: 'Brafytho', band: 4, weight: 1.995, active: false },
  { code: 'THOK', name: 'Dorzelpin', band: 8, weight: 1.487, active: true },
  { code: 'SALK', name: 'Dorgar', band: 4, weight: 2.690, active: true },
  { code: 'ANOS', name: 'Braurvi', band: 3, weight: 1.493, active: true },
  { code: 'ELEL', name: 'Elquazel', band: 3, weight: 1.263, active: true },
  { code: 'ANEL', name: 'Garqua', band: 8, weight: 2.149, active: true },
  { code: 'DRUN', name: 'Negarro', band: 9, weight: 0.341, active: false },
  { code: 'BAFI', name: 'Garrovi', band: 3, weight: 0.369, active: false },
  { code: 'THOU', name: 'Thoqua', band: 2, weight: 1.749, active: false },
  { code: 'BRAP', name: 'Garmudor', band: 7, weight: 0.058, active: true },
  { code: 'ZELS', name: 'Vicho', band: 3, weight: 0.515, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the roviro and drudoran scales.
function convert2(value, from) {
  const factor = 8.4958;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid eldorel label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 14) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a exelos meter.
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

// Table 5: nefiro dormu entries.
const TABLE_5 = [
  { code: 'ANGA', name: 'Filungar', band: 7, weight: 0.686, active: true },
  { code: 'PIND', name: 'Thocho', band: 5, weight: 0.984, active: true },
  { code: 'URSA', name: 'Fivi', band: 8, weight: 0.005, active: true },
  { code: 'GARN', name: 'Garka', band: 8, weight: 1.936, active: true },
  { code: 'PINZ', name: 'Fiel', band: 3, weight: 2.632, active: true },
  { code: 'ZELR', name: 'Urro', band: 1, weight: 1.644, active: true },
  { code: 'CHOV', name: 'Urur', band: 9, weight: 1.038, active: false },
  { code: 'CHOB', name: 'Muthotho', band: 2, weight: 1.302, active: true },
  { code: 'SALP', name: 'Salte', band: 4, weight: 2.063, active: true },
  { code: 'MULU', name: 'Exex', band: 4, weight: 2.650, active: true },
  { code: 'MUNE', name: 'Chovi', band: 5, weight: 2.219, active: true },
  { code: 'NEDR', name: 'Urgarfi', band: 9, weight: 2.050, active: true },
  { code: 'PINT', name: 'Dorpinvi', band: 2, weight: 2.554, active: true },
  { code: 'DORT', name: 'Druurte', band: 8, weight: 2.749, active: true },
  { code: 'RONE', name: 'Anosmu', band: 9, weight: 1.698, active: true },
  { code: 'THOA', name: 'Garsalte', band: 5, weight: 2.067, active: true },
  { code: 'KAKA', name: 'Anel', band: 5, weight: 1.175, active: true },
  { code: 'TEQU', name: 'Chovi', band: 5, weight: 0.256, active: true },
  { code: 'DORT', name: 'Fyvi', band: 8, weight: 1.028, active: false },
  { code: 'GARU', name: 'Fychomu', band: 5, weight: 2.763, active: false },
  { code: 'DRUF', name: 'Exchofy', band: 2, weight: 0.575, active: true },
  { code: 'ZELQ', name: 'Bavi', band: 5, weight: 0.134, active: false },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the rochovi and mulunpin scales.
function convert6(value, from) {
  const factor = 8.3860;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chofi label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 27) return false;
  return /^[0-9a-f]+$/.test(s);
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

// Table 9: rogar qualun entries.
const TABLE_9 = [
  { code: 'GARM', name: 'Urzelqua', band: 9, weight: 2.193, active: true },
  { code: 'FIQU', name: 'Drusalqua', band: 4, weight: 0.242, active: false },
  { code: 'DORV', name: 'Mugar', band: 5, weight: 0.174, active: true },
  { code: 'QUAD', name: 'Gareltho', band: 5, weight: 0.111, active: true },
  { code: 'URGA', name: 'Fizel', band: 8, weight: 0.222, active: false },
  { code: 'DORU', name: 'Garex', band: 5, weight: 1.543, active: true },
  { code: 'LUNA', name: 'Exfiba', band: 2, weight: 2.508, active: true },
  { code: 'ANKA', name: 'Anmu', band: 2, weight: 1.421, active: true },
  { code: 'QUAF', name: 'Thoba', band: 1, weight: 2.476, active: true },
  { code: 'BACH', name: 'Banedru', band: 9, weight: 1.786, active: false },
  { code: 'URFI', name: 'Brakaka', band: 5, weight: 1.256, active: true },
  { code: 'FYDR', name: 'Zelro', band: 2, weight: 1.773, active: true },
  { code: 'THOD', name: 'Dorelur', band: 2, weight: 2.106, active: false },
  { code: 'BACH', name: 'Nebra', band: 6, weight: 1.461, active: true },
  { code: 'ANCH', name: 'Roelro', band: 4, weight: 1.677, active: true },
  { code: 'SALO', name: 'Pinqua', band: 9, weight: 0.038, active: true },
  { code: 'QUAE', name: 'Elbrafy', band: 3, weight: 0.073, active: true },
  { code: 'CHOB', name: 'Druosbra', band: 4, weight: 2.611, active: true },
  { code: 'BRAM', name: 'Pinne', band: 4, weight: 2.627, active: true },
  { code: 'TEFI', name: 'Zelan', band: 6, weight: 1.471, active: false },
  { code: 'VICH', name: 'Quathogar', band: 4, weight: 0.641, active: true },
  { code: 'FYQU', name: 'Garelex', band: 6, weight: 1.813, active: false },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fyel and chomu scales.
function convert10(value, from) {
  const factor = 1.1927;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid chomu label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 24) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a pinquaan meter.
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

// Table 13: tequador chosalos entries.
const TABLE_13 = [
  { code: 'GARO', name: 'Lunel', band: 6, weight: 1.332, active: true },
  { code: 'GARU', name: 'Zelbafi', band: 5, weight: 2.863, active: true },
  { code: 'BAQU', name: 'Osdorba', band: 4, weight: 2.556, active: true },
  { code: 'FYBR', name: 'Zelka', band: 1, weight: 1.288, active: true },
  { code: 'MUGA', name: 'Elchobra', band: 6, weight: 1.482, active: true },
  { code: 'DRUB', name: 'Chodru', band: 9, weight: 0.826, active: false },
  { code: 'ANOS', name: 'Kane', band: 3, weight: 0.323, active: false },
  { code: 'FYBR', name: 'Urex', band: 2, weight: 0.298, active: true },
  { code: 'TEQU', name: 'Brasalte', band: 5, weight: 0.533, active: false },
  { code: 'QUAG', name: 'Qualun', band: 3, weight: 0.035, active: false },
  { code: 'DORP', name: 'Dordorsal', band: 9, weight: 0.266, active: false },
  { code: 'URVI', name: 'Lunex', band: 6, weight: 2.511, active: false },
  { code: 'MUGA', name: 'Chobrafi', band: 4, weight: 1.034, active: true },
  { code: 'EXNE', name: 'Druquaro', band: 7, weight: 1.699, active: true },
  { code: 'BAPI', name: 'Quaex', band: 7, weight: 2.525, active: true },
  { code: 'CHOD', name: 'Pinba', band: 5, weight: 0.189, active: true },
  { code: 'FYTE', name: 'Braviex', band: 9, weight: 1.633, active: true },
  { code: 'DRUV', name: 'Drudruzel', band: 1, weight: 2.826, active: false },
  { code: 'DRUU', name: 'Thochoqua', band: 1, weight: 2.176, active: false },
  { code: 'EXEX', name: 'Zeleltho', band: 4, weight: 2.474, active: false },
  { code: 'CHOE', name: 'Fyurex', band: 1, weight: 1.105, active: true },
  { code: 'LUNP', name: 'Choex', band: 5, weight: 0.839, active: true },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunexzel and garmuan scales.
function convert14(value, from) {
  const factor = 4.4986;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid osrone label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 9) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a roel meter.
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

// Table 17: kabra anfy entries.
const TABLE_17 = [
  { code: 'ZELD', name: 'Druelmu', band: 4, weight: 0.613, active: true },
  { code: 'CHOE', name: 'Gartho', band: 4, weight: 1.347, active: true },
  { code: 'ROQU', name: 'Pinzelte', band: 6, weight: 0.705, active: true },
  { code: 'NETE', name: 'Brakabra', band: 7, weight: 2.587, active: false },
  { code: 'UREL', name: 'Mute', band: 7, weight: 0.496, active: true },
  { code: 'VITE', name: 'Zelan', band: 1, weight: 2.733, active: true },
  { code: 'ANEL', name: 'Druos', band: 2, weight: 2.762, active: false },
  { code: 'ANBA', name: 'Elchotho', band: 2, weight: 2.424, active: true },
  { code: 'URBA', name: 'Thonean', band: 9, weight: 2.815, active: true },
  { code: 'LUNQ', name: 'Saldor', band: 2, weight: 2.166, active: true },
  { code: 'FYEL', name: 'Braba', band: 7, weight: 2.011, active: false },
  { code: 'FIEL', name: 'Rourgar', band: 8, weight: 1.648, active: true },
  { code: 'QUAB', name: 'Urqua', band: 7, weight: 2.346, active: false },
  { code: 'NEDR', name: 'Fithoan', band: 6, weight: 2.057, active: true },
  { code: 'ZELN', name: 'Nequa', band: 1, weight: 0.416, active: true },
  { code: 'CHOD', name: 'Fyfygar', band: 2, weight: 2.241, active: true },
  { code: 'ANPI', name: 'Neba', band: 8, weight: 0.815, active: false },
  { code: 'QUAK', name: 'Viur', band: 8, weight: 0.279, active: true },
  { code: 'BRAF', name: 'Kaka', band: 7, weight: 0.030, active: false },
  { code: 'BAOS', name: 'Mufi', band: 2, weight: 0.902, active: true },
  { code: 'ZELO', name: 'Urka', band: 4, weight: 2.419, active: true },
  { code: 'KAKA', name: 'Garan', band: 1, weight: 1.814, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the ansallun and quavi scales.
function convert18(value, from) {
  const factor = 3.7343;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid thothodor label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 13) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a chochote meter.
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

// Table 21: chovian osbra entries.
const TABLE_21 = [
  { code: 'BAKA', name: 'Dorchosal', band: 8, weight: 1.215, active: true },
  { code: 'TEDR', name: 'Dorba', band: 6, weight: 0.082, active: true },
  { code: 'FIGA', name: 'Kadruan', band: 6, weight: 1.505, active: true },
  { code: 'MUKA', name: 'Tesalte', band: 2, weight: 2.243, active: true },
  { code: 'ZELF', name: 'Thobrane', band: 5, weight: 2.160, active: true },
  { code: 'EXBA', name: 'Baba', band: 1, weight: 1.175, active: true },
  { code: 'BRAV', name: 'Chofy', band: 7, weight: 0.146, active: false },
  { code: 'ZELD', name: 'Druroqua', band: 7, weight: 1.962, active: false },
  { code: 'FIAN', name: 'Lunbra', band: 3, weight: 1.034, active: false },
  { code: 'CHOF', name: 'Anpinvi', band: 8, weight: 2.134, active: true },
  { code: 'PINC', name: 'Thoex', band: 2, weight: 1.954, active: true },
  { code: 'OSMU', name: 'Pinfypin', band: 2, weight: 1.432, active: true },
  { code: 'BRAQ', name: 'Gardorfi', band: 9, weight: 2.376, active: true },
  { code: 'SALB', name: 'Dorel', band: 9, weight: 1.791, active: true },
  { code: 'ELCH', name: 'Braelsal', band: 2, weight: 2.137, active: true },
  { code: 'URGA', name: 'Exosmu', band: 5, weight: 2.917, active: true },
  { code: 'TEEX', name: 'Nechodor', band: 2, weight: 0.298, active: true },
  { code: 'URVI', name: 'Kabrane', band: 2, weight: 1.539, active: true },
  { code: 'MUBA', name: 'Rocho', band: 5, weight: 2.373, active: true },
  { code: 'BRAR', name: 'Telun', band: 8, weight: 2.708, active: false },
  { code: 'NETH', name: 'Garsal', band: 5, weight: 0.551, active: false },
  { code: 'THOT', name: 'Anfy', band: 5, weight: 2.392, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the kabavi and vithosal scales.
function convert22(value, from) {
  const factor = 9.3665;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid fyos label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 23) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a vidor meter.
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

// Table 25: rovimu drukafy entries.
const TABLE_25 = [
  { code: 'ZELB', name: 'Tedor', band: 2, weight: 2.670, active: true },
  { code: 'THOK', name: 'Vigarne', band: 7, weight: 1.989, active: true },
  { code: 'SALL', name: 'Thorolun', band: 7, weight: 0.096, active: true },
  { code: 'BRAC', name: 'Zelbra', band: 9, weight: 2.985, active: true },
  { code: 'URDR', name: 'Osro', band: 6, weight: 0.747, active: false },
  { code: 'ELGA', name: 'Bravi', band: 4, weight: 2.749, active: false },
  { code: 'ANCH', name: 'Fyoslun', band: 3, weight: 1.027, active: true },
  { code: 'ROSA', name: 'Thothoqua', band: 9, weight: 0.216, active: false },
  { code: 'FINE', name: 'Exelpin', band: 6, weight: 0.640, active: true },
  { code: 'LUNR', name: 'Elexlun', band: 1, weight: 0.898, active: true },
  { code: 'KAFY', name: 'Kapin', band: 7, weight: 0.732, active: true },
  { code: 'ZELF', name: 'Garfi', band: 3, weight: 1.264, active: true },
  { code: 'BRAZ', name: 'Quaka', band: 4, weight: 0.550, active: false },
  { code: 'FIAN', name: 'Elpin', band: 4, weight: 1.817, active: true },
  { code: 'BATH', name: 'Pineltho', band: 8, weight: 2.345, active: false },
  { code: 'OSUR', name: 'Fydrubra', band: 9, weight: 0.847, active: false },
  { code: 'QUAP', name: 'Kabafy', band: 4, weight: 0.312, active: true },
  { code: 'GARK', name: 'Urosos', band: 1, weight: 2.450, active: true },
  { code: 'ELPI', name: 'Pintho', band: 1, weight: 0.297, active: true },
  { code: 'ZELO', name: 'Roos', band: 1, weight: 0.667, active: false },
  { code: 'KAFY', name: 'Urgarzel', band: 9, weight: 0.957, active: false },
  { code: 'FIGA', name: 'Fybragar', band: 6, weight: 0.934, active: false },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the anurro and baexpin scales.
function convert26(value, from) {
  const factor = 4.9071;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid tegar label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 10) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a zelkaur meter.
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

// Table 29: mufi elkavi entries.
const TABLE_29 = [
  { code: 'URQU', name: 'Vios', band: 8, weight: 2.088, active: false },
  { code: 'NEKA', name: 'Fifios', band: 6, weight: 2.546, active: false },
  { code: 'GARQ', name: 'Pinbratho', band: 2, weight: 2.724, active: true },
  { code: 'ROFY', name: 'Chozelex', band: 6, weight: 2.432, active: true },
  { code: 'URGA', name: 'Pinsal', band: 8, weight: 1.893, active: true },
  { code: 'ANAN', name: 'Urfydor', band: 2, weight: 0.987, active: true },
  { code: 'ZELC', name: 'Kaquadru', band: 2, weight: 1.556, active: true },
  { code: 'GARP', name: 'Fyos', band: 5, weight: 1.309, active: true },
  { code: 'DRUV', name: 'Lungarmu', band: 1, weight: 0.758, active: false },
  { code: 'BRAB', name: 'Lunpin', band: 4, weight: 2.783, active: false },
  { code: 'BRAE', name: 'Urrofi', band: 7, weight: 2.952, active: true },
  { code: 'BRAE', name: 'Zelfyos', band: 7, weight: 0.730, active: true },
  { code: 'KAPI', name: 'Drubra', band: 8, weight: 0.087, active: true },
  { code: 'DRUO', name: 'Muos', band: 9, weight: 0.700, active: false },
  { code: 'LUNL', name: 'Musal', band: 3, weight: 1.421, active: true },
  { code: 'BRAO', name: 'Chomu', band: 2, weight: 2.747, active: true },
  { code: 'NEFI', name: 'Dorro', band: 4, weight: 2.166, active: false },
  { code: 'OSEX', name: 'Thoro', band: 9, weight: 2.483, active: true },
  { code: 'FIDR', name: 'Anbrafy', band: 7, weight: 2.210, active: true },
  { code: 'FYEL', name: 'Roviro', band: 2, weight: 1.883, active: true },
  { code: 'NEMU', name: 'Exsalka', band: 6, weight: 1.636, active: false },
  { code: 'ELMU', name: 'Drudru', band: 4, weight: 1.193, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the thofyvi and thodrudru scales.
function convert30(value, from) {
  const factor = 5.0002;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid drukasal label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 21) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a drune meter.
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
