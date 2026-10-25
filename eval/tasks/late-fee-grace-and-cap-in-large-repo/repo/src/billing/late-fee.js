// Late fees on overdue invoices. Dates are 'YYYY-MM-DD' strings, compared as UTC calendar days.
const RATE_PER_DAY = 0.01;

function parseDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new Error('bad date: ' + text);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysLate(dueDate, today) {
  return Math.max(0, Math.floor((parseDay(today) - parseDay(dueDate)) / 86400000));
}

function lateFee(invoice, today) {
  const days = daysLate(invoice.dueDate, today);
  return Math.round(invoice.amountCents * RATE_PER_DAY * days);
}

module.exports = { daysLate, lateFee };
