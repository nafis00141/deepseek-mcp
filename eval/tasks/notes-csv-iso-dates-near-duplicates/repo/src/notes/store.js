const { makeNote, touch } = require('./model.js');

function createStore() {
  const notes = [];
  return {
    add(title, now) {
      const n = makeNote(notes.length + 1, title, now);
      notes.push(n);
      return n;
    },
    edit(id, now) {
      const i = notes.findIndex((n) => n.id === id);
      if (i < 0) return null;
      notes[i] = touch(notes[i], now);
      return notes[i];
    },
    all() {
      return notes.slice();
    },
  };
}

module.exports = { createStore };
