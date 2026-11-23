// Sonde des points d'accès de données ouvertes utiles à Anzar. Sans clé, sans dépendance : node probe.mjs
// Affiche pour chaque point d'accès : statut HTTP, présence de l'en-tête CORS (appel direct du navigateur possible) et durée.
// Un échec d'aujourd'hui ne prouve rien sur demain : relancer avant de conclure. User-Agent générique (aucune donnée personnelle).

const UA = 'research-probe/0.1';
const P = '30.42', L = '-9.6';
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const CHECKS = [
  ['Open-Meteo prévision (pluie, ET0)', `https://api.open-meteo.com/v1/forecast?latitude=${P}&longitude=${L}&daily=precipitation_sum,et0_fao_evapotranspiration&forecast_days=3`],
  ['Open-Meteo archive ERA5', `https://archive-api.open-meteo.com/v1/archive?latitude=${P}&longitude=${L}&start_date=${day(-20)}&end_date=${day(-15)}&daily=precipitation_sum`],
  ['Open-Meteo ensemble', `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${P}&longitude=${L}&daily=precipitation_sum&models=icon_seamless`],
  ['Open-Meteo Flood (GloFAS)', `https://flood-api.open-meteo.com/v1/flood?latitude=${P}&longitude=${L}&daily=river_discharge&forecast_days=3`],
  ['Open-Meteo Climate (CMIP6)', `https://climate-api.open-meteo.com/v1/climate?latitude=${P}&longitude=${L}&start_date=2040-01-01&end_date=2040-01-03&models=EC_Earth3P_HR&daily=precipitation_sum`],
  ['NASA POWER (pluie, EVLAND)', `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,EVLAND&community=AG&longitude=${L}&latitude=${P}&start=${day(-20).replaceAll('-', '')}&end=${day(-15).replaceAll('-', '')}&format=JSON`],
  ['World Bank (population Maroc)', 'https://api.worldbank.org/v2/country/MAR/indicator/SP.POP.TOTL?format=json&mrv=1'],
  ['FAO WaPOR v3 (catalogue)', 'https://data.apps.fao.org/gismgr/api/v2/catalog/workspaces/WAPOR-3/mapsets?paged=true&pageSize=1&pageNumber=1'],
  ['HDX / OCHA (CKAN)', 'https://data.humdata.org/api/3/action/package_search?q=morocco&rows=1'],
  ['data.gov.ma (CKAN)', 'https://data.gov.ma/data/api/3/action/package_search?q=barrage&rows=1'],
  ['Earth Search STAC (Sentinel-2)', 'https://earth-search.aws.element84.com/v1/search?collections=sentinel-2-l2a&bbox=-9.7,30.3,-9.5,30.5&limit=1'],
  ['Copernicus CDSE OData (catalogue)', 'https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$top=1'],
  ['Copernicus CDS (catalogue)', 'https://cds.climate.copernicus.eu/api/catalogue/v1/collections?limit=1'],
  ['NASA CMR (métadonnées IMERG)', 'https://cmr.earthdata.nasa.gov/search/collections.json?short_name=GPM_3IMERGDL&page_size=1'],
  ['JRC Global Surface Water (tuile)', 'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/10/492/399.png'],
  ['Mapterhorn (TileJSON)', 'https://tiles.mapterhorn.com/tilejson.json'],
  ['OpenFreeMap (style)', 'https://tiles.openfreemap.org/styles/liberty'],
  ['CHIRPS v3 (index CHC)', 'https://data.chc.ucsb.edu/products/CHIRPS/v3.0/'],
  ['Overpass (GET, barrages)', 'https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3Bnwr%5B%22waterway%22%3D%22dam%22%5D(30%2C-10%2C31%2C-8)%3Bout%20count%3B'],
];

async function probe([name, url]) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Origin: 'https://example.org' }, signal: AbortSignal.timeout(25000) });
    await r.body?.cancel();
    return { name, status: r.status, cors: r.headers.get('access-control-allow-origin') || 'non', ms: Date.now() - t0 };
  } catch (e) {
    return { name, status: `erreur (${e.cause?.code || e.name})`, cors: '-', ms: Date.now() - t0 };
  }
}

console.log(`Sonde du ${new Date().toISOString()}\n`);
for (const row of await Promise.all(CHECKS.map(probe))) {
  console.log(`${String(row.status).padEnd(18)} cors=${String(row.cors).padEnd(8)} ${String(row.ms).padStart(5)} ms  ${row.name}`);
}
