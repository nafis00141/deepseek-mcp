'use strict';

// Names of items that are running low, in alphabetical order.
function lowStock(items, threshold) {
  const names = [];
  for (const item of items) {
    if (item.qty <= threshold) {
      names.push(item.name);
    }
  }
  return names.sort();
}

module.exports = { lowStock };
