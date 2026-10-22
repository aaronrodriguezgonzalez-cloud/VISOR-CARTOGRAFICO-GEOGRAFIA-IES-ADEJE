# ANAMBRO · descarga de puntos de SIGNA (IGN) para los indicadores del Análisis geográfico
# Equipamientos, centrales y explotaciones mineras: solo coordenadas (lon, lat), agrupadas por indicador.
import json, urllib.request, urllib.parse, time, os, datetime as dt
SRV = 'https://certiserviciosgis.ign.es/servicios/rest/services/signa/05_servicios_industria/MapServer/'
GRUPOS = {'eq_hosp': [1], 'eq_san': [2], 'eq_mayor': [3], 'eq_univ': [5], 'eq_edu': [6, 7], 'en_vec': [18], 'eq_cem': [22],
          'en_eol': [13], 'en_sol': [14, 15], 'en_nuc': [10], 'en_hid': [11], 'en_ter': [12, 16], 'pr_min': [30, 31]}
OUT = os.environ.get('OUT', 'data/signa/puntos.json')
def q(layer, off):
    p = {'where': '1=1', 'outFields': 'OBJECTID', 'returnGeometry': 'true', 'outSR': '4326', 'f': 'json', 'resultOffset': off, 'resultRecordCount': 2000}
    for i in range(6):
        try:
            with urllib.request.urlopen(SRV + str(layer) + '/query?' + urllib.parse.urlencode(p), timeout=120) as r: return json.loads(r.read())
        except Exception as e:
            print('  reintento', layer, off, e, flush=True); time.sleep(5 * (i + 1))
    raise RuntimeError('SIGNA no responde')
res = {}
for k, lays in GRUPOS.items():
    pts = []
    for l in lays:
        off = 0
        while True:
            d = q(l, off); fs = d.get('features', [])
            for f in fs:
                g = f.get('geometry') or {}
                if 'x' in g: pts += [round(g['x'], 5), round(g['y'], 5)]
                elif g.get('points'): pts += [round(g['points'][0][0], 5), round(g['points'][0][1], 5)]
            if not d.get('exceededTransferLimit') and len(fs) < 2000: break
            off += len(fs); time.sleep(0.5)
    res[k] = pts; print(k, len(pts) // 2, flush=True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'generado': dt.date.today().isoformat(), 'fuente': '© Instituto Geográfico Nacional · SIGNA (CC BY 4.0)', 'c': res}, open(OUT, 'w'), separators=(',', ':'))
print(os.path.getsize(OUT) // 1024, 'KB')
