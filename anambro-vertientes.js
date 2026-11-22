/* ANAMBRO · Vertientes (barlovento/sotavento) y orientación de las laderas · Canarias
   Cálculo propio de ANAMBRO a partir del MDT25 (IGN-CNIG). Capas raster por isla, en Web Mercator. */
try{(function(){"use strict";
if(typeof L==="undefined"||typeof map==="undefined")return;
const $=id=>document.getElementById(id);
const BASE="capas/canarias/",V="?v=20261122a";
(function(){const st=document.createElement("style");st.textContent=".leaflet-tooltip.anbVertTooltip{background:#fffffff5;border:1px solid #33506a;border-radius:9px;color:#17324d;font:14px/1.35 system-ui,sans-serif;max-width:290px;white-space:normal;box-shadow:0 2px 8px #0003}.leaflet-tooltip.anbVertTooltip small{font-size:14px;color:#4a5a66}#canaryVertientesLegend,#canaryAspectLegend{font-size:13px}.anbVertPop{margin:6px 0 8px;padding:7px 9px;border-radius:8px;background:#eef5fb;border:1px solid #c9dbea;font-size:14px;line-height:1.35}.anbVertPop small{font-size:13px;color:#4a5a66}";document.head.appendChild(st)})();
const ISLAS=["EH","LP","LG","TF","GC","FV","LZ"];
const CAPAS={
  vert:{chk:"canaryVertientesCheck",op:"canaryVertientesOpacity",opv:"canaryVertientesOpacityValue",st:"canaryVertientesStatus",pref:"vertientes_",
    pal:[[37,99,235,"Barlovento","del lado de la divisoria que recibe el alisio (NNE) y las borrascas del NW: más nubes y lluvia"],
         [234,120,30,"Sotavento","del lado de la divisoria abrigado del alisio y de las borrascas del NW: más sol y sequedad"],
         [196,178,140,"Relieve bajo","de una isla baja: sin montañas que retengan la humedad (en Lanzarote y Fuerteventura solo los macizos de Famara–Chache, Betancuria y Jandía cuentan como barlovento)"]]},
  ori:{chk:"canaryAspectCheck",op:"canaryAspectOpacity",opv:"canaryAspectOpacityValue",st:"canaryAspectStatus",pref:"orientacion_",
    pal:[[37,99,200,"Norte"],[32,160,170,"Noreste"],[120,190,60,"Este"],[240,195,40,"Sureste"],[240,130,30,"Sur"],[215,60,40,"Suroeste"],[160,55,160,"Oeste"],[95,75,205,"Noroeste"],[205,205,205,"Llano (pendiente < 2,5°)"]]}
};
let pane=map.getPane("canaryVertientesPane");
if(!pane){pane=map.createPane("canaryVertientesPane");pane.style.zIndex="262";pane.style.pointerEvents="none";}
let meta=null,metaP=null;
function cargaMeta(){if(meta)return Promise.resolve(meta);if(!metaP)metaP=fetch(BASE+"vertientes.json"+V).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(j=>meta=j);return metaP}
const grupos={},lienzos={};
function grupo(k){
  if(grupos[k])return grupos[k];
  const c=CAPAS[k],g=L.layerGroup();
  ISLAS.forEach(i=>{const b=meta.islas[i].b;
    const ov=L.imageOverlay(BASE+c.pref+i+".png"+V,b,{pane:"canaryVertientesPane",opacity:+($(c.op)?.value||.6),interactive:false,className:"anbVertImg",
      attribution:"Vertientes y orientación: cálculo propio ANAMBRO · MDT25 © IGN-CNIG"});
    ov.__isla=i;g.addLayer(ov)});
  return grupos[k]=g;
}
function estado(k,t){const e=$(CAPAS[k].st);if(e)e.innerHTML=t}
function sync(){setTimeout(()=>{try{updateLegend()}catch(e){}try{window.anambroActiveLayerOrder?.sync?.()}catch(e){}},0)}
async function set(k,on){
  const c=CAPAS[k];
  if(on){
    try{await cargaMeta()}catch(e){console.warn("Vertientes:",e);estado(k,"⚠️ No se pudieron cargar los datos de la capa.");$(c.chk).checked=false;return}
    const g=grupo(k);if(!map.hasLayer(g))g.addTo(map);
    estado(k,"Activa · toca el mapa en una isla para consultar el punto.");
  }else{if(grupos[k]&&map.hasLayer(grupos[k]))map.removeLayer(grupos[k]);estado(k,"Capa desactivada.")}
  sync();
}
Object.keys(CAPAS).forEach(k=>{const c=CAPAS[k],ch=$(c.chk),op=$(c.op);
  ch&&ch.addEventListener("change",()=>set(k,ch.checked));
  op&&op.addEventListener("input",()=>{const v=+op.value;const t=$(c.opv);t&&(t.textContent=Math.round(v*100)+" %");grupos[k]&&grupos[k].eachLayer(l=>l.setOpacity(v))});
});
// «Ver con el Modelo de Sombras»: elige ese fondo y encuadra Canarias si hace falta
document.querySelectorAll("[data-anb-sombras]").forEach(b=>b.addEventListener("click",()=>{
  const r=document.querySelector('input[data-base-choice="shadowCanary"]');
  if(r&&!r.checked){r.checked=true;r.dispatchEvent(new Event("change",{bubbles:true}));r.dispatchEvent(new Event("click",{bubbles:true}))}
  const k=b.getAttribute("data-anb-sombras"),ch=$(CAPAS[k].chk);
  if(ch&&!ch.checked){ch.checked=true;set(k,true)}
  const op=$(CAPAS[k].op);if(op&&+op.value>.6){op.value=.55;op.dispatchEvent(new Event("input"))}
  try{if(!L.latLngBounds([[27.45,-18.3],[29.5,-13.15]]).contains(map.getCenter()))map.fitBounds([[27.45,-18.3],[29.5,-13.15]],{animate:false})}catch(e){}
}));
// Consulta del punto: se lee el color del PNG de la isla
function lienzo(k,i){
  const key=k+i;if(lienzos[key])return lienzos[key];
  return lienzos[key]=new Promise((ok,ko)=>{const im=new Image();im.onload=()=>{const cv=document.createElement("canvas");cv.width=im.naturalWidth;cv.height=im.naturalHeight;const cx=cv.getContext("2d",{willReadFrequently:true});cx.drawImage(im,0,0);ok({cx,w:cv.width,h:cv.height})};im.onerror=ko;im.src=BASE+CAPAS[k].pref+i+".png"+V});
}
async function clase(k,ll){
  await cargaMeta();
  for(const i of ISLAS){const b=meta.islas[i].b,bb=L.latLngBounds(b);if(!bb.contains(ll))continue;
    const P=L.CRS.EPSG3857,p=P.project(ll),sw=P.project(L.latLng(b[0])),ne=P.project(L.latLng(b[1]));
    const c=await lienzo(k,i),x=Math.floor((p.x-sw.x)/(ne.x-sw.x)*c.w),y=Math.floor((ne.y-p.y)/(ne.y-sw.y)*c.h);
    if(x<0||y<0||x>=c.w||y>=c.h)continue;
    const d=c.cx.getImageData(x,y,1,1).data;if(d[3]<128)continue;
    let best=-1,bd=1e9;CAPAS[k].pal.forEach((q,n)=>{const e=(q[0]-d[0])**2+(q[1]-d[1])**2+(q[2]-d[2])**2;if(e<bd){bd=e;best=n}});
    return{isla:meta.islas[i].n,n:best};
  }
  return null;
}
let tip=null,tipT=0,pend=null,obs=null;
function pon(){if(!pend||Date.now()>pend.hasta)return false;
  const p=map._popup,el=p&&p.isOpen&&p.isOpen()&&p.getElement&&p.getElement();
  const c=el&&el.querySelector(".leaflet-popup-content");if(!c)return false;
  if(!c.querySelector(".anbVertPop")){const d=document.createElement("div");d.className="anbVertPop";d.innerHTML=pend.html;
    const hr=c.querySelector("hr");hr?hr.before(d):c.appendChild(d)}
  try{obs&&obs.disconnect()}catch(_){}
  // la ficha del visor se va rellenando: si reescribe el contenido, se vuelve a añadir el bloque
  obs=new MutationObserver(()=>{if(!c.isConnected||!pend)return obs.disconnect();if(!c.querySelector(".anbVertPop")){obs.disconnect();pon()}});
  obs.observe(c,{childList:true,subtree:true});return true}
map.on("popupopen",()=>setTimeout(pon,0));
function enPopup(html,ll){
  pend={html,hasta:Date.now()+20000};
  if(pon())return;
  setTimeout(()=>{if(pon())return;try{tip&&map.removeLayer(tip)}catch(_){}
    tip=L.tooltip({permanent:true,direction:"top",className:"anbVertTooltip",offset:[0,-6]}).setLatLng(ll).setContent(html).addTo(map);
    clearTimeout(tipT);tipT=setTimeout(()=>{try{map.removeLayer(tip)}catch(_){}},7000)},2200);
}
map.on("click",async e=>{
  const act=Object.keys(CAPAS).filter(k=>$(CAPAS[k].chk)?.checked);if(!act.length)return;
  const lin=[];let isla="";
  for(const k of act){try{const r=await clase(k,e.latlng);if(!r)continue;isla=r.isla;const q=CAPAS[k].pal[r.n];
    if(k==="vert")lin.push('<b style="color:rgb('+q.slice(0,3)+')">'+q[3]+"</b> <small>· ladera "+q[4]+".</small>");
    else lin.push(q[3].startsWith("Llano")?"Terreno <b>llano</b>":"Ladera orientada al <b>"+q[3].toLowerCase()+"</b>")}catch(err){console.warn(err)}}
  if(!lin.length)return;
  const html='<div class="anbVertTip"><b>🌬️ Vertiente y orientación</b> <small>('+isla+')</small><br>'+lin.join("<br>")+"</div>";
  act.forEach(k=>estado(k,"En este punto ("+isla+"): "+lin.map(x=>x.replace(/ <small>.*?<\/small>/,"")).join(" · ")));
  enPopup(html,e.latlng);
});
// Leyenda y fuentes del visor
function ley(k){const c=CAPAS[k];return c.pal.map(q=>'<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:16px;height:12px;border-radius:2px;flex:none;background:rgb('+q.slice(0,3)+')"></span><span>'+q[3]+"</span></div>").join("")}
const lg=typeof activeLegendHTML=="function"?activeLegendHTML:null;
lg&&(window.activeLegendHTML=function(){let h=lg.apply(this,arguments)||"";
  if($("canaryVertientesCheck")?.checked)h+='<div style="margin-top:8px"><b>Vertientes · barlovento y sotavento</b>'+ley("vert")+"<small>Cálculo ANAMBRO · MDT25 IGN-CNIG.</small></div>";
  if($("canaryAspectCheck")?.checked)h+='<div style="margin-top:8px"><b>Orientación de las laderas</b>'+ley("ori")+"<small>Cálculo ANAMBRO · MDT25 IGN-CNIG.</small></div>";
  return h});
const sr=typeof activeSourcesText=="function"?activeSourcesText:null;
sr&&(window.activeSourcesText=function(){const a=[sr.apply(this,arguments)||""];
  ($("canaryVertientesCheck")?.checked||$("canaryAspectCheck")?.checked)&&a.push("Vertientes y orientación de laderas: cálculo propio ANAMBRO a partir del MDT25 © IGN-CNIG");
  return a.filter(Boolean).join(" · ")});
// leyendas dentro del panel
const l1=$("canaryVertientesLegend");l1&&(l1.innerHTML=ley("vert"));
const l2=$("canaryAspectLegend");l2&&(l2.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:8px">'+ley("ori")+"</div>");
window.__anambroVertientes={set,clase,grupos:()=>grupos};
})()}catch(e){console.error("[ANAMBRO] anambro-vertientes",e)}
