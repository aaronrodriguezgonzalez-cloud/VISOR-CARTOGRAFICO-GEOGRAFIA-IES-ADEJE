# ANAMBRO · Tiempo meteorológico en directo
# Lo ejecuta la Action de GitHub (.github/workflows/tiempo.yml) cada 30 minutos y deja los archivos en data/tiempo/.
# Cada bloque es independiente: si una fuente falla, se conserva el último archivo publicado en anambro.es.
#   - AEMET OpenData: observación horaria (últimas 24 h) de sus ~850 estaciones automáticas, mapa de análisis
#     de superficie (isobaras y frentes), radares regionales y rayos. Requiere AEMET_API_KEY (secreto del repositorio).
#   - NOAA Aviation Weather Center: último METAR de los aeródromos de todo el mundo (dominio público).
#   - NOAA NCEP GFS: presión a nivel del mar → isobaras (análisis y pronóstico a 24, 48 y 72 h) (dominio público).
#   - NOAA NHC y GDACS (UE/ONU): ciclones tropicales activos.
import os, sys, json, gzip, io, csv, time, math, datetime as dt, urllib.request, urllib.parse, urllib.error, zipfile, re, traceback
import xml.etree.ElementTree as ET

OUT = os.environ.get('OUT', 'data/tiempo')
SITE = os.environ.get('SITE_URL', 'https://anambro.es').rstrip('/')
KEY = os.environ.get('AEMET_API_KEY', '').strip()
UA = {'User-Agent': 'ANAMBRO (visor educativo sin animo de lucro; https://anambro.es)'}
os.makedirs(OUT, exist_ok=True)
STATUS = {'generado': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'fuentes': {}}

def get(url, headers=None, timeout=60, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e; time.sleep(35 if e.code == 429 else 3 * (i + 1))
        except Exception as e:
            last = e; time.sleep(3 * (i + 1))
    raise last

def save(name, data):
    p = os.path.join(OUT, name)
    with open(p, 'wb') as f: f.write(data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))

def keep_previous(names):
    """Si una fuente falla, recupera de la web publicada los archivos de la ejecución anterior."""
    for n in names:
        try: save(n, get(f'{SITE}/data/tiempo/{n}', timeout=30, tries=1))
        except Exception: pass

def block(key, files):
    def deco(fn):
        def run():
            t0 = time.time()
            try:
                info = fn() or {}
                STATUS['fuentes'][key] = {'ok': True, **info, 's': round(time.time() - t0, 1)}
            except Exception as e:
                traceback.print_exc()
                prev = None
                try: prev = json.loads(get(f'{SITE}/data/tiempo/estado.json', timeout=20, tries=1))['fuentes'].get(key)
                except Exception: pass
                keep_previous(files() if callable(files) else files)
                STATUS['fuentes'][key] = {'ok': False, 'error': str(e)[:200], 'anterior': prev}
        return run
    return deco

# ---------------- AEMET ----------------
_ultima = [0.0]
def _pausa(seg=2.2):
    # AEMET OpenData corta con «429 Too Many Requests» si se le pide demasiado deprisa
    t = time.time() - _ultima[0]
    if t < seg: time.sleep(seg - t)
    _ultima[0] = time.time()

def aemet(path):
    if not KEY: raise RuntimeError('Falta AEMET_API_KEY')
    for intento in range(4):
        _pausa()
        idx = json.loads(get('https://opendata.aemet.es/opendata/api/' + path, {'api_key': KEY}).decode('latin-1'))
        if idx.get('estado') != 429: break
        time.sleep(45)  # «límite de peticiones»: AEMET pide esperar
    if idx.get('estado') != 200: raise RuntimeError(f"AEMET {path}: {idx.get('estado')} {idx.get('descripcion')}")
    _pausa()
    return get(idx['datos'])

OBS_VARS = ['ta', 'tamax', 'tamin', 'hr', 'tpr', 'prec', 'vv', 'dv', 'vmax', 'dmax', 'pres', 'pres_nmar', 'vis', 'inso', 'nieve']

