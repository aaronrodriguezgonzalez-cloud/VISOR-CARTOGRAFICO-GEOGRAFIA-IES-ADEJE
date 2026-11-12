/* ANAMBRO · Lenguas del mundo y variedades del español · nov 2026
   Capas: lenguas actuales (Asher y Moseley 2007 · Glottography), lenguas antes del contacto europeo,
   familias lingüísticas, «¿Dónde se habla…?» (Unicode CLDR) y variedades del español (Moreno Fernández).
   Dibujo en teselas de lienzo (rápido en 2D y reflejado automáticamente en el globo) y fichas propias. */
(function(){
"use strict";
if(typeof map==="undefined"||typeof L==="undefined")return;
var BASE=new URL("data/lenguas/",location.href).href, V="20261112";
var $=function(id){return document.getElementById(id);};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
var fmtN=function(n){try{return Math.round(n).toLocaleString("es-ES");}catch(e){return String(n);}};
var fmtHab=function(h){if(!h)return"";if(h>=1e9)return(h/1e9).toLocaleString("es-ES",{maximumFractionDigits:2})+" mil millones";if(h>=1e6)return(h/1e6).toLocaleString("es-ES",{maximumFractionDigits:h>=1e8?0:1})+" millones";return fmtN(h);};
var IDS={act:"lngActualCheck",pre:"lngPrecontactCheck",fam:"lngFamilyCheck",donde:"lngWhereCheck",vari:"lngSpanishCheck"};
var NAMES={act:"Lenguas del mundo · áreas actuales",pre:"Lenguas de América y Australia antes del contacto europeo",fam:"Familias lingüísticas del mundo",donde:"¿Dónde se habla…?",vari:"Variedades del español"};

/* ---------- datos ---------- */
var cache={};
function getJSON(name){
  if(!cache[name])cache[name]=fetch(BASE+name+"?v="+V,{cache:"force-cache"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status+" · "+name);return r.json();}).catch(function(e){delete cache[name];throw e;});
  return cache[name];
}
var INFO=null;
function info(){return INFO?Promise.resolve(INFO):getJSON("info.json").then(function(d){INFO=d;return d;});}
function paisNombre(c){
  if(c==="EH")return"Sáhara Occidental (territorio ocupado)";
  return (INFO&&INFO.paises&&INFO.paises[c])||c;
}

/* ---------- colores ---------- */
var FAMCOL={indo1319:"#d9534f",atla1278:"#e8a33d",aust1307:"#3a9d8f",sino1245:"#c9b03b",afro1255:"#b07a3c",nucl1709:"#7a9a4a",aust1305:"#5db37e",turk1311:"#4f8fc4",ural1272:"#7d6bc4",drav1251:"#c46b9b",taik1256:"#9bc45a",mong1349:"#6aa5d9",japo1237:"#e07b91",kore1284:"#a47bd1",quec1387:"#cf7b3e",ayma1253:"#b8873a",tupi1275:"#3f9a5c",araw1281:"#6c8f3a",cari1283:"#8fb35a",maya1287:"#2f8f8a",utoa1244:"#c78d4a",otom1299:"#d6a65a",eski1264:"#5a8fc4",algi1248:"#8a6f4f",atha1245:"#a3826a",pama1250:"#d08a3a",nilo1247:"#a8643a",mand1469:"#c79a5a",cent2225:"#b86f5a",kart1248:"#6f7fbf",nakh1245:"#5f9fb0",abkh1242:"#3fa7a0",hmon1336:"#a9b84f",chib1249:"#4f9f7a",pano1259:"#7fae6a",khoe1240:"#c0a070",kruu1280:"#9c7a5a",dogo1299:"#b59a6a",song1307:"#a58a5a",saha1256:"#c08a6a",tung1282:"#6a8fb8",chuk1271:"#7a9fc8",siou1252:"#9a7a5a",iroq1247:"#8a8a5a",sali1255:"#6a9a8a",nucl1710:"#6f8f4f",timo1261:"#5a9a7a",sepi1257:"#7a8a4a",book1242:"#9a9a9a",sign1238:"#8a8aa8"};
function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hsl2hex(h,s,l){s/=100;l/=100;var k=function(n){return(n+h/30)%12;},a=s*Math.min(l,1-l),f=function(n){var c=l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return Math.round(255*c).toString(16).padStart(2,"0");};return"#"+f(0)+f(8)+f(4);}
function famColor(fid){if(!fid)return"#9aa3ad";if(FAMCOL[fid])return FAMCOL[fid];var h=hashStr(fid);return hsl2hex(h%360,38+h%20,52+(h>>8)%12);}
function shade(hex,amt){var n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;var t=amt<0?0:255,p=Math.abs(amt);r=Math.round((t-r)*p+r);g=Math.round((t-g)*p+g);b=Math.round((t-b)*p+b);return"#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
function hex2hsl(hex){var n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255,mx_=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx_+mn)/2,h=0,s=0;if(mx_!==mn){var d=mx_-mn;s=l>.5?d/(2-mx_-mn):d/(mx_+mn);h=mx_===r?(g-b)/d+(g<b?6:0):mx_===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return[h,s*100,l*100];}
var LCOL={};
function langColor(gc){if(LCOL[gc])return LCOL[gc];var d=INFO&&INFO.lenguas[gc];var base=d&&d.f==="Lengua aislada"?"#8c8c8c":famColor(d&&d.fid);var hsl=hex2hsl(base),h=hashStr(gc||"x");
  var col=hsl2hex((hsl[0]+((h%9)-4)*6+360)%360,Math.max(18,Math.min(80,hsl[1]+(((h>>4)%5)-2)*7)),Math.max(30,Math.min(78,hsl[2]+(((h>>8)%9)-4)*5.5)));if(INFO)LCOL[gc]=col;return col;}
var VITAL={1:["No amenazada","#3c9a52"],2:["Vulnerable","#c9b12f"],3:["En peligro","#e08a2e"],4:["En grave peligro","#d4572e"],5:["En peligro crítico","#b82f2f"],6:["Extinta","#6f6f6f"]};
var WHERE_CLASSES=[[90,"#08306b","≥ 90 %"],[75,"#1c5a99","75–90 %"],[50,"#3a7fc0","50–75 %"],[25,"#6aa6d6","25–50 %"],[10,"#9cc6e6","10–25 %"],[1,"#cde2f2","1–10 %"],[0.0001,"#eaf2f9","< 1 %"]];
var STATUS_COL={official:["#08306b","Lengua oficial"],de_facto_official:["#1c5a99","Oficial de hecho"],official_regional:["#4f95cf","Oficial en una región"],"":["#b9d6ee","Se habla, sin estatus oficial"]};

/* ---------- variedades del español (Moreno Fernández, 2009) ---------- */
var VAR={
 castellana:{n:"Castellana",c:"#c0392b",ambito:"Centro y norte de la península ibérica y Baleares; en Galicia, Asturias, País Vasco, Navarra, Cataluña, Comunidad Valenciana y Baleares convive con otras lenguas.",
  fon:["Distinción entre /s/ y /θ/: <i>casa</i> ≠ <i>caza</i>.","/s/ ápico-alveolar, muy característica.","Se conserva la -s final de sílaba: <i>los niños</i>.","/x/ velar y tensa: <i>jamón</i>.","Yeísmo general (<i>pollo</i> = <i>poyo</i>); la distinción de <i>ll</i> resiste en zonas rurales y bilingües."],
  gram:["<i>Vosotros, vosotras</i> con sus formas verbales: <i>vosotros cantáis</i>.","Pretérito perfecto compuesto para el pasado reciente: <i>hoy he comido pronto</i>.","Leísmo de persona (<i>le vi a Juan</i>) y, en el centro, laísmo popular."],
  lex:["coche","ordenador","móvil","zumo","patata","conducir","vale"],ciudades:[["Madrid",40.42,-3.70],["Valladolid",41.65,-4.72],["Burgos",42.34,-3.70],["Zaragoza",41.65,-0.88]]},
 transito:{n:"Hablas de tránsito (Extremadura y Murcia)",c:"#e07a5f",ambito:"Extremadura y Murcia (y, en parte, La Mancha meridional): hablas que comparten rasgos castellanos y meridionales. En la clasificación se integran en el área castellana; aquí se señalan aparte por su interés didáctico.",
  fon:["Se mantiene en general la distinción /s/–/θ/.","Aspiración o pérdida de la -s final: <i>loh niñoh</i>, con abertura vocálica en Murcia.","Aspiración de la /x/ y, en Extremadura, de la h- procedente de f- latina: <i>jambre</i> (‘hambre’).","Neutralización de -r y -l finales en el habla popular."],
  gram:["Diminutivo extremeño en <i>-ino</i>: <i>chiquinino</i>.","Diminutivo murciano en <i>-ico</i>: <i>poquico</i>."],
  lex:["acho (Murcia)","pijo (Murcia)","bellota","dehesa"],ciudades:[["Badajoz",38.88,-6.97],["Cáceres",39.47,-6.37],["Murcia",37.98,-1.13]]},
 andaluza:{n:"Andaluza",c:"#2e86c1",ambito:"Andalucía, Ceuta y Melilla.",
  fon:["Seseo o ceceo en buena parte de Andalucía occidental; distinción en gran parte de la oriental.","Aspiración o pérdida de la -s final; en Andalucía oriental, abertura de la vocal: <i>niñoh</i> / <i>niñɔ</i>.","/x/ aspirada: <i>jamón</i> [ha'mon].","Pérdida de la -d- intervocálica: <i>cansao</i>, <i>to</i> (‘todo’).","Confusión de -r y -l: <i>arma</i> por <i>alma</i>; pronunciación fricativa de la <i>ch</i> [ʃ] en zonas."],
  gram:["En Andalucía occidental, <i>ustedes</i> sustituye a <i>vosotros</i>, a veces con el verbo en 2.ª persona: <i>ustedes vais</i>."],
  lex:["chiquillo","quillo","mijita","pisha (Cádiz)","malaje","bulla"],ciudades:[["Sevilla",37.39,-5.98],["Cádiz",36.53,-6.29],["Málaga",36.72,-4.42],["Granada",37.18,-3.60]]},
 canaria:{n:"Canaria",c:"#f1c40f",ambito:"Islas Canarias. Muy próxima a las variedades americanas, sobre todo a la caribeña, por la emigración canaria a América.",
  fon:["Seseo general: <i>cazar</i> = <i>casar</i>.","Aspiración de la -s final de sílaba: <i>loh niñoh</i>, <i>mihmo</i>.","/x/ aspirada y suave: <i>jarea</i>, <i>gente</i> [ˈhente].","Yeísmo; <i>ch</i> adherente, casi [ʝ], en algunas zonas.","Entonación propia, más cercana a la de América que a la peninsular."],
  gram:["<i>Ustedes</i> en lugar de <i>vosotros</i>: <i>ustedes van</i>, <i>¿ustedes quieren?</i>","Preferencia por el pretérito indefinido para hechos de hoy: <i>esta mañana fui</i>.","Diminutivos afectivos: <i>mi niño</i>, <i>ahorita</i>."],
  lex:["guagua (autobús)","papa","millo","gofio","baifo","cholas","mojo","machango","fisco","fleje","bucio"],ciudades:[["Santa Cruz de Tenerife",28.47,-16.25],["Las Palmas de Gran Canaria",28.12,-15.43],["Adeje",28.12,-16.73],["Puerto del Rosario",28.50,-13.86]]},
 caribena:{n:"Caribeña",c:"#16a085",ambito:"Cuba, Puerto Rico, República Dominicana, la mayor parte de Venezuela, la costa caribe de Colombia y Panamá.",
  fon:["Seseo.","Aspiración o pérdida intensa de la -s: <i>lah casah</i>, <i>la casa</i>.","Neutralización de -r y -l: <i>puelto</i>, <i>amol</i> (Puerto Rico), <i>poi favoi</i> (Cibao).","Velarización de la -n final: <i>pan</i> [paŋ].","/x/ aspirada; ritmo y entonación muy marcados."],
  gram:["<i>Ustedes</i> en lugar de <i>vosotros</i>; tuteo general.","Sujeto antepuesto en preguntas: <i>¿qué tú quieres?</i>","Uso abundante del pronombre sujeto: <i>yo creo que yo voy</i>."],
  lex:["guagua (autobús)","chévere","carro","jugo","china (naranja, Puerto Rico)","pana","vaina"],ciudades:[["La Habana",23.11,-82.37],["San Juan",18.47,-66.11],["Santo Domingo",18.49,-69.93],["Caracas",10.49,-66.88],["Cartagena de Indias",10.39,-75.51],["Panamá",8.98,-79.52]]},
 mexicana:{n:"Mexicana y centroamericana",c:"#8e44ad",ambito:"México, Guatemala, El Salvador, Honduras, Nicaragua y Costa Rica. Es la variedad con más hablantes del mundo.",
  fon:["Seseo.","En el altiplano mexicano, consonantes firmes y -s conservada; vocales átonas debilitadas: <i>much(o)s</i>.","/x/ velar y tensa en México.","En Centroamérica, aspiración de la -s y de la /x/."],
  gram:["<i>Ustedes</i> en lugar de <i>vosotros</i>.","Voseo en buena parte de Centroamérica (<i>vos tenés</i>), junto al tuteo; ustedeo afectivo en Costa Rica.","Diminutivos muy frecuentes: <i>ahorita</i>, <i>cerquita</i>; <i>¿mande?</i> para pedir que se repita."],
  lex:["carro","jugo","platicar","ahorita","chamaco","cuate","padre (‘estupendo’)","chompa","tuanis (Costa Rica)"],ciudades:[["Ciudad de México",19.43,-99.13],["Guadalajara",20.67,-103.35],["Guatemala",14.63,-90.51],["San Salvador",13.69,-89.19],["Tegucigalpa",14.07,-87.19],["Managua",12.11,-86.24],["San José",9.93,-84.08]]},
 andina:{n:"Andina",c:"#d35400",ambito:"Interior y Andes de Colombia, Andes venezolanos, Ecuador, Perú y Bolivia. En contacto con el quechua y el aimara.",
  fon:["Seseo.","Se conserva la -s final con firmeza y se debilitan las vocales átonas: <i>pues(o)s</i>.","<i>rr</i> y <i>r</i> asibiladas (arrastradas) en muchas zonas: <i>carro</i> [ˈkaɻo].","Se conserva en zonas la distinción entre <i>ll</i> y <i>y</i>."],
  gram:["<i>Ustedes</i> en lugar de <i>vosotros</i>.","Voseo en la sierra de Ecuador, en Bolivia y en el sur de Colombia.","Influencia quechua: <i>nomás</i>, duplicación de complementos (<i>lo vi a Juan</i>), <i>dar + gerundio</i> (<i>dame cerrando la puerta</i>)."],
  lex:["guagua (bebé)","cancha","choclo","palta","poroto","chompa","achachay (Ecuador)"],ciudades:[["Bogotá",4.71,-74.07],["Quito",-0.18,-78.47],["Lima",-12.05,-77.04],["Cusco",-13.53,-71.97],["La Paz",-16.50,-68.15],["Mérida (Venezuela)",8.59,-71.14]]},
 austral:{n:"Rioplatense y paraguaya (austral)",c:"#2980b9",ambito:"Argentina, Uruguay y Paraguay. En Paraguay, bilingüismo general español-guaraní. El noroeste argentino comparte rasgos andinos.",
  fon:["Seseo.","Yeísmo rehilado (žeísmo o šeísmo) en el Río de la Plata: <i>yo</i> [ʃo], <i>calle</i> [ˈkaʃe].","Aspiración de la -s final.","Entonación de influencia italiana en Buenos Aires y Montevideo.","En Paraguay se conserva la distinción <i>ll</i>–<i>y</i>."],
  gram:["Voseo general: <i>vos tenés</i>, <i>vos sabés</i>, <i>vení</i>.","<i>Ustedes</i> en lugar de <i>vosotros</i>.","En Paraguay, préstamos y partículas del guaraní: <i>-pa</i>, <i>-na</i>."],
  lex:["che","pibe","laburo","colectivo","frutilla","pollera","boludo","mate","bondi"],ciudades:[["Buenos Aires",-34.60,-58.38],["Montevideo",-34.90,-56.16],["Asunción",-25.26,-57.58],["Córdoba (Argentina)",-31.42,-64.18],["Rosario",-32.95,-60.65]]},
 chilena:{n:"Chilena",c:"#27ae60",ambito:"Chile.",
  fon:["Seseo.","Aspiración o pérdida de la -s final.","Palatalización de /x/ ante <i>e</i>, <i>i</i>: <i>mujer</i> [muˈçeɾ].","<i>ch</i> fricativa [ʃ] en hablas populares: <i>Chile</i> [ˈʃile]."],
  gram:["Voseo verbal con <i>tú</i>: <i>¿tú sabís?</i>, <i>¿cómo estái?</i>","<i>Ustedes</i> en lugar de <i>vosotros</i>.","Muletillas muy características: <i>po</i>, <i>¿cachái?</i>"],
  lex:["guagua (bebé)","pololo, polola","fome","al tiro","cabro chico","once (merienda)","luca"],ciudades:[["Santiago de Chile",-33.45,-70.67],["Valparaíso",-33.05,-71.62],["Concepción",-36.83,-73.05]]},
 guinea:{n:"Español de Guinea Ecuatorial",c:"#7f8c8d",ambito:"Guinea Ecuatorial, el único país africano con el español como lengua oficial. No figura entre las ocho áreas de Moreno Fernández y se añade aquí para completar el mapa.",
  fon:["Distinción /s/–/θ/ en parte del habla culta, por la enseñanza de modelo peninsular.","Se conserva la -s final.","Tendencia a neutralizar <i>r</i> y <i>rr</i>.","Entonación influida por las lenguas bantúes (fang, bubi…)."],
  gram:["Convive con el fang, el bubi, el annobonés y el francés y el portugués (también oficiales).","Uso de <i>vosotros</i> en el registro escolar."],
  lex:["Préstamos del fang y del inglés pichi"],ciudades:[["Malabo",3.75,8.78],["Bata",1.86,9.77]]}
};

/* ---------- motor de teselas ---------- */
var D2R=Math.PI/180,MAXLAT=85.0511;
function mx(lng,s){return(lng+180)/360*s;}
function my(lat,s){lat=Math.max(-MAXLAT,Math.min(MAXLAT,lat));return(1-Math.log(Math.tan(Math.PI/4+lat*D2R/2))/Math.PI)/2*s;}
function tileLng(x,z){return x/Math.pow(2,z)*360-180;}
function tileLat(y,z){var n=Math.PI-2*Math.PI*y/Math.pow(2,z);return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));}
function prep(fc){
  var feats=[],CELL=5,grid={};
  (fc.features||[]).forEach(function(f,i){
    var g=f.geometry;if(!g)return;
    var polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    var parts=[],W=180,S=90,E=-180,N=-90;
    polys.forEach(function(rings){var w=180,s=90,e=-180,n=-90;rings[0].forEach(function(p){if(p[0]<w)w=p[0];if(p[0]>e)e=p[0];if(p[1]<s)s=p[1];if(p[1]>n)n=p[1];});parts.push({r:rings,b:[w,s,e,n]});if(w<W)W=w;if(e>E)E=e;if(s<S)S=s;if(n>N)N=n;});
    var o={i:feats.length,id:f.properties.id,lp:f.properties.lp,a:f.properties.a,parts:parts,b:[W,S,E,N]};
    feats.push(o);
    for(var cx=Math.floor((W+180)/CELL);cx<=Math.floor((E+180)/CELL);cx++)for(var cy=Math.floor((S+90)/CELL);cy<=Math.floor((N+90)/CELL);cy++){var k=cx+","+cy;(grid[k]||(grid[k]=[])).push(o.i);}
  });
  return{feats:feats,grid:grid,CELL:CELL};
}
function query(ix,w,s,e,n){
  var C=ix.CELL,seen=new Uint8Array(ix.feats.length),out=[];
  for(var cx=Math.floor((Math.max(-180,w)+180)/C);cx<=Math.floor((Math.min(180,e)+180)/C);cx++)for(var cy=Math.floor((Math.max(-90,s)+90)/C);cy<=Math.floor((Math.min(90,n)+90)/C);cy++){
    var L1=ix.grid[cx+","+cy];if(!L1)continue;
    for(var j=0;j<L1.length;j++){var id=L1[j];if(seen[id])continue;seen[id]=1;var f=ix.feats[id];if(f.b[2]<w||f.b[0]>e||f.b[3]<s||f.b[1]>n)continue;out.push(f);}
  }
  out.sort(function(a,b){return a.i-b.i;});
  return out;
}
function pip(x,y,ring){var c=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi||1e-12)+xi)c=!c;}return c;}
function inFeat(f,x,y){
  for(var p=0;p<f.parts.length;p++){var P=f.parts[p];if(x<P.b[0]||x>P.b[2]||y<P.b[1]||y>P.b[3])continue;if(!pip(x,y,P.r[0]))continue;var hole=false;for(var h=1;h<P.r.length;h++)if(pip(x,y,P.r[h])){hole=true;break;}if(!hole)return true;}
  return false;
}
function nearFeat(f,x,y,tol){var t2=tol*tol;for(var p=0;p<f.parts.length;p++){var P=f.parts[p];if(x<P.b[0]-tol||x>P.b[2]+tol||y<P.b[1]-tol||y>P.b[3]+tol)continue;var R=P.r[0];for(var i=1;i<R.length;i++){var ax=R[i-1][0],ay=R[i-1][1],dx=R[i][0]-ax,dy=R[i][1]-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)):0,ex=ax+t*dx-x,ey=ay+t*dy-y;if(ex*ex+ey*ey<=t2)return true;}}return false;}
function hit(ix,lat,lng,filter){
  var c=query(ix,lng-1e-6,lat-1e-6,lng+1e-6,lat+1e-6);
  for(var k=c.length-1;k>=0;k--){if(filter&&!filter(c[k]))continue;if(inFeat(c[k],lng,lat))return c[k];}
  return null;
}
var PolyTiles=L.GridLayer.extend({
  options:{tileSize:256,noWrap:true,updateWhenIdle:false,keepBuffer:3,minZoom:0,maxZoom:20,bounds:L.latLngBounds([[-85,-180],[85,180]])},
  initialize:function(spec,opts){L.GridLayer.prototype.initialize.call(this,opts);this._spec=spec;},
  createTile:function(coords,done){
    var size=256,ratio=Math.max(1,Math.min(2,window.devicePixelRatio||1)),cv=document.createElement("canvas");
    cv.width=cv.height=size*ratio;cv.style.width=cv.style.height=size+"px";
    var self=this,go=function(){try{self._draw(cv.getContext("2d"),coords,ratio);}catch(e){console.warn("ANAMBRO lenguas · tesela",e);}done(null,cv);};
    var pr=null;try{pr=self._spec.prepare&&self._spec.prepare(coords);}catch(e){pr=null;}
    if(pr&&pr.then)pr.then(go,go);else setTimeout(go,0);
    return cv;
  },
  _draw:function(ctx,c,ratio){
    var sp=this._spec,ix=sp.ix();if(!ix)return;
    var z=c.z,S=256*Math.pow(2,z),ox=c.x*256,oy=c.y*256;
    var w=tileLng(c.x,z),e=tileLng(c.x+1,z),n=tileLat(c.y,z),s=tileLat(c.y+1,z);
    var px=(e-w)/256;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    var det=sp.detailFeats?sp.detailFeats(z,w-px*2,s-px*2,e+px*2,n+px*2):null;
    var feats=det||query(ix,w-px*2,s-px*2,e+px*2,n+px*2),CE=det?sp.seam:0;
    ctx.lineJoin="round";
    var onSeam=function(a,b){if(!CE)return false;var ax=a[0]/CE,bx=b[0]/CE,ay=a[1]/CE,by=b[1]/CE;return(Math.abs(a[0]-b[0])<1e-9&&Math.abs(ax-Math.round(ax))<1e-6)||(Math.abs(a[1]-b[1])<1e-9&&Math.abs(ay-Math.round(ay))<1e-6);};
    for(var k=0;k<feats.length;k++){
      var f=feats[k],st=sp.style(f);if(!st)continue;
      ctx.beginPath();
      for(var p=0;p<f.parts.length;p++){var P=f.parts[p];if(P.b[2]<w-px*2||P.b[0]>e+px*2||P.b[3]<s-px*2||P.b[1]>n+px*2)continue;
        for(var r=0;r<P.r.length;r++){var R=P.r[r];for(var q=0;q<R.length;q++){var X=mx(R[q][0],S)-ox,Y=my(R[q][1],S)-oy;if(q)ctx.lineTo(X,Y);else ctx.moveTo(X,Y);}ctx.closePath();}}
      if(st.fill){ctx.fillStyle=st.fill;ctx.globalAlpha=st.fillOpacity==null?1:st.fillOpacity;ctx.fill("evenodd");if(CE){ctx.strokeStyle=st.fill;ctx.lineWidth=0.9;ctx.stroke();}}
      if(st.stroke){ctx.globalAlpha=st.strokeOpacity==null?1:st.strokeOpacity;ctx.strokeStyle=st.stroke;ctx.lineWidth=st.weight||0.6;
        if(CE){ctx.beginPath();for(var p2=0;p2<f.parts.length;p2++){var P2=f.parts[p2];if(P2.b[2]<w-px*2||P2.b[0]>e+px*2||P2.b[3]<s-px*2||P2.b[1]>n+px*2)continue;for(var r2=0;r2<P2.r.length;r2++){var R2=P2.r[r2];for(var q2=1;q2<R2.length;q2++){if(onSeam(R2[q2-1],R2[q2]))continue;ctx.moveTo(mx(R2[q2-1][0],S)-ox,my(R2[q2-1][1],S)-oy);ctx.lineTo(mx(R2[q2][0],S)-ox,my(R2[q2][1],S)-oy);}}}}
        ctx.stroke();}
      ctx.globalAlpha=1;
    }
    if(sp.labels&&sp.labels()&&z>=sp.minLabelZoom){
      var pad=180*px;var lf=query(ix,w-pad,s-pad/3,e+pad,n+pad/3);
      ctx.textAlign="center";ctx.textBaseline="middle";
      for(var m=0;m<lf.length;m++){
        var F=lf[m],txt=sp.label(F);if(!txt||!F.lp)continue;
        var fs=sp.fontSize?sp.fontSize(F,z):12;ctx.font="700 "+fs+"px system-ui,-apple-system,'Segoe UI',sans-serif";
        var tw=ctx.measureText(txt).width,bw=(mx(F.b[2],S)-mx(F.b[0],S)),bh=(my(F.b[1],S)-my(F.b[3],S));
        if(bw<tw*0.95||bh<fs*1.4)continue;
        var lx=mx(F.lp[0],S)-ox,ly=my(F.lp[1],S)-oy;
        if(lx+tw/2<0||lx-tw/2>256||ly+fs<0||ly-fs>256)continue;
        ctx.lineWidth=3;ctx.strokeStyle="rgba(255,255,255,.88)";ctx.strokeText(txt,lx,ly);ctx.fillStyle="#1b2733";ctx.fillText(txt,lx,ly);
      }
    }
  }
});

