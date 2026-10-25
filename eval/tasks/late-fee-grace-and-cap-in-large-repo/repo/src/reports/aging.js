const { daysLate, lateFee } = require('../billing/charges.js');

// One row of the aging report.
function agingRow(invoice, today) {
  const fee = lateFee(invoice, today);
  return {
    id: invoice.id,
    daysLate: daysLate(invoice.dueDate, today),
    fee,
    label: fee > 0 ? 'Late fee: ' + (fee / 100).toFixed(2) : 'No fee',
  };
}

module.exports = { agingRow };
