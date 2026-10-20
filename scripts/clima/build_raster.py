# Mapamundis de Miller y Köppen-Geiger a partir de las normales TerraClimate (1/6°), reproyectados a Web Mercator
import numpy as np, sys, os, json
from PIL import Image
sys.path.insert(0, '/home/claude/clima/scripts'); import classify as C
R = '/home/claude/clima/raw/terraclimate'; OUT = '/home/claude/clima/out/data/clima'
KCOL = {'Af':'#0000ff','Am':'#0078ff','Aw':'#46aafa','BWh':'#ff0000','BWk':'#ff9696','BSh':'#f5a500','BSk':'#ffdc64','Csa':'#ffff00','Csb':'#c8c800','Csc':'#969600','Cwa':'#96ff96','Cwb':'#64c864','Cwc':'#329632','Cfa':'#c8ff50','Cfb':'#64ff50','Cfc':'#32c800','Dsa':'#ff00ff','Dsb':'#c800c8','Dsc':'#963296','Dsd':'#966496','Dwa':'#aaafff','Dwb':'#5a78dc','Dwc':'#4b50b4','Dwd':'#320087','Dfa':'#00ffff','Dfb':'#37c8ff','Dfc':'#007d7d','Dfd':'#00465f','ET':'#b2b2b2','EF':'#666666'}
MCOL = {'A1':'#1a7f37','A2':'#3fa34d','A3':'#a7c957','B1':'#f2c14e','B2':'#f78c40','C1':'#4ea8de','C2':'#5e60ce','D1':'#7b2cbf','D2':'#3c096c','E':'#adb5bd','F1':'#e63946','F2':'#f4a3a8','G':'#8d6e63'}
H0, W0 = 1080, 2160; RES = 1/6
lat_c = 90 - (np.arange(H0) + .5) * RES
stats = {}
for pk, (a, b) in {'9120': (1991, 2020), '6190': (1961, 1990)}.items():
    tx = np.load(f'{R}/tmax_{a}_{b}.npy'); tn = np.load(f'{R}/tmin_{a}_{b}.npy'); pp = np.load(f'{R}/ppt_{a}_{b}.npy')
    T = (tx + tn) / 2; P = np.maximum(pp, 0)
    valid = np.isfinite(T).all(0) & np.isfinite(P).all(0)
    iy, ix = np.nonzero(valid)
    Tv = T[:, iy, ix]; Pv = P[:, iy, ix]; lat = lat_c[iy]
    for name, fn, order, cols in (('koppen', C.koppen, C.KORDER, KCOL), ('miller', C.miller, C.MORDER, MCOL)):
        cls = fn(Tv, Pv, lat)
        grid = np.full((H0, W0), 255, np.uint8); grid[iy, ix] = np.where(cls >= 0, cls, 255)
        # Web Mercator (EPSG:3857) entre ±85,0511°
        Hm = 2160; ym = (np.arange(Hm) + .5) / Hm
        latm = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ym))))
        rows = np.clip(((90 - latm) / RES).astype(int), 0, H0 - 1)
        merc = grid[rows, :]
        pal = []
        for k in order:
            h = cols[k]; pal += [int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]
        pal += [0, 0, 0] * (256 - len(order))
        im = Image.fromarray(merc, 'P'); im.putpalette(pal); im.info['transparency'] = 255
        fn_out = f'{OUT}/{name}_{pk}_terraclimate.png'
        im.save(fn_out, optimize=True, transparency=255)
        cnt = np.bincount(cls[cls >= 0], minlength=len(order))
        stats[f'{name}_{pk}'] = {order[i]: int(c) for i, c in enumerate(cnt) if c}
        print(fn_out, os.path.getsize(fn_out) // 1024, 'KB')
json.dump({'v': '2026-10-20', 'res_deg': RES, 'proj': 'EPSG:3857', 'bounds': [[-85.0511, -180], [85.0511, 180]], 'stats': stats,
           'src': 'TerraClimate (Abatzoglou et al., 2018, Scientific Data 5:170191) · normales 1991-2020 y 1961-1990 calculadas por ANAMBRO a partir de los ficheros anuales; Tm = (Tmáx + Tmín)/2; malla agregada a 1/6°.'},
          open(f'{OUT}/mapas_clima_meta.json', 'w'), ensure_ascii=False)
print(json.dumps(stats)[:600])