/* ---------- capas ---------- */
var state={opacity:0.85,labels:true,where:"es",whereMode:"pct"};
var IX={},LAYERS={},WHERE=null,COUNTRIES=null;
function countryCode(p){var c=p.ISO_A2_EH&&p.ISO_A2_EH!=="-99"?p.ISO_A2_EH:p.ISO_A2;if(!c||c==="-99")c=({France:"FR",Norway:"NO",Kosovo:"XK"})[p.ADMIN]||"";return c;}
var SPECS={
 act:{file:"lenguas_actuales.json",minLabelZoom:4,detail:true,label:function(f){var d=INFO&&INFO.lenguas[f.id];return d?d.n:"";},
  style:function(f){return{fill:langColor(f.id),fillOpacity:1,stroke:"#ffffff",weight:0.6,strokeOpacity:.85};},fontSize:function(f,z){return z>=6?13:11;}},
 pre:{file:"lenguas_precontacto.json",minLabelZoom:4,label:function(f){var d=INFO&&INFO.lenguas[f.id];return d?d.n:"";},
  style:function(f){return{fill:langColor(f.id),fillOpacity:1,stroke:"#ffffff",weight:0.6,strokeOpacity:.85};},fontSize:function(f,z){return z>=6?13:11;}},
 fam:{file:"familias.json",minLabelZoom:2,label:function(f){var d=INFO&&INFO.familias[f.id];return d&&d.n!=="Sin clasificar"?d.n:"";},
  style:function(f){return{fill:famColor(f.id),fillOpacity:1,stroke:"#ffffff",weight:0.8,strokeOpacity:.9};},fontSize:function(f,z){return z>=4?14:12;}},
 vari:{file:"variedades_espanol.json",minLabelZoom:2,label:function(f){return VAR[f.id]?VAR[f.id].n:"";},
  style:function(f){return{fill:VAR[f.id]?VAR[f.id].c:"#999",fillOpacity:1,stroke:"#ffffff",weight:1.2,strokeOpacity:.95};},fontSize:function(f,z){return z>=5?15:13;}},
 donde:{file:null,minLabelZoom:99,label:function(){return"";},
  style:function(f){var row=whereRow(f.id);if(!row)return{fill:null,stroke:"#9aa7b4",weight:.5,strokeOpacity:.7};return{fill:whereColor(row),fillOpacity:1,stroke:"#ffffff",weight:.6,strokeOpacity:.9};}}
};
function whereRow(cc){var L1=WHERE&&WHERE.lenguas[state.where];return L1&&L1.t[cc]||null;}
function whereColor(row){if(state.whereMode==="status")return(STATUS_COL[row[1]]||STATUS_COL[""])[0];for(var i=0;i<WHERE_CLASSES.length;i++)if(row[0]>=WHERE_CLASSES[i][0])return WHERE_CLASSES[i][1];return WHERE_CLASSES[WHERE_CLASSES.length-1][1];}
function ensure(key){
  if(IX[key])return Promise.resolve(IX[key]);
  var jobs=[info()];
  if(key==="donde"){
    jobs.push(getJSON("donde_se_habla.json").then(function(d){WHERE=d;}));
    jobs.push(getJSON("paises.json").then(function(fc){COUNTRIES=fc;IX.donde=prep(fc);IX.donde.feats.forEach(function(f,i){f.ne=fc.features[i].properties.ne;});}));
  }else jobs.push(getJSON(SPECS[key].file).then(function(fc){IX[key]=prep(fc);}));
  return Promise.all(jobs).then(function(){return IX[key];});
}
/* detalle por trozos de 30° (zoom ≥ 5): geometría mucho más fiel a la costa, cargada solo donde se mira */
var DET={idx:null,loading:null,chunks:{},cell:30,MINZ:5};
function detIndex(){if(DET.idx)return Promise.resolve(DET.idx);if(!DET.loading)DET.loading=getJSON("detalle/index.json").then(function(d){DET.idx=d;DET.cell=d.cell||30;return d;});return DET.loading;}
function detChunksFor(w,s,e,n){return(DET.idx?DET.idx.chunks:[]).filter(function(c){return !(c[2]<w||c[0]>e||c[3]<s||c[1]>n);});}
function detLoad(c){var k=c[4];if(!DET.chunks[k])DET.chunks[k]=getJSON("detalle/"+k).then(function(fc){var ix=prep(fc);ix.feats.forEach(function(f){f.a=f.a||0;});DET.chunks[k]={ix:ix};return DET.chunks[k];}).catch(function(e){delete DET.chunks[k];throw e;});return DET.chunks[k];}
function detPrepare(c){
  if(c.z<DET.MINZ)return null;
  var w=tileLng(c.x,c.z),e=tileLng(c.x+1,c.z),n=tileLat(c.y,c.z),s=tileLat(c.y+1,c.z);
  return detIndex().then(function(){var need=detChunksFor(w,s,e,n).filter(function(x){var v=DET.chunks[x[4]];return !v||v.then;});return Promise.all(need.map(detLoad));}).catch(function(){});
}
function detFeats(z,w,s,e,n){
  if(z<DET.MINZ||!DET.idx)return null;var cs=detChunksFor(w,s,e,n),out=[];
  for(var i=0;i<cs.length;i++){var v=DET.chunks[cs[i][4]];if(!v||v.then)return null;out=out.concat(query(v.ix,w,s,e,n));}
  out.sort(function(a,b){return b.a-a.a;});return out;
}
function detHit(lat,lng){
  if(!DET.idx||!LAYERS.act||map.getZoom()<DET.MINZ&&!document.body.classList.contains("globe-mode"))return undefined;
  var cs=detChunksFor(lng,lat,lng,lat);if(!cs.length)return undefined;var v=DET.chunks[cs[0][4]];if(!v||v.then)return undefined;
  var c=query(v.ix,lng-1e-6,lat-1e-6,lng+1e-6,lat+1e-6).sort(function(a,b){return b.a-a.a;});
  for(var k=c.length-1;k>=0;k--)if(inFeat(c[k],lng,lat)){var id=c[k].id;return IX.act.feats.filter(function(f){return f.id===id;})[0]||null;}
  return null;
}
function layerFor(key){
  if(!LAYERS[key]){
    var sp=SPECS[key];
    LAYERS[key]=new PolyTiles({ix:function(){return IX[key];},style:sp.style,label:sp.label,labels:function(){return state.labels;},minLabelZoom:sp.minLabelZoom,fontSize:sp.fontSize,
      prepare:sp.detail?detPrepare:null,detailFeats:sp.detail?detFeats:null,seam:30},{opacity:state.opacity,attribution:attrib(key),className:"anLngTiles"});
    LAYERS[key].__anLng=key;
  }
  return LAYERS[key];
}
function attrib(key){return key==="donde"?"Unicode CLDR · Made with Natural Earth":key==="vari"?"Variedades del español · Moreno Fernández (2009) · elaboración ANAMBRO":"Asher y Moseley (2007) · Glottography · Glottolog · CC BY 4.0";}
function isOn(key){return !!($(IDS[key])&&$(IDS[key]).checked);}
function setStatus(t){var e=$("lngStatus");if(e)e.textContent=t;}
function redraw(key){var l=LAYERS[key];if(l&&map.hasLayer(l))l.redraw();syncGlobe();}
function syncGlobe(){try{window.__anambroGlobo&&window.__anambroGlobo.sync&&setTimeout(window.__anambroGlobo.sync,60);}catch(e){}}
function syncAll(){
  try{window.__anActiveLayers&&window.__anActiveLayers.sync();}catch(e){}
  try{typeof updateLegend==="function"&&updateLegend();}catch(e){}
  try{typeof renderActiveSources==="function"&&renderActiveSources();}catch(e){}
  renderLegendBox();syncGlobe();
}
var loadingMsg={act:"Cargando unas 3.800 áreas lingüísticas…",pre:"Cargando las lenguas anteriores al contacto…",fam:"Cargando las familias lingüísticas…",donde:"Preparando el mapa por países…",vari:"Cargando las variedades del español…"};
function toggle(key,on){
  var l=layerFor(key);
  if(!on){if(map.hasLayer(l))map.removeLayer(l);setStatus("Capa desactivada.");syncAll();return;}
  Object.keys(IDS).forEach(function(k){if(k!==key&&isOn(k)){var o=$(IDS[k]);o.checked=false;o.dispatchEvent(new Event("change",{bubbles:true}));}});
  setStatus(loadingMsg[key]);
  ensure(key).then(function(){
    if(!isOn(key))return;
    l.setOpacity(state.opacity);if(!map.hasLayer(l))l.addTo(map);else l.redraw();
    setStatus(NAMES[key]+" · pulsa una zona para abrir su ficha.");
    if(key==="vari"&&!document.body.classList.contains("globe-mode")){try{var b=L.latLngBounds([[-56,-118],[44,10]]);if(!map.getBounds().intersects(b)||map.getZoom()<2)map.fitBounds(b,{padding:[10,10]});}catch(e){}}
    syncAll();fillSearch();
  }).catch(function(e){console.warn(e);setStatus("No se pudieron cargar los datos de lenguas.");var c=$(IDS[key]);if(c)c.checked=false;syncAll();});
}

