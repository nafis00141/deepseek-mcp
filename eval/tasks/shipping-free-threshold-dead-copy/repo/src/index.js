const { quote } = require('./shipping/quote.js');
const { quoteMany } = require('./shipping/quotes.js');
const { banner } = require('./checkout/banner.js');
const { summarize } = require('./checkout/summary.js');

module.exports = { quote, quoteMany, banner, summarize };
