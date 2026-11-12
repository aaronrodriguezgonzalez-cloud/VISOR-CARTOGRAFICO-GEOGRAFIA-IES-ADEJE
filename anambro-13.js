/* ANAMBRO · Análisis geográfico: datos de las regiones del mundo (Global Data Lab) · nov 2026
   Los mismos indicadores que muestra la ficha de cada región (IDH subnacional, salud, educación, renta,
   esperanza de vida, población…) pasan a estar disponibles en el Análisis geográfico para:
   · Países del mundo (dato nacional del Global Data Lab)
   · Divisiones de 1.er y 2.º nivel de un país: a cada división se le asigna la región del Global Data Lab
     con la que comparte más superficie (intersección exacta de polígonos, no muestreo por puntos). */
(function(){
"use strict";
var V="?v=2026-11-03",BASE=new URL("data/gdl/",location.href).href;
var IND={
 shdi:["Índice de Desarrollo Humano (IDH)","",3],healthindex:["Índice de salud (IDH)","",3],edindex:["Índice de educación (IDH)","",3],incindex:["Índice de ingresos (IDH)","",3],
 lifexp:["Esperanza de vida al nacer","años",1],lifexpf:["Esperanza de vida al nacer · mujeres","años",1],lifexpm:["Esperanza de vida al nacer · hombres","años",1],
 esch:["Años esperados de escolarización","años",1],msch:["Años medios de escolarización (25 años o más)","años",1],
 gnic:["Renta nacional bruta por habitante (PPA, $ de 2017)","$ PPA",0],pop:["Población (Global Data Lab)","hab.",0],
 sgdi:["Índice de Desarrollo de Género (IDG)","mujeres / hombres",3],shdif:["IDH de las mujeres","",3],shdim:["IDH de los hombres","",3]
};
var ORDER=["shdi","healthindex","edindex","incindex","lifexp","lifexpf","lifexpm","esch","msch","gnic","sgdi","shdif","shdim","pop"];
var GROUP="🌍 Desarrollo humano · regiones del mundo (Global Data Lab)";
var WORLD=new Set(["world-countries","world-adm1","world-adm2"]);
var $=function(id){return document.getElementById(id);};
var IX=null,FILES={},ASSIGN=new WeakMap,YEARS={};
function index(){if(!IX)IX=fetch(BASE+"index.json"+V,{cache:"force-cache"}).then(function(r){return r.json();}).catch(function(){IX=null;return {};});return IX;}
function file(iso){
  if(!FILES[iso])FILES[iso]=fetch(BASE+iso+".json"+V,{cache:"force-cache"}).then(function(r){if(!r.ok)throw 0;return r.json();})
    .catch(function(){return fetch(BASE+"gdl/"+iso+".json"+V,{cache:"force-cache"}).then(function(r){if(!r.ok)throw new Error("sin datos");return r.json();});})
    .catch(function(e){delete FILES[iso];throw e;});
  return FILES[iso];
}
function unit(){return($("geoGeneralUnits")||{}).value||"";}
function isoOf(f){
  var p=f&&f.properties||{},u=unit();
  if(u==="world-adm1"||u==="world-adm2"){var c=($("geoGeneralCountry")||{}).value||"";if(/^[A-Z]{3}$/.test(c))return c;var k=String(p.__anambroCode||"");if(/^[A-Z]{3}/.test(k))return k.slice(0,3);}
  var cands=[p.ISO_A3_EH,p.ISO_A3,p.ADM0_A3,p.iso3,p.__iso3,p.__anambroCode,p.SOV_A3,p.WB_A3];
  for(var i=0;i<cands.length;i++){var v=String(cands[i]||"");if(/^[A-Z]{3}$/.test(v)&&v!=="-99")return v;}
  return "";
}
/* año: el último con dato para ese indicador en el país (igual para todas sus unidades) */
function lastYear(d,k,regional){
  var best=null;
  if(regional){(d.reg||[]).forEach(function(r){var s=r.v&&r.v[k];if(!s)return;for(var i=s.length-1;i>=0;i--)if(s[i]!=null){var y=d.y0+i;if(best==null||y>best)best=y;break;}});}
  else{var s=d.nat&&d.nat[k];if(s)for(var i=s.length-1;i>=0;i--)if(s[i]!=null){best=d.y0+i;break;}}
  return best;
}
function val(series,y,y0){if(!series||y==null)return null;var v=series[y-y0];return v==null?null:v;}
/* área plana aproximada (grados², corregida por latitud) de un multipolígono de polygon-clipping */
function areaMP(mp){var a=0;(mp||[]).forEach(function(poly){poly.forEach(function(ring,ri){var s=0;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var c=Math.cos(((ring[i][1]+ring[j][1])/2)*Math.PI/180);s+=(ring[j][0]*c-ring[i][0]*c)*(ring[j][1]+ring[i][1]);}a+=(ri?-1:1)*Math.abs(s/2);});});return a;}
function toMP(g){return !g?[]:g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];}
function bbox(mp){var b=[180,90,-180,-90];mp.forEach(function(p){p[0].forEach(function(q){if(q[0]<b[0])b[0]=q[0];if(q[1]<b[1])b[1]=q[1];if(q[0]>b[2])b[2]=q[0];if(q[1]>b[3])b[3]=q[1];});});return b;}
async function regionFor(f,d){
  if(ASSIGN.has(f))return ASSIGN.get(f);
  var PC=window.polygonClipping,feats=(d.geo&&d.geo.features)||[],res=null;
  if(!PC||!feats.length||!(d.reg||[]).length){ASSIGN.set(f,null);return null;}
  var A=toMP(f.geometry),bA=bbox(A),total=areaMP(A),best=null,bestA=0;
  for(var i=0;i<feats.length;i++){
    var G=feats[i],B=G.__mp||(G.__mp=toMP(G.geometry)),bB=G.__bb||(G.__bb=bbox(B));
    if(bB[2]<bA[0]||bB[0]>bA[2]||bB[3]<bA[1]||bB[1]>bA[3])continue;
    var inter=null;try{inter=PC.intersection(A,B);}catch(e){inter=null;}
    var a=inter?areaMP(inter):0;if(a>bestA){bestA=a;best=G;}
  }
  if(best){var by=d.__by||(d.__by={});if(!d.__byOk){(d.reg||[]).forEach(function(r){by[r.c]=r;});d.__byOk=1;}
    var r=by[best.properties&&best.properties.c];if(r)res={reg:r,share:total>0?bestA/total:null};}
  ASSIGN.set(f,res);return res;
}
function register(){
  var I=window.anambroGaIndicators||(window.anambroGaIndicators={});
  ORDER.forEach(function(k){
    var m=IND[k];
    I["gdl:"+k]={
      meta:{label:m[0],unit:m[1],group:GROUP,dec:m[2],source:"Global Data Lab · Subnational Human Development Database (SHDI), Radboud University",
        method:"Países: dato nacional del Global Data Lab. Divisiones de un país: cada división recibe el valor de la región estadística del Global Data Lab con la que comparte más superficie (intersección de polígonos). Si una región del Global Data Lab agrupa varias divisiones, todas reciben el mismo valor. Último año disponible en el país."},
      compute:async function(f){
        var u=unit();if(!WORLD.has(u))return null;
        var iso=isoOf(f);if(!iso)return null;
        var ix=await index();var meta=ix&&ix[iso];var isoData=meta&&meta.of&&meta.of[0]?meta.of[0]:iso;
        var d;try{d=await file(iso);}catch(e){try{d=await file(isoData);}catch(e2){return null;}}
        var scale=k==="pop"?1000:1;
        if(u==="world-countries"){var y=lastYear(d,k,false);var v=val(d.nat&&d.nat[k],y,d.y0);if(v==null)return null;YEARS[k]=y;this.meta.label=m[0]+(y?" · "+y:"");return{value:v*scale};}
        if(!(d.reg||[]).length)return null;
        var regional=(d.reg||[]).length>1;
        var y2=lastYear(d,k,true);var R=await regionFor(f,d);if(!R)return null;
        var v2=val(R.reg.v&&R.reg.v[k],y2,d.y0);if(v2==null)return null;
        YEARS[k]=y2;this.meta.label=m[0]+(y2?" · "+y2:"");
        try{f.properties.__gdlRegion=regional?R.reg.n:"(dato nacional)";}catch(e){}
        return{value:v2*scale};
      }
    };
  });
}
function addOptions(){
  var s=$("geoGeneralMetric");if(!s||s.querySelector('option[value="gdl:shdi"]'))return;
  var og=document.createElement("optgroup");og.label=GROUP;
  og.innerHTML=ORDER.map(function(k){var m=IND[k];return'<option value="gdl:'+k+'">'+m[0].replace(/</g,"&lt;")+(m[1]?" · "+m[1]:"")+"</option>";}).join("");
  s.appendChild(og);
}
/* el reordenador de grupos del análisis manda lo desconocido a «Otros indicadores»: le devolvemos su nombre */
function fixGroup(){
  var s=$("geoGeneralMetric");if(!s)return;
  [].forEach.call(s.querySelectorAll("optgroup"),function(g){var o=[].slice.call(g.querySelectorAll("option"));if(o.length&&o.every(function(x){return /^gdl:/.test(x.value);})&&g.label!==GROUP)g.label=GROUP;});
  var u=unit(),ok=WORLD.has(u),changed=false;
  [].forEach.call(s.querySelectorAll('option[value^="gdl:"]'),function(o){
    var t=o.textContent.replace(/ ⦸$/,"");
    if(ok){if(o.disabled){o.disabled=false;o.title="";}o.textContent=t;}
    else{o.disabled=true;o.title="Disponible con países del mundo y divisiones de 1.er o 2.º nivel de un país";o.textContent=t+" ⦸";}
  });
  if(!ok&&/^gdl:/.test(s.value)){var f=[].find.call(s.querySelectorAll("option"),function(x){return !x.disabled;});if(f){s.value=f.value;changed=true;}}
  if(changed)s.dispatchEvent(new Event("change",{bubbles:true}));
}
/* nombres de los países del selector en español (venían en inglés) */
var NAMES_ES=null;
function namesEs(){if(!NAMES_ES)NAMES_ES=fetch(new URL("data/admin/paises_50m.json?v=2026-11-03",location.href).href,{cache:"force-cache"}).then(function(r){return r.json();}).then(function(fc){var m={};(fc.features||[]).forEach(function(f){var p=f.properties||{};[p.ISO_A3_EH,p.ISO_A3,p.ADM0_A3,p.WB_A3,p.GU_A3].forEach(function(c){if(c&&c!=="-99"&&p.NAME_ES&&!m[c])m[c]=p.NAME_ES;});});m.ESH=m.ESH||"Sáhara Occidental";return m;}).catch(function(){NAMES_ES=null;return {};});return NAMES_ES;}
function relabelCountries(){
  var sel=$("geoGeneralCountry");if(!sel||sel.__anEs===sel.options.length)return;
  namesEs().then(function(m){
    var cur=sel.value,opts=[].slice.call(sel.options);if(!opts.length)return;
    opts.forEach(function(o){var es=m[o.value];if(o.value==="ESH")es="Sáhara Occidental (territorio ocupado)";if(es&&o.textContent!==es)o.textContent=es;});
    opts.sort(function(a,b){if(!a.value)return -1;if(!b.value)return 1;return a.textContent.localeCompare(b.textContent,"es");});
    opts.forEach(function(o){sel.appendChild(o);});sel.value=cur;sel.__anEs=sel.options.length;
  });
}
function init(){
  register();
  setInterval(relabelCountries,1500);
  var tries=0,t=setInterval(function(){if($("geoGeneralMetric")){addOptions();fixGroup();}if(++tries>40||($("geoGeneralMetric")&&$("geoGeneralMetric").querySelector('option[value="gdl:shdi"]')))clearInterval(t);},500);
  document.addEventListener("change",function(e){var id=e.target&&e.target.id;if(id==="geoGeneralUnits"||id==="geoGeneralMetric"||id==="geoGeneralCountry")setTimeout(fixGroup,30);},true);
  var s=$("geoGeneralMetric");if(s)try{new MutationObserver(function(){if(!fixGroup.__busy){fixGroup.__busy=1;setTimeout(function(){fixGroup();fixGroup.__busy=0;},0);}}).observe(s,{childList:true});}catch(e){}
  window.anambroGaGdl={years:YEARS};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
