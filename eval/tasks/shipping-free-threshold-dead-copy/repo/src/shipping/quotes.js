const { quote } = require('./quote.js');

function quoteMany(orders) {
  const quotes = orders.map(quote);
  return { quotes, grandTotal: quotes.reduce((sum, q) => sum + q.total, 0) };
}

module.exports = { quoteMany };
