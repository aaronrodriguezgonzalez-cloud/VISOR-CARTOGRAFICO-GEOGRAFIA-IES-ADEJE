# ANAMBRO · Núcleos de población de Canarias: polígonos (digitalizados de la cartografía estadística de 2001, GRAFCAN/ISTAC)
# + población oficial del ISTAC por núcleo (padrón 2025, 2011 y 2001), con estructura por sexo y edad de 2025.
import json, re, unicodedata, collections, os
R = '/home/claude/clima/raw/istac'; OUT = '/home/claude/clima/out/data/istac'; os.makedirs(OUT, exist_ok=True)
G = json.load(open(R + '/nucleos2001.geojson'))
def js(path):
    d = json.load(open(path)); ids = d['id']; size = d['size']; dims = {}
    for k in ids:
        idx = d['dimension'][k]['category']['index']; dims[k] = idx if isinstance(idx, dict) else {v: i for i, v in enumerate(idx)}
    lab = d['dimension']['TERRITORIO']['category'].get('label', {})
    val = d['value']; stride = [1] * len(ids)
    for i in range(len(ids) - 2, -1, -1): stride[i] = stride[i + 1] * size[i + 1]
    def get(**kw):
        o = 0
        for i, k in enumerate(ids):
            v = kw.get(k); o += stride[i] * (dims[k][v] if v is not None else 0)
        x = val[o] if isinstance(val, list) else val.get(str(o))
        try: return float(x)
        except (TypeError, ValueError): return None
    return dims, lab, get
def key(code): m = re.match(r'\d{8}_(\d{5})_E(\d\d)_N(\d\d)$', code); return f'{m.group(1)}_E{m.group(2)}_N{m.group(3)}' if m else None
D25, L25, g25 = js(R + '/nuc2025.jsonstat'); D11, L11, g11 = js(R + '/nuc2011.jsonstat')
C = lambda dims: dict(next(iter(dims['TIME_PERIOD'].items()))[0:1]) if False else None
AGE0 = ['Y0T4', 'Y5T9', 'Y10T14']; AGE65 = ['Y65T69', 'Y70T74', 'Y75T79', 'Y80T84', 'Y85T89', 'Y90T94', 'Y95T99', 'Y_GE100']
fixed25 = {k: next(iter(v)) for k, v in D25.items() if len(v) == 1}; fixed11 = {k: next(iter(v)) for k, v in D11.items() if len(v) == 1}
def pop(get, fixed, t, sexo='_T', edad='_T'): return get(**fixed, TERRITORIO=t, SEXO=sexo, EDAD=edad)
P25 = {}
for t in D25['TERRITORIO']:
    k = key(t)
    if not k: continue
    tot = pop(g25, fixed25, t)
    if tot is None: continue
    a0 = sum(pop(g25, fixed25, t, edad=e) or 0 for e in AGE0); a65 = sum(pop(g25, fixed25, t, edad=e) or 0 for e in AGE65)
    P25[k] = {'n25': L25.get(t, t), 't': tot, 'h': pop(g25, fixed25, t, 'M') or 0, 'm': pop(g25, fixed25, t, 'F') or 0, 'a0': a0, 'a65': a65}
P11 = {}
for t in D11['TERRITORIO']:
    k = key(t)
    if k: P11[k] = pop(g11, fixed11, t)
def norm(s): s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().upper(); return re.sub(r'[^A-Z0-9 ]', ' ', re.sub(r'\((EL|LA|LOS|LAS)\)', r'\1', s)).split()
def nname(s): return ' '.join(sorted(norm(s)))
# índice por nombre (isla+núcleo) para casar códigos que cambiaron (p. ej. El Pinar, segregado de La Frontera en 2007)
byname = collections.defaultdict(list)
for k, v in P25.items():
    nm = re.sub(r'^.*? - ', '', v['n25']); byname[(k[:5], nname(nm))].append(k)
out = []; used = set(); miss = 0
for f in G['features']:
    p = f['properties']; k = p['code']; ok = k in P25
    if not ok and p['cnuc'] != '99':
        SEG = {'38013': ['38013', '38901']}  # El Pinar se segregó de La Frontera en 2007
        c = [x for m in SEG.get(k[:5], [k[:5]]) for x in byname.get((m, nname(p['nuc'])), []) if x not in used]
        if len(c) == 1: k = c[0]; ok = True
    if not ok:
        miss += 1
    used.add(k)
    v = P25.get(k, {})
    nm = re.sub(r'^.*? - ', '', v.get('n25', '')) if v else ''
    props = {'k': k, 'n': (nm or p['nuc'].title()) if p['cnuc'] != '99' else 'Diseminado de ' + p['ent'].title(), 'e': p['ent'], 'mun': k[:5], 'nmun': p['nmun'], 'isla': p['isla'], 'dis': p['cnuc'] == '99',
             'km2': p['area_km2'], 'p25': v.get('t'), 'h': v.get('h'), 'm': v.get('m'), 'a0': v.get('a0'), 'a65': v.get('a65'), 'p11': P11.get(k), 'p01': p['pob2001']}
    from shapely.geometry import shape, mapping
    gg = shape(f['geometry']).simplify(0.00025, preserve_topology=True); m = mapping(gg)
    def rnd(o):
        if isinstance(o[0], (float, int)): return [round(o[0], 4), round(o[1], 4)]
        return [rnd(x) for x in o]
    out.append({'type': 'Feature', 'geometry': {'type': m['type'], 'coordinates': rnd(m['coordinates'])}, 'properties': props})
