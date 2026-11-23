import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import * as B from '../src/lib/balance.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const fixture = readJson('tests/fixtures/water-balance.fixture.json');
const realPath = resolve(root, 'public/data/water-balance.json');
const real = existsSync(realPath) ? readJson('public/data/water-balance.json') : null;
const realBulletin = readJson('public/data/national-bulletin.json');

const hasKey = (o, re) => {
  if (Array.isArray(o)) return o.some(x => hasKey(x, re));
  if (o && typeof o === 'object') return Object.entries(o).some(([k, v]) => re.test(k) || hasKey(v, re));
  return false;
};
const FORBIDDEN = /transf|transferable|volumeTransf/i;
const basinOf = (doc, rb) => doc.basins.filter(b => (rb.basinShares ?? []).some(s => s.basin === b.name));

function properties(label, doc, bulletin) {
  describe(label, () => {
    const regs = doc.regions;
    const withStock = regs.filter(r => B.basinStockForRegion(r, bulletin).hasStock);

    test('stock attribué cohérent (0 <= stocké <= capacité)', () => {
      for (const r of regs) {
        const s = B.basinStockForRegion(r, bulletin);
        assert.ok(s.storedMm3 >= 0 && s.storedMm3 <= s.capacityMm3 + 1e-9, r.id);
      }
    });

    test('plus de population => moins de mois de couverture (monotonie)', () => {
      for (const r of withStock) {
        const lo = B.coverage(r, bulletin, { popGrowth: 0 }).monthsOfCoverage;
        const hi = B.coverage(r, bulletin, { popGrowth: 5, year: (r.population.year ?? 2024) + 10 }).monthsOfCoverage;
        if (lo == null || hi == null) continue;
        assert.ok(hi <= lo + 1e-9, `${r.id}: ${hi} > ${lo}`);
      }
    });

    test('scénario dry <= normal <= wet, stock dans [0, capacité], bandes cohérentes', () => {
      for (const r of withStock) {
        const cap = B.basinStockForRegion(r, bulletin).capacityMm3;
        const bs = basinOf(doc, r);
        const run = h => B.simulate(r, bulletin, bs, { hydrology: h, startYear: 2026 }, 10);
        const [dry, normal, wet] = ['dry', 'normal', 'wet'].map(run);
        assert.equal(dry.length, 10);
        for (let i = 0; i < 10; i++) {
          assert.ok(dry[i].storedMm3 <= normal[i].storedMm3 + 1e-9, `${r.id} y${i} dry>normal`);
          assert.ok(normal[i].storedMm3 <= wet[i].storedMm3 + 1e-9, `${r.id} y${i} normal>wet`);
          for (const row of [dry[i], normal[i], wet[i]]) {
            assert.ok(row.storedMm3 >= 0 && row.storedMm3 <= cap + 1e-9, `${r.id} stock hors bornes`);
            assert.equal(row.band, B.bandFor(row.monthsOfCoverage));
            assert.ok(row.caveats.length > 0);
          }
          if (dry[i].monthsOfCoverage != null && wet[i].monthsOfCoverage != null) assert.ok(dry[i].monthsOfCoverage <= wet[i].monthsOfCoverage + 1e-9);
        }
      }
    });

    test('bandes : bornes documentées 6 et 18', () => {
      assert.equal(B.bandFor(5.99), 'critique');
      assert.equal(B.bandFor(6), 'tendu');
      assert.equal(B.bandFor(18), 'tendu');
      assert.equal(B.bandFor(18.01), 'confortable');
      assert.equal(B.bandFor(null), null);
      for (const r of regs) {
        const c = B.coverage(r, bulletin);
        assert.equal(c.band, B.bandFor(c.monthsOfCoverage));
      }
    });

    test('régions sans stock : null + caveat, pas de crash', () => {
      for (const r of regs.filter(x => !B.basinStockForRegion(x, bulletin).hasStock)) {
        const c = B.coverage(r, bulletin);
        assert.equal(c.monthsOfCoverage, null);
        assert.equal(c.band, null);
        assert.ok(c.caveats.some(x => /pas de stock/.test(x)), r.id);
        assert.ok(B.explain(c).length > 0);
        const sim = B.simulate(r, bulletin, [], { hydrology: 'normal', startYear: 2026 }, 3);
        assert.equal(sim.length, 3);
        assert.ok(sim.every(x => x.monthsOfCoverage === null && x.storedMm3 === 0));
        assert.ok(B.levers(r, bulletin).every(l => l.deltaMonths === null));
      }
    });

    test('aucune sortie ne contient de clé de transfert ; groundwater absent des composantes mais dans caveats', () => {
      const ass = {};
      const out = {
        cov: regs.map(r => B.coverage(r, bulletin, ass)),
        lev: regs.map(r => B.levers(r, bulletin, ass)),
        rank: B.rankRegions(regs, bulletin, ass),
        sol: B.solidarityView(regs, bulletin, ass),
        sim: withStock.map(r => B.simulate(r, bulletin, basinOf(doc, r), { hydrology: 'normal', startYear: 2026 }, 5)),
      };
      assert.equal(hasKey(out, FORBIDDEN), false);
      for (const c of out.cov) {
        assert.equal(hasKey(c.components, /ground|souterrain|nappe/i), false);
        assert.ok(c.caveats.some(x => /souterraines non modélisées/.test(x)));
      }
    });

    test('leviers : jamais de transfert, hypothèse, effet >= 0 quand chiffré', () => {
      for (const r of withStock) {
        const ls = B.levers(r, bulletin);
        assert.ok(ls.length >= 4);
        for (const l of ls) {
          assert.equal(l.status, 'hypothese');
          assert.ok(['économie', 'réutilisation', 'dessalement'].includes(l.kind));
          if (l.deltaMonths != null) assert.ok(l.deltaMonths >= -1e-9, `${r.id} ${l.id}`);
        }
      }
    });

    test('classement et vue de solidarité : rangs cohérents, sans volume', () => {
      const ranked = B.rankRegions(regs, bulletin);
      assert.equal(ranked.length, regs.length);
      const ok = ranked.filter(r => r.rank != null);
      ok.forEach((r, i) => { assert.equal(r.rank, i + 1); if (i) assert.ok(ok[i - 1].monthsOfCoverage >= r.monthsOfCoverage); });
      const sol = B.solidarityView(regs, bulletin);
      const n = sol.wellEndowed.length + sol.intermediate.length + sol.underPressure.length + sol.undetermined.length;
      assert.equal(n, regs.length);
      assert.ok(sol.caveats.length > 0);
    });

    test('explain renvoie des phrases courtes en français', () => {
      for (const r of regs) {
        const s = B.explain(B.coverage(r, bulletin));
        assert.ok(s.length >= 2);
        assert.ok(s.every(x => typeof x === 'string' && x.length < 300));
      }
    });
  });
}

