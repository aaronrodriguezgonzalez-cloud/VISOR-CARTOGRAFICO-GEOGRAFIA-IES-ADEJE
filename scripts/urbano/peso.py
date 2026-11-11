# ANAMBRO · Peso de cada aglomeración urbana (ONU, WUP 2025) en la población de su país y de su región.
# Añade 4 columnas a data/urbano/ciudades_mundo.json y a data/urbano/pais/*.json:
#   11 pct_pob_pais_total  % de la población TOTAL del país en 2025 (ONU, World Population Prospects 2024)
#   12 region             nombre de la región subnacional (Global Data Lab) donde está el centro de la aglomeración
#   13 pct_pob_region     % de la población de esa región (la aglomeración interpolada al año del dato regional)
#   14 anio_region        año del dato regional
# La columna 9 (pct_pob_pais de la ONU) es otra cosa: % sobre la población de las aglomeraciones del país.
# Uso: python3 scripts/urbano/peso.py  (desde la raíz del repositorio; requiere shapely)
import json, os, glob, re
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = lambda *a: os.path.join(ROOT, *a)
NCOL = 11  # columnas originales de cada ciudad

wpp = json.load(open(P('data/piramides/mundo.json'), encoding='utf-8'))['d']
pais_tot = {k: sum(sum(s) for s in v['a']['2025']) for k, v in wpp.items() if '2025' in v.get('a', {})}

cm = json.load(open(P('data/urbano/ciudades_mundo.json'), encoding='utf-8'))
YEARS = cm['years']

def pob_en(row, year):
    """Población (habitantes) de la aglomeración en un año, interpolando entre los quinquenios de la ONU."""
    s = row[6]
    if year <= YEARS[0]: return s[0] * 1e3
    if year >= YEARS[-1]: return s[-1] * 1e3
    for i in range(len(YEARS) - 1):
        a, b = YEARS[i], YEARS[i + 1]
        if a <= year <= b:
            return (s[i] + (s[i + 1] - s[i]) * (year - a) / (b - a)) * 1e3

gdl_ix = json.load(open(P('data/gdl/index.json'), encoding='utf-8'))
_gdl = {}
def gdl(iso):
    if iso in _gdl: return _gdl[iso]
    out = None
    meta = gdl_ix.get(iso)
    f = P('data/gdl', iso + '.json')
    if not os.path.exists(f): f = P('data/gdl/gdl', iso + '.json')
    if meta and meta.get('r', 0) > 1 and os.path.exists(f):
        d = json.load(open(f, encoding='utf-8'))
        regs = {}
        for r in d['reg']:
            pop = r['v'].get('pop') or []
            idx = [i for i, v in enumerate(pop) if v is not None]
            if idx:
                i = idx[-1]
                n = re.sub(r'\s+', ' ', re.sub(r'^The ', '', str(r['n'] or ''))).strip()  # igual que el visor
                regs[r['c']] = (n, pop[i] * 1e3, d['y0'] + i)
        geoms, codes = [], []
        for ft in d['geo']['features']:
            c = ft['properties']['c']
            if c in regs:
                try:
                    g = shape(ft['geometry']).buffer(0)
                    geoms.append(g); codes.append(c)
                except Exception:
                    pass
        if geoms:
            out = (STRtree(geoms), geoms, codes, regs)
    _gdl[iso] = out
    return out

# Palestina: en la base GDL del visor los polígonos y los nombres de las regiones no casan
# (la Franja de Gaza aparece como «Qalqiliya» y «Salfit»), así que no se asigna región.
SIN_REGION = {'PSE'}

def region(iso, lat, lon):
    if iso in SIN_REGION: return None
    g = gdl(iso)
    if not g: return None
    tree, geoms, codes, regs = g
    pt = Point(lon, lat)
    for i in tree.query(pt):
        if geoms[i].contains(pt):
            return regs[codes[i]]
    i = tree.nearest(pt)  # punto en la costa, fuera del polígono simplificado
    if geoms[i].distance(pt) < 0.25:
        return regs[codes[i]]
    return None

extra = {}
stats = dict(pais=0, reg=0, sobre_pais=0, sobre_reg=0)
for r in cm['c']:
    r[:] = r[:NCOL]
    iso, lat, lon = r[2], r[4], r[5]
    p25 = r[6][YEARS.index(2025)] * 1e3
    pp = round(p25 / pais_tot[iso] * 100, 2) if pais_tot.get(iso) else None
    rg = region(iso, lat, lon)
    if rg:
        n, popr, yr = rg
        pr = round(pob_en(r, yr) / popr * 100, 2) if popr else None
        e = [pp, n, pr, yr]
    else:
        e = [pp, None, None, None]
    r.extend(e)
    extra[r[0]] = e
    stats['pais'] += pp is not None; stats['reg'] += e[2] is not None
    stats['sobre_pais'] += (pp or 0) > 100; stats['sobre_reg'] += (e[2] or 0) > 100

cm['cols'] = cm['cols'][:NCOL] + ['pct_pob_pais_total', 'region', 'pct_pob_region', 'anio_region']
cm['def_cols'] = {
    'pct_pob_pais': '% sobre la población que vive en las aglomeraciones del país (ONU, WUP 2025)',
    'pct_pob_pais_total': '% sobre la población total del país en 2025 (ONU, World Population Prospects 2024)',
    'pct_pob_region': '% sobre la población de la región subnacional (Global Data Lab) en la que está el centro de la aglomeración',
}
json.dump(cm, open(P('data/urbano/ciudades_mundo.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

for f in sorted(glob.glob(P('data/urbano/pais/*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    for r in d['c']:
        r[:] = r[:NCOL] + extra[r[0]]
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

print(len(cm['c']), 'aglomeraciones ·', stats)
