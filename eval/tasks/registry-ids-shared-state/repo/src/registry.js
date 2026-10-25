// One registry per process, shared by everything that requires this module.
const items = [];

function register(name) {
  items.push(name);
}

function list() {
  return items.slice();
}

function size() {
  return items.length;
}

module.exports = { register, list, size };
