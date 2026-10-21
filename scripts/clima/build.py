# ANAMBRO · construcción de datos/clima/normales.json
# Fuentes: OMM (NOAA NCEI, normales 1991-2020 y 1961-1990), AEMET OpenData (normales 1991-2020), Meteostat (normales, secundaria).
import json, glob, os, re, gzip, math, collections, unicodedata
from babel import Locale
R = '/home/claude/clima/raw'
OUT = '/home/claude/clima/out/data/clima'
os.makedirs(OUT, exist_ok=True)
ES = Locale('es').territories
EN = Locale('en').territories
EN_REV = {unicodedata.normalize('NFKD', v).encode('ascii', 'ignore').decode().lower(): k for k, v in EN.items() if len(k) == 2}
WMO_CC = {
 'antigua_and_barbuda':'AG','bosnia_and_herzegovina':'BA','bosnia_and_herzegovina_srpska':'BA','brunei_darussalam':'BN','cabo_verde_republic':'CV',
 "cote_d'ivoire":'CI','curacao_a._s._maarten':'CW','dem._rep._congo':'CD','denmark_faroe_islands':'FO','denmark_greenland':'GL','fr._polynesia':'PF',
 'guinea_bissau':'GW','hong_kong_china':'HK','macau_china':'MO','rep._korea':'KR','russian_federation_(in_asia)':'RU','russian_federation_(in_europe)':'RU',
 'st._kitts_and_nevis':'KN','turkiye':'TR','iran':'IR','laos':'LA','syria':'SY','tanzania':'TZ','venezuela':'VE','moldova':'MD','czech_republic':'CZ',
 'united_states':'US','united_kingdom':'GB','myanmar':'MM','saint_lucia':'LC','cayman_islands':'KY','bermuda':'BM'}
import re as _re
_L=lambda x:_re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',str(x)).encode('ascii','ignore').decode().lower())
EN_L={_L(v):k for k,v in EN.items() if len(k)==2}
MAN={'bosniaandherzegovina':'BA','trinidadandtobago':'TT','antiguaandbarbuda':'AG','stvincentandthegrenadines':'VC','saotomeandprincipe':'ST','korea':'KR','repkorea':'KR','republicofkorea':'KR','uae':'AE','unitedarabemirates':'AE','russianfederation':'RU','russianfederationinasia':'RU','russianfederationineurope':'RU','iran':'IR','iranislamicrepublicof':'IR','laos':'LA','syria':'SY','syrianarabrepublic':'SY','caboverde':'CV','caboverderepublic':'CV','capeverde':'CV','cotedivoire':'CI','hongkongchina':'HK','hongkong':'HK','macaochina':'MO','macauchina':'MO','republicofcongo':'CG','congo':'CG','curacaoandsintmaarten':'CW','curacaoasmaarten':'CW','turkiye':'TR','turkey':'TR','stkittsandnevis':'KN','bruneidarussalam':'BN','czechrepublic':'CZ','moldova':'MD','republicofmoldova':'MD','tanzania':'TZ','unitedrepublicoftanzania':'TZ','venezuela':'VE','bosniaandherzegovinarepublicofsrpska':'BA','bosniaandherzegovinasrpska':'BA','denmarkfaroeislands':'FO','denmarkgreenland':'GL','unitedstates':'US','unitedstatesofamerica':'US','unitedkingdom':'GB','demrepcongo':'CD','democraticrepublicofthecongo':'CD','frpolynesia':'PF','frenchpolynesia':'PF','guineabissau':'GW','myanmar':'MM','vietnam':'VN','libyanarabjamahiriya':'LY','libya':'LY','afghanistanislamicstateof':'AF','koreademocraticpeoplesrepublicof':'KP','laopeoplesdemocraticrepublic':'LA','russia':'RU','gambia':'GM','bahamas':'BS','micronesia':'FM','macedonia':'MK','yugoslavia':'RS','serbiaandmontenegro':'RS','czechoslovakia':'CZ','ussr':'RU','vietnamsocialistrepublicof':'VN','unitedrepublicoftanzania':'TZ','saintlucia':'LC','eswatini':'SZ','swaziland':'SZ'}
def cc_from_name(n):
    if not n: return None
    raw=str(n)
    if 'ANTARCTIC' in raw.upper(): return 'AQ'
    base=_re.sub(r'\(.*?\)','',raw)
    for cand in (raw,base,base.split(',')[0]):
        k=_L(cand)
        if not k: continue
        if k in MAN: return MAN[k]
        if k in EN_L: return EN_L[k]
    k=_L(base.split(',')[0])
    for name,code in EN_L.items():
        if k and (name.startswith(k) or k.startswith(name)) and len(name)>3: return code
    return None
