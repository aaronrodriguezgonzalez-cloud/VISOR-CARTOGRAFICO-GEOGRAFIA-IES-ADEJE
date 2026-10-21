# Atlas Climático de Canarias (ULPGC / Gobierno de Canarias) → capas y consulta por punto para ANAMBRO
# - Mosaico de las siete islas a 0,002° (~200 m)
# - PNG de visualización en Web Mercator (Tm, P, HR, Köppen)
# - PNG «de datos» (RGB = valor de 16 bits + máscara) en EPSG:4326 para leer el valor exacto al pulsar
import rasterio, glob, json, os, numpy as np
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
from PIL import Image
A = '/home/claude/clima/raw/canarias/atlas/tif'
OUT = '/home/claude/clima/out/data/clima/canarias'; os.makedirs(OUT, exist_ok=True)
W0, E0, S0, N0, RES = -18.25, -13.30, 27.60, 29.45, 0.002
W, H = int(round((E0 - W0) / RES)), int(round((N0 - S0) / RES))
DST = from_origin(W0, N0, RES, RES)
VARS = {'tm': ('Tmed', 10, 'Temperatura media anual', 'ºC'), 'tx': ('Tmax', 10, 'Temperatura máxima media anual', 'ºC'),
        'tn': ('Tmin', 10, 'Temperatura mínima media anual', 'ºC'), 'p': ('Ppt', 1, 'Precipitación media anual', 'mm'),
        'hr': ('Hr', 1, 'Humedad relativa media anual', '%')}