@block('aemet_obs', ['aemet_obs.json'])
def aemet_obs():
    raw = aemet('observacion/convencional/todas')
    try: d = json.loads(raw.decode('utf-8'))
    except UnicodeDecodeError: d = json.loads(raw.decode('latin-1'))
    # AEMET solo sirve las últimas ~12 h: se suman las horas de la ejecución anterior para conservar 24 h
    rec = {}   # (idema, hora) -> {var: valor}
    meta = {}
    try:
        prev = json.loads(get(f'{SITE}/data/tiempo/aemet_obs.json', timeout=30, tries=1))
        for i, m in enumerate(prev['s']):
            meta[m[0]] = m
            for j, t in enumerate(prev['t']):
                vals = {k: prev['v'][k][i][j] for k in prev['vars'] if k in prev['v']}
                if any(v is not None for v in vals.values()): rec[(m[0], t[:13])] = vals
    except Exception as e: print('sin serie anterior:', e)
    for r in d:
        meta[r['idema']] = [r['idema'], r.get('ubi', ''), round(r['lat'], 4), round(r['lon'], 4), r.get('alt')]
        rec[(r['idema'], r['fint'][:13])] = {k: (round(r[k], 1) if isinstance(r.get(k), (int, float)) else None) for k in OBS_VARS}
    hours = sorted({h for _, h in rec})[-24:]
    ids = sorted({i for i, h in rec if h in set(hours)})
    out = {'t': [h + ':00Z' for h in hours], 'vars': OBS_VARS, 's': [meta[i] for i in ids],
           'v': {k: [[(rec.get((i, h)) or {}).get(k) for h in hours] for i in ids] for k in OBS_VARS},
           'fuente': '© AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma (AEMET OpenData).'}
    save('aemet_obs.json', out)
    return {'estaciones': len(ids), 'horas': len(hours), 'ultima': out['t'][-1] if out['t'] else None}

RADARES = {'ca': 'Canarias (Gran Canaria)', 'co': 'A Coruña', 'sa': 'Cantabria', 'ss': 'Bizkaia', 'vd': 'Valladolid', 'za': 'Zaragoza',
           'ba': 'Barcelona', 'cc': 'Cáceres', 'ma': 'Madrid', 'va': 'Valencia', 'pm': 'Palma de Mallorca', 'mu': 'Murcia',
           'se': 'Sevilla', 'ml': 'Málaga', 'am': 'Almería'}

@block('aemet_img', lambda: ['aemet_analisis.png', 'aemet_rayos.gif', 'aemet_img.json'] + [f'radar_{c}.gif' for c in RADARES])
def aemet_img():
    from PIL import Image
    info = {'analisis': None, 'rayos': None, 'radares': {}}
    now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    errs = []
    try:
        im = Image.open(io.BytesIO(aemet('mapasygraficos/analisis'))).convert('RGB').rotate(-90, expand=True)
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); save('aemet_analisis.png', b.getvalue()); info['analisis'] = now
    except Exception as e: errs.append('analisis: ' + str(e)); keep_previous(['aemet_analisis.png'])
    try: save('aemet_rayos.gif', aemet('red/rayos/mapa')); info['rayos'] = now
    except Exception as e: errs.append('rayos: ' + str(e)); keep_previous(['aemet_rayos.gif'])
    for c, n in RADARES.items():
        try: save(f'radar_{c}.gif', aemet(f'red/radar/regional/{c}')); info['radares'][c] = {'n': n, 't': now}
        except Exception as e: errs.append(f'radar {c}: ' + str(e)); keep_previous([f'radar_{c}.gif']); info['radares'][c] = {'n': n, 't': None}
    save('aemet_img.json', info)
    if errs: print('\n'.join(errs))
    return {'avisos': errs[:5]}

# ---------------- METAR (NOAA AWC) ----------------
def fnum(v):
    try: return float(v)
    except (TypeError, ValueError): return None

