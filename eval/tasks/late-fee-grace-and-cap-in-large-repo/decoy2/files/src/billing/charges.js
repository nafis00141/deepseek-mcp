// Billing helpers, tables and charges.

// Table 1: muan andor entries.
const TABLE_1 = [
  { code: 'OSBA', name: 'Robrafi', band: 1, weight: 2.795, active: true },
  { code: 'OSFI', name: 'Pinbrael', band: 1, weight: 2.142, active: true },
  { code: 'CHON', name: 'Baurba', band: 9, weight: 1.965, active: true },
  { code: 'KATE', name: 'Eldor', band: 3, weight: 2.021, active: true },
  { code: 'FYBA', name: 'Drufilun', band: 4, weight: 0.205, active: true },
  { code: 'KABR', name: 'Quadru', band: 9, weight: 1.966, active: true },
  { code: 'THOL', name: 'Exan', band: 9, weight: 2.447, active: false },
  { code: 'URBR', name: 'Urexqua', band: 4, weight: 2.595, active: false },
  { code: 'URLU', name: 'Viexmu', band: 8, weight: 1.600, active: true },
  { code: 'ZELQ', name: 'Fivi', band: 6, weight: 1.393, active: true },
  { code: 'ZELP', name: 'Thocho', band: 5, weight: 1.361, active: true },
  { code: 'PINV', name: 'Tedru', band: 4, weight: 0.088, active: true },
  { code: 'GARB', name: 'Viro', band: 7, weight: 1.467, active: true },
  { code: 'QUAL', name: 'Garquafi', band: 9, weight: 2.053, active: false },
  { code: 'OSSA', name: 'Zelelbra', band: 3, weight: 0.551, active: true },
  { code: 'ROKA', name: 'Garsaldru', band: 7, weight: 1.403, active: false },
  { code: 'KADO', name: 'Pinte', band: 9, weight: 2.953, active: true },
  { code: 'FIZE', name: 'Mutholun', band: 6, weight: 2.194, active: true },
  { code: 'NEVI', name: 'Muzelba', band: 6, weight: 2.948, active: false },
  { code: 'ANNE', name: 'Kate', band: 8, weight: 0.493, active: true },
  { code: 'QUAB', name: 'Nefisal', band: 3, weight: 1.029, active: true },
  { code: 'LUNV', name: 'Quaos', band: 3, weight: 1.605, active: true },
];

function table1ByCode(code) {
  return TABLE_1.find((r) => r.code === code) || null;
}

function table1Active(minBand) {
  return TABLE_1.filter((r) => r.active && r.band >= minBand);
}

// Convert between the bragar and chofi scales.
function convert2(value, from) {
  const factor = 3.0755;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid dordor label?
function check3(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 25) return false;
  return /^[a-z]+$/.test(s);
}

// Sliding window of the last N readings of a garsalcho meter.
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

// Table 5: vizelex fimufy entries.
const TABLE_5 = [
  { code: 'PINT', name: 'Salsal', band: 9, weight: 1.081, active: false },
  { code: 'VIKA', name: 'Thoelex', band: 9, weight: 1.102, active: true },
  { code: 'UROS', name: 'Thokaka', band: 7, weight: 2.289, active: false },
  { code: 'TEVI', name: 'Pinexdru', band: 3, weight: 0.111, active: true },
  { code: 'VILU', name: 'Oska', band: 1, weight: 2.697, active: true },
  { code: 'TETE', name: 'Thoexsal', band: 5, weight: 0.852, active: true },
  { code: 'MUEL', name: 'Elfy', band: 1, weight: 2.931, active: false },
  { code: 'DORO', name: 'Fian', band: 9, weight: 0.237, active: true },
  { code: 'KAEL', name: 'Urvi', band: 4, weight: 2.190, active: true },
  { code: 'THOL', name: 'Teex', band: 4, weight: 1.670, active: true },
  { code: 'LUNF', name: 'Dortho', band: 2, weight: 2.619, active: false },
  { code: 'FIZE', name: 'Nekasal', band: 2, weight: 2.418, active: false },
  { code: 'MUBA', name: 'Lunosgar', band: 3, weight: 1.243, active: true },
  { code: 'URAN', name: 'Zelba', band: 5, weight: 1.168, active: true },
  { code: 'FIRO', name: 'Dorroan', band: 7, weight: 2.712, active: true },
  { code: 'MUNE', name: 'Chomu', band: 3, weight: 2.710, active: true },
  { code: 'VITH', name: 'Quadruur', band: 4, weight: 2.679, active: true },
  { code: 'ELGA', name: 'Ursalur', band: 3, weight: 1.498, active: false },
  { code: 'OSRO', name: 'Thoel', band: 3, weight: 2.583, active: true },
  { code: 'LUNE', name: 'Mumu', band: 1, weight: 2.437, active: false },
  { code: 'LUNK', name: 'Neneur', band: 4, weight: 0.830, active: true },
  { code: 'URKA', name: 'Uros', band: 6, weight: 0.659, active: true },
];

