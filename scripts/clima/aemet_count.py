import json,glob,collections
c=collections.Counter()
for f in glob.glob('/home/claude/clima/raw/aemet/normales/*.json'):
    try: d=json.load(open(f))
    except Exception: c['err']+=1; continue
    if not d: c['sin normales']+=1; continue
    ms={r['mes']:r for r in d}
    P=all(ms.get('%02d'%m,{}).get('p_mes_md') not in (None,'') for m in range(1,13))
    T=all(ms.get('%02d'%m,{}).get('tm_mes_md') not in (None,'') for m in range(1,13))
    c[('P' if P else 'sinP')+'/'+('T' if T else 'sinT')]+=1
print(sum(c.values()),dict(c))