@block('metar', ['metar.json'])
def metar():
    names = {}
    try:
        for s in json.loads(gzip.decompress(get('https://aviationweather.gov/data/cache/stations.cache.json.gz'))):
            names[s.get('icaoId') or s.get('id')] = [s.get('site') or '', s.get('country') or '']
    except Exception as e: print('stations', e)
    txt = gzip.decompress(get('https://aviationweather.gov/data/cache/metars.cache.csv.gz')).decode('utf-8', 'replace').splitlines()
    i0 = next(i for i, l in enumerate(txt) if l.startswith('raw_text'))
    rows = []
    for r in csv.DictReader(txt[i0:]):
        la, lo = fnum(r.get('latitude')), fnum(r.get('longitude'))
        if la is None or lo is None: continue
        sky = [(r.get(f'sky_cover') or '')] if False else []
        rows.append([r['station_id'], round(la, 3), round(lo, 3), fnum(r.get('elevation_m')), r.get('observation_time'),
                     fnum(r.get('temp_c')), fnum(r.get('dewpoint_c')), fnum(r.get('wind_dir_degrees')) if r.get('wind_dir_degrees') not in ('VRB',) else -1,
                     fnum(r.get('wind_speed_kt')), fnum(r.get('wind_gust_kt')), fnum(r.get('visibility_statute_mi')), fnum(r.get('sea_level_pressure_mb')),
                     fnum(r.get('altim_in_hg')), r.get('wx_string') or '', r.get('flight_category') or '', r.get('raw_text') or '',
                     *(names.get(r['station_id'], ['', '']))])
    cols = ['id', 'lat', 'lon', 'z', 't', 'ta', 'td', 'dv', 'kt', 'gust', 'vis_mi', 'slp', 'altim', 'wx', 'cat', 'raw', 'nombre', 'pais']
    save('metar.json', {'cols': cols, 'r': rows, 'fuente': 'NOAA · National Weather Service · Aviation Weather Center (aviationweather.gov), dominio público.'})
    return {'aerodromos': len(rows)}

