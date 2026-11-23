import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, Check, ChevronDown, FileUp, FlaskConical, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import './QualityPanel.css';

const csvHeader = 'facilityId,sampledAt,parameter,value,unit,source,method\n';
const formatDate = (value) => new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const number = (value) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 4 }).format(value);
const defaultForm = () => ({ facilityId: '', parameter: '', sampledAt: '', value: '', source: '', method: '' });

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error('Le serveur ne répond pas correctement. Réessayez dans un instant.'); }
  if (!response.ok) {
    const details = Array.isArray(data.details) ? data.details.map((item) => typeof item === 'string' ? item : item.row ? `Ligne ${item.row} : ${item.error || item.message}` : item.message || item.error || JSON.stringify(item)).join(' · ') : typeof data.details === 'string' ? data.details : '';
    throw new Error(`${data.error || 'Cette opération a échoué.'}${details ? ` ${details}` : ''}`);
  }
  return data;
}

function saveFile(content, filename, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Trend({ observations, parameter, facilityName }) {
  const sorted = [...observations].sort((a, b) => new Date(a.sampledAt) - new Date(b.sampledAt));
  const width = 760, height = 210, left = 58, right = 24, top = 25, bottom = 38;
  const values = sorted.map((row) => Number(row.value));
  const minValue = Math.min(...values), maxValue = Math.max(...values);
  const padding = maxValue === minValue ? Math.max(Math.abs(maxValue) * 0.1, 0.5) : (maxValue - minValue) * 0.18;
  const min = minValue - padding, max = maxValue + padding;
  const times = sorted.map((row) => new Date(row.sampledAt).getTime());
  const first = times[0], last = times[times.length - 1];
  const x = (time) => first === last ? (width + left - right) / 2 : left + (time - first) / (last - first) * (width - left - right);
  const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
  const ticks = [min, (min + max) / 2, max];
  const description = `${parameter.label} à ${facilityName} : ${sorted.length} mesure${sorted.length > 1 ? 's' : ''}, de ${number(minValue)} à ${number(maxValue)} ${parameter.unit || ''}.`;
  return <div className="quality-trend">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
      <title>{description}</title>
      {ticks.map((tick, index) => <g key={index}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#e6ebf0" /><text x={left - 12} y={y(tick) + 4} textAnchor="end" className="quality-axis">{number(tick)}</text></g>)}
      {sorted.length > 1 && <polyline fill="none" stroke="#12508f" strokeWidth="2.5" points={sorted.map((row, index) => `${x(times[index])},${y(Number(row.value))}`).join(' ')} />}
      {sorted.map((row, index) => <circle key={row.id} cx={x(times[index])} cy={y(Number(row.value))} r="4.5" fill="#12508f" stroke="white" strokeWidth="2"><title>{formatDate(row.sampledAt)} : {number(row.value)} {row.unit}</title></circle>)}
      <text x={left} y={height - 10} className="quality-axis">{new Intl.DateTimeFormat('fr-MA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(first))}</text>
      {first !== last && <text x={width - right} y={height - 10} textAnchor="end" className="quality-axis">{new Intl.DateTimeFormat('fr-MA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(last))}</text>}
    </svg>
    <p>Mesures importées ou saisies. Les lignes relient les échantillons et ne constituent pas une prévision.</p>
  </div>;
}

export default function QualityPanel({ facilities = [], user, onRequireAuth, onToast }) {
  const [parameters, setParameters] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [parameterFilter, setParameterFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [retry, setRetry] = useState(0);
  const upload = useRef(null);
  const formFocus = useRef(null);
  const notice = (message) => onToast?.(message);

  useEffect(() => {
    const controller = new AbortController();
    request('/api/parameters', { signal: controller.signal }).then((data) => { setParameters(data.parameters || []); setMetadataError(''); }).catch((err) => { if (err.name !== 'AbortError') setMetadataError(err.message); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    setObservations([]);
    setError('');
    setFormOpen(false);
    if (!user) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    request('/api/observations', { signal: controller.signal }).then((data) => setObservations(data.observations || [])).catch((err) => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user, retry]);

  useEffect(() => { if (formOpen) formFocus.current?.focus(); }, [formOpen]);

  const facilityMap = useMemo(() => new Map(facilities.map((facility) => [facility.id, facility])), [facilities]);
  const parameterMap = useMemo(() => new Map(parameters.map((parameter) => [parameter.id, parameter])), [parameters]);
  const filtered = useMemo(() => observations.filter((row) => (!facilityFilter || row.facilityId === facilityFilter) && (!parameterFilter || row.parameter === parameterFilter)).sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt)), [observations, facilityFilter, parameterFilter]);
  const measuredSites = new Set(observations.map((row) => row.facilityId)).size;
  const chosenParameter = parameterMap.get(form.parameter);
  const trendParameter = parameterMap.get(parameterFilter);
  const latest = observations.length ? observations.reduce((a, b) => new Date(a.sampledAt) > new Date(b.sampledAt) ? a : b) : null;

  function openForm() {
    if (!user) { onRequireAuth?.(); return; }
    setForm({ ...defaultForm(), facilityId: facilityFilter, parameter: parameterFilter });
    setFormError('');
    setFormOpen(true);
  }

  async function addObservation(event) {
    event.preventDefault();
    setFormError('');
    if (!form.facilityId || !form.parameter || !form.sampledAt || form.value === '' || !form.source.trim()) { setFormError('Renseignez le site, le paramètre, la date, la valeur et la source.'); return; }
    const value = Number(form.value);
    const sampledAt = new Date(form.sampledAt);
    if (!Number.isFinite(value) || !Number.isFinite(sampledAt.getTime())) { setFormError('Vérifiez la valeur et la date de prélèvement.'); return; }
    if (sampledAt.getTime() > Date.now()) { setFormError('La date du prélèvement ne peut pas être dans le futur.'); return; }
    if (chosenParameter?.min != null && value < chosenParameter.min || chosenParameter?.max != null && value > chosenParameter.max) { setFormError(`La valeur doit être comprise dans le domaine accepté pour ${chosenParameter.label}${chosenParameter.min != null ? ` : minimum ${chosenParameter.min}` : ''}${chosenParameter.max != null ? `, maximum ${chosenParameter.max}` : ''}. Ce domaine vérifie la saisie, pas la potabilité.`); return; }
    setSaving(true);
    try {
      await request('/api/observations', { method: 'POST', body: JSON.stringify({ ...form, value, sampledAt: sampledAt.toISOString(), unit: chosenParameter?.unit || '', source: form.source.trim(), method: form.method.trim() }) });
      const data = await request('/api/observations');
      setObservations(data.observations || []);
      setFormOpen(false);
      notice('Mesure enregistrée');
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  }

  async function importCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) { setError('Le fichier dépasse 1 Mo. Divisez-le avant de l’importer.'); return; }
    setImporting(true);
    setError('');
    try {
      const csv = await file.text();
      const result = await request('/api/observations/import', { method: 'POST', body: JSON.stringify({ csv }) });
      const data = await request('/api/observations');
      setObservations(data.observations || []);
      notice(`${result.imported} mesure${result.imported === 1 ? '' : 's'} importée${result.imported === 1 ? '' : 's'}`);
    } catch (err) { setError(err.message); } finally { setImporting(false); }
  }

  async function exportCsv() {
    setError('');
    try {
      const response = await fetch('/api/observations/export', { credentials: 'same-origin' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'L’export a échoué.'); }
      saveFile(await response.text(), 'srmsm-mesures.csv');
      notice('Export téléchargé');
    } catch (err) { setError(err.message); }
  }

  async function removeObservation(id) {
    setDeleting(id);
    setError('');
    try {
      await request(`/api/observations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setObservations((rows) => rows.filter((row) => row.id !== id));
      setConfirmDelete(null);
      notice('Mesure supprimée');
    } catch (err) { setError(err.message); } finally { setDeleting(null); }
  }

  return <section className="quality-panel" aria-labelledby="quality-title">
    <div className="quality-heading">
      <h2 id="quality-title">Analyses et prélèvements</h2>
      <button className="quality-button quality-primary" onClick={openForm}><Plus size={18} /> Ajouter une mesure</button>
    </div>

    <div className="quality-summary" aria-label="Résumé des mesures">
      <div><span>Mesures enregistrées</span><strong>{observations.length}</strong><small>{user ? 'Dans votre espace de travail' : 'Connectez votre espace pour commencer'}</small></div>
      <div><span>Sites suivis</span><strong>{measuredSites}<em> / {facilities.length}</em></strong><small>Avec au moins une analyse</small></div>
      <div><span>Dernier prélèvement</span><strong className="quality-date-value">{latest ? formatDate(latest.sampledAt) : 'Aucun prélèvement'}</strong><small>La date d’échantillon fait référence</small></div>
    </div>

    {(error || metadataError) && <div className="quality-error" role="alert"><span>{error || metadataError}</span><button onClick={() => { setError(''); setRetry((value) => value + 1); }}>Réessayer</button></div>}

    {!user ? <div className="quality-guest">
      <div className="quality-guest-copy"><FlaskConical size={30} strokeWidth={1.6} /><h2>Une carte ne remplace pas un prélèvement</h2><p>Les données publiques décrivent les infrastructures. Les mesures de qualité de votre organisation commencent avec vos analyses de laboratoire ou vos capteurs.</p><button className="quality-button quality-primary" onClick={() => onRequireAuth?.()}>Créer mon espace de suivi</button><p className="quality-small-note">Vos mesures restent dans votre espace de travail</p></div>
      <ol className="quality-guide"><li><span>Choisir le site</span><p>Rattachez l’échantillon à un barrage, un ouvrage de traitement ou un autre site référencé.</p></li><li><span>Documenter la mesure</span><p>Indiquez le paramètre, l’unité, la date et la source. Saisissez une analyse ou importez un fichier CSV.</p></li><li><span>Lire l’évolution</span><p>Comparez des mesures du même site et du même paramètre. Aucune valeur de qualité n’est inventée.</p></li></ol>
    </div> : <>
      <div className="quality-controls">
        <div className="quality-select-wrap"><label htmlFor="quality-facility-filter">Site</label><div className="quality-select"><select id="quality-facility-filter" value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}><option value="">Tous les sites</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><ChevronDown size={15} /></div></div>
        <div className="quality-select-wrap"><label htmlFor="quality-parameter-filter">Paramètre</label><div className="quality-select"><select id="quality-parameter-filter" value={parameterFilter} onChange={(event) => setParameterFilter(event.target.value)}><option value="">Tous les paramètres</option>{parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.label}{parameter.unit ? ` (${parameter.unit})` : ''}</option>)}</select><ChevronDown size={15} /></div></div>
        <div className="quality-data-actions"><input ref={upload} type="file" accept=".csv,text/csv" className="quality-file-input" aria-label="Fichier CSV de mesures" onChange={importCsv} /><button className="quality-button quality-secondary" onClick={() => upload.current?.click()} disabled={importing}>{importing ? <LoaderCircle className="quality-spin" size={17} /> : <FileUp size={17} />}{importing ? 'Import en cours' : 'Importer CSV'}</button><button className="quality-button quality-secondary" onClick={exportCsv} disabled={!observations.length}><ArrowDownToLine size={17} /> Exporter</button></div>
      </div>

      <div className="quality-chart-section"><div className="quality-section-heading"><div><h2>Évolution des mesures</h2><p>{facilityFilter && trendParameter ? `${facilityMap.get(facilityFilter)?.name || facilityFilter} · ${trendParameter.label}${trendParameter.unit ? ` (${trendParameter.unit})` : ''}` : 'Sélectionnez un site et un paramètre pour lire une série comparable'}</p></div><Activity size={21} strokeWidth={1.5} /></div>
        {loading ? <div className="quality-chart-empty"><LoaderCircle className="quality-spin" size={24} /><p>Chargement de vos mesures</p></div> : facilityFilter && trendParameter && filtered.length ? <Trend observations={filtered} parameter={trendParameter} facilityName={facilityMap.get(facilityFilter)?.name || facilityFilter} /> : <div className="quality-chart-empty"><div className="quality-empty-grid" aria-hidden="true"><span /><span /><span /><span /></div><p>{!observations.length ? 'Votre première analyse dessinera le début de la série' : facilityFilter && parameterFilter ? 'Aucune mesure pour cette sélection' : 'Un site, un paramètre, une lecture précise'}</p><span>{!observations.length ? 'Ajoutez une mesure ou importez vos résultats de laboratoire' : 'Utilisez les filtres ci-dessus'}</span></div>}
      </div>

      <div className="quality-records"><div className="quality-section-heading"><div><h2>Registre des analyses <span className="quality-count">{filtered.length}</span></h2><p>Valeurs déclarées par votre organisation. Leur validation scientifique reste à documenter.</p></div><button className="quality-text-button" onClick={() => saveFile(csvHeader, 'srmsm-modele-mesures.csv')}>Télécharger le modèle CSV</button></div>
        <div className="quality-table-scroll"><table><caption className="quality-sr-only">Mesures de qualité de l’eau enregistrées</caption><thead><tr><th>Site</th><th>Prélèvement</th><th>Paramètre</th><th className="quality-number-cell">Valeur</th><th>Source et méthode</th><th>Provenance</th><th><span className="quality-sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td className="quality-site-cell">{facilityMap.get(row.facilityId)?.name || row.facilityId}</td><td className="quality-nowrap">{formatDate(row.sampledAt)}</td><td>{parameterMap.get(row.parameter)?.label || row.parameter}</td><td className="quality-number-cell quality-nowrap"><strong>{number(row.value)}</strong> <span>{row.unit}</span></td><td className="quality-source-cell"><span>{row.source}</span>{row.method && <small>{row.method}</small>}</td><td><span className={`quality-provenance ${row.provenance === 'synthetic' ? 'quality-synthetic' : ''}`}>{({ observed: 'Observée', measured: 'Mesurée', synthetic: 'Synthétique', predicted: 'Prédite', imported: 'Importée', 'user-imported': 'Déclarée' })[row.provenance] || row.provenance || 'Non précisée'}</span></td><td className="quality-delete-cell">{confirmDelete === row.id ? <div className="quality-delete-confirm"><button title="Confirmer la suppression" aria-label="Confirmer la suppression de cette mesure" onClick={() => removeObservation(row.id)} disabled={deleting === row.id}>{deleting === row.id ? <LoaderCircle className="quality-spin" size={16} /> : <Check size={16} />}</button><button title="Annuler" aria-label="Annuler la suppression" onClick={() => setConfirmDelete(null)}><X size={16} /></button></div> : <button className="quality-icon-button" title="Supprimer cette mesure" aria-label={`Supprimer la mesure ${parameterMap.get(row.parameter)?.label || row.parameter} du ${formatDate(row.sampledAt)}`} onClick={() => setConfirmDelete(row.id)}><Trash2 size={16} /></button>}</td></tr>)}{!filtered.length && <tr><td colSpan="7" className="quality-table-empty">{loading ? 'Chargement…' : observations.length ? 'Aucune analyse ne correspond aux filtres.' : 'Aucune mesure enregistrée. Votre registre est prêt à accueillir vos premières analyses.'}</td></tr>}</tbody></table></div>
        <p className="quality-csv-help">CSV : identifiant du site, date ISO, identifiant du paramètre, valeur, unité, source, méthode. Le modèle ne contient aucune mesure d’exemple. <button onClick={() => saveFile(JSON.stringify({ facilities: facilities.map(({ id, name }) => ({ id, name })), parameters }, null, 2), 'srmsm-referentiel-import.json', 'application/json')}>Télécharger les identifiants et unités</button></p>
      </div>
    </>}

    <div className="quality-method-note"><FlaskConical size={19} strokeWidth={1.6} /><p><strong>Une lecture transparente de la qualité.</strong> Aucun indice global de potabilité n’est calculé. L’interprétation exige des unités vérifiées, une méthode d’analyse et des références adaptées à l’usage de l’eau.</p></div>

    {formOpen && <div className="quality-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}><section className="quality-modal" role="dialog" aria-modal="true" aria-labelledby="quality-form-title" onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setFormOpen(false); if (event.key === 'Tab') { const items = event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}>
      <div className="quality-modal-heading"><div><h2 id="quality-form-title">Ajouter une mesure</h2><p>Conservez le contexte de chaque prélèvement</p></div><button className="quality-icon-button" onClick={() => setFormOpen(false)} aria-label="Fermer le formulaire" disabled={saving}><X size={21} /></button></div>
      <form onSubmit={addObservation}>
        <div className="quality-form-grid"><label className="quality-full-field">Site<select ref={formFocus} required value={form.facilityId} onChange={(event) => setForm({ ...form, facilityId: event.target.value })}><option value="">Sélectionner le site du prélèvement</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label><label>Paramètre<select required value={form.parameter} onChange={(event) => setForm({ ...form, parameter: event.target.value, value: '' })}><option value="">Choisir un paramètre</option>{parameters.map((parameter) => <option key={parameter.id} value={parameter.id}>{parameter.label}</option>)}</select></label><label>Valeur {chosenParameter?.unit ? `(${chosenParameter.unit})` : ''}<input required type="number" step="any" min={chosenParameter?.min} max={chosenParameter?.max} value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="Valeur de l’analyse" inputMode="decimal" /></label><label className="quality-full-field">Date et heure du prélèvement<input required type="datetime-local" value={form.sampledAt} onChange={(event) => setForm({ ...form, sampledAt: event.target.value })} /><small>Heure locale de votre appareil, enregistrée en UTC</small></label><label className="quality-full-field">Source de l’analyse<input required maxLength={300} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Laboratoire, rapport ou identifiant du capteur" /></label><label className="quality-full-field">Méthode d’analyse <span className="quality-optional">facultatif</span><input maxLength={300} value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} placeholder="Référence de méthode ou protocole utilisé" /></label></div>
        {formError && <p className="quality-form-error" role="alert">{formError}</p>}
        <div className="quality-form-footer"><button type="button" className="quality-button quality-secondary" onClick={() => setFormOpen(false)} disabled={saving}>Annuler</button><button type="submit" className="quality-button quality-primary" disabled={saving || !parameters.length}>{saving ? <LoaderCircle className="quality-spin" size={17} /> : <Plus size={17} />}{saving ? 'Enregistrement…' : 'Enregistrer la mesure'}</button></div>
      </form>
    </section></div>}
  </section>;
}