ISL = ['TF', 'GC', 'LZ', 'FV', 'LP', 'LG', 'EH']
meta = {'bbox': [W0, S0, E0, N0], 'res': RES, 'w': W, 'h': H, 'vars': {}, 'periods': {}}
grids = {}
for k, (pre, sc, lab, unit) in VARS.items():
    dst = np.full((H, W), np.nan, np.float32)
    for isl in ISL:
        fs = glob.glob(f'{A}/{pre}-{isl}-*/*.tif')
        if not fs: print('falta', pre, isl); continue
        meta['periods'].setdefault(k, {})[isl] = fs[0].split('/')[-2].split('-', 2)[2]
        with rasterio.open(fs[0]) as r:
            src = r.read(1).astype(np.float32); nod = r.nodata
            if nod is not None: src[src == nod] = np.nan
            src[(src < -50) | (src > 9000)] = np.nan
            tmp = np.full((H, W), np.nan, np.float32)
            reproject(src, tmp, src_transform=r.transform, src_crs=r.crs, dst_transform=DST, dst_crs='EPSG:4326',
                      resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
            m = np.isfinite(tmp); dst[m] = tmp[m]
    grids[k] = dst
    v = dst[np.isfinite(dst)]
    meta['vars'][k] = {'label': lab, 'unit': unit, 'scale': sc, 'min': float(np.nanmin(v)), 'max': float(np.nanmax(v))}
    print(k, v.size, round(float(v.min()), 1), round(float(v.max()), 1))
# Köppen (códigos 1-6 por orden alfabético de la capa vectorial oficial)
KP = ['BSh', 'BSk', 'BWh', 'Csa', 'Csb', 'Dsc']
with rasterio.open(glob.glob(f'{A}/Kp/*.tif')[0]) as r:
    src = r.read(1).astype(np.float32); src[src == 0] = np.nan
    tmp = np.full((H, W), np.nan, np.float32)
    reproject(src, tmp, src_transform=r.transform, src_crs=r.crs, dst_transform=DST, dst_crs='EPSG:4326',
              resampling=Resampling.mode, src_nodata=np.nan, dst_nodata=np.nan)
grids['kp'] = tmp
meta['vars']['kp'] = {'label': 'Köppen-Geiger oficial de Canarias 1991–2020', 'unit': '', 'scale': 1, 'classes': KP}
# --- PNG de datos (EPSG:4326): R,G = valor+32768 en 16 bits; B = 255 si hay dato
for k, g in grids.items():
    sc = meta['vars'][k]['scale']
    ok = np.isfinite(g)
    val = np.zeros((H, W), np.int32); val[ok] = np.round(g[ok] * sc).astype(np.int32) + 32768
    rgb = np.zeros((H, W, 3), np.uint8); rgb[..., 0] = (val >> 8) & 255; rgb[..., 1] = val & 255; rgb[..., 2] = np.where(ok, 255, 0)
    Image.fromarray(rgb, 'RGB').save(f'{OUT}/atlas_dato_{k}.png', optimize=True)
# --- PNG de visualización (Web Mercator)
def merc_rows(Hm):
    import math
    y0 = math.log(math.tan(math.pi / 4 + math.radians(N0) / 2)); y1 = math.log(math.tan(math.pi / 4 + math.radians(S0) / 2))
    ys = y0 + (np.arange(Hm) + .5) / Hm * (y1 - y0)
    lat = np.degrees(2 * np.arctan(np.exp(ys)) - np.pi / 2)
    return np.clip(((N0 - lat) / RES).astype(int), 0, H - 1)
import math
Hm = int(round(W * (math.log(math.tan(math.pi/4+math.radians(N0)/2)) - math.log(math.tan(math.pi/4+math.radians(S0)/2))) / math.radians(E0 - W0)))
rows = merc_rows(Hm)
def ramp(stops, t):
    t = np.clip(t, 0, 1); n = len(stops) - 1; i = np.minimum((t * n).astype(int), n - 1); f = t * n - i
    c = np.array([[int(s[j:j+2], 16) for j in (1, 3, 5)] for s in stops], np.float32)
    return (c[i] * (1 - f[..., None]) + c[i + 1] * f[..., None]).astype(np.uint8)
STY = {'tm': (['#313695', '#4575b4', '#74add1', '#abd9e9', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'], -2, 24, False),
       'p': (['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'], 50, 1200, True),
       'hr': (['#fff7ec', '#fdd49e', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'], 50, 90, False)}
for k, (stops, lo, hi, lg) in STY.items():
    g = grids[k][rows, :]; ok = np.isfinite(g)
    t = (np.log10(np.clip(g, lo, hi)) - np.log10(lo)) / (np.log10(hi) - np.log10(lo)) if lg else (g - lo) / (hi - lo)
    rgba = np.zeros((Hm, W, 4), np.uint8); rgba[..., :3] = ramp(stops, np.nan_to_num(t)); rgba[..., 3] = np.where(ok, 255, 0)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/atlas_{k}.png', optimize=True)
    meta['vars'][k].update({'stops': stops, 'lo': lo, 'hi': hi, 'log': lg})
KCOL = {'BSh': '#f5a500', 'BSk': '#ffdc64', 'BWh': '#ff0000', 'Csa': '#ffff00', 'Csb': '#c8c800', 'Dsc': '#963296'}
g = grids['kp'][rows, :]; ok = np.isfinite(g)
rgba = np.zeros((Hm, W, 4), np.uint8)
for i, c in enumerate(KP, 1):
    m = ok & (np.round(g) == i); rgba[m, 0] = int(KCOL[c][1:3], 16); rgba[m, 1] = int(KCOL[c][3:5], 16); rgba[m, 2] = int(KCOL[c][5:7], 16); rgba[m, 3] = 255
Image.fromarray(rgba, 'RGBA').save(f'{OUT}/atlas_kp.png', optimize=True)
meta['vars']['kp']['colors'] = KCOL
meta['src'] = 'Atlas Climático Interactivo de Canarias · P. Mayer Suárez, Á. L. de Luque Söllheim y F. García Hernández (Grupo de Geografía Física y Medio Ambiente, ULPGC), para la Consejería de Transición Ecológica del Gobierno de Canarias, 2022 · datos abiertos SITCAN / GRAFCAN'
meta['u'] = 'https://opendata.sitcan.es/dataset/atlas-climatico-de-canarias-canarias'
json.dump(meta, open(f'{OUT}/atlas_meta.json', 'w'), ensure_ascii=False)
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(f'{OUT}/{f}') // 1024, 'KB')