/* ---------- fichas ---------- */
function tile(lbl,val,sub){return val?'<div class="anLgTile"><small>'+lbl+"</small><b>"+val+"</b>"+(sub?"<span>"+sub+"</span>":"")+"</div>":"";}
function countryList(arr,max){arr=(arr||[]).filter(function(c){return c!=="IC"&&c!=="EA";});if(!arr.length)return"";var names=arr.map(paisNombre).sort(function(a,b){return a.localeCompare(b,"es");});var more=names.length>max?" y "+(names.length-max)+" más":"";return names.slice(0,max).map(esc).join(", ")+more;}
function head(icon,title,sub,color){return'<div class="anLgHead" style="--lgc:'+(color||"#123a5e")+'"><div class="anLgIcon">'+icon+'</div><div class="anLgTit"><h3>'+esc(title)+"</h3>"+(sub?"<p>"+sub+"</p>":"")+"</div></div>";}
function langCard(f,key){
  var d=INFO.lenguas[f.id]||{n:f.id};
  var v=d.e&&VITAL[d.e];
  var sub=[d.en&&d.en!==d.n?"En inglés: "+esc(d.en):"",key==="pre"?"Área tradicional (antes del contacto europeo)":"Área actual de uso"].filter(Boolean).join(" · ");
  var h='<div class="anLg">'+head("🗣️",d.n,sub,langColor(f.id))+'<div class="anLgBody"><div class="anLgTiles">'+
    tile("Familia",esc(d.f||""),d.g?"Grupo: "+esc(d.g):"")+tile("Macroárea",esc(macro(d.m)))+
    tile("Hablantes",d.h?"≈ "+fmtHab(d.h):"","primera y segunda lengua · CLDR")+tile("Código ISO 639-3",d.iso?esc(d.iso):"")+
    (v?'<div class="anLgTile"><small>Vitalidad</small><b><span class="anLgDot" style="background:'+v[1]+'"></span>'+v[0]+"</b><span>Glottolog (AES)</span></div>":"")+"</div>";
  if(d.of)h+='<p class="anLgP"><b>Lengua oficial en:</b> '+countryList(d.of,14)+".</p>";
  if(d.rg)h+='<p class="anLgP"><b>Oficial en alguna región de:</b> '+countryList(d.rg,10)+".</p>";
  if(d.p&&d.p.length)h+='<p class="anLgP"><b>Se habla en:</b> '+countryList(d.p,16)+".</p>";
  h+='<div class="anLgRadio" data-lng-radio="'+esc(key)+'|'+esc(f.id)+'"><button type="button" class="anLgBtn" data-lng-act="radios">📻 Escuchar emisoras de esta zona</button></div>';
  h+='<div class="anLgBtns">'+(d.c&&WHERE_OK(d.c)?'<button type="button" class="anLgBtn" data-lng-act="where" data-code="'+esc(d.c)+'">🌍 ¿Dónde se habla '+esc(d.n.toLowerCase())+'?</button>':"")+
    '<a class="anLgBtn" href="https://glottolog.org/resource/languoid/id/'+esc(f.id)+'" target="_blank" rel="noopener">Glottolog ↗</a></div>';
  if(d.add)h+='<div class="anLgNote" style="border:0;margin-top:8px">⚠️ '+esc(d.add)+"</div>";
  h+='<div class="anLgNote">'+(key==="pre"?"Áreas tradicionales de Asher y Moseley (2007) para América y Australia, aproximadamente en la época del contacto europeo.":"Áreas de Asher y Moseley (2007, Atlas of the World’s Languages) en la versión libre de Glottography.")+" Clasificación y vitalidad: Glottolog. Las áreas son aproximadas y en muchas zonas conviven varias lenguas.</div></div></div>";
  return h;
}
var MACRO_ES={"Eurasia":"Eurasia","Africa":"África","Papunesia":"Papunesia","Australia":"Australia","North America":"América del Norte y Central","South America":"América del Sur"};
function macro(m){return String(m||"").split(";").map(function(x){x=x.trim();return MACRO_ES[x]||x;}).filter(Boolean).join(", ");}
function WHERE_OK(c){return !!(WHERE?WHERE.lenguas[c]:true);}
function famCard(f){
  var d=INFO.familias[f.id]||{n:f.id};var tops=[];
  for(var k in INFO.lenguas){var x=INFO.lenguas[k];if(x.fid===f.id&&x.h)tops.push(x);}
  var seen={};tops=tops.sort(function(a,b){return b.h-a.h;}).filter(function(x){if(seen[x.n])return false;seen[x.n]=1;return true;}).slice(0,8);
  var single=!d.nl||d.nl<=1;
  var h='<div class="anLg">'+head("🌳",single?d.n:"Familia "+d.n.toLowerCase(),d.en&&d.en!==d.n?"En inglés: "+esc(d.en):"",famColor(f.id))+'<div class="anLgBody"><div class="anLgTiles">'+
    tile("Lenguas de la familia",d.nl?fmtN(d.nl):"","según Glottolog")+tile("Macroárea",esc(d.m||""))+"</div>";
  if(tops.length)h+='<p class="anLgP"><b>Lenguas con más hablantes:</b></p><ul class="anLgList">'+tops.map(function(x){return"<li><b>"+esc(x.n)+"</b> · ≈ "+fmtHab(x.h)+"</li>";}).join("")+"</ul>";
  h+='<div class="anLgRadio" data-lng-radio="fam|'+esc(f.id)+'"><button type="button" class="anLgBtn" data-lng-act="radios">📻 Escuchar emisoras de esta zona</button></div>';
  h+='<div class="anLgNote">Área de la familia según Asher y Moseley (2007) · Glottography; número de lenguas y clasificación: Glottolog. Hablantes: estimación de Unicode CLDR (primera y segunda lengua).</div></div></div>';
  return h;
}
function varCard(f){
  var v=VAR[f.id];if(!v)return"";
  var li=function(a){return"<ul class=\"anLgList\">"+a.map(function(x){return"<li>"+x+"</li>";}).join("")+"</ul>";};
  var h='<div class="anLg">'+head("🇪🇸","Español · área "+v.n.replace(/^(.)/,function(m){return m.toLowerCase();}),"Variedades del español · Moreno Fernández (2009)",v.c)+'<div class="anLgBody"><p class="anLgP">'+v.ambito+"</p>"+
   '<div class="anLgSec"><h4>🔊 Pronunciación</h4>'+li(v.fon)+'</div><div class="anLgSec"><h4>✍️ Gramática</h4>'+li(v.gram)+'</div><div class="anLgSec"><h4>📖 Léxico</h4><p class="anLgChips">'+v.lex.map(function(x){return"<span>"+x+"</span>";}).join("")+"</p></div>"+
   '<div class="anLgSec"><h4>📻 Escúchalo en la radio</h4><div class="anLgBtns">'+v.ciudades.map(function(c,i){return'<button type="button" class="anLgBtn" data-lng-act="city" data-lat="'+c[1]+'" data-lng="'+c[2]+'" data-city="'+esc(c[0])+'">'+esc(c[0])+"</button>";}).join("")+"</div><div class=\"anLgRadioOut\"></div></div>"+
   '<div class="anLgNote">Áreas según F. Moreno Fernández, <i>La lengua española en su geografía</i> (Madrid, Arco/Libros, 2009), dibujadas por ANAMBRO sobre divisiones administrativas (Natural Earth): los límites son aproximados y los rasgos varían dentro de cada área según la zona, la edad y el nivel sociocultural.</div></div></div>';
  return h;
}
function whereCard(f){
  var L1=WHERE&&WHERE.lenguas[state.where],row=whereRow(f.id),name=paisNombre(f.id)||f.ne||f.id;
  if(f.id==="EH")name="Sáhara Occidental (territorio ocupado)";
  var all=[];if(WHERE)for(var c in WHERE.lenguas){var r=WHERE.lenguas[c].t[f.id];if(r&&r[0]>=1)all.push([WHERE.lenguas[c].n,r[0],r[1],c]);}
  all.sort(function(a,b){return b[1]-a[1];});
  var stTxt=function(s){return(STATUS_COL[s]||STATUS_COL[""])[1];};
  var h='<div class="anLg">'+head("🌍",name,L1?"¿Dónde se habla "+esc(L1.n.toLowerCase())+"?":"",row?whereColor(row):"#7b8a99")+'<div class="anLgBody"><div class="anLgTiles">'+
    (row?tile(esc(L1.n),fmtPct(row[0])+" de la población",stTxt(row[1])):'<div class="anLgTile"><small>'+esc(L1?L1.n:"")+"</small><b>Sin hablantes registrados</b></div>")+"</div>";
  if(all.length)h+='<p class="anLgP"><b>Lenguas que se hablan en '+esc(name)+":</b></p><ul class=\"anLgList\">"+all.slice(0,10).map(function(x){return"<li><b>"+esc(x[0])+"</b> · "+fmtPct(x[1])+(x[2]?" · "+stTxt(x[2]).toLowerCase():"")+"</li>";}).join("")+"</ul>";
  h+='<div class="anLgNote">Porcentaje de la población que habla la lengua, como primera o segunda lengua, y estatus oficial: Unicode CLDR (territoryInfo), estimaciones de distintas fuentes con años diferentes. Solo se incluyen lenguas con más de un millón de hablantes.</div></div></div>';
  return h;
}
function fmtPct(p){return(p>=10?Math.round(p):p>=1?p.toLocaleString("es-ES",{maximumFractionDigits:1}):p.toLocaleString("es-ES",{maximumFractionDigits:2}))+" %";}
function cardFor(key,f){return key==="fam"?famCard(f):key==="vari"?varCard(f):key==="donde"?whereCard(f):langCard(f,key);}

