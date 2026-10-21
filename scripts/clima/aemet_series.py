# Series mensuales AEMET OpenData (1961-2020) de las estaciones de Canarias, para calcular normales con criterios OMM
import json, time, os, urllib.request
K=open('/home/claude/clima/secret/aemet.key').read().strip()
OUT='/home/claude/clima/raw/aemet/series'; os.makedirs(OUT,exist_ok=True)
inv=json.load(open('/home/claude/clima/raw/aemet/inventario.json'))
can=[s for s in inv if s['provincia'] in ('SANTA CRUZ DE TENERIFE','LAS PALMAS')]
def get(url,hdr=True):
    req=urllib.request.Request(url,headers={'api_key':K} if hdr else {})
    with urllib.request.urlopen(req,timeout=90) as r: return r.read()
for s in can:
    ind=s['indicativo']
    for a in range(1961,2021,3):
        fn=f'{OUT}/{ind}_{a}.json'
        if os.path.exists(fn): continue
        b=a+2
        for att in range(8):
            try:
                j=json.loads(get(f'https://opendata.aemet.es/opendata/api/valores/climatologicos/mensualesanuales/datos/anioini/{a}/aniofin/{b}/estacion/{urllib.request.quote(ind)}').decode('latin1'))
                if j.get('estado')==404: open(fn,'w').write('[]'); break
                if j.get('estado')==429: time.sleep(40); continue
                if 'datos' not in j: print(ind,a,j,flush=True); time.sleep(15); continue
                open(fn,'w').write(get(j['datos'],False).decode('latin1')); break
            except Exception as e:
                print(ind,a,'ERR',e,flush=True); time.sleep(20)
        time.sleep(1.5)
    print('ok',ind,flush=True)
print('DONE')
