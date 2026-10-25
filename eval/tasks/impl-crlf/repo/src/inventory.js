'use strict';

// Names of items that are running low.
function lowStock(items, threshold) {
  const names = [];
  for (const item of items) {
    if (item.qty < threshold) {
      names.push(item.name);
    }
  }
  return names;
}

module.exports = { lowStock };