NCDC={}
for _l in open(R+'/n6190/CTRYCOD1.TXT',encoding='latin1'):
    _m=_re.match(r'\s+([A-Z0-9]{2})\s{2,}(.+?)\s*$',_l)
    if _m: NCDC[_m[1]]=_m[2]

SMALL = {'de','del','la','las','los','el','y','e','en','da','do','dos','das','di','du','des','le','les','van','von','der','den','al','a','und','sur','sul'}
def nice(s):
    s = re.sub(r'\s+', ' ', s.replace('_', ' ')).strip()
    if not s: return s
    if s != s.upper(): return s  # ya tiene mayúsculas y minúsculas
    out = []
    for i, w in enumerate(re.split(r'(\s|/|-|\(|\)|\.|,)', s.lower())):
        if not w: continue
        if i > 0 and w in SMALL: out.append(w)
        elif re.fullmatch(r'[ivx]+', w) and len(w) <= 4: out.append(w.upper())
        else: out.append(w[:1].upper() + w[1:])
    r = ''.join(out)
    r = re.sub(r'\bSta\.', 'Sta.', r)
    return r[:1].upper() + r[1:]

def r1(x): return None if x is None else round(x + 0.0, 1)
def full(a): return a is not None and len(a) == 12 and all(v is not None for v in a)
def dms(s):
    # '28|18|32|N' o '394924N'
    s = s.strip().strip('"')
    m = re.fullmatch(r'(\d+)\|(\d+)\|(\d+(?:\.\d+)?)\|([NSEW])', s)
    if m: d, mi, se, h = float(m[1]), float(m[2]), float(m[3]), m[4]
    elif re.search(r'[NSEW]\s*$', s) and '|' in s:
        h = s.strip()[-1]; parts = [x for x in re.split(r'[|\s]+', s[:-1]) if x.strip()]
        try: nums = [float(x) for x in parts]
        except ValueError: return None
        nums += [0, 0, 0]; d, mi, se = nums[:3]
    else:
        m = re.fullmatch(r'(\d{2,3})(\d{2})(\d{2})([NSEW])', s)
        if not m: return None
        d, mi, se, h = float(m[1]), float(m[2]), float(m[3]), m[4]
    v = d + mi / 60 + se / 3600
    return -v if h in 'SW' else v

stations = {}   # id -> dict
def station(key, **kw):
    s = stations.setdefault(key, {'id': key, 'p': {}})
    for k, v in kw.items():
        if v is not None and s.get(k) in (None, ''): s[k] = v
    return s

# ---------- Meteostat (metadatos: nombres, país, coordenadas) ----------
MS = {s['id']: s for s in json.load(open(R + '/meteostat/full.json'))}
def ms_normals(mid):
    f = f'{R}/meteostat/normals/{mid}.csv.gz'
    if not os.path.exists(f): return {}
    try: rows = [l.split(',') for l in gzip.open(f, 'rt').read().split('\n') if l]
    except Exception: return {}
    per = collections.defaultdict(dict)
    for r in rows:
        per[(int(r[0]), int(r[1]))][int(r[2])] = r
    out = {}
    for (a, b), months in per.items():
        if len(months) != 12: continue
        g = lambda i: [float(months[m][i]) if months[m][i] != '' else None for m in range(1, 13)]
        tn, tx, p = g(3), g(4), g(5)
        if not (full(tn) and full(tx) and full(p)): continue
        out[(a, b)] = {'Tn': tn, 'Tx': tx, 'P': p}
    return out
def ms_ok(mid, a, b):
    s = MS.get(mid)
    if not s: return False
    inv = s['inventory']['monthly']
    st, en = inv.get('start'), inv.get('end')
    # exigimos que la serie mensual de la estación cubra al menos 24 de los 30 años
    return isinstance(st, int) and isinstance(en, int) and st <= a + 6 and en >= b

