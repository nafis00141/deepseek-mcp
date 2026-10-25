function words(text) {
  return text.split(/\s+/).filter(Boolean);
}

module.exports = { words };