/* prioridad de consulta entre las capas de lenguas activas */
function activeKeys(){
  var ks=["vari","donde","act","pre","fam"].filter(function(k){return isOn(k)&&IX[k]&&LAYERS[k]&&map.hasLayer(LAYERS[k]);});
  try{var R=window.__anActiveLayers&&window.__anActiveLayers.rank;if(R)ks.sort(function(a,b){return R(IDS[a])-R(IDS[b]);});}catch(e){}
  return ks;
}
function hitAt(lat,lng){
  var ks=activeKeys();
  for(var i=0;i<ks.length;i++){var k=ks[i],f;
    if(k==="act"){var dh=detHit(lat,lng);f=dh===undefined?hit(IX.act,lat,lng):dh;}
    else f=hit(IX[k],lat,lng,k==="donde"?function(x){return !!whereRow(x.id);}:null);
    if(f)return{key:k,f:f};}
  if(ks.indexOf("donde")>=0){var g=hit(IX.donde,lat,lng);if(g)return{key:"donde",f:g};}
  return null;
}
var lastCard=null;
function open2D(h,latlng){
  lastCard={key:h.key,f:h.f,latlng:latlng};
  L.popup({maxWidth:470,minWidth:300,className:"anLgPopup",autoPan:true,autoPanPaddingTopLeft:L.point(24,180),autoPanPaddingBottomRight:L.point(24,90)}).setLatLng(latlng).setContent('<div class="anLgCard">'+cardFor(h.key,h.f)+"</div>").openOn(map);
  try{status(NAMES[h.key]);}catch(e){}
}
function openGlobe(h,pos,latlng){
  lastCard={key:h.key,f:h.f,latlng:latlng};
  var html='<div class="anLgCard anLgGlobe">'+cardFor(h.key,h.f)+"</div>";
  try{if(window.anambroGlobo&&window.anambroGlobo.showInfo){window.anambroGlobo.showInfo(html,pos,latlng);var gi=$("globeInfo");gi&&gi.classList.add("anLgWide");return true;}}catch(e){console.warn(e);}
  return false;
}
/* 2D: antes del popup genérico */
function wrapShowPoint(){
  if(typeof showPoint!=="function"||showPoint.__anLng)return;
  var orig=showPoint;
  var w=function(latlng,title){
    try{if((title===undefined||title==="Punto consultado")&&latlng&&activeKeys().length){var h=hitAt(latlng.lat,latlng.lng);if(h){open2D(h,latlng);return Promise.resolve();}}}catch(e){console.warn(e);}
    return orig.apply(this,arguments);
  };
  w.__anLng=true;for(var k in orig)try{w[k]=orig[k];}catch(e){}
  showPoint=w;window.showPoint=w;
}
/* globo: clic propio si no hay un elemento puntual encima */
var BLOCK=["__anambroRadioGarden","__anambroVolcano","__anambroRecentVolcano","__anambroQuake","__anambroHistoricalEvent","__anambroClima","__anambroTiempo","__anambroUrb","__anLeaf"];
function wrapGlobe(){
  var G=window.anambroGlobo;if(!G||!G.leafClick||G.leafClick.__anLng)return !!(G&&G.leafClick&&G.leafClick.__anLng);
  var orig=G.leafClick;
  var w=function(pos,ll){
    var r=false;try{r=orig.apply(this,arguments);}catch(e){}
    if(r)return r;
    try{
      if(!ll||!activeKeys().length)return false;
      var gv=typeof globeViewer!=="undefined"?globeViewer:null;
      if(gv){var picks=[];try{picks=gv.scene.drillPick(pos,6)||[];}catch(e){}
        for(var i=0;i<picks.length;i++){var id=picks[i]&&picks[i].id;if(!id)continue;for(var j=0;j<BLOCK.length;j++)if(id[BLOCK[j]])return false;if(id.__anambroSearchedPlaceId!==undefined)return false;}}
      var lat=ll.lat!=null?ll.lat:ll[0],lng=ll.lng!=null?ll.lng:ll[1];
      var h=hitAt(lat,lng);if(h)return openGlobe(h,pos,L.latLng(lat,lng));
    }catch(e){console.warn(e);}
    return false;
  };
  w.__anLng=true;G.leafClick=w;return true;
}

