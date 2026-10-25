function makeNote(id, title, created) {
  return { id, title, created, updated: null };
}

function touch(note, now) {
  return { ...note, updated: now };
}

module.exports = { makeNote, touch };