# ---------------- GFS: isobaras ----------------
def gfs_run():
    now = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=5)  # el ciclo tarda unas 4–5 h en estar completo
    h = (now.hour // 6) * 6
    return now.strftime('%Y%m%d'), f'{h:02d}'

def contour_geojson(lats, lons, z, levels):
    import numpy as np, matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig = plt.figure(); cs = plt.contour(lons, lats, z, levels=levels)
    feats = []
    for lev, segs in zip(cs.levels, cs.allsegs):
        for seg in segs:
            if len(seg) < 4: continue
            step = max(1, len(seg) // 400)
            coords = [[round(float(x), 1), round(float(y), 1)] for x, y in seg[::step]]
            if coords[-1] != [round(float(seg[-1][0]), 1), round(float(seg[-1][1]), 1)]: coords.append([round(float(seg[-1][0]), 1), round(float(seg[-1][1]), 1)])
            feats.append({'type': 'Feature', 'properties': {'hPa': int(lev)}, 'geometry': {'type': 'LineString', 'coordinates': coords}})
    plt.close(fig)
    return feats

def centres(lats, lons, z, oro=None):
    """Centros de altas (A) y bajas (B): extremos locales en un radio de ~1000 km con contraste ≥ 4 hPa."""
    import numpy as np
    from scipy.ndimage import maximum_filter, minimum_filter, uniform_filter
    out = []
    n = 17  # ventana de 17 × 1° (unos 1.900 km de lado)
    mx = maximum_filter(z, size=n, mode=('nearest', 'wrap')); mn = minimum_filter(z, size=n, mode=('nearest', 'wrap'))
    mean = uniform_filter(z, size=n, mode=('nearest', 'wrap'))
    for kind, ext, cond in (('A', mx, lambda v, m: v - m >= 4), ('B', mn, lambda v, m: m - v >= 4)):
        ys, xs = np.where((z == ext))
        for y, x in zip(ys, xs):
            if abs(lats[y]) > 80: continue
            if oro is not None and oro[y, x] > 1000: continue  # la reducción al nivel del mar inventa altas sobre Groenlandia, el Tíbet o los Andes
            v = float(z[y, x])
            if not cond(v, float(mean[y, x])): continue
            out.append({'type': 'Feature', 'properties': {'c': kind, 'hPa': round(v)}, 'geometry': {'type': 'Point', 'coordinates': [round(float(lons[x]), 1), round(float(lats[y]), 1)]}})
    return out

@block('gfs', lambda: ['isobaras.json'])
def gfs():
    import numpy as np, pygrib
    day, run = gfs_run()
    steps = [0, 24, 48, 72]
    res = {'run': f'{day[:4]}-{day[4:6]}-{day[6:]}T{run}:00Z', 'pasos': []}
    for f in steps:
        q = {'file': f'gfs.t{run}z.pgrb2.1p00.f{f:03d}', 'var_PRMSL': 'on', 'lev_mean_sea_level': 'on', 'var_HGT': 'on', 'lev_surface': 'on', 'dir': f'/gfs.{day}/{run}/atmos'}
        g = get('https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_1p00.pl?' + urllib.parse.urlencode(q), timeout=120)
        tmp = os.path.join(OUT, '_tmp.grb'); open(tmp, 'wb').write(g)
        grbs = pygrib.open(tmp); m = grbs.select(name='Pressure reduced to MSL')[0]
        z, lats, lons = m.values / 100.0, m.latlons()[0][:, 0], m.latlons()[1][0, :]
        try: oro = grbs.select(name='Orography')[0].values
        except Exception:
            try: oro = grbs.select(shortName='orog')[0].values
            except Exception: oro = None
        grbs.close(); os.remove(tmp)
        # longitudes 0..359 → -180..180 (con una columna repetida para cerrar las líneas en el antimeridiano)
        lons = np.where(lons > 180, lons - 360, lons); o = np.argsort(lons); lons, z = lons[o], z[:, o]
        if oro is not None: oro = oro[:, o]
        lons = np.append(lons, lons[0] + 360); z = np.concatenate([z, z[:, :1]], axis=1)
        if lats[0] > lats[-1]:
            lats, z = lats[::-1], z[::-1, :]
            if oro is not None: oro = oro[::-1, :]
        from scipy.ndimage import gaussian_filter
        zs = gaussian_filter(z, 0.7)
        levels = list(range(int(np.floor(zs.min() / 4) * 4), int(np.ceil(zs.max() / 4) * 4) + 1, 4))
        feats = contour_geojson(lats, lons, zs, levels) + centres(lats, lons[:-1], z[:, :-1], oro)
        valid = (dt.datetime.strptime(day + run, '%Y%m%d%H') + dt.timedelta(hours=f)).strftime('%Y-%m-%dT%H:00Z')
        res['pasos'].append({'h': f, 'valido': valid, 'fc': {'type': 'FeatureCollection', 'features': feats}})
    res['fuente'] = 'NOAA · NCEP · Global Forecast System (GFS), resolución 1°, dominio público. Isobaras y centros de acción calculados por ANAMBRO.'
    save('isobaras.json', res)
    return {'run': res['run'], 'pasos': len(steps)}

# ---------------- Ciclones tropicales ----------------
def kml_to_features(kml_bytes, props):
    """KML → GeoJSON sin depender de la versión del espacio de nombres (NHC usa 2.1 y 2.2)."""
    root = ET.fromstring(kml_bytes)
    for el in root.iter():
        if isinstance(el.tag, str) and '}' in el.tag: el.tag = el.tag.split('}', 1)[1]
    def coords(txt): return [[round(float(a), 3), round(float(b), 3)] for a, b, *_ in (c.split(',') for c in txt.split())]
    feats = []
    for pm in root.iter('Placemark'):
        nm = (pm.findtext('name') or '').strip()
        desc = re.sub(r'\s+', ' ', re.sub('<[^>]+>', ' ', pm.findtext('description') or '')).strip()[:300]
        for poly in pm.iter('Polygon'):
            c = poly.find('outerBoundaryIs/LinearRing/coordinates')
            if c is not None and c.text: feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'cono', 'n': nm}, 'geometry': {'type': 'Polygon', 'coordinates': [coords(c.text)]}})
        for ls in pm.iter('LineString'):
            c = ls.find('coordinates')
            if c is not None and c.text: feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'linea', 'n': nm}, 'geometry': {'type': 'LineString', 'coordinates': coords(c.text)}})
        for pt in pm.iter('Point'):
            c = pt.find('coordinates')
            if c is not None and c.text: feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'punto', 'n': nm, 'd': desc}, 'geometry': {'type': 'Point', 'coordinates': coords(c.text)[0]}})
    return feats

