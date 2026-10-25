function exportJson(notes) {
  return JSON.stringify(notes.map((n) => ({ id: n.id, title: n.title, created: n.created, updated: n.updated ?? null })));
}

module.exports = { exportJson };
