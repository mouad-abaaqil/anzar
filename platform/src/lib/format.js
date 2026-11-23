export const number = (v, digits = 1) => typeof v === 'number'
  ? v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
  : '—';

export const date = (v) => {
  if (!v) return 'Non renseignée';
  if (/^\d{4}$/.test(v)) return v;
  const matched = v.match(/\d{4}-\d{2}-\d{2}/);
  if (!matched) return v;
  return new Date(matched[0] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const download = (data, name, type = 'application/json') => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