/* ---------- radios ---------- */
function placesReady(){try{if(typeof loadRadioGardenPlaces==="function")return Promise.resolve(loadRadioGardenPlaces()).then(function(p){return p||(typeof radioGardenPlaces!=="undefined"?radioGardenPlaces:[]);});}catch(e){}return Promise.reject(new Error("Radio Garden no disponible"));}
function placeLL(p){return{lat:p.geo[1],lng:p.geo[0]};}
function openPlace(p){
  var ll=placeLL(p);
  if(document.body.classList.contains("globe-mode")&&typeof showRadioGardenGlobePlace==="function"){
    try{globeViewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(ll.lng,ll.lat,9e5),duration:1.2});}catch(e){}
    setTimeout(function(){try{showRadioGardenGlobePlace(p,null);}catch(e){console.warn(e);}},1300);return;
  }
  if(typeof openRadioGardenPlace2D==="function"){
    map.closePopup();
    var mk=L.marker([ll.lat,ll.lng],{opacity:0,interactive:false,keyboard:false}).addTo(map);
    map.setView([ll.lat,ll.lng],Math.max(map.getZoom(),6));
    setTimeout(function(){openRadioGardenPlace2D(p,mk);mk.on("popupclose",function(){setTimeout(function(){map.removeLayer(mk);},0);});},350);
  }
}
function radiosForFeature(box){
  var parts=String(box.getAttribute("data-lng-radio")||"").split("|"),key=parts[0],id=parts.slice(1).join("|");
  var ix=IX[key==="fam"?"fam":key];var f=ix&&ix.feats.filter(function(x){return x.id===id;});
  box.innerHTML='<span class="anLgMuted">Buscando localidades con emisoras…</span>';
  placesReady().then(function(pl){
    var inside=[];(pl||[]).forEach(function(p){if(!p||!p.geo)return;var x=p.geo[0],y=p.geo[1];for(var i=0;i<(f||[]).length;i++){var F=f[i];if(x<F.b[0]-.3||x>F.b[2]+.3||y<F.b[1]-.3||y>F.b[3]+.3)continue;if(inFeat(F,x,y)||nearFeat(F,x,y,.25)){inside.push(p);break;}}});
    inside.sort(function(a,b){return(b.size||0)-(a.size||0);});
    if(!inside.length){box.innerHTML='<span class="anLgMuted">No hay emisoras de Radio Garden dentro de esta área.</span>';return;}
    box.innerHTML='<small class="anLgMuted">Localidades con emisoras dentro del área (pulsa para escuchar):</small><div class="anLgBtns">'+inside.slice(0,10).map(function(p,i){return'<button type="button" class="anLgBtn" data-lng-act="place" data-i="'+i+'">'+esc(p.title)+(p.country?" · "+esc(p.country):"")+"</button>";}).join("")+"</div>";
    box.__places=inside.slice(0,10);
  }).catch(function(){box.innerHTML='<span class="anLgMuted">No se pudo cargar el directorio de Radio Garden.</span>';});
}
function radiosNearCity(btn){
  var lat=+btn.dataset.lat,lng=+btn.dataset.lng,out=btn.closest(".anLgSec").querySelector(".anLgRadioOut");
  out&&(out.innerHTML='<span class="anLgMuted">Buscando emisoras de '+esc(btn.dataset.city)+"…</span>");
  placesReady().then(function(pl){
    var best=null,bd=1e9;(pl||[]).forEach(function(p){if(!p||!p.geo)return;var dx=(p.geo[0]-lng)*Math.cos(lat*D2R),dy=p.geo[1]-lat,d=dx*dx+dy*dy-Math.log((p.size||1)+1)*1e-4;if(d<bd){bd=d;best=p;}});
    if(!best||bd>1.2){out&&(out.innerHTML='<span class="anLgMuted">No hay emisoras cerca de '+esc(btn.dataset.city)+".</span>");return;}
    out&&(out.innerHTML="");openPlace(best);
  }).catch(function(){out&&(out.innerHTML='<span class="anLgMuted">No se pudo cargar el directorio de Radio Garden.</span>');});
}
document.addEventListener("click",function(ev){
  var b=ev.target.closest&&ev.target.closest("[data-lng-act]");if(!b)return;
  var act=b.dataset.lngAct;if(act!=="glottolog"){ev.stopPropagation();}
  setTimeout(function(){runAct(b,act);},0);
},true);
function runAct(b,act){
  if(act==="radios"){radiosForFeature(b.closest("[data-lng-radio]"));}
  else if(act==="place"){var box=b.closest("[data-lng-radio]");var p=box&&box.__places&&box.__places[+b.dataset.i];p&&openPlace(p);}
  else if(act==="city"){radiosNearCity(b);}
  else if(act==="where"){var c=b.dataset.code;var sel=$("lngWhereLang");if(sel){if(![].some.call(sel.options,function(o){return o.value===c;}))return;sel.value=c;}state.where=c;var ck=$(IDS.donde);if(ck&&!ck.checked){ck.checked=true;ck.dispatchEvent(new Event("change",{bubbles:true}));}else redraw("donde");renderLegendBox();try{map.closePopup();}catch(e){}}
}

