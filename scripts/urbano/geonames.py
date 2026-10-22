# ANAMBRO · Núcleos y localidades del mundo de más de 5.000 habitantes · GeoNames (cities5000, CC BY 4.0)
# Población de la localidad (no de la aglomeración), del año que cada país tenga disponible.
import csv, json, os
IN = '/home/claude/clima/raw/geonames/cities5000.txt'; OUT = '/home/claude/clima/out/data/urbano/localidades.json'
T = {'PPLC': 'c', 'PPLA': '1', 'PPLA2': '2', 'PPLA3': '3', 'PPLA4': '4', 'PPLG': 'g'}
rows = []
csv.field_size_limit(10**7)
for r in csv.reader(open(IN, encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE):
    try: pop = int(r[14] or 0)
    except: pop = 0
    if pop < 5000: continue
    rows.append([r[1], round(float(r[4]), 4), round(float(r[5]), 4), r[8], pop, T.get(r[7], ''), int(r[0])])
rows.sort(key=lambda x: -x[4])
json.dump({'fuente': 'GeoNames (geonames.org) · cities5000 · CC BY 4.0', 'cols': ['nombre', 'lat', 'lon', 'pais_iso2', 'poblacion', 'tipo(c=capital de Estado,1=capital de 1.er nivel,2..4=cabeceras)', 'geonameid'], 'l': rows},
          open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), os.path.getsize(OUT) // 1024, 'KB', rows[:3])