properties('fixture', fixture, fixture.bulletin);

describe('valeurs de référence (fixture, calcul à la main)', () => {
  const r = fixture.regions[0];
  test('demande domestique = pop x l/j x 365 / 1e9 x (1 + pertes)', () => {
    const d = B.annualDemand(r, { year: 2024, popGrowth: 0 });
    assert.ok(Math.abs(d.domesticMm3 - (2000000 * 100 * 365) / 1e9 * 1.25) < 1e-9);
    assert.ok(Math.abs(d.agricultureMm3 - 300) < 1e-9);
    assert.equal(d.industryMm3, 10);
    assert.equal(d.potableMm3, d.domesticMm3);
  });
  test('couverture = (stock + dessalement) / demande mensuelle de surface', () => {
    const c = B.coverage(r, fixture.bulletin, { year: 2024, popGrowth: 0 });
    const demand = 91.25 + 300 + 10;
    const expected = (300 + 20 * B.DESAL_UTILISATION) / (demand * B.SURFACE_SHARE / 12);
    assert.ok(Math.abs(c.monthsOfCoverage - expected) < 1e-9);
    assert.ok(c.monthsPotable > c.monthsOfCoverage);
  });
  test('stock multi-bassins pondéré par parts', () => {
    const s = B.basinStockForRegion(fixture.regions[1], fixture.bulletin);
    assert.ok(Math.abs(s.storedMm3 - (0.3 * 300 + 0.5 * 100)) < 1e-9);
    assert.ok(Math.abs(s.capacityMm3 - (0.3 * 600 + 0.5 * 400)) < 1e-9);
  });
  test('bassin absent du bulletin : signalé, pas de crash', () => {
    const x = { ...r, basinShares: [{ basin: 'Inconnu', share: 1 }] };
    const c = B.coverage(x, fixture.bulletin);
    assert.equal(c.monthsOfCoverage, null);
    assert.ok(c.caveats.some(t => /absent du bulletin/.test(t)));
  });
  test('volume traité inconnu : levier de réutilisation non chiffré', () => {
    const l = B.levers(fixture.regions[1], fixture.bulletin).find(x => x.id === 'reutilisation');
    assert.equal(l.deltaMonths, null);
  });
  test('les leviers d’économie et de dessalement améliorent la couverture', () => {
    const ls = B.levers(r, fixture.bulletin);
    for (const id of ['economies', 'dessalement', 'fuites']) assert.ok(ls.find(l => l.id === id).deltaMonths > 0, id);
  });
  test('hypothèse sèche + forte croissance : la couverture se dégrade vs scénario neutre', () => {
    const bs = fixture.basins;
    const base = B.simulate(r, fixture.bulletin, bs, { hydrology: 'normal', startYear: 2026 }, 10).at(-1);
    const bad = B.simulate(r, fixture.bulletin, bs, { hydrology: 'dry', popGrowth: 3, startYear: 2026 }, 10).at(-1);
    assert.ok(bad.storedMm3 <= base.storedMm3 && bad.demandMm3 > base.demandMm3);
  });
});

