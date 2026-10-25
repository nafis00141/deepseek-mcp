// One registry per process, shared by everything that requires this module.
const ids = new Map();
let lastId = 0;

function register(name) {
  if (!ids.has(name)) ids.set(name, ++lastId);
  return ids.get(name);
}

function unregister(name) {
  return ids.delete(name);
}

function idOf(name) {
  return ids.get(name);
}

// names in alphabetical order
function list() {
  return [...ids.keys()].sort();
}

function size() {
  return ids.size;
}

module.exports = { register, unregister, idOf, list, size };