QC = collections.Counter()
LIM = {'T': (-75, 45), 'Tx': (-70, 55), 'Tn': (-80, 40), 'P': (0, 4000), 'S': (0, 480), 'H': (1, 100), 'D': (0, 31)}
def okr(a, k):
    lo, hi = LIM[k]
    return full(a) and all(lo <= v <= hi for v in a)
def mkper(src, T=None, Tx=None, Tn=None, P=None, D=None, S=None, H=None, years=None, dthr=None, note=None):
    # control de calidad básico: se descartan variables con valores físicamente imposibles o incoherentes
    v = {'T': T, 'Tx': Tx, 'Tn': Tn, 'P': P, 'D': D, 'S': S, 'H': H}
    for k in v:
        if v[k] is not None and full(v[k]) and not okr(v[k], k): QC['fuera de rango ' + k] += 1; v[k] = None
    if full(v['Tx']) and full(v['Tn']) and any(x < n for x, n in zip(v['Tx'], v['Tn'])):
        QC['Tmáx<Tmín'] += 1; v['Tx'] = v['Tn'] = None
    if full(v['T']) and full(v['Tx']) and full(v['Tn']) and any(t > x + 1.5 or t < n - 1.5 for t, x, n in zip(v['T'], v['Tx'], v['Tn'])):
        QC['T fuera de [Tmín,Tmáx]'] += 1; v['Tx'] = v['Tn'] = None
    T, Tx, Tn, P, D, S, H = v['T'], v['Tx'], v['Tn'], v['P'], v['D'], v['S'], v['H']
    tcalc = 0
    if not full(T) and full(Tx) and full(Tn):
        T = [(x + n) / 2 for x, n in zip(Tx, Tn)]; tcalc = 1
    if not (full(T) and full(P)): return None
    d = {'src': src, 'T': [r1(v) for v in T], 'P': [r1(v) for v in P]}
    if tcalc: d['tc'] = 1
    for k, v in (('Tx', Tx), ('Tn', Tn), ('D', D), ('S', S), ('H', H)):
        if full(v): d[k] = [r1(x) for x in v]
    if years: d['y'] = years
    if dthr and 'D' in d: d['dt'] = dthr
    if note: d['nt'] = note
    return d

# ---------- OMM 1991-2020 ----------
W = json.load(open(R + '/wmo9120_parsed.json'))
meta8 = {}
import csv
for r in list(csv.reader(open(R + '/n9120/meta8.csv', encoding='latin1')))[1:]:
    if len(r) < 15: continue
    meta8[(re.sub(r'[^a-z]','',r[1].lower()), r[14].strip())] = (float(r[3]), float(r[4]), float(r[5]))
    meta8.setdefault(('*', r[14].strip()), (float(r[3]), float(r[4]), float(r[5])))
cnt = collections.Counter()
for fn, s in W.items():
    info, p = s['info'], s['p']
    folder_country = fn.split('__')[1] if '__' in fn else ''
    base = fn.split('__')[-1]
    m8 = meta8.get((re.sub(r'[^a-z]','',folder_country.lower()), base)) or meta8.get(('*', base))
    lat = m8[0] if m8 else dms(info.get('lat_s', ''))
    lon = m8[1] if m8 else dms(info.get('lon_s', ''))
    try: z = m8[2] if m8 else float(info.get('elev_s', 'nan'))
    except ValueError: z = None
    wmo0 = re.sub(r'\D', '', info.get('wmo', '') or '').zfill(5)
    if (lat is None or lon is None) and wmo0 in MS:
        loc = MS[wmo0]['location']; lat, lon = loc['latitude'], loc['longitude']; z = z if z is not None and not (isinstance(z, float) and math.isnan(z)) else loc.get('elevation')
    if lat is None or lon is None: cnt['sin coord'] += 1; continue
    wmo = re.sub(r'\D', '', info.get('wmo', '') or '')
    wmo = wmo.zfill(5) if wmo and len(wmo) <= 5 else (wmo or None)
    def g(k): v = p.get(k); return v[0] if v else None
    def ny(k):
        v = p.get(k); return min(x for x in v[0] if x is not None) if v and any(x is not None for x in v[0]) else None
    per = mkper('OMM', T=g('5_1'), Tx=g('3_1'), Tn=g('4_1'), P=g('1_4'), D=g('2_5'), S=g('8_4'), H=g('38_1'), dthr='1')
    if not per: cnt['incompleta'] += 1; continue
    nys = [x for x in (ny('1_98'), ny('5_98') or ny('3_98')) if x]
    if nys: per['n'] = int(min(nys))
    cc = cc_from_name(folder_country) or cc_from_name(info.get('country', ''))
    key = 'W' + wmo if wmo and len(wmo) == 5 else 'X' + re.sub(r'\W', '', base)
    if key in stations and '9120' in stations[key]['p']: cnt['dup'] += 1; continue
    msn = MS.get(wmo, {}).get('name', {}).get('en') if wmo else None
    nm = info.get('name') or base
    name = nice(nm) if any(ch in nm for ch in 'ÁÉÍÓÚÑÜáéíóúñüÇçÅÄÖØ') or not msn else msn
    stn = station(key, n=name, c=cc, la=round(lat, 4), lo=round(lon, 4), z=None if z is None or math.isnan(z) else round(z), w=wmo)
    stn['p']['9120'] = per
    cnt['ok'] += 1