/* ---------- leyenda ---------- */
var MAINFAM=["indo1319","sino1245","atla1278","afro1255","aust1307","drav1251","turk1311","aust1305","japo1237","taik1256","ural1272","kore1284","nucl1709","quec1387","utoa1244","maya1287","tupi1275","pama1250"];
function legendHTML(forPrint){
  var h="";
  if(isOn("act")||isOn("pre")||isOn("fam")){
    var t=isOn("fam")?"Familias lingüísticas":isOn("act")?"Lenguas del mundo · color por familia":"Lenguas antes del contacto europeo · color por familia";
    h+='<div class="anLgLeg"><b>'+t+'</b><div class="anLgLegGrid">'+MAINFAM.map(function(id){var n=INFO&&INFO.familias[id]?INFO.familias[id].n:id;return'<span><i style="background:'+famColor(id)+'"></i>'+esc(n)+"</span>";}).join("")+'<span><i style="background:#8c8c8c"></i>Lengua aislada</span></div>'+(isOn("fam")?"":"<small>Cada lengua lleva un tono propio dentro del color de su familia.</small>")+"</div>";
  }
  if(isOn("donde")&&WHERE){
    var L1=WHERE.lenguas[state.where];
    h+='<div class="anLgLeg"><b>¿Dónde se habla '+esc(L1?L1.n.toLowerCase():"")+"?</b>"+(state.whereMode==="status"?
      '<div class="anLgLegGrid">'+["official","official_regional",""].map(function(k){return'<span><i style="background:'+STATUS_COL[k][0]+'"></i>'+STATUS_COL[k][1]+"</span>";}).join("")+"</div>":
      '<div class="anLgLegGrid">'+WHERE_CLASSES.map(function(c){return'<span><i style="background:'+c[1]+'"></i>'+c[2]+"</span>";}).join("")+"</div><small>% de la población que la habla (1.ª o 2.ª lengua)</small>")+"</div>";
  }
  if(isOn("vari"))h+='<div class="anLgLeg"><b>Variedades del español</b><div class="anLgLegGrid">'+Object.keys(VAR).map(function(k){return'<span><i style="background:'+VAR[k].c+'"></i>'+esc(VAR[k].n)+"</span>";}).join("")+"</div><small>Moreno Fernández (2009) · límites aproximados</small></div>";
  return h;
}
function renderLegendBox(){var e=$("lngLegend");if(!e)return;var h=legendHTML(false);e.innerHTML=h;e.style.display=h?"block":"none";var wo=$("lngWhereOpts");if(wo)wo.style.display=isOn("donde")?"block":"none";}

