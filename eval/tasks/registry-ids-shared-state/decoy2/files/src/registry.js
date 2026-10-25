// One registry per process, shared by everything that requires this module.
const items = [];

function register(name) {
  if (!items.includes(name)) items.push(name);
  return items.indexOf(name) + 1;
}

function unregister(name) {
  const i = items.indexOf(name);
  if (i < 0) return false;
  items.splice(i, 1);
  return true;
}

function idOf(name) {
  const i = items.indexOf(name);
  return i < 0 ? undefined : i + 1;
}

function list() {
  return items.slice();
}

function size() {
  return items.length;
}

module.exports = { register, unregister, idOf, list, size };
