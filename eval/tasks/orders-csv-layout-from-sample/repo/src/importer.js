// Reads the nightly order file. Header row first; fields may be quoted; lines end in CRLF or LF.
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      // the line break is handled on the \n
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseOrdersCsv(text) {
  return parseRows(text)
    .slice(1)
    .map((r) => ({
      id: Number(r[0]),
      customer: r[1],
      totalCents: Math.round(parseFloat(r[2]) * 100),
      paid: r[3] === 'Y',
      note: r[4] === '' || r[4] === undefined ? null : r[4],
    }));
}

module.exports = { parseOrdersCsv };