/* ---------- buscador de lenguas ---------- */
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");}
function fillSearch(){
  var dl=$("lngSearchList");if(!dl||!INFO)return;var keys=["act","pre"].filter(function(k){return IX[k];});if(!keys.length)return;
  var seen={},opts=[];keys.forEach(function(k){IX[k].feats.forEach(function(f){var d=INFO.lenguas[f.id];if(!d||seen[d.n])return;seen[d.n]=1;opts.push(d.n);});});
  dl.__all=opts.sort(function(a,b){return a.localeCompare(b,"es");});
}
function searchInput(e){var dl=$("lngSearchList");if(!dl||!dl.__all)return;var q=norm(e.target.value);var r=[];for(var i=0;i<dl.__all.length&&r.length<40;i++)if(!q||norm(dl.__all[i]).indexOf(q)>=0)r.push(dl.__all[i]);dl.innerHTML=r.map(function(x){return'<option value="'+esc(x)+'"></option>';}).join("");}
function searchGo(e){
  var v=e.target.value.trim();if(!v||!INFO)return;
  var keys=["act","pre"].filter(function(k){return IX[k]&&isOn(k);});if(!keys.length)keys=["act","pre"].filter(function(k){return IX[k];});
  var found=null;keys.some(function(k){return IX[k].feats.some(function(f){var d=INFO.lenguas[f.id];if(d&&(d.n===v||norm(d.n)===norm(v)||norm(d.en)===norm(v))){found={key:k,f:f};return true;}return false;});});
  if(!found)keys.some(function(k){return IX[k].feats.some(function(f){var d=INFO.lenguas[f.id];if(d&&(norm(d.n).indexOf(norm(v))>=0||norm(d.en).indexOf(norm(v))>=0)){found={key:k,f:f};return true;}return false;});});
  if(!found){setStatus("No encuentro «"+v+"» entre las lenguas cartografiadas.");return;}
  var F=found.f,ll=L.latLng(F.lp[1],F.lp[0]);e.target.value="";
  if(document.body.classList.contains("globe-mode")&&typeof globeViewer!=="undefined"&&globeViewer){
    try{globeViewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(ll.lng,ll.lat,Math.max(4e5,Math.min(6e6,Math.sqrt(F.a||1)*2.5e5))),duration:1.4});}catch(x){}
    setTimeout(function(){openGlobe(found,null,ll);},1500);
  }else{
    try{map.fitBounds(L.latLngBounds([[F.b[1],F.b[0]],[F.b[3],F.b[2]]]),{padding:[40,40],maxZoom:7});}catch(x){map.setView(ll,5);}
    setTimeout(function(){open2D(found,ll);},450);
  }
}

