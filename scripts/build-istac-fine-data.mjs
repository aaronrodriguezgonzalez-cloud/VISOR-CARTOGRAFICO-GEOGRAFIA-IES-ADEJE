#!/usr/bin/env node
/**
 * ANAMBRO · Generador local de Entidades y Núcleos ISTAC 2025
 *
 * Fuentes oficiales:
 * - Cubo ISTAC:E30243A_000022 (población por sexo y edad, 01/01/2025)
 * - Clasificación ISTAC:CL_AREA_ES70_EN_20250101
 *
 * Salida:
 * - data/istac_entidades_2025.json
 * - data/istac_nucleos_2025.json
 *
 * No requiere dependencias externas (Node 20+).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const DATASET_JSONSTAT = 'https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/datasets/ISTAC/E30243A_000022/1.0.jsonstat';
const DATASET_JSON = 'https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/datasets/ISTAC/E30243A_000022/1.0.json';
const CLASS_BASE = 'https://datos.canarias.es/api/estadisticas/structural-resources/v1.0/codelists/ISTAC/CL_AREA_ES70_EN_20250101/01.000/codes.json';
const OUTPUT_DIR = new URL('../data/', import.meta.url);
const REFERENCE_DATE = '2025-01-01';
const PAGE_LIMIT = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, { attempts = 5, timeoutMs = 10 * 60_000 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout ${timeoutMs} ms`)), timeoutMs);
    try {
      console.log(`[ISTAC] GET ${url} (intento ${attempt}/${attempts})`);
      const res = await fetch(url, {
        headers: { 'accept': 'application/json, application/vnd.sdmx.data+json;q=0.9, */*;q=0.1' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      if (!text.trim()) throw new Error('respuesta vacía');
      return JSON.parse(text);
    } catch (err) {
      last = err;
      console.warn(`[ISTAC] Fallo: ${err?.message || err}`);
      if (attempt < attempts) await sleep(Math.min(30_000, 1500 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

function textOf(x) {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (Array.isArray(x)) {
    const es = x.find(v => String(v?.lang || v?.language || '').toLowerCase().startsWith('es'));
    return textOf(es || x.find(Boolean));
  }
  if (typeof x === 'object') {
    return textOf(x.value ?? x.name ?? x.label ?? x.title ?? x.text ?? x.id ?? '');
  }
  return '';
}

function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function refId(v) {
  if (v == null) return '';
  if (typeof v === 'object') return refId(v.id ?? v.code ?? v.value ?? v.urn ?? v.href ?? v.selfLink?.href ?? v.selfLink ?? '');
  let s = String(v).trim();
  if (!s) return '';
  try { s = decodeURIComponent(s); } catch {}
  const urn = s.match(/CL_AREA_ES70_EN_20250101\([^)]*\)\.([^\s?#]+)/i);
  if (urn) return urn[1];
  const url = s.match(/\/codes\/([^/?#]+)(?:[/?#]|$)/i);
  if (url) return url[1];
  return s.replace(/^.*\)\./, '').replace(/^.*\/codes\//, '').trim();
}

function parentId(o) {
  const p = o?.parent ?? o?.parentCode ?? o?.parentId ?? o?.visualisationParent ?? o?.visualizationParent ?? o?.hierarchyParent ?? o?.parentRef ?? '';
  return refId(p?.urn ?? p?.id ?? p?.code ?? p?.href ?? p);
}

function codeName(o) {
  return textOf(o?.name ?? o?.label ?? o?.title ?? o?.description ?? o?.id ?? '').trim();
}

function extractCodeObjects(payload) {
  const out = [];
  const seen = new Set();
  function walk(v) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const urn = String(v.urn || '');
    const kind = String(v.kind || '');
    if (v.id && (kind === 'structuralResources#code' || /infomodel\.codelist\.Code=/i.test(urn))) {
      out.push(v);
      return;
    }
    for (const [k, x] of Object.entries(v)) {
      if (/^(?:nextLink|next|previousLink|selfLink)$/i.test(k)) continue;
      if (x && typeof x === 'object') walk(x);
    }
  }
  walk(payload);
  return out;
}

function discoverTotal(payload) {
  const candidates = [
    payload?.total,
    payload?.codes?.total,
    payload?.code?.total,
    payload?.pagination?.total,
    payload?.metadata?.total,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

async function fetchAllClassificationCodes() {
  const all = [];
  const ids = new Set();
  let offset = 0;
  let knownTotal = null;
  for (let pageNo = 0; pageNo < 200; pageNo++) {
    const u = new URL(CLASS_BASE);
    u.searchParams.set('limit', String(PAGE_LIMIT));
    u.searchParams.set('offset', String(offset));
    u.searchParams.set('fields', '+description');
    const json = await fetchJson(u.href, { timeoutMs: 2 * 60_000 });
    const page = extractCodeObjects(json);
    if (knownTotal == null) knownTotal = discoverTotal(json);
    let added = 0;
    for (const o of page) {
      const id = refId(o.id ?? o.code ?? o.urn ?? o.selfLink?.href);
      if (id && !ids.has(id)) { ids.add(id); all.push(o); added++; }
    }
    console.log(`[ISTAC] Clasificación: página ${pageNo + 1}, ${page.length} objetos, ${all.length} únicos${knownTotal != null ? ` / ${knownTotal}` : ''}`);
    if (!page.length || !added) break;
    const direct = json?.codes?.code ?? json?.code ?? json?.items ?? json?.results ?? [];
    const directCount = Array.isArray(direct) ? direct.length : 0;
    const step = directCount || Math.min(PAGE_LIMIT, Math.max(1, page.length));
    offset += step;
    if (knownTotal != null && offset >= knownTotal) break;
  }
  if (all.length < 100) throw new Error(`Clasificación territorial incompleta: solo ${all.length} códigos`);
  return all;
}

function municipalityId(v) {
  const s = String(v ?? '').trim();
  const d = s.replace(/\D/g, '');
  if (/^(35|38)\d{3}$/.test(d)) return d;
  const m = s.match(/(?:^|[_\-.])((?:35|38)\d{3})(?:$|[_\-.])/);
  if (m) return m[1];
  const m2 = d.match(/((?:35|38)\d{3})$/);
  return m2 ? m2[1] : '';
}

function buildClassification(rawCodes) {
  const byId = new Map();
  for (const o of rawCodes) {
    const id = refId(o.id ?? o.code ?? o.urn ?? o.selfLink?.href);
    if (!id || byId.has(id)) continue;
    const granularity = String(o?.geographicGranularity?.id ?? o?.geographicGranularity?.code ?? o?.granularity?.id ?? '').toUpperCase();
    byId.set(id, { id, name: codeName(o) || id, parentId: parentId(o), granularity, raw: o, level: '' });
  }

  function ancestors(rec) {
    const out = [];
    let cur = rec;
    for (let i = 0; cur?.parentId && i < 12; i++) {
      cur = byId.get(cur.parentId);
      if (!cur) break;
      out.push(cur);
    }
    return out;
  }

  function levelOf(rec) {
    const g = rec.granularity || '';
    if (/MUNICIP/.test(g)) return 'municipality';
    if (/ENTIT/.test(g)) return 'entity';
    if (/NUCLE|NUCLEI|NUCLEUS/.test(g)) return 'nucleus';
    if (municipalityId(rec.id)) return 'municipality';
    const a = ancestors(rec);
    if (a[0] && municipalityId(a[0].id)) return 'entity';
    if (a[1] && municipalityId(a[1].id)) return 'nucleus';
    const id = String(rec.id || '');
    if (/(?:^|_)E\d+(?:$|_)/i.test(id) && /(?:^|_)N\d+(?:$|_)/i.test(id)) return 'nucleus';
    if (/(?:^|_)E\d+(?:$|_)/i.test(id)) return 'entity';
    return '';
  }

  for (const rec of byId.values()) rec.level = levelOf(rec);

  function ancestorAt(rec, level) {
    if (rec?.level === level) return rec;
    for (const a of ancestors(rec)) if (a.level === level || (level === 'municipality' && municipalityId(a.id))) return a;
    return null;
  }

  const counts = { municipality: 0, entity: 0, nucleus: 0 };
  for (const rec of byId.values()) if (counts[rec.level] !== undefined) counts[rec.level]++;
  if (!counts.entity || !counts.nucleus) throw new Error(`No se reconstruyeron Entidades/Núcleos (${counts.entity}/${counts.nucleus})`);
  console.log('[ISTAC] Niveles clasificación:', counts);
  return { byId, counts, ancestors, ancestorAt };
}

function dimensionCodes(dim) {
  const cat = dim?.category || dim?.representation?.category || {};
  const idx = cat?.index ?? dim?.index;
  if (Array.isArray(idx)) return idx.map(String);
  if (idx && typeof idx === 'object') return Object.entries(idx).sort((a,b) => Number(a[1]) - Number(b[1])).map(([k]) => String(k));
  const reps = dim?.representation?.representations || dim?.representations || dim?.values || dim?.items;
  if (Array.isArray(reps)) return reps.map(x => String(x?.code ?? x?.id ?? x?.value ?? '')).filter(Boolean);
  return [];
}

function dimensionLabels(dim) {
  const out = new Map();
  const cat = dim?.category || dim?.representation?.category || {};
  const lab = cat?.label ?? dim?.label;
  if (lab && typeof lab === 'object' && !Array.isArray(lab)) {
    for (const [k, v] of Object.entries(lab)) out.set(String(k), textOf(v) || String(k));
  }
  const reps = dim?.representation?.representations || dim?.representations || dim?.values || dim?.items;
  if (Array.isArray(reps)) for (const x of reps) {
    const c = String(x?.code ?? x?.id ?? x?.value ?? '');
    if (c) out.set(c, textOf(x?.name ?? x?.label ?? x?.title ?? c) || c);
  }
  return out;
}

function dimensionKey(keys, target) {
  const t = target.toUpperCase();
  const exact = keys.find(k => String(k).toUpperCase() === t);
  if (exact) return exact;
  const rx = t === 'GEOGRAPHICAL' ? /(GEOGRAPH|GEO|TERRIT|LUGAR|RESID|MUNICIP|AREA)/i
    : t === 'TIME' ? /(TIME|PERIOD|YEAR|ANO|AÑO|TIEMPO)/i
    : /(MEASURE|MEDIDA|INDICADOR|MAGNITUD)/i;
  return keys.find(k => rx.test(String(k))) || '';
}

function observationEntries(obs) {
  if (Array.isArray(obs)) return obs.entries();
  if (obs && typeof obs === 'object') {
    return Object.entries(obs)
      .map(([k,v]) => [Number(k),v])
      .filter(([i]) => Number.isInteger(i) && i >= 0)
      .sort((a,b) => a[0]-b[0])[Symbol.iterator]();
  }
  return [][Symbol.iterator]();
}

function tupleText(tuple) {
  return normalize(Object.entries(tuple || {}).map(([k,v]) => `${k} ${v?.code || ''} ${v?.label || ''}`).join(' | '));
}

const INDICATORS = [
  { key: 'population', kind: 'total', name: 'Población total' },
  { key: 'men', kind: 'men', name: 'Población · hombres' },
  { key: 'women', kind: 'women', name: 'Población · mujeres' },
  { key: 'age_0_14', kind: 'age', min: 0, max: 14, name: 'Población · de 0 a 14 años' },
  { key: 'age_15_64', kind: 'age', min: 15, max: 64, name: 'Población · de 15 a 64 años' },
  { key: 'age_65_plus', kind: 'age', min: 65, max: Infinity, name: 'Población · 65 años y más' },
];

function rowMatches(text, item) {
  const t = text;
  const sexSpecific = /\bhombre\b|\bhombres\b|\bmujer\b|\bmujeres\b|\bvaron\b|\bvarones\b|\bmale\b|\bfemale\b/.test(t);
  const ageRange = t.match(/\b(\d{1,3})\s*(?:a|-|–)\s*(\d{1,3})\b/);
  const agePlus = t.match(/\b(\d{1,3})\s*(?:y|o)?\s*mas\b/);
  if (item.kind === 'total') return !sexSpecific && !ageRange && !agePlus;
  if (item.kind === 'men') return /\bhombre\b|\bhombres\b|\bvaron\b|\bvarones\b|\bmale\b/.test(t) && !ageRange && !agePlus;
  if (item.kind === 'women') return /\bmujer\b|\bmujeres\b|\bfemale\b/.test(t) && !ageRange && !agePlus;
  if (item.kind === 'age') {
    if (sexSpecific) return false;
    if (ageRange) {
      const a = Number(ageRange[1]), b = Number(ageRange[2]);
      return a >= item.min && b <= item.max;
    }
    if (item.max === Infinity && agePlus) return Number(agePlus[1]) >= item.min;
  }
  return false;
}

function makeUnitRecord(rec, cls) {
  const mun = cls.ancestorAt(rec, 'municipality');
  const ent = cls.ancestorAt(rec, 'entity');
  return {
    id: rec.id,
    name: rec.name,
    level: rec.level,
    municipalityCode: mun?.id || '',
    municipality: mun?.name || '',
    entityId: rec.level === 'entity' ? rec.id : (ent?.id || ''),
    entity: rec.level === 'entity' ? rec.name : (ent?.name || ''),
    parentId: rec.parentId || '',
    values: Object.fromEntries(INDICATORS.map(i => [i.key, null])),
  };
}

function aggregateObservation(unit, text, value) {
  for (const item of INDICATORS) {
    if (!rowMatches(text, item)) continue;
    const old = unit.values[item.key];
    unit.values[item.key] = (old == null ? 0 : old) + value;
  }
}

function finalizeUnit(unit) {
  // Fallbacks coherentes si el cubo no trae explícitamente el total en alguna combinación.
  if (unit.values.population == null && unit.values.men != null && unit.values.women != null) {
    unit.values.population = unit.values.men + unit.values.women;
  }
  if (unit.values.population == null && unit.values.age_0_14 != null && unit.values.age_15_64 != null && unit.values.age_65_plus != null) {
    unit.values.population = unit.values.age_0_14 + unit.values.age_15_64 + unit.values.age_65_plus;
  }
  for (const k of Object.keys(unit.values)) {
    const v = unit.values[k];
    if (v != null && (!Number.isFinite(v) || v < 0)) unit.values[k] = null;
  }
  return unit;
}

function aggregateJsonStat(json, cls) {
  const jd = (json.dimension || json.dimensions) ? json : (json.data && (json.data.dimension || json.data.dimensions) ? json.data : null);
  if (!jd) throw new Error('El cubo no parece JSON-stat');
  const dims = jd.dimension || jd.dimensions;
  if (!dims || typeof dims !== 'object' || Array.isArray(dims) || Array.isArray(dims?.dimension)) throw new Error('Dimensiones JSON-stat no reconocidas');
  const keys = Array.isArray(jd.id) && jd.id.length ? jd.id.map(String) : Object.keys(dims);
  const geoKey = dimensionKey(keys, 'GEOGRAPHICAL');
  const timeKey = dimensionKey(keys, 'TIME');
  if (!geoKey) throw new Error(`No se encontró dimensión geográfica. Dimensiones: ${keys.join(', ')}`);
  if (!timeKey) throw new Error(`No se encontró dimensión temporal. Dimensiones: ${keys.join(', ')}`);
  const codes = keys.map(k => dimensionCodes(dims[k]));
  const labels = keys.map(k => dimensionLabels(dims[k]));
  const sizes = codes.map((a,i) => a.length || Number(jd.size?.[i]) || 1);
  if (sizes.some(x => !Number.isFinite(x) || x < 1)) throw new Error('Tamaños de dimensión inválidos');
  const geoIndex = keys.indexOf(geoKey), timeIndex = keys.indexOf(timeKey);
  const entityUnits = new Map();
  const nucleusUnits = new Map();
  for (const rec of cls.byId.values()) {
    if (rec.level === 'entity') entityUnits.set(rec.id, makeUnitRecord(rec, cls));
    else if (rec.level === 'nucleus') nucleusUnits.set(rec.id, makeUnitRecord(rec, cls));
  }

  let numeric = 0, used = 0;
  const obs = jd.observation ?? jd.observations ?? jd.value;
  for (const [flat, raw0] of observationEntries(obs)) {
    const raw = raw0 && typeof raw0 === 'object' ? (raw0.value ?? raw0.obsValue) : raw0;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    numeric++;
    let rem = Number(flat), tuple = {};
    for (let i = keys.length - 1; i >= 0; i--) {
      const size = sizes[i], ix = rem % size; rem = Math.floor(rem / size);
      const c = codes[i][ix] ?? String(ix);
      tuple[keys[i]] = { code: String(c), label: labels[i].get(String(c)) || String(c) };
    }
    const time = tuple[timeKey] || {};
    if (!String(time.code || time.label || '').includes('2025')) continue;
    const geo = tuple[geoKey] || {};
    const geoId = refId(geo.code || '');
    const rec = cls.byId.get(geoId);
    if (!rec || (rec.level !== 'entity' && rec.level !== 'nucleus')) continue;
    const unit = rec.level === 'entity' ? entityUnits.get(rec.id) : nucleusUnits.get(rec.id);
    if (!unit) continue;
    aggregateObservation(unit, tupleText(tuple), value);
    used++;
  }
  console.log(`[ISTAC] Observaciones numéricas ${numeric}; observaciones finas 2025 consideradas ${used}`);
  return {
    entity: [...entityUnits.values()].map(finalizeUnit),
    nucleus: [...nucleusUnits.values()].map(finalizeUnit),
    dimensions: keys,
  };
}

function legacyCodes(d) {
  let reps = d?.representations?.representation ?? d?.representation ?? d?.values ?? d?.value ?? [];
  if (reps && typeof reps === 'object' && !Array.isArray(reps) && Array.isArray(reps.code)) return reps.code.map(String);
  if (Array.isArray(reps) && reps.length === 1 && reps[0] && Array.isArray(reps[0].code)) return reps[0].code.map(String);
  if (Array.isArray(reps)) {
    const out = [];
    for (const r of reps) {
      if (r && Array.isArray(r.code)) out.push(...r.code.map(String));
      else { const c = r?.code ?? r?.id ?? r?.value; if (c != null) out.push(String(c)); }
    }
    if (out.length) return out;
  }
  if (Array.isArray(d?.codes)) return d.codes.map(String);
  return [];
}

function aggregateNative(json, cls) {
  const data = json?.data && typeof json.data === 'object' ? json.data : json;
  let dimList = data?.dimensions?.dimension;
  if (dimList && !Array.isArray(dimList)) dimList = [dimList];
  const obsRaw = data?.observations ?? data?.observation;
  if (!Array.isArray(dimList) || !dimList.length || obsRaw === undefined) throw new Error('Formato nativo ISTAC no reconocido');
  const keys = dimList.map((d,i) => String(d?.dimensionId ?? d?.id ?? d?.code ?? `DIM_${i}`));
  const geoKey = dimensionKey(keys, 'GEOGRAPHICAL'), timeKey = dimensionKey(keys, 'TIME');
  if (!geoKey || !timeKey) throw new Error(`Dimensiones nativas incompletas: ${keys.join(', ')}`);
  const codes = dimList.map(legacyCodes);
  if (codes.some(a => !a.length)) throw new Error('Alguna dimensión nativa no tiene códigos');

  const labelMaps = new Map();
  let metaDims = json?.metadata?.dimensions?.dimension ?? json?.metadata?.dimension ?? [];
  if (metaDims && !Array.isArray(metaDims)) metaDims = [metaDims];
  for (const md of metaDims) {
    const key = String(md?.id ?? md?.dimensionId ?? md?.code ?? ''); if (!key) continue;
    let vals = md?.dimensionValues?.value ?? md?.values?.value ?? md?.values ?? [];
    if (vals && !Array.isArray(vals)) vals = [vals];
    const mp = new Map();
    for (const v of vals) {
      const c = String(v?.id ?? v?.code ?? v?.value ?? ''); if (!c) continue;
      const lab = textOf(v?.text?.text ?? v?.text ?? v?.name ?? v?.label ?? v?.title ?? c) || c;
      mp.set(c, lab);
    }
    labelMaps.set(key, mp);
  }

  let obs = [];
  if (typeof obsRaw === 'string') obs = obsRaw.split('|');
  else if (Array.isArray(obsRaw)) obs = obsRaw;
  else if (obsRaw && typeof obsRaw === 'object') obs = Object.keys(obsRaw).sort((a,b) => +a - +b).map(k => obsRaw[k]);
  const sizes = codes.map(a => a.length);
  const expected = sizes.reduce((a,b) => a*b, 1), n = Math.min(obs.length, expected);

  const entityUnits = new Map(), nucleusUnits = new Map();
  for (const rec of cls.byId.values()) {
    if (rec.level === 'entity') entityUnits.set(rec.id, makeUnitRecord(rec, cls));
    else if (rec.level === 'nucleus') nucleusUnits.set(rec.id, makeUnitRecord(rec, cls));
  }
  let used = 0;
  for (let flat = 0; flat < n; flat++) {
    const raw0 = obs[flat], raw = raw0 && typeof raw0 === 'object' ? (raw0.value ?? raw0.obsValue) : raw0;
    if (raw == null || raw === '' || String(raw).toLowerCase() === 'nan') continue;
    const value = Number(raw); if (!Number.isFinite(value)) continue;
    let rem = flat, tuple = {};
    for (let i = keys.length - 1; i >= 0; i--) {
      const size = sizes[i], ix = rem % size; rem = Math.floor(rem / size);
      const c = codes[i][ix] ?? String(ix), mp = labelMaps.get(keys[i]);
      tuple[keys[i]] = { code: String(c), label: mp?.get(String(c)) || String(c) };
    }
    const time = tuple[timeKey] || {};
    if (!String(time.code || time.label || '').includes('2025')) continue;
    const geo = tuple[geoKey] || {}, rec = cls.byId.get(refId(geo.code || ''));
    if (!rec || (rec.level !== 'entity' && rec.level !== 'nucleus')) continue;
    const unit = rec.level === 'entity' ? entityUnits.get(rec.id) : nucleusUnits.get(rec.id);
    aggregateObservation(unit, tupleText(tuple), value); used++;
  }
  console.log(`[ISTAC] Observaciones finas 2025 consideradas (nativo): ${used}`);
  return { entity: [...entityUnits.values()].map(finalizeUnit), nucleus: [...nucleusUnits.values()].map(finalizeUnit), dimensions: keys };
}

function countValues(units, key) { return units.reduce((n,u) => n + (u.values[key] != null ? 1 : 0), 0); }

function validateOutput(level, units) {
  if (!units.length) throw new Error(`Salida ${level} vacía`);
  const populated = countValues(units, 'population');
  if (!populated) throw new Error(`Salida ${level} sin población`);
  console.log(`[ANAMBRO] ${level}: ${units.length} unidades; población en ${populated}; hombres ${countValues(units,'men')}; mujeres ${countValues(units,'women')}; 0-14 ${countValues(units,'age_0_14')}; 15-64 ${countValues(units,'age_15_64')}; 65+ ${countValues(units,'age_65_plus')}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const rawCodes = await fetchAllClassificationCodes();
  const cls = buildClassification(rawCodes);

  let cube, format;
  try {
    cube = await fetchJson(DATASET_JSONSTAT, { timeoutMs: 10 * 60_000 });
    format = 'jsonstat';
  } catch (e) {
    console.warn(`[ISTAC] JSONSTAT falló; probando JSON nativo: ${e?.message || e}`);
    cube = await fetchJson(DATASET_JSON, { timeoutMs: 10 * 60_000 });
    format = 'native';
  }

  let agg;
  try { agg = aggregateJsonStat(cube, cls); format = 'jsonstat'; }
  catch (e) {
    console.warn(`[ANAMBRO] No se pudo decodificar como JSON-stat: ${e?.message || e}`);
    agg = aggregateNative(cube, cls); format = 'native';
  }

  validateOutput('entity', agg.entity);
  validateOutput('nucleus', agg.nucleus);

  const common = {
    schema: 'anambro-istac-fine-v2',
    generatedAt: new Date().toISOString(),
    referenceDate: REFERENCE_DATE,
    indicators: Object.fromEntries(INDICATORS.map(i => [i.key, { name: i.name, unit: 'habitantes' }])),
    source: {
      publisher: 'Instituto Canario de Estadística (ISTAC)',
      dataset: 'ISTAC:E30243A_000022',
      datasetUrl: DATASET_JSONSTAT,
      classification: 'ISTAC:CL_AREA_ES70_EN_20250101',
      classificationUrl: CLASS_BASE,
      downloadedFormat: format,
    },
  };

  const entityDoc = { ...common, level: 'entity', unitCount: agg.entity.length, units: agg.entity };
  const nucleusDoc = { ...common, level: 'nucleus', unitCount: agg.nucleus.length, units: agg.nucleus };

  await writeFile(new URL('istac_entidades_2025.json', OUTPUT_DIR), JSON.stringify(entityDoc));
  await writeFile(new URL('istac_nucleos_2025.json', OUTPUT_DIR), JSON.stringify(nucleusDoc));
  console.log('[ANAMBRO] Datos locales escritos en data/istac_entidades_2025.json y data/istac_nucleos_2025.json');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
