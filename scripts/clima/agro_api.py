# AgroCabildo (Cabildo de Tenerife, CC BY) · datos diarios por API, años 1991-2020
import json, os, time, urllib.request, csv
B='https://datos.tenerife.es/api/meteo/latest'
OUT='/home/claude/clima/raw/canarias/agroapi'; os.makedirs(OUT,exist_ok=True)
est=list(csv.DictReader(open('/home/claude/clima/raw/canarias/agrocabildo_est.csv',encoding='utf-8-sig')))
import subprocess
def get(u):
    for a in range(8):
        r=subprocess.run(['curl','-s','-m','120','-H','Accept: application/json',u],capture_output=True)
        t=r.stdout.decode('utf-8','replace')
        if r.returncode==0 and t.lstrip().startswith('{'):
            try: return json.loads(t)
            except Exception: pass
        time.sleep(10*(a+1))
    return None
for e in est:
    sid=e['estacion_id']; y0=max(1991,int(e['fecha_instalacion'][:4]))
    fs=f'{OUT}/{sid}_sensors.json'
    if not os.path.exists(fs):
        s=get(f'{B}/stations/{sid}/sensors')
        if s is None: print('sin sensores',sid,flush=True); continue
        json.dump(s,open(fs,'w'))
    for y in range(y0,2013):  # 2013-2020 se toman de los CSV del portal de datos abiertos
        fn=f'{OUT}/{sid}_{y}.json'
        if os.path.exists(fn): continue
        d=get(f'{B}/readings/summarized/station/{sid}/year/{y}')
        if d is not None: json.dump(d,open(fn,'w'))
        time.sleep(2)
    print('ok',sid,e['estacion_nombre'],flush=True)
# reintento lento de los CSV 2013-2020 del portal que fallaron
import re
cfg=open('/home/claude/clima/raw/canarias/agro_cfg.txt').read()
for u,o in re.findall(r'url = "([^"]+)"\noutput = "([^"]+)"',cfg):
    yr=int(re.search(r'-(\d{4})\.csv$',o).group(1))
    if yr>2020: continue
    o='/home/claude/clima/'+o
    for a in range(6):
        if os.path.exists(o) and not open(o,'rb').read(15).startswith(b'<!DOC'): break
        subprocess.run(['curl','-s','-m','120','-o',o,u]); time.sleep(3+5*a)
print('DONE')
