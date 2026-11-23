export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Le fichier CSV est vide.');
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') {
      if (field || closed) throw new Error('Guillemets CSV invalides.');
      quoted = true;
    } else if (ch === ',') { row.push(field); field = ''; closed = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      row = []; field = ''; closed = false;
    } else {
      if (closed && ch.trim()) throw new Error('Caractère inattendu après un champ CSV.');
      if (!closed) field += ch;
    }
  }
  if (quoted) throw new Error('Champ CSV non fermé.');
  if (field || row.length || closed) { row.push(field); if (row.some(v => v.trim())) rows.push(row); }
  if (rows.length < 2) throw new Error('Le CSV doit contenir un en-tête et au moins une mesure.');
  const header = rows.shift().map(v => v.trim());
  const required = ['facilityId', 'sampledAt', 'parameter', 'value', 'unit', 'source'];
  if (new Set(header).size !== header.length || required.some(k => !header.includes(k))) throw new Error(`En-têtes requis : ${required.join(', ')} (method facultatif).`);
  if (rows.length > 5000) throw new Error('La limite est de 5 000 mesures par import.');
  return rows.map((values, i) => {
    if (values.length !== header.length) throw new Error(`Ligne ${i + 2} : nombre de colonnes incorrect.`);
    return Object.fromEntries(header.map((key, j) => [key, values[j]]));
  });
}
export function toCsv(records) {
  const keys = ['facilityId', 'sampledAt', 'parameter', 'value', 'unit', 'source', 'method'];
  const escape = value => {
    let s = String(value ?? '');
    // Neutralise spreadsheet formulas while preserving ordinary numeric values.
    const numeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    if (/^[=+@\x00-\x1f\x7f]/.test(s) || /^[ \uFEFF]+[=+@-]/.test(s) || (s.startsWith('-') && !numeric.test(s))) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [keys.join(','), ...records.map(r => keys.map(k => escape(r[k])).join(','))].join('\r\n') + '\r\n';
}
