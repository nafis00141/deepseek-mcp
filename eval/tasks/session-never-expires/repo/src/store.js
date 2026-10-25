function createStore() {
  const items = new Map();
  return {
    set(id, value) {
      items.set(id, value);
    },
    get(id) {
      return items.get(id);
    },
    delete(id) {
      return items.delete(id);
    },
  };
}

module.exports = { createStore };