print('OMM 9120', cnt)

# ---------- AEMET 1991-2020 ----------
inv = {s['indicativo']: s for s in json.load(open(R + '/aemet/inventario.json'))}
cnt = collections.Counter()
for f in glob.glob(R + '/aemet/normales/*.json'):
    ind = os.path.basename(f)[:-5]
    try: d = json.load(open(f))
    except Exception: cnt['err'] += 1; continue
    if not d: cnt['vacía'] += 1; continue
    ms = {r['mes']: r for r in d}
    def col(k, fac=1.0):
        a = []
        for m in range(1, 13):
            v = ms.get('%02d' % m, {}).get(k)
            try: a.append(float(v) * fac)
            except (TypeError, ValueError): a.append(None)
        return a
    days = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    S = col('inso_md'); S = [None if v is None else v * dd for v, dd in zip(S, days)] if full(S) else None
    per = mkper('AEMET', T=col('tm_mes_md'), Tx=col('tm_max_md'), Tn=col('tm_min_md'), P=col('p_mes_md'), D=col('np_010_md'), S=S, H=col('hr_md'), dthr='1')
    if not per: cnt['incompleta'] += 1; continue
    nn = [x for x in col('p_mes_n') + col('tm_mes_n') if x is not None]
    if nn: per['n'] = int(min(nn))
    st = inv.get(ind, {})
    lat, lon = dms(st.get('latitud', '')), dms(st.get('longitud', ''))
    if lat is None: cnt['sin coord'] += 1; continue
    wmo = (st.get('indsinop') or '').strip() or None
    key = 'W' + wmo.zfill(5) if wmo and ('W' + wmo.zfill(5)) in stations else 'A' + ind
    s = stations.get(key)
    if s and '9120' in s['p']:
        s['p']['9120_omm'] = s['p']['9120']  # se conserva para contraste
    s = station(key, n=nice(st.get('nombre', ind)), c='ES', la=round(lat, 4), lo=round(lon, 4), z=int(float(st.get('altitud') or 0)), w=wmo.zfill(5) if wmo else None)
    s['a'] = ind; s['n'] = nice(st.get('nombre', ind)); s['pr'] = st.get('provincia')
    s['p']['9120'] = per
    cnt['ok'] += 1
print('AEMET 9120', cnt)

# ---------- OMM 1961-1990 ----------
meta61 = {}
for l in open(R + '/n6190/STNMETA.DAT', encoding='latin1'):
    k = l[0:17]
    def ll(a):
        m = re.fullmatch(r'\s*(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])', a)
        if not m: return None
        la = int(m[1]) + int(m[2]) / 60; lo = int(m[4]) + int(m[5]) / 60
        return (-la if m[3] == 'S' else la, -lo if m[6] == 'W' else lo)
    c1 = ll(l[18:29]); c2 = ll(l[35:46])
    try: z = int(l[29:35])
    except ValueError:
        try: z = int(l[46:50])
        except ValueError: z = None
    meta61[k] = {'ll': c1 or c2, 'z': z, 'name': (l[56:90].strip() or l[90:136].strip()), 'cty': l[158:208].strip()}
