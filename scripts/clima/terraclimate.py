# TerraClimate (Abatzoglou et al., 2018) · normales 1961-1990 y 1991-2020 a 1/12° (media de bloques 2x2)
import h5py, numpy as np, os, subprocess, sys, time, concurrent.futures as cf
OUT='/home/claude/clima/raw/terraclimate'; TMP=OUT+'/tmp'; os.makedirs(TMP, exist_ok=True)
URL='https://climate.northwestknowledge.net/TERRACLIMATE-DATA/TerraClimate_{v}_{y}.nc'
def fetch(v,y):
    fn=f'{TMP}/{v}_{y}.nc'
    if os.path.exists(fn): os.remove(fn)
    for a in range(5):
        r=subprocess.run(['curl','-s','-f','-o',fn,'-m','900',URL.format(v=v,y=y)])
        if r.returncode==0 and os.path.getsize(fn)>1e6: return fn
        time.sleep(10)
    raise RuntimeError(f'fallo {v} {y}')
def read(fn,v):
    f=h5py.File(fn,'r'); d=f[v]
    sf=float(d.attrs['scale_factor'][0]); ao=float(d.attrs['add_offset'][0]); fill=int(d.attrs['_FillValue'][0])
    uns=str(d.attrs.get('_Unsigned',b'false')).lower().find('true')>=0
    out=np.empty((12,1080,2160),np.float32)
    for m in range(12):
        raw=d[m,:,:]
        ok=(raw!=fill)
        x=(raw.view(np.uint16) if uns else raw).astype(np.float32)*sf+ao
        x*=ok
        s4=x.reshape(1080,4,2160,4).sum(axis=(1,3)); c4=ok.reshape(1080,4,2160,4).sum(axis=(1,3))
        with np.errstate(invalid='ignore',divide='ignore'):
            out[m]=np.where(c4>=8,s4/np.maximum(c4,1),np.nan)
    f.close(); return out
JOBS=[(v,a,b) for v in ['tmax','tmin','ppt'] for a,b in [(1991,2020),(1961,1990)]]
W=int(sys.argv[1]) if len(sys.argv)>1 else 0
for v,a,b in JOBS[W::2]:
    if True:
        res=f'{OUT}/{v}_{a}_{b}.npy'
        if os.path.exists(res): continue
        acc=np.zeros((12,1080,2160),np.float32); n=0
        years=list(range(a,b+1))
        with cf.ThreadPoolExecutor(2) as ex:
            futs={y:ex.submit(fetch,v,y) for y in years}
            for y in years:
                fn=futs[y].result(); arr=read(fn,v); os.remove(fn)
                if n==0: valid=~np.isnan(arr)
                acc+=np.nan_to_num(arr); n+=1
                print(v,a,b,y,flush=True)
        mean=acc/n; mean[~valid]=np.nan
        np.save(res,mean.astype(np.float32)); print('OK',res,flush=True)
print('DONE')
