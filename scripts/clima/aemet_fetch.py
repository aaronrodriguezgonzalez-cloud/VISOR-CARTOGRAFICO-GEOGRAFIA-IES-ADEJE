import json, time, os, sys, urllib.request
K=open('/home/claude/clima/secret/aemet.key').read().strip()
OUT='/home/claude/clima/raw/aemet/normales'; os.makedirs(OUT,exist_ok=True)
inv=json.load(open('/home/claude/clima/raw/aemet/inventario.json'))
def get(url,hdr=True):
    req=urllib.request.Request(url,headers={'api_key':K} if hdr else {})
    with urllib.request.urlopen(req,timeout=60) as r: return r.read()
for i,s in enumerate(inv):
    ind=s['indicativo']; fn=f'{OUT}/{ind}.json'
    if os.path.exists(fn): continue
    for att in range(6):
        try:
            j=json.loads(get('https://opendata.aemet.es/opendata/api/valores/climatologicos/normales/estacion/'+urllib.request.quote(ind)).decode('latin1'))
            if j.get('estado')==404: open(fn,'w').write('[]'); break
            if j.get('estado')==429: time.sleep(30); continue
            if 'datos' not in j: print(ind,j,flush=True); time.sleep(10); continue
            d=get(j['datos'],False).decode('latin1')
            open(fn,'w').write(d); break
        except Exception as e:
            print(ind,'ERR',e,flush=True); time.sleep(15)
    time.sleep(1.3)
    if i%50==0: print(i,ind,flush=True)
print('DONE')
