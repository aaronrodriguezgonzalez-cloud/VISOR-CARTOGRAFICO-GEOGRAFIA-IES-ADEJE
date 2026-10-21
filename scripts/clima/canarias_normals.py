# Normales de Canarias calculadas por ANAMBRO:
#  (1) AEMET: a partir de las series mensuales (OpenData) de sus estaciones de Canarias, 1991-2020 y 1961-1990.
#  (2) Cabildo de Tenerife · AgroCabildo (CC BY): a partir de datos diarios, solo con los años dentro de 1991-2020.
# Criterios (OMM-No. 1203): normal «estándar» con ≥ 24 años válidos por mes; «provisional» con ≥ 10 años.
# Mes válido de temperatura: ≤ 10 días sin dato y ≤ 4 consecutivos (regla 11/5). Mes válido de precipitación: sin días sin dato.
import json, glob, os, csv, collections, math, re
R = '/home/claude/clima/raw'
OUT = R + '/canarias_normales.json'
DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
PER = {'9120': (1991, 2020), '6190': (1961, 1990)}
MIN_STD, MIN_PROV = 24, 10

def fnum(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def normals_from_monthly(rows, a, b):
    """rows: dict (year, month) -> dict(T,Tx,Tn,P,H,S,D). Devuelve periodo o None."""
    acc = {k: [[] for _ in range(12)] for k in ('T', 'Tx', 'Tn', 'P', 'H', 'S', 'D')}
    years = set()
    for (y, m), v in rows.items():
        if not (a <= y <= b): continue
        for k in acc:
            if v.get(k) is not None: acc[k][m - 1].append(v[k]); years.add(y)
    def mean(k):
        L = acc[k]
        if any(len(x) < MIN_PROV for x in L): return None, 0
        return [round(sum(x) / len(x), 1) for x in L], min(len(x) for x in L)
    T, nT = mean('T'); P, nP = mean('P')
    if T is None:
        Tx, nx = mean('Tx'); Tn, nn = mean('Tn')
        if Tx and Tn: T = [round((x + n) / 2, 1) for x, n in zip(Tx, Tn)]; nT = min(nx, nn)
    if T is None or P is None: return None
    out = {'T': T, 'P': P, 'n': min(nT, nP)}
    for k in ('Tx', 'Tn', 'H', 'S', 'D'):
        v, n = mean(k)
        if v: out[k] = v
    ys = sorted(years)
    out['y'] = f'{ys[0]}–{ys[-1]}' if ys else ''
    out['prov'] = 1 if out['n'] < MIN_STD else 0
    return out

res = {}
# ---------- (1) AEMET ----------
inv = {s['indicativo']: s for s in json.load(open(R + '/aemet/inventario.json'))}
by = collections.defaultdict(dict)
for f in glob.glob(R + '/aemet/series/*.json'):
    ind = os.path.basename(f).split('_')[0]
    try: d = json.load(open(f))
    except Exception: continue
    for r in d or []:
        m = re.match(r'(\d{4})-(\d{1,2})$', r.get('fecha', ''))
        if not m or int(m[2]) == 13: continue
        y, mo = int(m[1]), int(m[2])
        v = {'T': fnum(r.get('tm_mes')), 'Tx': fnum(r.get('tm_max')), 'Tn': fnum(r.get('tm_min')), 'P': fnum(r.get('p_mes')),
             'H': fnum(r.get('hr')), 'D': fnum(r.get('np_010'))}
        ins = fnum(r.get('inso'))
        v['S'] = ins * DAYS[mo - 1] if ins is not None else None
        by[ind][(y, mo)] = v
for ind, rows in by.items():
    st = inv.get(ind, {})
    pers = {}
    for pk, (a, b) in PER.items():
        n = normals_from_monthly(rows, a, b)
        if n: n['src'] = 'AEMETc'; n['dt'] = '1'; pers[pk] = n
    if pers: res['A' + ind] = {'a': ind, 'name': st.get('nombre'), 'lat': st.get('latitud'), 'lon': st.get('longitud'), 'z': st.get('altitud'), 'wmo': st.get('indsinop'), 'p': pers}

# ---------- (2) AgroCabildo (Cabildo de Tenerife) ----------
est = {r['estacion_id']: r for r in csv.DictReader(open(R + '/canarias/agrocabildo_est.csv', encoding='utf-8-sig'))}
daily = collections.defaultdict(lambda: collections.defaultdict(dict))  # id -> date -> var
for fs in glob.glob(R + '/canarias/agroapi/*_sensors.json'):
    sid = os.path.basename(fs).split('_')[0]
    try: alias = {x['id_weatherstationsensor']: x['sensor_alias'] for x in json.load(open(fs))['stations'][0]['sensors']}
    except Exception: continue
    for f in glob.glob(R + f'/canarias/agroapi/{sid}_[12]*.json'):
        try: S = json.load(open(f))['summarized']['sensors']
        except Exception: continue
        for x in S:
            al = alias.get(x['id_weatherstationsensor'])
            if al not in ('TEMP', 'RAIN', 'HUM'): continue
            for dd in x['dates']:
                v = (dd.get('values') or [{}])[0]
                if al == 'TEMP':
                    for kk, mm in (('T', 'mean'), ('Tx', 'max'), ('Tn', 'min')):
                        q = fnum(v.get(mm))
                        if q is not None: daily[sid][dd['observation_date']][kk] = q
                elif al == 'RAIN':
                    q = fnum(v.get('total'))
                    if q is not None: daily[sid][dd['observation_date']]['P'] = q
                else:
                    q = fnum(v.get('mean'))
                    if q is not None: daily[sid][dd['observation_date']]['H'] = q
for f in glob.glob(R + '/canarias/agro/*.csv'):
    if open(f, 'rb').read(15).startswith(b'<!DOC'): continue
    for r in csv.DictReader(open(f, encoding='utf-8-sig')):
        key = {('TEMP', 'media'): 'T', ('TEMP', 'maximo'): 'Tx', ('TEMP', 'minimo'): 'Tn', ('RAIN', 'total'): 'P', ('HUM', 'media'): 'H'}.get((r['sensor_alias'], r['metrica']))
        val = fnum(r['valor'])
        if key and val is not None: daily[r['estacion_id']][r['fecha_observacion']].setdefault(key, val)
import calendar
for sid, dd in daily.items():
    rows = {}
    bym = collections.defaultdict(list)
    for ds, v in dd.items():
        y, m, d = int(ds[:4]), int(ds[5:7]), int(ds[8:10]); bym[(y, m)].append((d, v))
    for (y, m), L in bym.items():
        nd = calendar.monthrange(y, m)[1]; got = {d: v for d, v in L}
        def ok_temp(k):
            present = [d for d in range(1, nd + 1) if k in got.get(d, {})]
            miss = nd - len(present)
            if miss > 10: return None
            run = mx = 0
            for d in range(1, nd + 1):
                run = run + 1 if k not in got.get(d, {}) else 0; mx = max(mx, run)
            if mx > 4: return None
            vals = [got[d][k] for d in present]
            # control de calidad simple
            if any(v < -15 or v > 48 for v in vals): return None
            return sum(vals) / len(vals)
        v = {k: ok_temp(k) for k in ('T', 'Tx', 'Tn', 'H')}
        pd = [got[d]['P'] for d in range(1, nd + 1) if 'P' in got.get(d, {})]
        v['P'] = sum(pd) if len(pd) == nd and all(0 <= x < 500 for x in pd) else None
        rows[(y, m)] = v
    n = normals_from_monthly(rows, 1991, 2020)
    e = est.get(sid)
    if n and e:
        n['src'] = 'CAB'
        res['T' + sid] = {'cab': sid, 'name': e['estacion_nombre'], 'lat': float(e['latitud']), 'lon': float(e['longitud']), 'z': fnum(e['altitud']),
                          'muni': e['municipio_nombre'], 'paraje': e['paraje'] or e['localidad_nombre'], 'p': {'9120': n}}
INCLUDE_CAB = os.environ.get('INCLUDE_CAB') == '1'
if not INCLUDE_CAB: res = {k: v for k, v in res.items() if not k.startswith('T')}
json.dump(res, open(OUT, 'w'), ensure_ascii=False)
c = collections.Counter((k[0], pk, v['prov']) for k, s in res.items() for pk, v in s['p'].items())
print(len(res), 'estaciones', c)
