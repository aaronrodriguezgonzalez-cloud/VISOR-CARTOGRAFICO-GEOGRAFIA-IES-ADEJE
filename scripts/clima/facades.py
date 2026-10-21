# Posición en el continente (base geográfica de Miller): distancia al océano abierto hacia el oeste y hacia el este
# a lo largo del paralelo, sobre la máscara de tierra de TerraClimate (1/6°). Los mares cerrados (Mediterráneo, Negro,
# Caspio, Báltico, mar Rojo, golfo Pérsico) y los lagos cuentan como tierra: no generan «fachada» oceánica.
import numpy as np, os
from scipy import ndimage
R='/home/claude/clima/raw/terraclimate'; OUT='/home/claude/clima/raw/facades.npz'
H,W=1080,2160; RES=1/6
lat=90-(np.arange(H)+.5)*RES; lon=-180+(np.arange(W)+.5)*RES
def build():
    t=np.load(f'{R}/tmax_1991_2020.npy')[0]
    water=~np.isfinite(t)
    # océano abierto = agua conectada con el Pacífico central
    lab,_=ndimage.label(water,structure=np.ones((3,3)))
    seed=lab[int((90-0)/RES),int((-150+180)/RES)]
    ocean=lab==seed
    # mares semicerrados tratados como tierra a efectos de fachada
    LO,LA=np.meshgrid(lon,lat)
    for (a,b,c,d) in [(-5.8,-0.6,30,40.5),(-0.6,36.5,30,46.5),(27,42,40,47.5),(46,55,36,48),(9,31,53,66.5),(32,44,12,30.5),(47,57,23.5,31)]:
        ocean[(LO>=a)&(LO<=b)&(LA>=c)&(LA<=d)]=False
    km=RES*111.32*np.cos(np.radians(lat))[:,None]
    dW=np.full((H,W),np.inf,np.float32); dE=np.full((H,W),np.inf,np.float32)
    for i in range(H):
        o=ocean[i]
        if not o.any(): continue
        idx=np.where(o)[0]
        # distancia (en celdas) al océano más cercano hacia el oeste y hacia el este, con continuidad en ±180°
        ext=np.concatenate([idx-W,idx,idx+W])
        cols=np.arange(W)
        pos=np.searchsorted(ext,cols)
        west=cols-ext[pos-1]; east=ext[np.minimum(pos,len(ext)-1)]-cols
        west[o]=0; east[o]=0
        dW[i]=west*km[i,0]; dE[i]=east*km[i,0]
    np.savez_compressed(OUT,dW=dW,dE=dE,ocean=ocean)
    return dW,dE,ocean
def load():
    if not os.path.exists(OUT): return build()
    z=np.load(OUT); return z['dW'],z['dE'],z['ocean']
def at(la,lo,dW,dE):
    i=np.clip(((90-np.asarray(la))/RES).astype(int),0,H-1); j=np.clip(((np.asarray(lo)+180)/RES).astype(int),0,W-1)
    return dW[i,j],dE[i,j]
if __name__=='__main__':
    dW,dE,o=build()
    for n,la,lo in [('Santiago',42.88,-8.56),('Burgos',42.36,-3.62),('Madrid',40.41,-3.68),('Valencia',39.48,-0.37),('Shanghai',31.2,121.4),('Berlin',52.5,13.4),('Paris',48.8,2.3),('Manaus',-3.1,-60.0),('Miami',25.8,-80.3)]:
        w,e=at(la,lo,dW,dE); print(n,round(float(w)),round(float(e)))
