# ANAMBRO · Red urbana mundial a partir de ONU · World Urbanization Prospects 2025 (ciudades del Grado de Urbanización)
import csv, gzip, io, json, collections, os
SRC = '/home/claude/clima/raw/urbano/WUP2025-DB-DEGURBA-Cities-Population-Surface-Data.csv.gz'
OUT = os.environ.get('OUT', '/home/claude/clima/out/data/urbano/ciudades_mundo.json')
YEARS = list(range(1975, 2051, 5))
C = {}
with gzip.open(SRC, 'rt', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        y = int(r['Year'])
        k = r['City_Code']
        c = C.setdefault(k, {'n': r['City_Name'], 'iso': r['ISO3_Code'], 'iso2': r['ISO2_Code'], 'pais': r['Location'], 'cap': int(r['Capital'] or 0), 'p': {}, 'locid': r['LocID']})
        try: c['p'][y] = float(r['Pop'])
        except ValueError: pass
        if y == 2025:
            c.update(la=round(float(r['PWCent_Latitude']), 4), lo=round(float(r['PWCent_Longitude']), 4), area=float(r['AREA_km2'] or 0), dens=float(r['Pop_density'] or 0),
                     pct=float(r['percPop'] or 0), rate=float(r['Pop_rate'] or 0), plaus=r['Pop_plausibility'])
out = []
for k, c in C.items():
    if 'la' not in c or 2025 not in c['p']: continue
    out.append([int(k), c['n'], c['iso'], c['cap'], c['la'], c['lo'], [round(c['p'].get(y, 0)) for y in YEARS], round(c['area'], 1), round(c['dens']), round(c['pct'], 2), round(c['rate'], 2)])
out.sort(key=lambda r: -r[6][YEARS.index(2025)])
paises = {}
for c in C.values(): paises[c['iso']] = [c['pais'], c.get('iso2', '')]
json.dump({'fuente': 'United Nations, Department of Economic and Social Affairs, Population Division (2025). World Urbanization Prospects: The 2025 Revision. CC BY 3.0 IGO.',
           'def': 'Ciudades del Grado de Urbanización: zonas continuas con al menos 1.500 hab./km² y 50.000 habitantes, delimitadas con la misma regla en todos los países a partir de rejillas de población de 1 km² e imágenes de satélite (Copernicus GHSL).',
           'years': YEARS, 'cols': ['id', 'nombre', 'iso3', 'capital', 'lat', 'lon', 'pob_miles', 'area_km2', 'densidad', 'pct_pob_pais', 'tasa_crec'],
           'paises': paises, 'c': out}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'ciudades ·', sum(1 for r in out if r[3]), 'capitales ·', os.path.getsize(OUT) // 1024, 'KB')
print(out[:5]); print([r[1] for r in out if r[2] == 'ESP'][:12])
