# ANAMBRO · Situación de los núcleos de población de Canarias a partir de la Cartografía Estadística de GRAFCAN (WMS CARTO_EST, capa NUC2001).
# El servicio solo ofrece imágenes: se descarga el mapa de contornos, se separan los recintos (componentes conexas) y se pregunta al servicio
# (GetFeatureInfo) qué núcleo hay en un punto interior de cada recinto. Resultado: centroide, superficie y códigos INE de cada núcleo.
import io, json, math, re, time, urllib.request, concurrent.futures as cf
import numpy as np
from PIL import Image
from scipy import ndimage
URL = 'https://idecan2.grafcan.es/ServicioWMS/CARTO_EST?'
RES = 0.0002   # grados por píxel (~20 m)
TILE = 2000
import os
ONLY=os.environ.get('ISLA')
ISLAS = {'El Hierro': [-18.17, 27.62, -17.86, 27.86], 'La Palma': [-18.01, 28.44, -17.71, 28.86], 'La Gomera': [-17.36, 27.99, -17.08, 28.22],
         'Tenerife': [-16.93, 27.98, -16.11, 28.6], 'Gran Canaria': [-15.84, 27.73, -15.35, 28.19], 'Fuerteventura': [-14.53, 28.03, -13.80, 28.77],
         'Lanzarote': [-13.89, 28.83, -13.40, 29.43]}
def get(u, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(u, timeout=90) as r: return r.read()
        except Exception as e: time.sleep(2 * (i + 1))
    raise RuntimeError('fallo ' + u)
def mosaic(b):
    W = int(math.ceil((b[2] - b[0]) / RES)); H = int(math.ceil((b[3] - b[1]) / RES)); A = np.zeros((H, W), bool)
    for y0 in range(0, H, TILE):
        for x0 in range(0, W, TILE):
            w = min(TILE, W - x0); h = min(TILE, H - y0)
            bb = [b[0] + x0 * RES, b[3] - (y0 + h) * RES, b[0] + (x0 + w) * RES, b[3] - y0 * RES]
            png = get(URL + f'SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=NUC2001&STYLES=&SRS=EPSG:4326&BBOX={bb[0]},{bb[1]},{bb[2]},{bb[3]}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png&TRANSPARENT=TRUE')
            im = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
            A[y0:y0 + h, x0:x0 + w] = im[:, :, 3] > 40
    return A, W, H
def gfi(lon, lat):
    d = RES
    x = get(URL + f'SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=NUC2001&QUERY_LAYERS=NUC2001&STYLES=&SRS=EPSG:4326&BBOX={lon-d},{lat-d},{lon+d},{lat+d}&WIDTH=3&HEIGHT=3&X=1&Y=1&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1').decode('utf-8', 'replace')
    f = lambda k: (re.search(f'<{k}>([^<]*)</{k}>', x) or [None, None])[1]
    if not f('PROVMUN'): return None
    return {k: f(k) for k in ('PROVMUN', 'CENTC', 'CENTS', 'CNUC', 'NMUN', 'NENTS', 'NNUC', 'AREA', 'POB_TOT')}
import rasterio.features as rf
from rasterio.transform import from_origin
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
feats = {}
for isla, b in ISLAS.items():
    if ONLY and isla!=ONLY: continue
    t0 = time.time(); A, W, H = mosaic(b)
    lab, n = ndimage.label(~A)
    idx = np.arange(1, n + 1)
    sizes = ndimage.sum(np.ones(lab.shape, np.int32), lab, index=idx)
    dist = ndimage.distance_transform_edt(~A)
    best = ndimage.maximum_position(dist, lab, index=idx)
    cand = [(int(i + 1), best[i]) for i in range(n) if sizes[i] >= 4 and sizes[i] < 0.5 * W * H]
    def ask(c):
        k, (py, px) = c
        lon = b[0] + (px + .5) * RES; lat = b[3] - (py + .5) * RES
        try: return k, gfi(lon, lat)
        except Exception: return k, None
    with cf.ThreadPoolExecutor(8) as ex: res = dict(ex.map(ask, cand))
    _, (iy, ix) = ndimage.distance_transform_edt(lab == 0, return_indices=True)
    full = lab[iy, ix].astype(np.int32)
    keep = np.zeros(n + 1, bool)
    for k, a in res.items():
        if a: keep[k] = True
    full[~keep[full]] = 0
    T = from_origin(b[0], b[3], RES, RES)
    for geom, k in rf.shapes(full, mask=full > 0, transform=T):
        a = res.get(int(k))
        if not a: continue
        code = f"{a['PROVMUN']}_E{a['CENTS']}_N{a['CNUC']}"
        feats.setdefault(code, {'a': a, 'isla': isla, 'g': []})['g'].append(shape(geom))
    print(isla, W, H, 'recintos', len(cand), 'con dato', sum(1 for v in res.values() if v), 'unidades', len(feats), round(time.time() - t0), 's', flush=True)
out = []
def rnd(o):
    if isinstance(o[0], (float, int)): return [round(o[0], 5), round(o[1], 5)]
    return [rnd(x) for x in o]
for code, v in feats.items():
    g = unary_union(v['g']).simplify(RES * .6, preserve_topology=True); a = v['a']; m = mapping(g)
    out.append({'type': 'Feature', 'geometry': {'type': m['type'], 'coordinates': rnd(m['coordinates'])},
                'properties': {'code': code, 'mun': a['PROVMUN'], 'nmun': a['NMUN'], 'ent': a['NENTS'], 'nuc': a['NNUC'], 'cents': a['CENTS'], 'cnuc': a['CNUC'], 'isla': v['isla'], 'area_km2': round(float(a['AREA'] or 0) / 1e6, 3), 'pob2001': int(float(a['POB_TOT'] or 0))}})
json.dump({'type': 'FeatureCollection', 'fuente': 'Contornos digitalizados por ANAMBRO a partir de la Cartografía Estadística de IDECanarias (GRAFCAN / ISTAC), capa «Núcleos de población 2001» (WMS CARTO_EST)', 'features': out},
          open('/home/claude/clima/raw/istac/nucleos2001.geojson', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'unidades')