/* ---------- integración: capas visibles, fuentes, leyenda, impresión ---------- */
function integrate(){
  try{var M=window.__anActiveLayers&&window.__anActiveLayers.META;if(M){Object.keys(IDS).forEach(function(k,i){M[IDS[k]]={name:k==="donde"?function(){var L1=WHERE&&WHERE.lenguas[state.where];return"¿Dónde se habla "+(L1?L1.n.toLowerCase():"…")+"?";}:NAMES[k],p:46-i,get:function(){return[LAYERS[k]||null];}};});}}catch(e){console.warn(e);}
  try{if(typeof ANAMBRO_SOURCES!=="undefined"){
    ANAMBRO_SOURCES.lng_asher={short:"Asher y Moseley (2007) · Atlas of the World’s Languages · Glottography (asher2007world) · CC BY 4.0"};
    ANAMBRO_SOURCES.lng_glottolog={short:"Glottolog 5 · Hammarström, Forkel, Haspelmath y Bank · CC BY 4.0"};
    ANAMBRO_SOURCES.lng_cldr={short:"Unicode CLDR · población hablante y estatus oficial · licencia Unicode"};
    ANAMBRO_SOURCES.lng_var={short:"Variedades del español · Moreno Fernández (2009) · límites: elaboración ANAMBRO sobre Natural Earth"};
  }}catch(e){}
  try{if(typeof activeSourceKeys==="function"&&!activeSourceKeys.__anLng){var o=activeSourceKeys,w=function(){var r=o.apply(this,arguments)||[];if(isOn("act")||isOn("pre")||isOn("fam")){r.push("lng_asher","lng_glottolog");}if(isOn("act")||isOn("fam")||isOn("donde"))r.push("lng_cldr");if(isOn("donde"))r.push("naturalearth");if(isOn("vari"))r.push("lng_var","naturalearth");return r.filter(function(x,i,a){return a.indexOf(x)===i;});};w.__anLng=true;for(var k in o)try{w[k]=o[k];}catch(e){}activeSourceKeys=w;window.activeSourceKeys=w;}}catch(e){console.warn(e);}
  try{if(typeof activeSourcesText==="function"&&!activeSourcesText.__anLng){var o2=activeSourcesText,w2=function(){var t=o2.apply(this,arguments)||"";var add=[];if(isOn("act")||isOn("pre")||isOn("fam"))add.push("Lenguas: Asher y Moseley (2007) · Glottography · Glottolog · CC BY 4.0");if(isOn("donde")||isOn("act"))add.push("Unicode CLDR");if(isOn("vari"))add.push("Variedades del español: Moreno Fernández (2009) · elaboración ANAMBRO");add=add.filter(function(x){return t.indexOf(x)<0;});return[t].concat(add).filter(Boolean).join(" · ");};w2.__anLng=true;activeSourcesText=w2;window.activeSourcesText=w2;}}catch(e){}
  try{if(typeof updateLegend==="function"&&!updateLegend.__anLng){var o3=updateLegend,w3=function(){o3.apply(this,arguments);var lc=$("legendContent");if(lc&&!lc.querySelector(".anLgLeg")){var h=legendHTML(false);h&&lc.insertAdjacentHTML("beforeend",h);}};w3.__anLng=true;updateLegend=w3;window.updateLegend=w3;}}catch(e){}
  try{if(typeof activeLegendHTML==="function"&&!activeLegendHTML.__anLng){var o4=activeLegendHTML,w4=function(){return(o4.apply(this,arguments)||"")+legendHTML(true);};w4.__anLng=true;activeLegendHTML=w4;window.activeLegendHTML=w4;}}catch(e){}
  try{if(typeof defaultLayoutTitle==="function"&&!defaultLayoutTitle.__anLng){var o5=defaultLayoutTitle,w5=function(){if(isOn("vari"))return"Variedades del español";if(isOn("donde")){var L1=WHERE&&WHERE.lenguas[state.where];return"¿Dónde se habla "+(L1?L1.n.toLowerCase():"")+"?";}if(isOn("fam"))return"Familias lingüísticas del mundo";if(isOn("pre"))return"Lenguas de América y Australia antes del contacto europeo";if(isOn("act"))return"Lenguas del mundo";return o5.apply(this,arguments);};w5.__anLng=true;defaultLayoutTitle=w5;window.defaultLayoutTitle=w5;}}catch(e){}
  wrapShowPoint();
  if(!wrapGlobe()){var tries=0,t=setInterval(function(){if(wrapGlobe()||++tries>40)clearInterval(t);},500);}
}

/* ---------- interfaz ---------- */
function buildWhereSelect(){
  var sel=$("lngWhereLang");if(!sel)return;
  getJSON("donde_se_habla.json").then(function(d){WHERE=d;var arr=Object.keys(d.lenguas).map(function(k){return[k,d.lenguas[k]];});
    arr.sort(function(a,b){return a[1].n.localeCompare(b[1].n,"es");});
    var top=["es","en","fr","de","pt","it","ar","zh","ru"];
    sel.innerHTML='<optgroup label="Lenguas del centro">'+top.filter(function(k){return d.lenguas[k];}).map(function(k){return'<option value="'+k+'">'+esc(d.lenguas[k].n)+"</option>";}).join("")+'</optgroup><optgroup label="Todas (más de un millón de hablantes)">'+arr.map(function(x){return'<option value="'+x[0]+'">'+esc(x[1].n)+" · ≈ "+fmtHab(x[1].h)+"</option>";}).join("")+"</optgroup>";
    sel.value=state.where;
  }).catch(function(){});
}
function bindUI(){
  Object.keys(IDS).forEach(function(k){var c=$(IDS[k]);c&&c.addEventListener("change",function(){toggle(k,c.checked);});});
  var op=$("lngOpacity");op&&op.addEventListener("input",function(){state.opacity=+op.value;var v=$("lngOpacityValue");v&&(v.textContent=Math.round(state.opacity*100)+" %");Object.keys(LAYERS).forEach(function(k){LAYERS[k].setOpacity(state.opacity);});syncGlobe();});
  var lb=$("lngLabelsCheck");lb&&lb.addEventListener("change",function(){state.labels=lb.checked;Object.keys(LAYERS).forEach(function(k){if(map.hasLayer(LAYERS[k]))LAYERS[k].redraw();});syncGlobe();});
  var sel=$("lngWhereLang");sel&&sel.addEventListener("change",function(){state.where=sel.value;redraw("donde");renderLegendBox();try{updateLegend();}catch(e){}try{window.__anActiveLayers&&window.__anActiveLayers.sync();}catch(e){}});
  var md=$("lngWhereMode");md&&md.addEventListener("change",function(){state.whereMode=md.value;redraw("donde");renderLegendBox();try{updateLegend();}catch(e){}});
  var se=$("lngSearch");if(se){se.addEventListener("focus",function(){Promise.all([info(),ensure("act")]).then(function(){fillSearch();searchInput({target:se});});});se.addEventListener("input",searchInput);se.addEventListener("change",searchGo);}
  buildWhereSelect();
}
function css(){
  if($("anLgCss"))return;var st=document.createElement("style");st.id="anLgCss";st.textContent=[
".anLgPopup .leaflet-popup-content{margin:0;width:auto!important;min-width:300px}",
".anLgPopup .leaflet-popup-content-wrapper{padding:0;border-radius:12px;overflow:hidden}",
".anLgCard{width:440px;max-width:calc(100vw - 60px);max-height:min(54vh,520px);overflow-y:auto;overscroll-behavior:contain}",
".anLg{font-size:14.5px;line-height:1.5;color:#1d2a3a;width:100%;max-width:460px;box-sizing:border-box}",
".anLg *{box-sizing:border-box}",
".anLgHead{display:flex;align-items:center;gap:12px;padding:14px 46px 14px 16px;background:#123a5e;color:#fff;border-bottom:6px solid var(--lgc,#123a5e)}",
".anLgIcon{width:46px;height:46px;flex:0 0 46px;border-radius:10px;background:var(--lgc,#fff);display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.75)}",
".anLgTit h3{margin:0;font-size:21px;line-height:1.15;color:#fff;font-weight:800}",
".anLgTit p{margin:3px 0 0;font-size:13px;color:#cfe0f0}",
".anLgBody{padding:12px 16px 12px}",
".anLgTiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}",
".anLgTile{background:#f4f7fb;border:1px solid #e3e9f1;border-radius:10px;padding:8px 10px}",
".anLgTile small{display:block;font-size:11.5px;color:#5f6e80;text-transform:uppercase;letter-spacing:.4px}",
".anLgTile b{display:block;font-size:15px;color:#14263f;line-height:1.3;margin-top:2px}",
".anLgTile span{display:block;font-size:12px;color:#5f6e80}",
".anLgDot{display:inline-block!important;width:11px;height:11px;border-radius:50%;margin-right:6px;vertical-align:0}",
".anLgP{margin:10px 0 0;font-size:14px}",
".anLgList{margin:6px 0 0 0;padding-left:20px}",".anLgList li{margin:2px 0}",
".anLgSec{margin-top:12px}",".anLgSec h4{margin:0 0 4px;font-size:15px;color:#123a5e;font-weight:800}",
".anLgChips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 0}",".anLgChips span{background:#fff4d6;border:1px solid #f0d58a;border-radius:999px;padding:2px 10px;font-size:13px}",
".anLgBtns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
".anLgBtn{font:inherit;font-size:13px;padding:5px 12px;border:1px solid #c5cfdb;border-radius:999px;background:#fff;color:#123a5e;font-weight:600;cursor:pointer;text-decoration:none}",
".anLgBtn:hover{background:#eef3f8}",
".anLgRadio{margin-top:10px}",".anLgMuted{color:#6a7889;font-size:13px}",
".anLgNote{margin-top:12px;font-size:11.5px;color:#6a7889;line-height:1.4;border-top:1px solid #e3e9f1;padding-top:8px}",
"#globeInfo.anLgWide{max-width:min(470px,92vw)!important;width:min(470px,92vw)}",
"#globeInfo .anLgCard{max-height:min(60vh,560px)}",
".anLgLeg{margin-top:8px;font-size:11px;line-height:1.35}",".anLgLeg small{display:block;color:#5f6e80;margin-top:3px}",
".anLgLegGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 8px;margin-top:4px}",
".anLgLegGrid span{display:flex;align-items:center;gap:5px}",".anLgLegGrid i{flex:0 0 13px;height:11px;border-radius:2px;border:1px solid rgba(0,0,0,.15)}",
"#lngSearch{width:100%;margin-top:6px;padding:5px 8px;border:1px solid #c5cfdb;border-radius:8px;font:inherit;font-size:12px}",
"#lngWhereOpts select{width:100%;margin-top:3px;font-size:12px}"
].join("\n");document.head.appendChild(st);
}
function init(){css();bindUI();integrate();renderLegendBox();window.anambroLenguas={ensure:ensure,hitAt:hitAt,layers:LAYERS,state:state,index:IX,open:function(k,id){var f=IX[k]&&IX[k].feats.filter(function(x){return x.id===id;})[0];if(f)open2D({key:k,f:f},L.latLng(f.lp[1],f.lp[0]));}};}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