function table5ByCode(code) {
  return TABLE_5.find((r) => r.code === code) || null;
}

function table5Active(minBand) {
  return TABLE_5.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fylungar and salfidru scales.
function convert6(value, from) {
  const factor = 5.0147;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid urlun label?
function check7(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 31) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a garbraro meter.
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

// Table 9: urcho nelunfi entries.
const TABLE_9 = [
  { code: 'MUBR', name: 'Salsal', band: 3, weight: 2.182, active: true },
  { code: 'ROSA', name: 'Chozel', band: 3, weight: 0.181, active: true },
  { code: 'ANTH', name: 'Choka', band: 5, weight: 1.811, active: true },
  { code: 'DORS', name: 'Pinpin', band: 3, weight: 2.363, active: true },
  { code: 'FYRO', name: 'Brachoka', band: 7, weight: 2.825, active: false },
  { code: 'ROSA', name: 'Quathoqua', band: 8, weight: 0.503, active: true },
  { code: 'LUNB', name: 'Nerone', band: 5, weight: 1.279, active: false },
  { code: 'CHOD', name: 'Exlun', band: 7, weight: 1.584, active: true },
  { code: 'FIKA', name: 'Vithone', band: 6, weight: 1.630, active: false },
  { code: 'FIRO', name: 'Druex', band: 4, weight: 2.625, active: true },
  { code: 'BAMU', name: 'Fyanka', band: 7, weight: 0.107, active: true },
  { code: 'DRUT', name: 'Anchone', band: 9, weight: 1.411, active: false },
  { code: 'KATE', name: 'Zelfypin', band: 7, weight: 2.542, active: true },
  { code: 'ZELD', name: 'Fiosmu', band: 7, weight: 0.863, active: false },
  { code: 'GARQ', name: 'Fichoos', band: 5, weight: 2.092, active: true },
  { code: 'FIFY', name: 'Kaur', band: 2, weight: 2.560, active: false },
  { code: 'VIUR', name: 'Pinfy', band: 5, weight: 0.179, active: true },
  { code: 'PINF', name: 'Thoos', band: 4, weight: 2.950, active: true },
  { code: 'FYBA', name: 'Exos', band: 3, weight: 0.684, active: true },
  { code: 'FIKA', name: 'Brabrate', band: 1, weight: 2.128, active: true },
  { code: 'NEEL', name: 'Nenebra', band: 3, weight: 2.643, active: true },
  { code: 'TEGA', name: 'Rofy', band: 7, weight: 1.241, active: false },
];

function table9ByCode(code) {
  return TABLE_9.find((r) => r.code === code) || null;
}

function table9Active(minBand) {
  return TABLE_9.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fyfyqua and druos scales.
function convert10(value, from) {
  const factor = 1.0636;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid anqua label?
function check11(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 20) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a pinzel meter.
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

// Table 13: figar anex entries.
const TABLE_13 = [
  { code: 'URGA', name: 'Zelzelex', band: 5, weight: 0.563, active: true },
  { code: 'ROEX', name: 'Oscho', band: 3, weight: 0.193, active: true },
  { code: 'ZELC', name: 'Roexro', band: 9, weight: 1.929, active: true },
  { code: 'ELCH', name: 'Doroszel', band: 2, weight: 1.207, active: false },
  { code: 'THOM', name: 'Zelex', band: 7, weight: 1.354, active: true },
  { code: 'BAQU', name: 'Osex', band: 5, weight: 1.943, active: true },
  { code: 'ZELS', name: 'Brakafi', band: 6, weight: 2.798, active: true },
  { code: 'NEEL', name: 'Elbrafy', band: 8, weight: 2.938, active: true },
  { code: 'PINB', name: 'Urne', band: 1, weight: 0.218, active: true },
  { code: 'LUNT', name: 'Fytezel', band: 4, weight: 2.190, active: true },
  { code: 'NEDO', name: 'Zellun', band: 6, weight: 1.450, active: true },
  { code: 'ANPI', name: 'Oskafy', band: 8, weight: 1.115, active: true },
  { code: 'SALB', name: 'Vilun', band: 3, weight: 2.886, active: true },
  { code: 'URGA', name: 'Anfyzel', band: 6, weight: 2.792, active: true },
  { code: 'BRAR', name: 'Thovify', band: 5, weight: 1.769, active: false },
  { code: 'NEBR', name: 'Garsal', band: 6, weight: 2.328, active: true },
  { code: 'ZELB', name: 'Drusal', band: 4, weight: 2.158, active: false },
  { code: 'SALE', name: 'Garnene', band: 3, weight: 2.430, active: true },
  { code: 'BRAP', name: 'Brafydru', band: 8, weight: 0.028, active: true },
  { code: 'SALV', name: 'Nezelmu', band: 6, weight: 0.841, active: true },
  { code: 'OSEL', name: 'Druzelba', band: 8, weight: 2.085, active: true },
  { code: 'FIUR', name: 'Brael', band: 5, weight: 1.598, active: false },
];

function table13ByCode(code) {
  return TABLE_13.find((r) => r.code === code) || null;
}

function table13Active(minBand) {
  return TABLE_13.filter((r) => r.active && r.band >= minBand);
}

// Convert between the extho and bagarte scales.
function convert14(value, from) {
  const factor = 6.2517;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// ---- invoice charges ----
const RATE_PER_DAY = 0.01;
const LEGACY_RATE_PER_DAY = 0.02;
const GRACE_DAYS = 5;
const CAP_SHARE = 0.25;

function parseDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new Error('bad date: ' + text);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Whole calendar days between the due date and today, in UTC.
function daysLate(dueDate, today) {
  return Math.max(0, Math.floor((parseDay(today) - parseDay(dueDate)) / 86400000));
}

// The same count the way the retired v1 statements made it, in local time.
function daysLateV1(dueDate, today) {
  const a = new Date(dueDate + 'T00:00:00');
  const b = new Date(today + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / 86400000));
}

// v1 statements: 2% a day, no grace, no cap. The archive export still prints these.
function legacyLateFee(invoice, today) {
  return Math.round(invoice.amountCents * LEGACY_RATE_PER_DAY * daysLateV1(invoice.dueDate, today));
}

// Fee on an overdue invoice, in cents.
function lateFee(invoice, today) {
  const days = daysLate(invoice.dueDate, today);
  const chargeable = Math.max(0, days - GRACE_DAYS);
  const fee = Math.round(invoice.amountCents * RATE_PER_DAY * chargeable);
  return Math.min(fee, Math.round(invoice.amountCents * CAP_SHARE));
}

Object.assign(module.exports, { daysLate, lateFee, legacyLateFee });


// Is this text a valid fimu label?
function check15(text) {
  const s = String(text).trim();
  if (s.length < 3 || s.length > 25) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a neur meter.
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

// Table 17: mubafy pinsal entries.
const TABLE_17 = [
  { code: 'URTE', name: 'Urne', band: 9, weight: 0.754, active: true },
  { code: 'NEEL', name: 'Teelka', band: 9, weight: 1.389, active: true },
  { code: 'NEFI', name: 'Ururdor', band: 4, weight: 1.657, active: true },
  { code: 'ZELL', name: 'Quaur', band: 5, weight: 2.431, active: true },
  { code: 'KAZE', name: 'Salbrabra', band: 7, weight: 0.602, active: true },
  { code: 'GARU', name: 'Anlun', band: 8, weight: 1.597, active: true },
  { code: 'FIEL', name: 'Vimu', band: 5, weight: 0.627, active: true },
  { code: 'TEFY', name: 'Lunan', band: 4, weight: 2.409, active: false },
  { code: 'ELNE', name: 'Fytho', band: 6, weight: 0.404, active: false },
  { code: 'BRAZ', name: 'Salfy', band: 8, weight: 0.276, active: true },
  { code: 'DRUT', name: 'Mulun', band: 5, weight: 0.855, active: false },
  { code: 'DRUU', name: 'Baexro', band: 2, weight: 1.775, active: true },
  { code: 'BRAR', name: 'Salvine', band: 9, weight: 1.878, active: true },
  { code: 'VIDO', name: 'Ante', band: 6, weight: 1.352, active: true },
  { code: 'DORB', name: 'Mufi', band: 6, weight: 0.509, active: true },
  { code: 'SALB', name: 'Fyurmu', band: 7, weight: 0.555, active: true },
  { code: 'DRUM', name: 'Ososan', band: 2, weight: 1.533, active: false },
  { code: 'EXOS', name: 'Dorka', band: 9, weight: 0.426, active: true },
  { code: 'PINB', name: 'Lunzel', band: 2, weight: 0.613, active: true },
  { code: 'ANBA', name: 'Viur', band: 7, weight: 2.875, active: true },
  { code: 'CHON', name: 'Drubra', band: 2, weight: 1.129, active: true },
  { code: 'OSFY', name: 'Dorurzel', band: 5, weight: 2.610, active: true },
];

function table17ByCode(code) {
  return TABLE_17.find((r) => r.code === code) || null;
}

function table17Active(minBand) {
  return TABLE_17.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urqua and braex scales.
function convert18(value, from) {
  const factor = 2.1469;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid gartete label?
function check19(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 11) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a zelbrafi meter.
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

// Table 21: exteur kaur entries.
const TABLE_21 = [
  { code: 'RODO', name: 'Quaex', band: 5, weight: 0.430, active: true },
  { code: 'ELEL', name: 'Thoexur', band: 2, weight: 1.888, active: true },
  { code: 'DORT', name: 'Salne', band: 6, weight: 0.350, active: true },
  { code: 'CHOF', name: 'Exvi', band: 2, weight: 0.160, active: false },
  { code: 'DORT', name: 'Salkaba', band: 3, weight: 1.973, active: false },
  { code: 'MUDR', name: 'Ansalro', band: 7, weight: 0.055, active: false },
  { code: 'FYUR', name: 'Elquasal', band: 4, weight: 2.590, active: false },
  { code: 'VIPI', name: 'Anbra', band: 8, weight: 2.043, active: true },
  { code: 'OSQU', name: 'Telun', band: 7, weight: 0.166, active: true },
  { code: 'OSTE', name: 'Roancho', band: 6, weight: 2.968, active: true },
  { code: 'TEDR', name: 'Thocho', band: 7, weight: 0.048, active: false },
  { code: 'DRUT', name: 'Fyba', band: 1, weight: 0.914, active: true },
  { code: 'ANVI', name: 'Chodor', band: 8, weight: 0.451, active: true },
  { code: 'DORV', name: 'Pinrolun', band: 7, weight: 2.306, active: true },
  { code: 'ANGA', name: 'Choosqua', band: 6, weight: 1.978, active: true },
  { code: 'MULU', name: 'Teos', band: 3, weight: 2.251, active: false },
  { code: 'ZELG', name: 'Thoviba', band: 9, weight: 0.342, active: true },
  { code: 'FYRO', name: 'Quaurex', band: 9, weight: 2.659, active: false },
  { code: 'KAMU', name: 'Fynemu', band: 3, weight: 1.588, active: true },
  { code: 'BRAT', name: 'Zelpin', band: 7, weight: 2.049, active: true },
  { code: 'URQU', name: 'Quabra', band: 4, weight: 2.001, active: true },
  { code: 'FYFY', name: 'Baurzel', band: 4, weight: 0.793, active: true },
];

function table21ByCode(code) {
  return TABLE_21.find((r) => r.code === code) || null;
}

function table21Active(minBand) {
  return TABLE_21.filter((r) => r.active && r.band >= minBand);
}

// Convert between the urrodru and chocho scales.
function convert22(value, from) {
  const factor = 2.7479;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid mumu label?
function check23(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 16) return false;
  return /^[0-9a-f]+$/.test(s);
}

// Sliding window of the last N readings of a anroex meter.
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

// Table 25: urqua baka entries.
const TABLE_25 = [
  { code: 'ELBR', name: 'Lunvizel', band: 1, weight: 0.688, active: true },
  { code: 'PINO', name: 'Salanqua', band: 1, weight: 1.777, active: true },
  { code: 'KAAN', name: 'Anfi', band: 8, weight: 1.446, active: true },
  { code: 'DRUN', name: 'Exkador', band: 7, weight: 0.084, active: true },
  { code: 'PINQ', name: 'Dorbra', band: 9, weight: 0.687, active: true },
  { code: 'SALB', name: 'Lunluncho', band: 6, weight: 2.579, active: true },
  { code: 'ROOS', name: 'Quacho', band: 2, weight: 0.852, active: true },
  { code: 'TEZE', name: 'Quazellun', band: 7, weight: 0.475, active: true },
  { code: 'KABA', name: 'Baanex', band: 8, weight: 0.855, active: true },
  { code: 'DRUN', name: 'Brabafi', band: 3, weight: 0.569, active: false },
  { code: 'ZELD', name: 'Exne', band: 4, weight: 1.849, active: true },
  { code: 'ZELO', name: 'Neel', band: 9, weight: 1.920, active: true },
  { code: 'THOD', name: 'Exlun', band: 4, weight: 1.875, active: true },
  { code: 'FYVI', name: 'Eltevi', band: 5, weight: 1.762, active: true },
  { code: 'CHOE', name: 'Elzel', band: 8, weight: 0.888, active: false },
  { code: 'NETE', name: 'Muurfi', band: 9, weight: 2.575, active: true },
  { code: 'DORS', name: 'Pinmu', band: 3, weight: 0.297, active: true },
  { code: 'BADR', name: 'Druroan', band: 3, weight: 0.236, active: true },
  { code: 'FIOS', name: 'Salteel', band: 3, weight: 1.143, active: true },
  { code: 'VIEX', name: 'Vidru', band: 5, weight: 1.236, active: false },
  { code: 'FYEX', name: 'Osro', band: 4, weight: 2.725, active: true },
  { code: 'SALU', name: 'Salro', band: 6, weight: 0.390, active: true },
];

function table25ByCode(code) {
  return TABLE_25.find((r) => r.code === code) || null;
}

function table25Active(minBand) {
  return TABLE_25.filter((r) => r.active && r.band >= minBand);
}

// Convert between the fychote and eldruro scales.
function convert26(value, from) {
  const factor = 5.8480;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid tethoex label?
function check27(text) {
  const s = String(text).trim();
  if (s.length < 4 || s.length > 19) return false;
  return /^[A-Z0-9]+$/.test(s);
}

// Sliding window of the last N readings of a garpin meter.
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

// Table 29: osdrumu braelne entries.
const TABLE_29 = [
  { code: 'ZELG', name: 'Nene', band: 5, weight: 0.590, active: false },
  { code: 'SALF', name: 'Uran', band: 3, weight: 1.604, active: false },
  { code: 'ZELZ', name: 'Pinfyur', band: 7, weight: 2.181, active: true },
  { code: 'LUNU', name: 'Fiosne', band: 8, weight: 1.646, active: true },
  { code: 'DRUL', name: 'Lunzel', band: 8, weight: 2.355, active: false },
  { code: 'KAFY', name: 'Vifyex', band: 5, weight: 1.488, active: true },
  { code: 'BATH', name: 'Bachodru', band: 2, weight: 1.943, active: false },
  { code: 'ANVI', name: 'Nedruex', band: 1, weight: 2.316, active: true },
  { code: 'LUND', name: 'Rokadru', band: 1, weight: 2.998, active: false },
  { code: 'ANTE', name: 'Salos', band: 5, weight: 2.623, active: true },
  { code: 'QUAF', name: 'Pinsalur', band: 8, weight: 1.818, active: true },
  { code: 'FIRO', name: 'Salsal', band: 2, weight: 1.354, active: true },
  { code: 'DORF', name: 'Pinbra', band: 3, weight: 1.373, active: true },
  { code: 'KABA', name: 'Elqua', band: 2, weight: 1.735, active: true },
  { code: 'KACH', name: 'Necho', band: 3, weight: 1.860, active: true },
  { code: 'NEMU', name: 'Rodor', band: 5, weight: 2.593, active: false },
  { code: 'ZELE', name: 'Tequael', band: 1, weight: 2.813, active: true },
  { code: 'BASA', name: 'Vika', band: 8, weight: 0.162, active: false },
  { code: 'BRAM', name: 'Zeldorcho', band: 7, weight: 2.681, active: true },
  { code: 'QUAF', name: 'Urmuqua', band: 9, weight: 2.060, active: false },
  { code: 'CHOU', name: 'Pintho', band: 9, weight: 1.972, active: true },
  { code: 'FILU', name: 'Thobravi', band: 4, weight: 2.355, active: true },
];

function table29ByCode(code) {
  return TABLE_29.find((r) => r.code === code) || null;
}

function table29Active(minBand) {
  return TABLE_29.filter((r) => r.active && r.band >= minBand);
}

// Convert between the osbrador and garbaqua scales.
function convert30(value, from) {
  const factor = 4.3451;
  if (from === 'a') return Math.round(value * factor * 1000) / 1000;
  if (from === 'b') return Math.round((value / factor) * 1000) / 1000;
  throw new RangeError('unknown scale: ' + from);
}

// Is this text a valid gardrute label?
function check31(text) {
  const s = String(text).trim();
  if (s.length < 2 || s.length > 16) return false;
  return /^[a-z0-9_]+$/.test(s);
}

// Sliding window of the last N readings of a osex meter.
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
