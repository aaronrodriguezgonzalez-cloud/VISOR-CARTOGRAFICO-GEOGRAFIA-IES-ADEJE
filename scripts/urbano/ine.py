# ANAMBRO · Red urbana de España: población oficial de los municipios (INE · Revisión del Padrón Municipal)
# Tablas provinciales 2854–2905 (= 2853 + código de provincia). Coordenadas del núcleo principal: AEMET (maestro de municipios).
import json, urllib.request, time, os
OUT = os.environ.get('OUT', '/home/claude/clima/out/data/urbano/municipios_es.json')
YEARS = [1996, 2000, 2005, 2010, 2015, 2020, 2025]
aemet = {m['id'][2:]: m for m in json.loads(open('/home/claude/clima/raw/tiempo/muni_list.json', 'rb').read().decode('latin-1'))}
CAP_PROV = {'01059','02003','03014','04013','05019','06015','07040','08019','09059','10037','11012','12040','13034','14021','15030','16078','17079','18087','19130','20069','21041','22125','23050','24089','25120','26089','27028','28079','29067','30030','31201','32054','33044','34120','35016','36038','37274','38038','39075','40194','41091','42173','43148','44216','45168','46250','47186','48020','49275','50297','51001','52001'}
CAP_CA = {'41091','50297','33044','07040','35016','38038','39075','45168','47186','08019','06083','15078','28079','30030','31201','01059','26089','46250','51001','52001'}
out = []
# Tablas «Población por sexo, municipios y tamaño» de cada provincia (el INE no las numera por código de provincia)
TABLAS = [2854,2855,2856,2857,2858,2859,2860,2861,2862,2863,2864,2865,2866,2868,2869,2870,2871,2872,2873,2874,2875,2876,2877,2878,2879,2880,2881,2882,2883,2884,2885,2886,2888,2889,2890,2891,2892,2893,2894,2895,2896,2899,2900,2901,2902,2903,2904,2905,2906,2907,2908,2909]
seen = set()
for t in TABLAS:
    prov = t
    for i in range(5):
        try:
            with urllib.request.urlopen(f'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{t}?nult=30&tip=AM', timeout=180) as r: d = json.loads(r.read()); break
        except Exception as e: print('reintento', t, e); time.sleep(5 * (i + 1))
    n = 0
    for s in d:
        md = {m['T3_Variable']: m for m in s.get('MetaData', [])}
        mu, sx, tam = md.get('Municipios'), md.get('Sexo'), md.get('Tamaño de los municipios')
        if not mu or not sx or sx['Codigo'] != '0' or (tam and tam['Codigo'] != '0'): continue
        code = mu['Codigo']; a = aemet.get(code)
        if not a or code in seen: continue
        ser = {x['Anyo']: x['Valor'] for x in s['Data'] if x.get('Valor') is not None}
        if 2025 not in ser: continue
        def at(y):
            for yy in (y, y + 1, y - 1):
                if yy in ser: return int(ser[yy])
            return None
        out.append([code, mu['Nombre'], round(float(a['latitud_dec']), 4), round(float(a['longitud_dec']), 4), (2 if code in CAP_CA else 0) + (1 if code in CAP_PROV else 0), [at(y) for y in YEARS], int(float(a.get('altitud') or 0))])
        n += 1; seen.add(code)
    print(prov, n, flush=True); time.sleep(0.4)
out.sort(key=lambda r: -r[5][-1])
json.dump({'fuente': 'INE · Cifras oficiales de población de los municipios españoles (Revisión del Padrón Municipal a 1 de enero). Coordenadas del núcleo principal: AEMET.', 'years': YEARS,
           'cols': ['ine', 'nombre', 'lat', 'lon', 'capital(1=provincia,2=comunidad)', 'poblacion', 'altitud'], 'm': out}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), os.path.getsize(OUT) // 1024, 'KB', out[:3])