recs = collections.defaultdict(dict)
for l in open(R + '/n6190/ALLNORMS.DAT', encoding='latin1'):
    if len(l) < 140: continue
    k = l[0:17]; code = l[26:30] + '|' + l[30:36].strip()
    def v(i):
        s = l[37 + i * 8:44 + i * 8].strip()
        try: x = float(s)
        except ValueError: return None
        if x in (-9999.9, -99999, -9999, -9797.9, -97979): return 0.0 if x in (-9797.9, -97979) else None
        if x in (88888.8, 8888888): return 0.0
        return x
    vals = [v(i) for i in range(12)]
    recs[k].setdefault(code, (vals, l[17:25]))
cnt = collections.Counter()
for k, r in recs.items():
    def g(*codes):
        for c in codes:
            if c in r and full(r[c][0]): return r[c][0]
        return None
    T = g('0101|'); Tx = g('0201|', '0109|'); Tn = g('0301|', '0110|'); P = g('0615|', '0601|')
    D = g('9515|1.0'); dthr = '1'
    if D is None:
        D = g('BT15|'); dthr = '0.1' if D else None
    per = mkper('OMM', T=T, Tx=Tx, Tn=Tn, P=P, D=D, S=g('1544|'), H=g('1101|'), dthr=dthr)
    if not per: cnt['incompleta'] += 1; continue
    yrs = r.get('0615|', r.get('0601|', (None, None)))[1]
    if yrs and yrs.strip() and yrs != '19611990': per['y'] = yrs[:4] + '–' + yrs[4:]
    wmo = k[3:8]
    m = meta61.get(k, {})
    key = 'W' + wmo if not wmo.endswith('000') else 'Y' + k.replace(' ', '')
    if key not in stations:
        if not m.get('ll'): cnt['sin coord'] += 1; continue
        ccn = m.get('cty', '')
        msn = MS.get(wmo, {}).get('name', {}).get('en')
        station(key, n=msn or nice(m.get('name') or wmo), c=MS.get(wmo, {}).get('country') or cc_from_name(NCDC.get(k[1:3], ccn)) , la=round(m['ll'][0], 4), lo=round(m['ll'][1], 4), z=m.get('z'), w=wmo)
        cnt['nueva'] += 1
    stations[key]['p']['6190'] = per
    cnt['ok'] += 1
print('OMM 6190', cnt)

# ---------- Canarias: normales calculadas por ANAMBRO (series AEMET) y AgroCabildo ----------
CN = json.load(open(R + '/canarias_normales.json')) if os.path.exists(R + '/canarias_normales.json') else {}
cnt = collections.Counter()
for k, c in CN.items():
    pers = {}
    for pk, per in c['p'].items():
        d = mkper(per['src'], T=per.get('T'), Tx=per.get('Tx'), Tn=per.get('Tn'), P=per.get('P'), D=per.get('D'), S=per.get('S'), H=per.get('H'), dthr=per.get('dt'))
        if d: d['n'] = per['n']; d['y'] = per.get('y'); d['prov'] = per.get('prov', 0); pers[pk] = d
    if not pers: continue
    if k.startswith('A'):
        ind = c['a']; wmo = (c.get('wmo') or '').strip()
        key = 'W' + wmo.zfill(5) if wmo and ('W' + wmo.zfill(5)) in stations else 'A' + ind
        s = stations.get(key)
        lat, lon = dms(c.get('lat') or ''), dms(c.get('lon') or '')
        if s is None:
            if lat is None: continue
            s = station(key, n=nice(c.get('name') or ind), c='ES', la=round(lat, 4), lo=round(lon, 4), z=int(float(c.get('z') or 0)), w=wmo.zfill(5) if wmo else None)
            s['a'] = ind; s['pr'] = inv.get(ind, {}).get('provincia')
        for pk, d in pers.items():
            old = s['p'].get(pk)
            # la normal oficial de AEMET u OMM se conserva; la calculada por ANAMBRO solo rellena huecos o sustituye a Meteostat
            if old is None or old.get('src') == 'MS': s['p'][pk] = d; cnt['AEMETc ' + pk] += 1
    else:
        key = 'T' + c['cab']
        s = station(key, n=nice(c['name'].replace('_', ' ')) + (' (' + c['muni'] + ')' if c.get('muni') else ''), c='ES', la=round(c['lat'], 4), lo=round(c['lon'], 4), z=int(c['z']) if c.get('z') is not None else None)
        s['cab'] = c['cab']; s['pr'] = 'SANTA CRUZ DE TENERIFE'; s['p'].update(pers); cnt['CAB'] += 1
