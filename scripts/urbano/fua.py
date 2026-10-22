# ANAMBRO · Áreas urbanas funcionales (áreas metropolitanas) del mundo · GHS-FUA R2019A (Centro Común de Investigación, Comisión Europea)
# Polígonos en Mollweide (ESRI:54009) → WGS84, simplificados; población 2015 del área, de su(s) centro(s) urbano(s) y de la corona de desplazamientos.
import sqlite3, json
from shapely import wkb
from shapely.ops import transform
from pyproj import Transformer
G = '/home/claude/clima/raw/fua/x/GHS_FUA_UCDB2015_GLOBE_R2019A_54009_1K_V1_0.gpkg'
OUT = '/home/claude/clima/out/data/urbano/areas_metropolitanas.json'
tr = Transformer.from_crs('ESRI:54009', 'EPSG:4326', always_xy=True).transform
c = sqlite3.connect(G); t = c.execute("select table_name from gpkg_contents").fetchone()[0]
def gp(b):  # GeoPackage binary → WKB
    flags = b[3]; env = (flags >> 1) & 7; n = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]; return b[8 + n:]
feats = []
for fid, g, name, iso, cn, area, ucarea, p, ucp, comp, ucn in c.execute(f"select fid,geom,eFUA_name,Cntry_ISO,Cntry_name,FUA_area,UC_area,FUA_p_2015,UC_p_2015,Com_p_2015,UC_num from '{t}'"):
    if not g or not p: continue
    s = wkb.loads(gp(g)).simplify(1500 if p < 1e6 else 900, preserve_topology=True)
    s = transform(tr, s)
    if s.is_empty: continue
    def rnd(o):
        if isinstance(o[0], (float, int)): return [round(o[0], 3), round(o[1], 3)]
        return [rnd(x) for x in o]
    gj = s.__geo_interface__
    feats.append({'type': 'Feature', 'geometry': {'type': gj['type'], 'coordinates': rnd(gj['coordinates'])},
                  'properties': {'n': name, 'iso': iso, 'p': round(p), 'pu': round(ucp or 0), 'pc': round(comp or 0), 'a': round(area or 0), 'au': round(ucarea or 0), 'nu': int(ucn or 0),
                                 'c': [round(s.representative_point().x, 3), round(s.representative_point().y, 3)]}})
feats.sort(key=lambda f: -f['properties']['p'])
json.dump({'type': 'FeatureCollection', 'fuente': 'Schiavina, M., Moreno-Monroy, A., Maffenini, L., Veneri, P. (2019): GHS-FUA R2019A · GHS Functional Urban Areas, derived from GHS-UCDB R2019A (2015). Comisión Europea, Centro Común de Investigación (JRC). CC BY 4.0',
           'campos': {'p': 'población 2015 del área funcional', 'pu': 'población de su(s) centro(s) urbano(s)', 'pc': 'población de la corona de desplazamientos', 'a': 'superficie km²', 'au': 'superficie de los centros urbanos km²', 'nu': 'número de centros urbanos'},
           'features': feats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
import os; print(len(feats), os.path.getsize(OUT) // 1024, 'KB')
