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

function list() {
  return [...ids.keys()];
}

function size() {
  return ids.size;
}

module.exports = { register, unregister, idOf, list, size };
