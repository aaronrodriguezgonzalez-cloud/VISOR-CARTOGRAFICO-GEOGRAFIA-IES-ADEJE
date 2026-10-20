import glob,os,re,json,collections,sys
def read(f):
    b=open(f,'rb').read()
    if b.startswith(b'\xef\xbb\xbf'): b=b[3:]
    try: return b.decode('utf8')
    except UnicodeDecodeError: return b.decode('latin1')
def num(v):
    v=v.strip()
    if v=='' : return None
    try: x=float(v)
    except: return None
    if x<=-99.9 and x in (-99.9,-999.9,-9999.0,-9999.9,-999.0,-99.0,-9999): return None
    if x<=-999: return None
    return x
def parse(f):
    t=read(f).replace('\r','')
    L=[l.split(',') for l in t.split('\n')]
    info={'file':os.path.basename(f)}
    for i,l in enumerate(L):
        k=l[0].strip()
        if k=='Country_Name': info['country']=l[1].strip()
        elif k=='Station_Name': info['name']=l[1].strip()
        elif k=='WMO_Number' and len(l)>1 and l[1].strip()=='Latitude':
            v=L[i+1]; info['wmo']=v[0].strip(); info['lat_s']=v[1].strip(); info['lon_s']=v[2].strip(); info['elev_s']=v[3].strip()
    params={}
    for l in L:
        if len(l)>=16 and re.fullmatch(r'\d+',l[1].strip() or 'x') and re.fullmatch(r'\d+',l[3].strip() or 'x'):
            pc=int(l[1]); cc=int(l[3]); vals=[num(x) for x in l[4:16]]
            key=(pc,cc)
            if key not in params: params[key]=(vals,num(l[16]) if len(l)>16 else None)
            if cc==98 and (pc,98) not in params: params[(pc,98)]=([num(x) for x in l[4:16]],None)
    return info,params
if __name__=='__main__':
    out={}
    for f in sorted(glob.glob('/home/claude/clima/raw/st9120/*.csv')):
        try: info,p=parse(f)
        except Exception as e: print('ERR',f,e); continue
        out[os.path.basename(f)]={'info':info,'p':{f'{a}_{b}':v for (a,b),v in p.items() if a in (1,2,3,4,5,8,38) and b in (1,4,5,98)}}
    json.dump(out,open('/home/claude/clima/raw/wmo9120_parsed.json','w'),ensure_ascii=False)
    c=collections.Counter(k for v in out.values() for k in v['p'])
    print(len(out),c.most_common(30))
