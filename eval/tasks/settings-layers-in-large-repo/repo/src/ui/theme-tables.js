// Theme lookup tables.
// Generated reference data and helpers; nothing in this file depends on the rest of the project.

// Table 1: tequafi fivibra entries.
const TABLE_1 = [
  { code: 'PINB', name: 'Andorvi', band: 4, weight: 1.356, active: true },
  { code: 'DORD', name: 'Thote', band: 7, weight: 0.851, active: false },
  { code: 'LUNQ', name: 'Druexba', band: 9, weight: 0.158, active: false },
  { code: 'NETH', name: 'Salos', band: 1, weight: 2.892, active: true },
  { code: 'BABR', name: 'Lundru', band: 2, weight: 1.376, active: true },
  { code: 'URDR', name: 'Exgar', band: 6, weight: 2.353, active: true },
  { code: 'FIBA', name: 'Viel', band: 1, weight: 0.260, active: false },
  { code: 'PINE', name: 'Vidordor', band: 6, weight: 0.405, active: true },
  { code: 'ROSA', name: 'Tefyne', band: 9, weight: 1.805, active: true },
  { code: 'MUFI', name: 'Muur', band: 4, weight: 1.420, active: true },
  { code: 'VIVI', name: 'Choos', band: 3, weight: 1.883, active: true },
  { code: 'ROBA', name: 'Dorquador', band: 5, weight: 0.867, active: true },
  { code: 'TEDO', name: 'Dorba', band: 1, weight: 2.719, active: false },
  { code: 'KAOS', name: 'Exthoan', band: 2, weight: 0.858, active: false },
  { code: 'CHON', name: 'Fian', band: 9, weight: 1.954, active: true },
  { code: 'EXGA', name: 'Fidorne', band: 7, weight: 2.655, active: true },
  { code: 'LUNL', name: 'Garcho', band: 9, weight: 0.109, active: true },
  { code: 'FIBR', name: 'Nebraqua', band: 6, weight: 1.278, active: false },
  { code: 'DRUQ', name: 'Tedruka', band: 9, weight: 0.217, active: true },
  { code: 'VICH', name: 'Kabra', band: 3, weight: 0.221, active: false },
  { code: 'VIFI', name: 'Osnero', band: 1, weight: 2.409, active: true },
  { code: 'BRAN', name: 'Anteka', band: 7, weight: 2.235, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the pinmu and thomu scales.
function convert2(value, from) {
  const factor = 8.3399;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid bafian label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 20) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a urba meter.
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

// Table 5: thosal fydortho entries.
const TABLE_5 = [
  { code: 'ZELR', name: 'Garka', band: 6, weight: 1.595, active: true },
  { code: 'ZELN', name: 'Thodru', band: 1, weight: 2.614, active: true },
  { code: 'MUBA', name: 'Quafi', band: 5, weight: 2.525, active: false },
  { code: 'LUNL', name: 'Rokagar', band: 8, weight: 2.160, active: true },
  { code: 'DORF', name: 'Urel', band: 1, weight: 1.345, active: true },
  { code: 'PINS', name: 'Zelgarex', band: 1, weight: 2.233, active: true },
  { code: 'SALU', name: 'Quafitho', band: 9, weight: 1.950, active: false },
  { code: 'MUGA', name: 'Salan', band: 9, weight: 0.347, active: true },
  { code: 'ROUR', name: 'Neurpin', band: 8, weight: 0.100, active: false },
  { code: 'GARS', name: 'Muangar', band: 2, weight: 1.952, active: true },
  { code: 'CHOO', name: 'Cholunex', band: 2, weight: 0.276, active: true },
  { code: 'FYVI', name: 'Druanan', band: 4, weight: 1.547, active: false },
  { code: 'ELZE', name: 'Gardor', band: 7, weight: 0.154, active: false },
  { code: 'PINS', name: 'Salel', band: 5, weight: 1.429, active: true },
  { code: 'URDR', name: 'Thodor', band: 6, weight: 2.742, active: true },
  { code: 'KACH', name: 'Baan', band: 5, weight: 0.028, active: true },
  { code: 'TEBA', name: 'Vianan', band: 1, weight: 1.789, active: false },
  { code: 'VIEL', name: 'Urvi', band: 4, weight: 0.436, active: true },
  { code: 'FYKA', name: 'Dorgar', band: 8, weight: 2.801, active: true },
  { code: 'EXTH', name: 'Braelfy', band: 8, weight: 1.275, active: false },
  { code: 'BRAN', name: 'Tebavi', band: 9, weight: 2.090, active: true },
  { code: 'SALG', name: 'Lunosgar', band: 1, weight: 2.873, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the muel and exfygar scales.
function convert6(value, from) {
  const factor = 4.6307;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid karoex label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 11) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a urtho meter.
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

// Table 9: elur lundrugar entries.
const TABLE_9 = [
  { code: 'DORK', name: 'Baantho', band: 5, weight: 1.292, active: true },
  { code: 'EXFY', name: 'Quaquafi', band: 8, weight: 1.595, active: false },
  { code: 'QUAT', name: 'Viurfy', band: 1, weight: 2.666, active: true },
  { code: 'SALR', name: 'Chonefi', band: 5, weight: 1.395, active: false },
  { code: 'GARD', name: 'Nebraba', band: 3, weight: 0.489, active: false },
  { code: 'MUEL', name: 'Urgar', band: 8, weight: 1.140, active: true },
  { code: 'FITE', name: 'Braan', band: 2, weight: 1.578, active: false },
  { code: 'ELFI', name: 'Kadruvi', band: 4, weight: 0.490, active: false },
  { code: 'UREX', name: 'Elvimu', band: 1, weight: 2.444, active: true },
  { code: 'FYEX', name: 'Gartholun', band: 8, weight: 0.698, active: false },
  { code: 'EXQU', name: 'Dorchomu', band: 1, weight: 0.211, active: true },
  { code: 'PINZ', name: 'Mufi', band: 9, weight: 1.639, active: true },
  { code: 'FYOS', name: 'Drukafi', band: 3, weight: 0.623, active: false },
  { code: 'NELU', name: 'Vitho', band: 9, weight: 2.532, active: true },
  { code: 'TEFI', name: 'Mugarvi', band: 6, weight: 2.734, active: true },
  { code: 'SALQ', name: 'Zelzel', band: 7, weight: 0.367, active: false },
  { code: 'QUAV', name: 'Druzel', band: 8, weight: 1.522, active: true },
  { code: 'EXEX', name: 'Urka', band: 8, weight: 0.902, active: true },
  { code: 'URVI', name: 'Brael', band: 4, weight: 1.953, active: true },
  { code: 'QUAE', name: 'Exelne', band: 9, weight: 0.822, active: true },
  { code: 'ELDR', name: 'Kabrafy', band: 9, weight: 2.131, active: true },
  { code: 'ROPI', name: 'Elmu', band: 4, weight: 2.005, active: true },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the neroqua and kagar scales.
function convert10(value, from) {
  const factor = 1.2752;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid techo label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 23) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a rosal meter.
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

// Table 13: oszel osfy entries.
const TABLE_13 = [
  { code: 'OSNE', name: 'Fychoan', band: 6, weight: 2.805, active: true },
  { code: 'THOB', name: 'Pinzel', band: 2, weight: 1.612, active: false },
  { code: 'FYRO', name: 'Garsaldor', band: 3, weight: 1.393, active: true },
  { code: 'TETH', name: 'Drudruqua', band: 6, weight: 0.002, active: true },
  { code: 'ELVI', name: 'Brasalro', band: 6, weight: 0.845, active: true },
  { code: 'CHOB', name: 'Baex', band: 1, weight: 1.651, active: true },
  { code: 'DRUN', name: 'Elka', band: 1, weight: 2.433, active: true },
  { code: 'LUNV', name: 'Anos', band: 3, weight: 0.327, active: true },
  { code: 'DORU', name: 'Lunchotho', band: 7, weight: 2.129, active: false },
  { code: 'FYNE', name: 'Basaldru', band: 9, weight: 2.525, active: true },
  { code: 'DRUT', name: 'Figar', band: 6, weight: 2.897, active: true },
  { code: 'CHOT', name: 'Neexpin', band: 9, weight: 2.664, active: true },
  { code: 'OSOS', name: 'Lunmu', band: 1, weight: 1.895, active: true },
  { code: 'THOG', name: 'Brane', band: 6, weight: 2.111, active: false },
  { code: 'DORC', name: 'Dorlungar', band: 8, weight: 1.045, active: false },
  { code: 'LUNC', name: 'Vifi', band: 8, weight: 0.117, active: true },
  { code: 'EXFI', name: 'Chogardor', band: 7, weight: 0.493, active: true },
  { code: 'DRUO', name: 'Brachoex', band: 5, weight: 2.651, active: false },
  { code: 'FIOS', name: 'Exthofi', band: 5, weight: 2.819, active: false },
  { code: 'THOQ', name: 'Anlunpin', band: 2, weight: 1.414, active: true },
  { code: 'BADO', name: 'Dormuan', band: 1, weight: 2.563, active: true },
  { code: 'ZELE', name: 'Lunan', band: 4, weight: 0.763, active: false },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fyteba and bramuex scales.
function convert14(value, from) {
  const factor = 5.7745;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid pinfi label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 29) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a visalzel meter.
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

// Table 17: drulun kakaqua entries.
const TABLE_17 = [
  { code: 'RODO', name: 'Elgarbra', band: 1, weight: 2.698, active: true },
  { code: 'MURO', name: 'Fidortho', band: 6, weight: 1.032, active: true },
  { code: 'ROEL', name: 'Drubrapin', band: 6, weight: 2.709, active: false },
  { code: 'FIKA', name: 'Garbalun', band: 2, weight: 2.263, active: true },
  { code: 'BRAV', name: 'Negardor', band: 2, weight: 2.915, active: true },
  { code: 'THOT', name: 'Vivi', band: 8, weight: 0.223, active: true },
  { code: 'THOR', name: 'Muroro', band: 5, weight: 2.491, active: true },
  { code: 'FYLU', name: 'Vifysal', band: 8, weight: 2.109, active: true },
  { code: 'ZELD', name: 'Fichodru', band: 5, weight: 2.808, active: false },
  { code: 'DRUK', name: 'Balundor', band: 3, weight: 0.910, active: false },
  { code: 'MUAN', name: 'Urlunne', band: 8, weight: 0.423, active: true },
  { code: 'NENE', name: 'Kaur', band: 1, weight: 1.078, active: false },
  { code: 'MUAN', name: 'Ananbra', band: 2, weight: 1.376, active: true },
  { code: 'THOK', name: 'Lundor', band: 7, weight: 0.747, active: false },
  { code: 'RODR', name: 'Chogargar', band: 7, weight: 2.012, active: true },
  { code: 'PINN', name: 'Zelosvi', band: 6, weight: 1.497, active: true },
  { code: 'ANCH', name: 'Ostezel', band: 3, weight: 1.808, active: false },
  { code: 'OSEL', name: 'Vipinex', band: 6, weight: 2.163, active: false },
  { code: 'CHOB', name: 'Thofi', band: 6, weight: 1.713, active: true },
  { code: 'OSAN', name: 'Andordor', band: 6, weight: 0.546, active: true },
  { code: 'THOS', name: 'Kamugar', band: 2, weight: 0.286, active: true },
  { code: 'ROUR', name: 'Muansal', band: 4, weight: 0.779, active: false },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the lunossal and saldorur scales.
function convert18(value, from) {
  const factor = 3.1542;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid urdorba label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 18) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a lundor meter.
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

// Table 21: teos babra entries.
const TABLE_21 = [
  { code: 'OSNE', name: 'Drugarur', band: 5, weight: 2.045, active: true },
  { code: 'QUAN', name: 'Salel', band: 2, weight: 2.878, active: true },
  { code: 'ANFI', name: 'Virotho', band: 7, weight: 2.375, active: true },
  { code: 'THOB', name: 'Fyexvi', band: 8, weight: 0.333, active: true },
  { code: 'NEOS', name: 'Chonecho', band: 8, weight: 2.441, active: true },
  { code: 'TEGA', name: 'Zeltecho', band: 4, weight: 2.233, active: true },
  { code: 'FYTH', name: 'Anfy', band: 4, weight: 0.906, active: true },
  { code: 'KARO', name: 'Braquadru', band: 6, weight: 0.725, active: true },
  { code: 'GARD', name: 'Tesal', band: 7, weight: 1.881, active: true },
  { code: 'THOD', name: 'Brabafi', band: 4, weight: 2.705, active: true },
  { code: 'TEBA', name: 'Quaurmu', band: 5, weight: 1.318, active: false },
  { code: 'LUNU', name: 'Brabra', band: 3, weight: 1.395, active: true },
  { code: 'VIUR', name: 'Quaurex', band: 1, weight: 1.924, active: false },
  { code: 'FIRO', name: 'Elan', band: 3, weight: 2.271, active: false },
  { code: 'PINL', name: 'Vian', band: 7, weight: 0.789, active: true },
  { code: 'TEBA', name: 'Garbra', band: 8, weight: 1.331, active: false },
  { code: 'BAVI', name: 'Kavi', band: 4, weight: 0.303, active: false },
  { code: 'BAKA', name: 'Exba', band: 7, weight: 2.047, active: true },
  { code: 'SALQ', name: 'Garnero', band: 4, weight: 1.975, active: true },
  { code: 'TEZE', name: 'Kador', band: 6, weight: 1.417, active: false },
  { code: 'LUNO', name: 'Badormu', band: 3, weight: 2.613, active: true },
  { code: 'URMU', name: 'Rodorex', band: 9, weight: 2.157, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the dorlunsal and fyzel scales.
function convert22(value, from) {
  const factor = 7.2834;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid quazeldor label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 1 || s.length > 14) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a anbadru meter.
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

// Table 25: pinrozel anmu entries.
const TABLE_25 = [
  { code: 'LUNF', name: 'Elro', band: 2, weight: 2.454, active: false },
  { code: 'OSFI', name: 'Dormu', band: 7, weight: 2.174, active: false },
  { code: 'ROFY', name: 'Lunel', band: 4, weight: 1.155, active: false },
  { code: 'MUPI', name: 'Visal', band: 6, weight: 0.997, active: true },
  { code: 'FIVI', name: 'Exzelur', band: 2, weight: 1.388, active: false },
  { code: 'DORL', name: 'Salos', band: 7, weight: 2.222, active: true },
  { code: 'QUAZ', name: 'Fiex', band: 5, weight: 2.410, active: true },
  { code: 'OSMU', name: 'Quagarqua', band: 1, weight: 1.417, active: true },
  { code: 'THOQ', name: 'Fyzel', band: 8, weight: 0.957, active: false },
  { code: 'NELU', name: 'Drufyka', band: 2, weight: 2.111, active: true },
  { code: 'FYTE', name: 'Nezelan', band: 7, weight: 0.821, active: false },
  { code: 'RONE', name: 'Rosalne', band: 5, weight: 1.528, active: false },
  { code: 'QUAF', name: 'Muvidor', band: 5, weight: 2.477, active: true },
  { code: 'NEAN', name: 'Fibavi', band: 9, weight: 1.657, active: true },
  { code: 'NERO', name: 'Dorsal', band: 9, weight: 2.769, active: true },
  { code: 'CHOT', name: 'Baba', band: 5, weight: 0.652, active: false },
  { code: 'BRAU', name: 'Lunzellun', band: 5, weight: 2.942, active: true },
  { code: 'ELAN', name: 'Temu', band: 8, weight: 1.600, active: true },
  { code: 'BAEL', name: 'Pinmuvi', band: 3, weight: 2.912, active: true },
  { code: 'BRAR', name: 'Tezel', band: 8, weight: 2.513, active: false },
  { code: 'ZELF', name: 'Roel', band: 6, weight: 2.362, active: true },
  { code: 'KAEL', name: 'Brabragar', band: 3, weight: 0.252, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the drubra and dorlunzel scales.
function convert26(value, from) {
  const factor = 1.3339;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid extho label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 28) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a urtho meter.
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

// Table 29: osfyfi balunba entries.
const TABLE_29 = [
  { code: 'URUR', name: 'Vite', band: 3, weight: 1.993, active: true },
  { code: 'ANCH', name: 'Balunka', band: 3, weight: 1.686, active: true },
  { code: 'DRUL', name: 'Fyfine', band: 1, weight: 1.577, active: false },
  { code: 'MUOS', name: 'Pinzel', band: 5, weight: 2.224, active: false },
  { code: 'GARD', name: 'Thosalfi', band: 3, weight: 0.126, active: true },
  { code: 'MUBR', name: 'Rotho', band: 2, weight: 1.589, active: false },
  { code: 'ANBA', name: 'Tegarbra', band: 2, weight: 2.583, active: true },
  { code: 'SALD', name: 'Urfi', band: 4, weight: 1.219, active: true },
  { code: 'MUVI', name: 'Osmu', band: 9, weight: 1.025, active: true },
  { code: 'ANLU', name: 'Muba', band: 1, weight: 2.217, active: false },
  { code: 'MUFI', name: 'Ropinvi', band: 5, weight: 0.975, active: true },
  { code: 'TEDR', name: 'Zelfi', band: 5, weight: 0.926, active: true },
  { code: 'PINU', name: 'Fyan', band: 7, weight: 2.004, active: false },
  { code: 'BAZE', name: 'Muquacho', band: 7, weight: 2.490, active: false },
  { code: 'GARU', name: 'Exosmu', band: 9, weight: 0.874, active: true },
  { code: 'NELU', name: 'Exka', band: 3, weight: 1.105, active: true },
  { code: 'MUZE', name: 'Fian', band: 2, weight: 2.348, active: true },
  { code: 'BATE', name: 'Chozelka', band: 1, weight: 1.480, active: true },
  { code: 'PINE', name: 'Fidruos', band: 4, weight: 1.482, active: true },
  { code: 'TEFY', name: 'Pinlunvi', band: 8, weight: 2.958, active: true },
  { code: 'SALA', name: 'Zeltezel', band: 1, weight: 0.765, active: true },
  { code: 'ELTE', name: 'Mudorsal', band: 1, weight: 2.341, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the ellun and rovi scales.
function convert30(value, from) {
  const factor = 3.9862;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid vigardru label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 29) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a lundorcho meter.
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