@block('ciclones', ['ciclones.json'])
def ciclones():
    feats, errs, n = [], [], 0
    try:
        cs = json.loads(get('https://www.nhc.noaa.gov/CurrentStorms.json')).get('activeStorms', [])
        for s in cs:
            n += 1
            props = {'f': 'NHC', 'id': s.get('id'), 'nombre': s.get('name'), 'clase': s.get('classification'), 'kt': fnum(s.get('intensity')), 'hPa': fnum(s.get('pressure')), 'obs': s.get('lastUpdate')}
            feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'actual'}, 'geometry': {'type': 'Point', 'coordinates': [fnum(s.get('longitudeNumeric')), fnum(s.get('latitudeNumeric'))]}})
            for k in ('trackCone', 'forecastTrack', 'bestTrackGIS'):
                u = (s.get(k) or {}).get('kmzFile')
                if not u: continue
                try:
                    z = zipfile.ZipFile(io.BytesIO(get(u)))
                    for nm in z.namelist():
                        if nm.endswith('.kml'): feats += kml_to_features(z.read(nm), {**props, 'capa': k})
                except Exception as e: errs.append(f'NHC {k}: {e}')
    except Exception as e: errs.append('NHC: ' + str(e))
    try:
        ev = json.loads(get('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC'))
        for f in ev.get('features', []):
            p = f.get('properties', {})
            if str(p.get('iscurrent')).lower() != 'true': continue
            n += 1
            u = p.get('url') or {}
            props = {'f': 'GDACS', 'id': p.get('eventid'), 'nombre': (p.get('eventname') or '').title(), 'alerta': p.get('alertlevel'),
                     'desde': p.get('fromdate'), 'hasta': p.get('todate'), 'paises': p.get('country'), 'url': u.get('report'),
                     'kmh': (p.get('severitydata') or {}).get('severity'), 'fuente_orig': p.get('source')}
            feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'actual'}, 'geometry': f.get('geometry')})
            try:
                g = json.loads(get(u.get('geometry') or f"https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid={p.get('eventid')}&episodeid={p.get('episodeid')}"))
                for gf in g.get('features', []):
                    gp = gf.get('properties', {}); lab = str(gp.get('polygonlabel') or '')
                    geo = gf.get('geometry') or {}
                    if geo.get('type') not in ('Polygon', 'MultiPolygon') or not lab.endswith('km/h'): continue  # solo la franja total de vientos (60/90/120 km/h)
                    def simp(r): st = max(1, len(r) // 300); r2 = [[round(x, 2), round(y, 2)] for x, y, *_ in r[::st]]; return r2 + [r2[0]]
                    if geo['type'] == 'Polygon': geo = {'type': 'Polygon', 'coordinates': [simp(r) for r in geo['coordinates']]}
                    else: geo = {'type': 'MultiPolygon', 'coordinates': [[simp(r) for r in pol] for pol in geo['coordinates']]}
                    feats.append({'type': 'Feature', 'properties': {**props, 'tipo': 'viento', 'kmh_banda': lab}, 'geometry': geo})
            except Exception as e: errs.append(f"GDACS geom {p.get('eventid')}: {e}")
    except Exception as e: errs.append('GDACS: ' + str(e))
    if errs and not feats and len(errs) >= 2: raise RuntimeError('; '.join(errs)[:200])
    save('ciclones.json', {'type': 'FeatureCollection', 'features': feats, 'avisos': errs[:6], 'fuente': 'NOAA · National Hurricane Center (Atlántico y Pacífico oriental) y GDACS · Comisión Europea (JRC) / OCHA (todas las cuencas).'})
    return {'sistemas': n, 'avisos': errs[:3]}


# ---------------- AEMET: predicción oficial por municipios (cada ~3 h) ----------------
MUNI = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'municipios_pred.json')