print('Canarias', cnt)

# ---------- Meteostat (secundaria): rellena periodos que faltan ----------
cnt = collections.Counter()
by_wmo = {s.get('w'): k for k, s in stations.items() if s.get('w')}
for mid, s in MS.items():
    if not s['inventory']['normals'].get('start'): continue
    nm = None
    wmo = (s['identifiers'].get('wmo') or '').strip() or None
    key = by_wmo.get(wmo) if wmo else None
    for (a, b), pk in (((1991, 2020), '9120'), ((1961, 1990), '6190')):
        if key and pk in stations[key]['p']: continue
        if not ms_ok(mid, a, b): continue
        if nm is None: nm = ms_normals(mid)
        n = nm.get((a, b))
        if not n: continue
        per = mkper('MS', Tx=n['Tx'], Tn=n['Tn'], P=n['P'])
        if not per: continue
        if key is None:
            key = 'W' + wmo if wmo else 'M' + mid
            loc = s['location']
            station(key, n=s['name'].get('en') or mid, c=s.get('country'), la=round(loc['latitude'], 4), lo=round(loc['longitude'], 4), z=loc.get('elevation'), w=wmo)
            cnt['nueva'] += 1
            if wmo: by_wmo[wmo] = key
        stations[key]['p'][pk] = per; stations[key]['ms'] = mid
        cnt[pk] += 1
print('Meteostat', cnt)

# ---------- salida ----------
out = []
for k, s in stations.items():
    if '9120' not in s['p'] and '6190' not in s['p']: continue
    s['p'].pop('9120_omm', None)
    c = s.get('c')
    s['cn'] = ES.get(c, c) if c else ''
    out.append(s)
import sys as _s; _s.path.insert(0,'/home/claude/clima/scripts'); import facades as _FA
_DW,_DE,_=_FA.load()
for s in out:
    w,e=_FA.at(s['la'],s['lo'],_DW,_DE); w=float(w); e=float(e)
    s['fw']=None if not math.isfinite(w) else int(round(w)); s['fe']=None if not math.isfinite(e) else int(round(e))
out.sort(key=lambda s: (s.get('cn') or '', s['n']))
src = {
 'OMM': {'t': 'Organización Meteorológica Mundial (OMM) · normales climatológicas, distribuidas por NOAA NCEI', 'u': 'https://www.ncei.noaa.gov/products/wmo-climate-normals', 'l': 'Datos de los servicios meteorológicos nacionales recopilados por la OMM (WMO-No. 1203); acceso público NOAA NCEI.'},
 'AEMET': {'t': 'AEMET · Agencia Estatal de Meteorología · valores normales 1991-2020 (AEMET OpenData)', 'u': 'https://opendata.aemet.es', 'l': '© AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma.'},
 'AEMETc': {'t': 'AEMET · series mensuales (AEMET OpenData); normal calculada por ANAMBRO con los criterios de la OMM', 'u': 'https://opendata.aemet.es', 'l': '© AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma. Normal estándar con ≥ 24 años válidos por mes; provisional con 10–23.'},
 'CAB': {'t': 'Cabildo de Tenerife · red agrometeorológica AgroCabildo (datos abiertos)', 'u': 'https://datos.tenerife.es', 'l': 'CC BY 4.0. Normal provisional 1991–2020 calculada por ANAMBRO solo con los años disponibles dentro del periodo (meses con datos completos; regla 11/5 de la OMM para la temperatura).'},
 'MS': {'t': 'Meteostat · normales climáticas (fuente secundaria)', 'u': 'https://meteostat.net', 'l': 'CC BY-NC 4.0. Normales calculadas por Meteostat a partir de datos de NOAA, DWD y otros servicios; Tm = (Tmáx + Tmín)/2.'}}
data = {'v': '2026-10-20', 'src': src, 's': out}
json.dump(data, open(OUT + '/normales.json', 'w'), ensure_ascii=False, separators=(',', ':'))
c = collections.Counter((pk, p['src']) for s in out for pk, p in s['p'].items())
print(len(out), 'estaciones', c, os.path.getsize(OUT + '/normales.json') // 1024, 'KB')
print('QC',QC)