describe('fichier réel public/data/water-balance.json', { skip: real ? false : 'fichier absent (worker données pas encore livré)' }, () => {
  properties('réel', real ?? { regions: [], basins: [] }, realBulletin);
  test('12 régions, groundwater null, parts de bassin <= 1 par bassin', () => {
    assert.equal(real.regions.length, 12);
    const sums = {};
    for (const r of real.regions) {
      assert.equal(r.groundwater, null, r.id);
      for (const s of r.basinShares ?? []) sums[s.basin] = (sums[s.basin] ?? 0) + s.share;
    }
    for (const [b, v] of Object.entries(sums)) assert.ok(v <= 1 + 1e-9, `${b}: ${v}`);
  });
  test('le fichier ne contient aucune clé de transfert', () => assert.equal(hasKey(real, FORBIDDEN), false));
  test('Laâyoune et Dakhla : pas de crash, null avec caveat quand sans stock', () => {
    for (const r of real.regions.filter(x => /laayoune|dakhla/.test(x.id))) {
      const c = B.coverage(r, realBulletin);
      if (!B.basinStockForRegion(r, realBulletin).hasStock) { assert.equal(c.monthsOfCoverage, null); assert.ok(c.caveats.some(x => /pas de stock/.test(x))); }
    }
  });
});