def _dia(dd):
    def best(lst, key='value'):
        lst = [x for x in (lst or []) if x.get(key) not in ('', None)]
        if not lst: return None
        for per in ('00-24', '12-24', '00-12'):
            for x in lst:
                if x.get('periodo') == per: return x
        return lst[0]
    c = best(dd.get('estadoCielo'), 'descripcion')
    pp = [x.get('value') for x in dd.get('probPrecipitacion') or [] if isinstance(x.get('value'), (int, float))]
    vv = best(dd.get('viento'), 'direccion')
    rm = [int(x['value']) for x in dd.get('rachaMax') or [] if str(x.get('value', '')).isdigit()]
    cota = [int(x['value']) for x in dd.get('cotaNieveProv') or [] if str(x.get('value', '')).isdigit()]
    t, hr = dd.get('temperatura') or {}, dd.get('humedadRelativa') or {}
    return {'f': (dd.get('fecha') or '')[:10], 'cielo': (c or {}).get('descripcion'), 'cod': (c or {}).get('value'),
            'tx': t.get('maxima'), 'tn': t.get('minima'), 'pp': max(pp) if pp else None,
            'vd': (vv or {}).get('direccion'), 'vv': (vv or {}).get('velocidad'), 'racha': max(rm) if rm else None,
            'hrx': hr.get('maxima'), 'hrn': hr.get('minima'), 'uv': dd.get('uvMax'), 'cota': max(cota) if cota else None}

@block('aemet_pred', ['pred_aemet.json'])
def aemet_pred():
    """Una sexta parte de los municipios en cada ejecución (cada 30 min): todos se renuevan cada 3 h
    sin superar el ritmo que permite AEMET ni alargar cada ejecución más de unos minutos."""
    prev = None
    try: prev = json.loads(get(f'{SITE}/data/tiempo/pred_aemet.json', timeout=30, tries=1))
    except Exception: pass
    lista = json.load(open(MUNI, encoding='utf-8'))
    old = {m['id']: m for m in (prev or {}).get('m', [])}
    ahora = dt.datetime.now(dt.timezone.utc)
    tanda = (ahora.hour * 2 + ahora.minute // 30) % 6
    if os.environ.get('FORZAR_PRED') == '1' or not old: hacer = lista
    else:
        hacer = [m for i, m in enumerate(lista) if i % 6 == tanda]
        hacer += [m for m in lista if m['id'] not in old and m not in hacer][:10]  # los que falten, poco a poco
    nuevos, fallos = {}, 0
    for mu in hacer:
        try:
            d = json.loads(aemet('prediccion/especifica/municipio/diaria/' + mu['id']).decode('latin-1'))[0]
            nuevos[mu['id']] = {**mu, 'elab': d.get('elaborado'), 'd': [_dia(x) for x in d['prediccion']['dia'][:4]]}
        except Exception as e:
            fallos += 1; print('pred', mu['id'], e)
    out = [nuevos.get(m['id']) or old.get(m['id']) for m in lista]
    out = [m for m in out if m]
    # se descartan predicciones de más de 24 h (por si AEMET falla mucho tiempo)
    def fresca(m):
        try: return (ahora - dt.datetime.fromisoformat(m['elab']).replace(tzinfo=dt.timezone.utc)).total_seconds() < 86400
        except Exception: return False
    out = [m for m in out if fresca(m)]
    if not out: raise RuntimeError('sin predicciones')
    save('pred_aemet.json', {'generado': ahora.strftime('%Y-%m-%dT%H:%M:%SZ'), 'm': out,
        'fuente': '© AEMET. Predicción para municipios (AEMET OpenData). Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma.'})
    return {'municipios': len(out), 'renovados': len(nuevos), 'fallos': fallos}

if __name__ == '__main__':
    only = sys.argv[1:]
    for name, fn in [('aemet_obs', aemet_obs), ('aemet_img', aemet_img), ('metar', metar), ('gfs', gfs), ('ciclones', ciclones), ('aemet_pred', aemet_pred)]:
        if only and name not in only: continue
        print('·', name, flush=True); fn()
    save('estado.json', STATUS)
    print(json.dumps(STATUS, ensure_ascii=False, indent=1))