sinpol = [k for k in P25 if k not in used and not k.endswith('_N99')]
json.dump({'type': 'FeatureCollection', 'fuente': 'Población: ISTAC, Padrón Municipal de Habitantes (población por núcleos y diseminados, 2001, 2011 y 2025). Contornos: digitalizados por ANAMBRO de la Cartografía Estadística de IDECanarias (GRAFCAN/ISTAC), núcleos de población 2001.',
           'sin_poligono': [[k, P25[k]['n25'], P25[k]['t']] for k in sinpol], 'features': out}, open(OUT + '/nucleos.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('polígonos', len(out), 'sin dato 2025', miss, '· núcleos 2025 sin polígono', len(sinpol), 'con', sum(P25[k]['t'] or 0 for k in sinpol), 'hab. de', sum(v['t'] or 0 for v in P25.values()), os.path.getsize(OUT + '/nucleos.json') // 1024, 'KB')

# ---------- Núcleos creados después de 2001: se reconstruye su contorno dentro del polígono de 2001 del que se segregaron ----------
from shapely.geometry import shape, mapping, Point, MultiPoint
from shapely.ops import voronoi_diagram, transform as stf
import math
SIT = json.load(open(R + '/nuevos_situacion.json')) if os.path.exists(R + '/nuevos_situacion.json') else {}
CL = math.cos(math.radians(28.3)); KX = 111320 * CL; KY = 110574
fw = lambda x, y, z=None: (x * KX, y * KY); bw = lambda x, y, z=None: (x / KX, y / KY)
D = json.load(open(OUT + '/nucleos.json')); F = D['features']
geo = [stf(fw, shape(f['geometry'])) for f in F]
def rnd(o):
    if isinstance(o[0], (float, int)): return [round(o[0], 4), round(o[1], 4)]
    return [rnd(x) for x in o]
groups = collections.defaultdict(list)
for k, s in SIT.items():
    if k not in P25: continue
    pt = Point(fw(s['lon'], s['lat']))
    cands = [i for i, g in enumerate(geo) if g.contains(pt)]
    if not cands:  # el punto cae en el mar o fuera: polígono más cercano del mismo municipio
        same = [i for i, f in enumerate(F) if f['properties']['mun'] in (k[:5], {'38901': '38013'}.get(k[:5], ''))]
        cands = sorted(same, key=lambda i: geo[i].distance(pt))[:1]
    if cands: groups[cands[0]].append((k, pt))
added = 0
for i, lst in groups.items():
    par = geo[i]; pp = F[i]['properties']; news = []
    if pp['dis']:
        rest = par
        for k, pt in sorted(lst, key=lambda x: -(P25[x[0]]['t'] or 0)):
            a = max((P25[k]['t'] or 0) / 2500 * 1e6, math.pi * 150 ** 2)  # ~2.500 hab./km², radio mínimo 150 m
            g = pt.buffer(math.sqrt(a / math.pi)).intersection(rest)
            if g.is_empty: continue
            rest = rest.difference(g); news.append((k, g))
        geo[i] = rest
    else:
        pts = [par.representative_point()] + [pt for k, pt in lst]
        cells = voronoi_diagram(MultiPoint(pts), envelope=par.buffer(2000))
        own = None
        for c in cells.geoms:
            g = c.intersection(par)
            if g.is_empty: continue
            if c.contains(pts[0]): own = g; continue
            for k, pt in lst:
                if c.contains(pt): news.append((k, g))
        if own is not None: geo[i] = own
    pp['div'] = True; pp['p01'] = None; pp['km2'] = round(geo[i].area / 1e6, 3)
    F[i]['geometry'] = {'type': mapping(stf(bw, geo[i]))['type'], 'coordinates': rnd(mapping(stf(bw, geo[i]))['coordinates'])}
    for k, g in news:
        v = P25[k]; gm = mapping(stf(bw, g))
        F.append({'type': 'Feature', 'geometry': {'type': gm['type'], 'coordinates': rnd(gm['coordinates'])},
                  'properties': {'k': k, 'n': re.sub(r'^.*? - ', '', v['n25']), 'e': pp['e'], 'mun': k[:5], 'nmun': pp['nmun'], 'isla': pp['isla'], 'dis': False, 'aprox': True, 'de': pp['n'],
                                 'km2': round(g.area / 1e6, 3), 'p25': v['t'], 'h': v['h'], 'm': v['m'], 'a0': v['a0'], 'a65': v['a65'], 'p11': P11.get(k), 'p01': None}})
        added += 1
D['sin_poligono'] = [x for x in D['sin_poligono'] if x[0] not in {f['properties']['k'] for f in F}]
D['fuente'] += ' Núcleos creados después de 2001: contorno aproximado reconstruido por ANAMBRO dentro del polígono del que se segregaron, situados con el buscador de topónimos de IDECanarias (GRAFCAN) y GeoNames.'
json.dump(D, open(OUT + '/nucleos.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('reconstruidos', added, '· siguen sin polígono', len([x for x in D['sin_poligono'] if x[2]]), 'con', int(sum(x[2] or 0 for x in D['sin_poligono'])), 'hab.')
