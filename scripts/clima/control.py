import json,sys,numpy as np
sys.path.insert(0,'/home/claude/clima/scripts');import classify as C, facades as F
dW,dE,_=F.load()
d=json.load(open('/home/claude/clima/out/data/clima/normales.json'))
CTRL={'Santiago de Compostela':'C1','A Coruña':'C1','Bilbao Aeropuerto':'C1','Oviedo':'C1','Burgos Aeropuerto':'C2','Valladolid':'C2','Madrid, Retiro':'B1','Sevilla Aeropuerto':'B1','València':'B1','Barcelona Aeropuerto':'B1','Zaragoza Aeropuerto':'B1','Izaña':'G','Gran Canaria Aeropuerto':'F1','Sta.Cruz de Tenerife':'F1',
'Dublin Airport':'C1','Paris-Montsouris':'C1','Brest':'C1','Bergen':'C1','Berlin':'C2','London':'C1','Chicago':'C2','Beijing':'C2','Asturias Aeropuerto':'C1','Moskva':'D2','Jakutsk':'D2','Reykjavík':'D1',
'Roma / Ciampino':'B1','Marseille':'B1','Athinai Airport':'B1','Lisboa / Geofisico':'B1','Shanghai':'C2','Sydney - Observatory Hill':'B2','Tokyo':'C2','New York Central Park, Ny':'C2','Calcutta / Alipore':'A3','Bombay / Colaba':'A3','Buenos Aires':'B2','Manaus':'A1','Singapore / Changi':'A1','Darwin Airport':'A3','Calcutta / Alipore':'A3','Bombay / Colaba':'A3','Cairo':'F1','Miami':'A2','Salvador':'A2','Mumbai':'A3','Vancouver':'C1','Seattle':'C1'}
names={s['n']:s for s in d['s']}
ok=bad=0
for n,exp in CTRL.items():
    s=names.get(n) if n in names else next((x for x in d['s'] if x['n'].lower().startswith(n.lower()[:8]) and '9120' in x['p']),None)
    if not s or '9120' not in s['p']: print('--',n,'no encontrada');continue
    p=s['p']['9120'];T=np.array(p['T'])[:,None];P=np.array(p['P'])[:,None];la=np.array([s['la']])
    w,e=F.at(s['la'],s['lo'],dW,dE)
    m=C.MORDER[C.miller(T,P,la,np.array([s.get('z') or 0]),np.array([w]),np.array([e]))[0]]
    flag='OK ' if m==exp else 'XX '
    ok+=m==exp;bad+=m!=exp
    print(flag,f"{s['n'][:26]:26} {s.get('cn','')[:10]:10} sale {m:3} esperado {exp:3} dW={float(w):6.0f} dE={float(e):6.0f} amp={max(p['T'])-min(p['T']):4.1f}")
print(ok,'bien',bad,'mal')