describe('hypothèses hydrologiques, pluie, dessalement', () => {
  const r = fixture.regions[0], bs = fixture.basins;
  const end = sc => B.simulate(r, fixture.bulletin, bs, { hydrology: 'normal', startYear: 2026, ...sc }, 10);
  test('facteurs lus dans le JSON, repli sur les constantes, affichés dans les caveats', () => {
    const custom = bs.map(b => ({ ...b, climateFactor: { dry: 0.1, normal: 0.2, wet: 0.3, damCaptureShare: 0.5 } }));
    assert.deepEqual(B.hydroParams(custom[0], 'wet'), { factor: 0.3, capture: 0.5, fromFile: true });
    assert.equal(B.hydroParams({}, 'dry').factor, B.HYDRO_FACTOR.dry);
    assert.equal(B.hydroParams({}, 'dry').capture, B.DAM_CAPTURE_SHARE);
    const rows = B.simulate(r, fixture.bulletin, custom, { hydrology: 'normal' }, 2);
    assert.ok(rows[0].caveats.some(c => /part captée 50 %/.test(c)));
    assert.ok(B.explain(B.coverage(r, fixture.bulletin)).some(x => /part captée/.test(x)));
  });
  test('fichier réel : facteurs hypothèse avec note', { skip: !real }, () => {
    for (const b of real.basins) { assert.equal(b.climateFactor.status, 'hypothese'); assert.equal(b.climateFactor.damCaptureShare, 0.35); assert.match(b.climateFactor.note, /pas une validation/); }
  });
  test('pluie : baisse => moins de stock, 0 par défaut, multiplicateur borné à 0', () => {
    assert.equal(B.RAIN_TO_RUNOFF_ELASTICITY, 2);
    assert.equal(B.rainMultiplier(-10), 0.8);
    assert.equal(B.rainMultiplier(-80), 0);
    assert.ok(end({ rainChangePct: -20 }).at(-1).storedMm3 <= end({}).at(-1).storedMm3);
    assert.ok(end({ rainChangePct: 20 }).at(-1).storedMm3 >= end({}).at(-1).storedMm3);
    assert.equal(end({ rainChangePct: 0 }).at(-1).storedMm3, end({}).at(-1).storedMm3);
  });
  test('stock épuisé : drapeau depleted et caveat', () => {
    const rows = end({ hydrology: 'dry', rainChangePct: -100, popGrowth: 5 });
    const d = rows.find(x => x.depleted);
    assert.ok(d && d.storedMm3 === 0 && d.caveats.includes(B.DEPLETED_NOTE));
  });
  test('desalCoverageOfPotable : borné [0,1], null sans demande, calculé sans stock', { skip: !real }, () => {
    for (const x of real.regions) {
      const c = B.coverage(x, realBulletin);
      if (c.desalCoverageOfPotable != null) assert.ok(c.desalCoverageOfPotable >= 0 && c.desalCoverageOfPotable <= 1, x.id);
    }
    const la = real.regions.find(x => x.id === 'laayoune-sakia-el-hamra');
    assert.ok(B.coverage(la, realBulletin).desalCoverageOfPotable > 0);
    const big = { ...r, desalination: { capacityMm3PerYear: { value: 1e6 } } };
    assert.equal(B.coverage(big, fixture.bulletin).desalCoverageOfPotable, 1);
    assert.equal(B.coverage({ ...r, population: null }, fixture.bulletin).desalCoverageOfPotable, null);
  });
});

