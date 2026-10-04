#!/usr/bin/env node
/**
 * ANAMBRO · Extracción de polígonos oficiales ISTAC de Entidades y Núcleos
 *
 * Descubre y descarga geometrías vectoriales desde servicios oficiales ISTAC.
 * Prioridad:
 *   1) GeoServer Indicadores demográficos (capas más recientes)
 *   2) GeoServer Cartografía Estadística Básica IGR-00080
 *   3) Catálogo CKAN ISTAC (recurso GeoJSON/WFS no turístico)
 *
 * Salida:
 *   data/istac_entidades_poligonos.geojson
 *   data/istac_nucleos_poligonos.geojson
 *   data/istac_poligonos_fuentes.json
 *
 * No requiere dependencias externas. Node 20+.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

const OUT_DIR = new URL('../data/', import.meta.url);
const WFS_SERVICES = [
  {
    id: 'indicadoresdemograficos',
    label: 'ISTAC · Indicadores demográficos',
    url: 'https://datos.canarias.es/api/estadisticas/geographical-resources/indicadoresdemograficos/ows',
  },
  {
    id: 'IGR-00080',
    label: 'ISTAC · Cartografía Estadística Básica IGR-00080',
    url: 'https://datos.canarias.es/api/estadisticas/geographical-resources/IGR-00080/wfs',
  },
];
const CKAN_API = 'https://datos.canarias.es/catalogos/estadisticas/api/3/action/package_search';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function decodeXml(s) {
  return String(s ?? '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function fetchText(url, { attempts = 5, timeoutMs = 180_000, accept = '*/*' } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error(`timeout ${timeoutMs} ms`)), timeoutMs);
    try {
      console.log(`[ISTAC] GET ${url} (intento ${attempt}/${attempts})`);
      const res = await fetch(url, {
        headers: {
          accept,
          'user-agent': 'ANAMBRO/0.16 (+https://github.com/)'
        },
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const txt = await res.text();
      if (!txt.trim()) throw new Error('respuesta vacía');
      return txt;
    } catch (e) {
      last = e;
      console.warn(`[ISTAC] ${e?.message || e}`);
      if (attempt < attempts) await sleep(Math.min(15000, 1200 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, accept: 'application/geo+json, application/json, */*;q=0.1' });
  try { return JSON.parse(text); }
  catch (e) {
    throw new Error(`Respuesta no JSON (${text.slice(0, 160).replace(/\s+/g, ' ')})`);
  }
}

function capabilitiesUrl(base) {
  const u = new URL(base);
  u.searchParams.set('service', 'WFS');
  u.searchParams.set('request', 'GetCapabilities');
  return u.href;
}

function parseFeatureTypes(xml, service) {
  const out = [];
  const blocks = xml.match(/<(?:\w+:)?FeatureType\b[\s\S]*?<\/(?:\w+:)?FeatureType>/gi) || [];
  for (const b of blocks) {
    const name = decodeXml((b.match(/<(?:\w+:)?Name>([\s\S]*?)<\/(?:\w+:)?Name>/i) || [])[1]);
    const title = decodeXml((b.match(/<(?:\w+:)?Title>([\s\S]*?)<\/(?:\w+:)?Title>/i) || [])[1]);
    const abstract = decodeXml((b.match(/<(?:\w+:)?Abstract>([\s\S]*?)<\/(?:\w+:)?Abstract>/i) || [])[1]);
    if (name) out.push({ name, title: title || name, abstract, service });
  }
  return out;
}

function levelScore(ft, level) {
  const text = norm(`${ft.name} ${ft.title} ${ft.abstract}`);
  const isEntity = /\bentidad(?:es)?\b/.test(text) || /\bentidad singular/.test(text);
  const isNucleus = /\bnucle(?:o|os)\b/.test(text);
  if (level === 'entity' && !isEntity) return -Infinity;
  if (level === 'nucleus' && !isNucleus) return -Infinity;
  if (/turistic|microdest|alojamiento|hotel/.test(text)) return -Infinity;

  let score = 0;
  if (/poblacion/.test(text)) score += 80;
  if (/20250101|2025/.test(text)) score += 1000;
  else if (/20240101|2024/.test(text)) score += 750;
  else if (/2023/.test(text)) score += 400;
  else if (/2001/.test(text)) score += 80;
  if (/generaliz/.test(text)) score -= 120;
  if (ft.service.id === 'indicadoresdemograficos') score += 120;
  if (ft.service.id === 'IGR-00080') score += 40;
  if (level === 'entity' && /entidad singular/.test(text)) score += 120;
  if (level === 'nucleus' && /nucleos? de poblacion/.test(text)) score += 120;
  return score;
}

async function discoverWfsLayers() {
  const all = [];
  for (const service of WFS_SERVICES) {
    try {
      const xml = await fetchText(capabilitiesUrl(service.url), { timeoutMs: 120_000 });
      const types = parseFeatureTypes(xml, service);
      console.log(`[ISTAC] ${service.label}: ${types.length} FeatureTypes.`);
      all.push(...types);
    } catch (e) {
      console.warn(`[ISTAC] No se pudo leer GetCapabilities de ${service.label}: ${e?.message || e}`);
    }
  }
  return all;
}

function chooseLayer(all, level) {
  const ranked = all.map(ft => ({ ...ft, score: levelScore(ft, level) }))
    .filter(x => Number.isFinite(x.score))
    .sort((a,b) => b.score - a.score);
  console.log(`[ISTAC] Candidatos ${level}:`, ranked.slice(0, 12).map(x => ({ score: x.score, service: x.service.id, name: x.name, title: x.title })));
  return ranked[0] || null;
}

function wfsGeoJsonUrls(ft) {
  const variants = [];
  for (const version of ['1.1.0', '2.0.0', '1.0.0']) {
    for (const outputFormat of ['application/json', 'application/json; subtype=geojson', 'json']) {
      const u = new URL(ft.service.url);
      u.searchParams.set('service', 'WFS');
      u.searchParams.set('version', version);
      u.searchParams.set('request', 'GetFeature');
      u.searchParams.set('typeName', ft.name);
      u.searchParams.set('srsName', 'EPSG:4326');
      u.searchParams.set('outputFormat', outputFormat);
      variants.push(u.href);
    }
  }
  return variants;
}

function validFeatureCollection(json) {
  return json && json.type === 'FeatureCollection' && Array.isArray(json.features) && json.features.length > 0;
}

function countPolygonal(fc) {
  return fc.features.filter(f => /^(?:Multi)?Polygon$/i.test(f?.geometry?.type || '')).length;
}

async function downloadWfsGeoJson(ft) {
  let last;
  for (const url of wfsGeoJsonUrls(ft)) {
    try {
      const json = await fetchJson(url, { attempts: 2, timeoutMs: 8 * 60_000 });
      if (!validFeatureCollection(json)) throw new Error('no es FeatureCollection o está vacío');
      const poly = countPolygonal(json);
      if (!poly) throw new Error('FeatureCollection sin polígonos');
      console.log(`[ISTAC] ${ft.name}: ${json.features.length} features, ${poly} poligonales.`);
      return { geojson: json, url };
    } catch (e) {
      last = e;
      console.warn(`[ISTAC] GetFeature falló para ${ft.name}: ${e?.message || e}`);
    }
  }
  throw last || new Error(`No se pudo descargar ${ft.name}`);
}

async function ckanSearch(q) {
  const u = new URL(CKAN_API);
  u.searchParams.set('q', q);
  u.searchParams.set('rows', '100');
  const json = await fetchJson(u.href, { timeoutMs: 120_000 });
  return json?.result?.results || [];
}

function ckanResourceCandidates(packages, level) {
  const want = level === 'entity' ? /entidad/ : /nucle/;
  const out = [];
  for (const p of packages) {
    const ptext = norm(`${p.title || ''} ${p.name || ''} ${p.notes || ''}`);
    if (!want.test(ptext) || /turistic|microdest|alojamiento|hotel/.test(ptext)) continue;
    for (const r of p.resources || []) {
      const fmt = norm(r.format || r.mimetype || '');
      const rtext = norm(`${r.name || ''} ${r.description || ''} ${r.url || ''}`);
      if (!/(geojson|json|wfs)/.test(`${fmt} ${rtext}`)) continue;
      let score = 0;
      if (/geojson/.test(`${fmt} ${rtext}`)) score += 500;
      if (/wfs/.test(`${fmt} ${rtext}`)) score += 300;
      if (/2025/.test(`${ptext} ${rtext}`)) score += 1000;
      if (/cartograf|delimitacion|territorial/.test(`${ptext} ${rtext}`)) score += 300;
      if (/generaliz/.test(rtext)) score -= 100;
      out.push({ score, packageTitle: p.title, resource: r });
    }
  }
  return out.sort((a,b) => b.score - a.score);
}

async function downloadCkanFallback(level) {
  const queries = level === 'entity'
    ? ['entidades poblacion cartografia', 'entidades singulares delimitaciones territoriales', 'entidades poblacion']
    : ['nucleos poblacion cartografia', 'nucleos delimitaciones territoriales', 'nucleos poblacion'];
  const packs = [];
  const seen = new Set();
  for (const q of queries) {
    try {
      for (const p of await ckanSearch(q)) {
        if (!seen.has(p.id)) { seen.add(p.id); packs.push(p); }
      }
    } catch (e) {
      console.warn(`[ISTAC] CKAN ${q}: ${e?.message || e}`);
    }
  }
  const candidates = ckanResourceCandidates(packs, level);
  console.log(`[ISTAC] CKAN candidatos ${level}:`, candidates.slice(0, 10).map(x => ({ score: x.score, package: x.packageTitle, resource: x.resource?.name, format: x.resource?.format, url: x.resource?.url })));
  for (const c of candidates) {
    const url = c.resource?.url;
    if (!url) continue;
    try {
      if (/service=wfs|request=getfeature/i.test(url) || /\/wfs\?/i.test(url)) {
        const u = new URL(url);
        u.searchParams.set('outputFormat', 'application/json');
        u.searchParams.set('srsName', 'EPSG:4326');
        const json = await fetchJson(u.href, { attempts: 2, timeoutMs: 8 * 60_000 });
        if (validFeatureCollection(json) && countPolygonal(json)) return { geojson: json, url: u.href, label: c.packageTitle };
      } else {
        const json = await fetchJson(url, { attempts: 2, timeoutMs: 8 * 60_000 });
        if (validFeatureCollection(json) && countPolygonal(json)) return { geojson: json, url, label: c.packageTitle };
      }
    } catch (e) {
      console.warn(`[ISTAC] Recurso CKAN falló: ${c.packageTitle}: ${e?.message || e}`);
    }
  }
  return null;
}

function propIndex(props) {
  const idx = new Map();
  for (const [k,v] of Object.entries(props || {})) idx.set(norm(k).replace(/ /g,''), { key:k, value:v });
  return idx;
}
function pickProp(props, patterns) {
  const entries = Object.entries(props || {});
  for (const rx of patterns) {
    const hit = entries.find(([k,v]) => rx.test(norm(k).replace(/ /g,'')) && v != null && String(v).trim() !== '');
    if (hit) return hit[1];
  }
  return '';
}
function normalizedFeature(f, level) {
  const p = f.properties || {};
  const rawCode = pickProp(p, level === 'entity'
    ? [/^codigo$/, /^codent/, /^codentida/, /^codentidad/, /^geocodigo$/, /^id$/]
    : [/^codine$/, /^codnuc/, /^codnucleo/, /^geocodigo$/, /^codigo$/, /^id$/]);
  const rawName = pickProp(p, level === 'entity'
    ? [/^entidad$/, /^nombre$/, /^name$/, /^noment/]
    : [/^nucleo$/, /^nombre$/, /^name$/, /^nomnuc/]);
  const munCode = pickProp(p, [/^codmun$/, /^cmun$/, /^inemuni$/, /^codigomun/, /^municipiocodigo$/]);
  const munName = pickProp(p, [/^municipio$/, /^nombremunicipio$/, /^munnombre$/, /^nommun/]);
  return {
    ...f,
    properties: {
      ...p,
      ANAMBRO_LEVEL: level,
      ANAMBRO_CODE: rawCode == null ? '' : String(rawCode),
      ANAMBRO_NAME: rawName == null ? '' : String(rawName),
      ANAMBRO_MUNICIPALITY_CODE: munCode == null ? '' : String(munCode),
      ANAMBRO_MUNICIPALITY: munName == null ? '' : String(munName),
    },
  };
}

async function extractLevel(level, featureTypes) {
  let source = null;
  let raw = null;
  const chosen = chooseLayer(featureTypes, level);
  if (chosen) {
    try {
      const dl = await downloadWfsGeoJson(chosen);
      raw = dl.geojson;
      source = { type: 'WFS', service: chosen.service.label, serviceId: chosen.service.id, layer: chosen.name, title: chosen.title, url: dl.url };
    } catch (e) {
      console.warn(`[ISTAC] Capa WFS elegida para ${level} no descargable: ${e?.message || e}`);
    }
  }
  if (!raw) {
    const fb = await downloadCkanFallback(level);
    if (fb) {
      raw = fb.geojson;
      source = { type: 'CKAN', service: 'Catálogo de datos abiertos ISTAC', layer: fb.label, title: fb.label, url: fb.url };
    }
  }
  if (!raw) throw new Error(`No se encontró una geometría oficial ISTAC descargable para ${level === 'entity' ? 'Entidades' : 'Núcleos'}.`);

  const features = raw.features
    .filter(f => /^(?:Multi)?Polygon$/i.test(f?.geometry?.type || ''))
    .map(f => normalizedFeature(f, level));
  if (!features.length) throw new Error(`La geometría ISTAC de ${level} no contiene polígonos.`);

  const names = features.filter(f => f.properties.ANAMBRO_NAME).length;
  const codes = features.filter(f => f.properties.ANAMBRO_CODE).length;
  console.log(`[ANAMBRO] ${level}: ${features.length} polígonos; ${names} con nombre; ${codes} con código.`);

  const fc = {
    type: 'FeatureCollection',
    name: level === 'entity' ? 'ISTAC · Entidades de población' : 'ISTAC · Núcleos de población',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    anambro: {
      generatedAt: new Date().toISOString(),
      publisher: 'Instituto Canario de Estadística (ISTAC)',
      level,
      featureCount: features.length,
      source,
    },
    features,
  };
  return { fc, source };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const featureTypes = await discoverWfsLayers();
  console.log(`[ISTAC] Total FeatureTypes descubiertos: ${featureTypes.length}`);

  const [entities, nuclei] = await Promise.all([
    extractLevel('entity', featureTypes),
    extractLevel('nucleus', featureTypes),
  ]);

  await writeFile(new URL('istac_entidades_poligonos.geojson', OUT_DIR), JSON.stringify(entities.fc));
  await writeFile(new URL('istac_nucleos_poligonos.geojson', OUT_DIR), JSON.stringify(nuclei.fc));
  await writeFile(new URL('istac_poligonos_fuentes.json', OUT_DIR), JSON.stringify({
    generatedAt: new Date().toISOString(),
    entities: entities.source,
    nuclei: nuclei.source,
  }, null, 2));

  console.log('[ANAMBRO] Polígonos ISTAC extraídos:');
  console.log(`  data/istac_entidades_poligonos.geojson (${entities.fc.features.length})`);
  console.log(`  data/istac_nucleos_poligonos.geojson (${nuclei.fc.features.length})`);
}

main().catch(err => {
  console.error('[ANAMBRO] ERROR:', err?.stack || err);
  process.exitCode = 1;
});
