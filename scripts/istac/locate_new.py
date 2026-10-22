# Sitúa los núcleos creados después de 2001 con el buscador de topónimos de GRAFCAN (IDECanarias)
import json, re, csv, time, unicodedata, urllib.request, urllib.parse
R = '/home/claude/clima/raw/istac'
d = json.load(open('/home/claude/clima/out/data/istac/nucleos.json'))
MUN = {}
for r in csv.DictReader(open('/tmp/claude-0/-home-claude/944c7bba-361a-575e-a9d3-6c41561f306f/scratchpad/cl.csv', encoding='utf-8')):
    if re.fullmatch(r'\d{5}', r['code']): MUN[r['code']] = r['name#es']
N = lambda s: ' '.join(re.sub(r'[^A-Z0-9 ]', ' ', unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().upper()).split())
GOOD = re.compile(r'POBLA|NUCLEO|ENTIDAD|URBANIZ|BARRIO|CASERIO|LUGAR|ASENTAMIENTO|POBLAMIENTO|LOCALIDAD', re.I)
out = {}
for k, n25, t in d['sin_poligono']:
    if not t: continue
    name = re.sub(r'^.*? - ', '', n25); mun = MUN.get(k[:5], '')
    url = 'https://visor.grafcan.es/busquedas/toponimo/1/50/?texto=' + urllib.parse.quote(name)
    try:
        with urllib.request.urlopen(url, timeout=40) as r: res = json.loads(r.read()).get('data', [])
    except Exception as e: print('fallo', k, e); continue
    cand = [x for x in res if N(x.get('localizacion')) == N(mun) or N(mun) in N(x.get('localizacion'))]
    exact = [x for x in cand if N(x['nombre']) == N(name)]
    pool = exact or cand
    pool.sort(key=lambda x: (0 if GOOD.search(N(x.get('clasificacion'))) else 1, -float(x.get('puntuacion') or 0)))
    if pool:
        x = pool[0]; out[k] = {'n': name, 'mun': mun, 'lon': float(x['longitud']), 'lat': float(x['latitud']), 'top': x['nombre'], 'clas': x['clasificacion'], 'exacto': bool(exact)}
    print(k, name, mun, int(t), '→', (out[k]['top'] + ' | ' + out[k]['clas'][:60]) if k in out else 'NO', flush=True)
    time.sleep(0.4)
json.dump(out, open(R + '/nuevos_situacion.json', 'w'), ensure_ascii=False, indent=0)
print(len(out), 'situados')