describe('classement à 10 ans et critères de tension', { skip: real ? false : 'fichier absent' }, () => {
  const out = rankingFor();
  function rankingFor() {
    if (!real) return [];
    const sc = rb => ({ hydrology: 'normal', startYear: 2026, rainChangePct: 0 });
    return B.rankingOutlook(real.regions, realBulletin, real.basins, { assumptions: { year: 2026 }, scenarioFor: sc, years: 10 });
  }
  test('les régions sans stock sont en fin de liste, sans rang', () => {
    const idx = out.findIndex(r => r.noStock);
    assert.ok(idx > 0);
    assert.ok(out.slice(idx).every(r => r.noStock && r.rank == null));
    assert.ok(out.slice(0, idx).every(r => !r.noStock && r.rank != null));
  });
  test('les régions avec stock sont triées par mois décroissants', () => {
    const w = out.filter(r => !r.noStock).map(r => r.monthsOfCoverage);
    assert.deepEqual(w, [...w].sort((x, y) => y - x));
  });
  test('l’année d’épuisement vient de simulate()', () => {
    for (const r of out.filter(x => !x.noStock)) {
      const rb = real.regions.find(x => x.id === r.id);
      const sim = B.simulate(rb, realBulletin, basinOf(real, rb), { hydrology: 'normal', startYear: 2026, rainChangePct: 0 }, 10);
      assert.equal(r.depletionYear, sim.find(p => p.depleted)?.year ?? null);
    }
  });
  test('sous tension seulement si un critère affiché est vrai (jamais « confortable » sans épuisement)', () => {
    assert.ok(B.TENSION_CRITERIA.length === 3);
    for (const r of out) {
      if (!r.noStock && r.band === 'confortable' && r.depletionYear == null) assert.equal(r.stressed, false, r.id);
      if (r.stressed) assert.ok(r.reasons.length > 0);
      if (!r.noStock && r.band !== 'confortable') assert.ok(r.stressed && r.reasons.some(x => /mois de couverture/.test(x)), r.id);
      if (r.depletionYear != null) assert.ok(r.reasons.some(x => x.includes(String(r.depletionYear))), r.id);
    }
  });
});
describe('indicateur de flux (Sahara marocain, régions sans barrage rattaché)', { skip: real ? false : 'fichier absent' }, () => {
  const get = id => real.regions.find(x => x.id === id);
  const la = get('laayoune-sakia-el-hamra'), da = get('dakhla-oued-ed-dahab');
  const a = { year: 2026 };
  test('bandes : seuils 30 % et 80 %, null sans ratio', () => {
    assert.equal(B.fluxBandFor(0.79), 'mixte');
    assert.equal(B.fluxBandFor(0.8), 'dominant');
    assert.equal(B.fluxBandFor(0.3), 'mixte');
    assert.equal(B.fluxBandFor(0.29), 'faible');
    assert.equal(B.fluxBandFor(null), null);
  });
  test('Laâyoune : dessalement dominant, valeur de carte kind flux, aucun stock ni mois', () => {
    const f = B.desalFlux(la, a);
    assert.equal(f.band, 'dominant');
    assert.ok(f.coveragePct > 80 && f.coveragePct <= 100);
    assert.equal(f.groundwater, 'non modélisé');
    const m = B.fluxMetric(la, a);
    assert.equal(m.kind, 'flux'); assert.equal(m.band, 'dominant');
    assert.equal(B.coverage(la, realBulletin).monthsOfCoverage, null);
  });
  test('Dakhla : valeur du jour limitée à la capacité en service (bande faible), projets seulement en fourchette « après chantiers »', () => {
    const f = B.desalFlux(da, a);
    assert.equal(f.band, 'faible');
    assert.ok(f.coveragePct < 5);
    assert.ok(f.nonDesalShare > 0.95);
    assert.ok(f.afterBuilding.low < f.afterBuilding.high);
    assert.ok(f.afterBuilding.low > f.ratio);
    assert.equal(B.fluxMetric(da, a).band, 'faible');
  });
  test('le curseur de dessalement relève l’indicateur ; la demande croissante l’abaisse', () => {
    assert.ok(B.desalFlux(da, { year: 2026, addedDesalMm3: 5 }).ratio > B.desalFlux(da, a).ratio);
    assert.ok(B.desalFlux(la, { year: 2036 }).ratio < B.desalFlux(la, { year: 2026 }).ratio);
  });
  test('classement : les régions de flux restent après les régions à stock, sans rang, avec flux', () => {
    const out = B.rankingOutlook(real.regions, realBulletin, real.basins, { assumptions: a, scenarioFor: () => ({ hydrology: 'normal', startYear: 2026 }), years: 10 });
    const flux = out.filter(r => r.noStock);
    assert.deepEqual(flux.map(r => r.id).sort(), ['dakhla-oued-ed-dahab', 'laayoune-sakia-el-hamra']);
    assert.ok(flux.every(r => r.rank == null && r.flux && r.flux.band));
    assert.ok(out.filter(r => !r.noStock).every(r => r.flux === null));
    assert.ok(out.slice(0, out.length - flux.length).every(r => !r.noStock));
  });
  test('contexte documentaire : sources http, aucune capacité de barrage comptée en stock', () => {
    assert.equal(la.fluxContext.surfaceWorks[0].countedInStock, false);
    assert.match(la.fluxContext.surfaceWorks[0].source, /^https?:\/\//);
    assert.deepEqual(la.basinShares, []);
    assert.equal(la.groundwater, null);
  });
  test('explainFlux : mentionne nappes non modélisées et « pas un stock »', () => {
    const t = B.explainFlux(B.desalFlux(da, a)).join(' ');
    assert.match(t, /non modélisées/); assert.match(t, /pas un stock/);
  });
});
