/* ANAMBRO · ficha histórica (Cliopatria + Wikidata precalculado) · nov 2026 */
(function(){
"use strict";
if(typeof enrichHistoryElement!=="function")return;
var BASE=new URL("data/cliopatria/",location.href).href;
var DATA=null,LOADING=null;
function load(){
  if(DATA)return Promise.resolve(DATA);
  if(!LOADING)LOADING=fetch(BASE+"fichas.json?v=20261109d",{cache:"force-cache"})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(d){DATA=d||{};return DATA;})
    .catch(function(e){LOADING=null;console.warn("ANAMBRO fichas",e);return null;});
  return LOADING;
}
window.anambroFichasHistoricas={load:load,get data(){return DATA;}};
var EVIDX=null,EVF=new Map();
function evIndex(){if(!EVIDX)EVIDX=fetch(BASE+"eventos/index.json?v=20261110b",{cache:"no-cache"}).then(function(r){return r.ok?r.json():null;}).catch(function(){EVIDX=null;return null;});return EVIDX;}
function evFor(y){return evIndex().then(function(ix){
  if(!ix||!ix.files)return null;
  var f=ix.files.filter(function(c){return y>=c[0]&&y<=c[1];})[0];if(!f)return null;
  if(!EVF.has(f[2]))EVF.set(f[2],fetch(BASE+"eventos/"+f[2]+"?v="+encodeURIComponent(ix.v||""),{cache:"force-cache"}).then(function(r){return r.ok?r.json():null;}).catch(function(){EVF.delete(f[2]);return null;}));
  return EVF.get(f[2]);});}
var EVMIN=2.0;
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});};
var yTxt=function(y){try{return typeof historyYearText==="function"?historyYearText(y):String(y);}catch(e){return String(y);}};
function qidOf(D){var w=String(D&&D.wikidata||"").match(/Q\d+/);return w?w[0]:"";}
/* [valor, inicio, fin] → activos en el año y; sin fechas solo si no hay ninguno fechado activo */
function activeIn(list,y,allowUndated){
  if(!list||!list.length)return[];
  var dated=[],und=[];
  list.forEach(function(it){
    var s=it[1],t=it[2];
    if(s==null&&t==null){und.push(it);return;}
    if((s==null||s<=y)&&(t==null||t>=y))dated.push(it);
  });
  return dated.length?dated:(allowUndated?und:[]);
}
function entityOk(d,y){return !!d&&!(d.from!=null&&y<d.from-25)&&!(d.to!=null&&y>d.to+25);}
function spanOf(d){return d&&d.from!=null&&d.to!=null?d.to-d.from:1e9;}
function curIn(d,y){
  var L=d.cur||[],dated=L.filter(function(c){return !c[3]&&(c[1]!=null||c[2]!=null)&&(c[1]==null||c[1]<=y)&&(c[2]==null||c[2]>=y);});
  if(dated.length)return dated;
  if(L.length===1&&L[0][3]&&spanOf(d)<=200)return L;
  return[];
}
function capIn(d,y){
  var L=d.cap||[],dated=L.filter(function(c){return(c[1]!=null||c[2]!=null)&&(c[1]==null||c[1]<=y)&&(c[2]==null||c[2]>=y);});
  if(dated.length)return dated;
  var und=L.filter(function(c){return c[1]==null&&c[2]==null;});
  var anyDated=L.some(function(c){return c[1]!=null||c[2]!=null;});
  return und.length===1&&!anyDated?und:[];
}
function uniq(a){var seen={},o=[];a.forEach(function(x){var k=String(x).toLowerCase();if(x&&!seen[k]){seen[k]=1;o.push(x);}});return o;}
function rulersIn(d,y){
  var out=[];
  (d.hs||[]).forEach(function(r){var s=r[1],t=r[2];
    if(s==null)return;
    if(t==null){if(y>=s&&y-s<=50)out.push(r);}
    else if(s<=y&&y<=t)out.push(r);});
  out.sort(function(a,b){return a[1]-b[1];});
  return out;
}
function commons(f,w){return"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(f)+"?width="+(w||160);}
function css(){
  if(document.getElementById("anFhCss"))return;
  var st=document.createElement("style");st.id="anFhCss";
  st.textContent=[
".anFhCard{display:block!important;width:100%;max-height:min(66vh,660px);overflow-y:auto;overscroll-behavior:contain;border-radius:12px}",
".anFh{font-size:15px;line-height:1.55;color:#1d2a3a;width:100%;box-sizing:border-box}",
".anFh *{box-sizing:border-box}",
".anFhHead{display:flex;align-items:center;gap:16px;padding:16px 56px 16px 18px;background:#123a5e;color:#fff;border-radius:12px 12px 0 0}",
".anFhEmb{width:68px;height:68px;flex:0 0 68px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;background:#fff;overflow:hidden;padding:4px}",
".anFhEmb img{max-width:58px;max-height:58px;object-fit:contain}",
".anFhEmb.two{width:120px;flex-basis:120px}",
".anFhEmb.two img{max-width:52px}",
".anFhTit{flex:1;min-width:0}",
".anFhTit h3{margin:0;font-size:23px;line-height:1.15;color:#fff;font-weight:800;letter-spacing:.2px}",
".anFhTit p{margin:4px 0 0;font-size:14px;color:#cfe0f0}",
".anFhYear{background:#f2c14e;color:#3a2a00;font-weight:800;font-size:22px;padding:6px 16px;border-radius:10px;white-space:nowrap}",
".anFhBody{padding:14px 18px 12px}",
".anFhTiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}",
".anFhTile{background:#f4f7fb;border:1px solid #e3e9f1;border-radius:10px;padding:10px 12px}",
".anFhTile small{display:block;font-size:13px;color:#5f6e80;text-transform:uppercase;letter-spacing:.4px}",
".anFhTile b{display:block;font-size:16px;color:#14263f;line-height:1.3;margin-top:2px}",
".anFhTile span{display:block;font-size:13px;color:#5f6e80}",
".anFhBar{margin-top:16px}",
".anFhBar small{font-size:13.5px;color:#4b5b6e}",
".anFhTrack{position:relative;height:10px;background:linear-gradient(90deg,#f6e3a8,#f2c14e);border-radius:6px;margin-top:6px}",
".anFhMark{position:absolute;top:-5px;width:4px;height:20px;background:#123a5e;border-radius:2px}",
".anFhEnds{position:relative;height:18px;font-size:12.5px;color:#7a8696;margin-top:4px}",
".anFhEnds span{position:absolute;top:0;white-space:nowrap}",
".anFhEnds .now{transform:translateX(-50%);color:#123a5e;font-weight:800}",
".anFhSum{margin-top:16px;font-size:15px;color:#2b3a4c}",
".anFhSum img{float:right;max-width:110px;max-height:110px;margin:0 0 6px 12px;border-radius:8px}",
".anFhEv{margin-top:18px;clear:both}",
".anFhEv h4{margin:0 0 10px;font-size:17px;color:#123a5e;font-weight:800}",
".anFhEvList{position:relative;margin-left:8px;padding-left:18px;border-left:3px solid #dbe4ee}",
".anFhEvIt{position:relative;padding:0 0 14px}",
".anFhEvIt:before{content:'';position:absolute;left:-26px;top:5px;width:13px;height:13px;border-radius:50%;background:#fff;border:3px solid #123a5e}",
".anFhEvIt small{font-size:13.5px;color:#123a5e;font-weight:700}",
".anFhEvIt .tag{display:inline-block;margin-left:8px;padding:1px 9px;border-radius:999px;font-size:12.5px;font-weight:600;background:#eef2f6;color:#3d4b5c}",
".anFhEvIt p{margin:3px 0 0;font-size:15px;color:#1d2a3a}",
".anFhEvIt a{font-size:12.5px;color:#5f6e80;text-decoration:none}",
".anFhEvIt a:hover{color:#1f6fd1;text-decoration:underline}",
".anFhEvMore{font:inherit;font-size:14px;margin:0 0 0 26px;padding:5px 14px;border:1px solid #c5cfdb;border-radius:999px;background:#fff;color:#123a5e;font-weight:600;cursor:pointer}",
".anFhEvMore:hover{background:#eef3f8}",
".anFhBtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;clear:both}",
".anFhBtns button,.anFhBtns a{font:inherit;font-size:14px;font-weight:600;padding:7px 14px;border:1px solid #c5cfdb;border-radius:999px;background:#fff;color:#123a5e;cursor:pointer;text-decoration:none}",
".anFhBtns button:hover,.anFhBtns a:hover{background:#eef3f8}",
".anFhSrc{margin-top:14px;padding-top:9px;border-top:1px solid #e3e9f1;font-size:12.5px;color:#6b7788}"
].join("\n");
  document.head.appendChild(st);
}
var SUM=new Map();
function esSummary(title){
  if(!title)return Promise.resolve(null);
  if(SUM.has(title))return SUM.get(title);
  var p=Promise.race([
    fetch("https://es.wikipedia.org/api/rest_v1/page/summary/"+encodeURIComponent(title.replace(/ /g,"_"))+"?redirect=true",{cache:"force-cache"})
      .then(function(r){return r.ok?r.json():null;}),
    new Promise(function(res){setTimeout(function(){res(null);},8000);})
  ]).then(function(j){
    if(!j||!j.extract||j.type==="disambiguation")return null;
    return{text:j.extract,thumb:j.thumbnail&&j.thumbnail.source,url:j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page};
  }).catch(function(){return null;});
  p.then(function(v){if(!v)SUM.delete(title);});
  SUM.set(title,p);return p;
}
function cut(t,n){t=String(t||"").trim();if(t.length<=n)return t;var c=t.slice(0,n),i=c.lastIndexOf(". ");return i>n*.5?c.slice(0,i+1):c.replace(/\s+\S*$/,"")+"…";}
function periodTxt(d,D){
  var a=d&&d.from!=null?d.from:null,b=d&&d.to!=null?d.to:null;
  if(a==null&&b==null)return"";
  return"existe de "+(a!=null?yTxt(a):"?")+" a "+(b!=null?yTxt(b):"?");
}
function render(el,D,y,d){
  css();
  var q=qidOf(D);
  var name=capF((d&&d.n)||D.name||"Entidad política");
  var sub=[];
  var gov=d?uniq(activeIn(d.gov,y,true).map(function(x){return x[0];})).slice(0,2):[];
  if(gov.length)sub.push(gov.join(" · "));
  var per=periodTxt(d,D);if(per)sub.push(per);
  if(!sub.length&&d&&d.d)sub.push(d.d);
  var emb="",imgs=[];
  if(d){
    var ca=activeIn(d.ca,y,true)[0],fl=activeIn(d.fl,y,true)[0];
    if(ca)imgs.push(['<img src="'+esc(commons(ca[0]))+'" alt="Escudo" loading="lazy" referrerpolicy="no-referrer" onerror="var p=this.parentNode;this.remove();if(p&&!p.querySelector(\'img\'))p.remove();">']);
    if(fl)imgs.push(['<img src="'+esc(commons(fl[0]))+'" alt="Bandera" loading="lazy" referrerpolicy="no-referrer" onerror="var p=this.parentNode;this.remove();if(p&&!p.querySelector(\'img\'))p.remove();">']);
  }
  if(imgs.length)emb='<div class="anFhEmb'+(imgs.length>1?" two":"")+'">'+imgs.join("")+"</div>";
  var h='<div class="anFh"><div class="anFhHead">'+emb+'<div class="anFhTit"><h3 class="historyCardTitle">'+esc(name)+"</h3>"+(sub.length?"<p>"+esc(sub.join(" · "))+"</p>":"")+'</div><div class="anFhYear">'+esc(yTxt(y))+'</div></div><div class="anFhBody">';
  var tiles=[];
  if(d){
    var rl=rulersIn(d,y);
    if(rl.length){
      var names=uniq(rl.map(function(r){return r[0];})).slice(0,3);
      tiles.push(["👑 "+(names.length>1?"Reinan / gobiernan":"Reina / gobierna"),names.join(" y "),""]);
    }
    var hg=uniq((d.hg||[]).filter(function(r){var s=r[1],t=r[2];return s!=null&&s<=y&&(t==null?y-s<=15:y<=t);}).map(function(r){return r[0];}));
    if(hg.length)tiles.push(["🏛️ Gobierno",hg.slice(0,2).join(" · "),""]);
    var cap=uniq(capIn(d,y).map(function(x){return x[0];}));
    if(cap.length)tiles.push(["🏰 Capital",cap.join(", "),""]);
    var cur=uniq(curIn(d,y).map(function(x){return x[0];}));
    if(cur.length)tiles.push(["🪙 Moneda"+(cur.length>1?"s":""),cur.slice(0,3).join(", "),""]);
  }
  var ar=Number(D.area);
  if(Number.isFinite(ar)&&ar>0)tiles.push(["📐 Extensión",Math.round(Math.abs(ar)).toLocaleString("es-ES")+" km²","según Cliopatria"]);
  if(tiles.length)h+='<div class="anFhTiles">'+tiles.map(function(t){return'<div class="anFhTile"><small>'+esc(t[0])+"</small><b>"+esc(t[1])+"</b>"+(t[2]?"<span>"+esc(t[2])+"</span>":"")+"</div>";}).join("")+"</div>";
  if(d){
    var main=rulersIn(d,y).filter(function(r){return r[2]!=null;})[0];
    if(main&&main[2]>main[1]){
      var pct=Math.max(0,Math.min(100,(y-main[1])/(main[2]-main[1])*100));
      h+='<div class="anFhBar"><small>Reinado / mandato de '+esc(main[0])+" · "+esc(yTxt(main[1]))+"–"+esc(yTxt(main[2]))+'</small><div class="anFhTrack"><div class="anFhMark" style="left:calc('+pct.toFixed(1)+'% - 1px)"></div></div><div class="anFhEnds"><span style="left:0">'+esc(yTxt(main[1]))+'</span>'+(pct>12&&pct<88?'<span class="now" style="left:'+pct.toFixed(1)+'%">'+esc(yTxt(y))+'</span>':'')+'<span style="right:0">'+esc(yTxt(main[2]))+"</span></div></div>";
    }
  }
  h+='<div class="anFhSumSlot"></div><div class="anFhEvSlot"></div>';
  var lo=d&&d.from!=null?d.from:-3400,hi=d&&d.to!=null?d.to:2024;
  h+='<div class="anFhBtns">'+(y-1>=Math.max(-3400,lo)?'<button type="button" data-fhy="'+(y-1)+'">← '+esc(yTxt(y-1))+"</button>":"")+(y+1<=Math.min(2024,hi)?'<button type="button" data-fhy="'+(y+1)+'">'+esc(yTxt(y+1))+" →</button>":"")+(d&&d.w?'<a href="https://es.wikipedia.org/wiki/'+esc(encodeURIComponent(d.w.replace(/ /g,"_")))+'" target="_blank" rel="noopener">📖 Wikipedia</a>':"")+"</div>";
  var src=["Fronteras: Cliopatria (Seshat) CC BY 4.0"];
  if(d)src.push("gobernantes, capital, moneda y emblemas: Wikidata CC0"+(imgs.length?" · imágenes: Wikimedia Commons":""));
  h+='<div class="anFhSrc anFhSrcLine">'+esc(src.join(" · "))+"</div></div></div>";
  var card=null,lp=null;
  try{if(el.closest&&el.closest(".leaflet-popup"))map.eachLayer(function(l){if(!lp&&l instanceof L.Popup&&l.isOpen&&l.isOpen()&&l.getElement&&l.getElement()===(el.closest(".leaflet-popup")))lp=l;});}catch(e){}
  if(lp){card=document.createElement("div");card.className="anFhCard";card.innerHTML=h;lp.options.maxWidth=700;lp.options.minWidth=Math.min(620,innerWidth-60);lp.setContent(card);try{var pc=lp.getElement().querySelector(".leaflet-popup-content");pc.style.width="min(660px, calc(100vw - 60px))";relayout(lp);}catch(e){}}
  else{card=el.querySelector(".historyCard,.anFhCard")||el;if(card!==el)card.className="anFhCard";card.innerHTML=h;}
  fillEvents(card,D,y,lp);
  if(d&&d.w)esSummary(d.w).then(function(s){
    var slot=card.querySelector(".anFhSumSlot");if(!s||!slot||!document.body.contains(slot))return;
    slot.innerHTML='<div class="anFhSum">'+(s.thumb&&!imgs.length?'<img src="'+esc(s.thumb)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':"")+esc(cut(s.text,520))+"</div>";relayout(lp);
    var line=card.querySelector(".anFhSrcLine");if(line&&line.textContent.indexOf("Wikipedia")<0)line.textContent+=" · resumen: Wikipedia en español CC BY-SA";
  });
  card.querySelectorAll("[data-fhy]").forEach(function(b){b.addEventListener("click",function(ev){ev.preventDefault();ev.stopPropagation();goYear(Number(b.getAttribute("data-fhy")),q,el);});});
}
function evKey(D){var q=qidOf(D);if(q)return q;var n=D&&(D.rawName||D.__name_raw||D.enName||D.name);return n?"N:"+n:"";}
function fillEvents(card,D,y,lp){
  var key=evKey(D);if(!key)return;
  evFor(y).then(function(E){
    var slot=card.querySelector(".anFhEvSlot");if(!E||!slot||!document.body.contains(slot))return;
    var ids=(E.ix[String(y)]||{})[key];if(!ids||!ids.length)return;
    var all=ids.map(function(i){return E.ev[i];}).filter(Boolean);
    var good=all.filter(function(e){return(e[5]||0)>=EVMIN;});
    if(!good.length)return;
    var MES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    var dk=function(e){var m=String(e[1]||"").toLowerCase().match(/(\d{1,2})?\D*?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);return m?MES.indexOf(m[2])*40+(m[1]?+m[1]:0):999;};
    var top=good.slice(0,6).sort(function(a,b){return dk(a)-dk(b);});
    var rest=good.slice(6).sort(function(a,b){return dk(a)-dk(b);});
    var TAGC={"Canarias":["#fff4d6","#7a5300"],"Guerra":["#fde8e6","#8f2a1e"],"Diplomacia":["#e6f4ea","#1f6b3a"],"Política":["#e7eefb","#1f4a8f"],"Iglesia y religión":["#f2eafb","#5b3a8c"],"Exploración":["#e3f5f7","#0f6670"],"Fundaciones":["#eef6e3","#4a6b12"],"Catástrofes":["#fdebd9","#8a4b0f"],"Ciencia y cultura":["#fbe9f2","#8a2a5a"],"Dinastía":["#f6efe4","#6b4a1f"]};
    var item=function(e){return'<div class="anFhEvIt">'+(e[1]?"<small>"+esc(e[1])+"</small>":"")+(e[3]?'<span class="tag" style="'+(e[1]?"":"margin-left:0;")+(TAGC[e[3]]?"background:"+TAGC[e[3]][0]+";color:"+TAGC[e[3]][1]:"")+'">'+esc(e[3])+"</span>":"")+"<p>"+esc(e[2])+"</p>"+(e[4]?'<a href="https://es.wikipedia.org/wiki/'+esc(encodeURIComponent(e[4].replace(/ /g,"_")))+'" target="_blank" rel="noopener">Wikipedia ↗</a>':"")+"</div>";};
    slot.innerHTML='<div class="anFhEv"><h4>📅 Qué pasa en '+esc(yTxt(y))+'</h4><div class="anFhEvList">'+top.map(item).join("")+'<div class="anFhEvRest" hidden>'+rest.map(item).join("")+"</div></div>"+(rest.length?'<button type="button" class="anFhEvMore">Ver todos ('+good.length+")</button>":"")+"</div>";
    var b=slot.querySelector(".anFhEvMore");if(b)b.addEventListener("click",function(ev){ev.preventDefault();ev.stopPropagation();var r=slot.querySelector(".anFhEvRest");r.hidden=!r.hidden;b.textContent=r.hidden?"Ver todos ("+good.length+")":"Ver menos";relayout(lp);});
    var line=card.querySelector(".anFhSrcLine");if(line&&line.textContent.indexOf("acontecimientos")<0)line.textContent+=" · acontecimientos: Wikipedia en español (artículos de cada año) CC BY-SA";
    relayout(lp);
  });
}
var LAST={ll:null};
function curFC(){try{return typeof historyCurrentFC!=="undefined"?historyCurrentFC:null;}catch(e){return null;}}
function goYear(y,q,el){
  var before=curFC();
  try{if(typeof updateHistoryControls==="function")updateHistoryControls(y);if(typeof requestHistoryYear==="function")requestHistoryYear(y,true);}catch(e){console.warn(e);return;}
  var ll=LAST.ll;if(!ll||!q)return;
  var t0=Date.now();
  (function wait(){
    var fc=curFC();
    if(typeof historyYear!=="undefined"&&historyYear===y&&fc&&fc!==before){
      setTimeout(function(){
        var lyr=null,any=null;
        try{ensureHistoryLayer2D().eachLayer(function(l){
          if(lyr||!l.feature||!l.getBounds||!l.getBounds().contains(ll))return;
          var D=historyFeatureData(l.feature);
          if(qidOf(D)===q)lyr=l;else if(!any)any=l;});}catch(e){}
        var t=lyr||any;
        if(t){try{t.fire("click",{latlng:ll,layerPoint:map.latLngToLayerPoint(ll),containerPoint:map.latLngToContainerPoint(ll),originalEvent:{}});}catch(e){console.warn(e);}}
      },350);
      return;
    }
    if(Date.now()-t0<9000)setTimeout(wait,150);
  })();
}
var prevEnrich=enrichHistoryElement;
enrichHistoryElement=async function(el,D,seq){
  var y=typeof historyYear!=="undefined"?historyYear:0;
  try{
    var pop=el&&el.closest&&el.closest(".leaflet-popup");
    if(pop){try{map.eachLayer(function(l){if(l instanceof L.Popup&&l.isOpen&&l.isOpen())LAST.ll=l.getLatLng();});}catch(e){}}
    var all=await load();
    if(seq!==historyWikiSeq||(typeof historyYear!=="undefined"&&historyYear!==y))return;
    if(!all){return prevEnrich.apply(this,arguments);}
    var d=all[qidOf(D)]||null;if(!entityOk(d,y))d=null;
    render(el,D,y,d);
  }catch(e){console.warn("ANAMBRO ficha histórica",e);}
};
/* nombres en español en el mapa y en la ficha */
function relayout(lp){try{if(!lp)return;lp._updateLayout&&lp._updateLayout();lp._updatePosition&&lp._updatePosition();if(lp._adjustPan){lp.options.autoPanPaddingTopLeft=L.point(20,190);lp.options.autoPanPaddingBottomRight=L.point(20,20);lp._adjustPan();}}catch(e){}}
function capF(s){s=String(s||"");return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function lock(p,k,v){try{Object.defineProperty(p,k,{get:function(){return v;},set:function(){},configurable:true,enumerable:true});}catch(e){p[k]=v;}}
function applyNames(fc){
  if(!DATA||!fc||!fc.features)return;
  var FIX=DATA._fix||{};
  fc.features.forEach(function(f){
    var p=f.properties||(f.properties={});
    if(p.__anFh)return;
    var raw=String(p.Wikidata||p.__wikidata||"");
    var w=raw.match(/Q\d+/);
    if(!w)return;
    var nm=String(p.Name||p.__name_raw||p.__name||"");
    var fy=p.FromYear!=null?p.FromYear:p.__from;
    var fx=FIX[nm+"|"+w[0]+"|"+fy];
    p.__anFh=1;
    var name=null;
    if(fx){
      p.__wikidata_cliopatria=raw;
      if("Wikidata" in p)p.Wikidata=fx.q||"";
      if("__wikidata" in p)p.__wikidata=fx.q||"";
      name=fx.n||null;
    }else{
      var d=DATA[w[0]];
      if(d&&d.n)name=d.n;
    }
    if(name){if(!p.__name_raw)p.__name_raw=p.__name||p.Name||"";name=capF(name);lock(p,"__name_es",name);lock(p,"__name_popup_es",name);}
  });
}
["applyHistory2D","applyHistoryGlobe"].forEach(function(fn){
  var orig=window[fn];if(typeof orig!=="function")return;
  window[fn]=function(fc){applyNames(fc);return orig.apply(this,arguments);};
});
function warm(){load().then(function(d){if(!d)return;try{var fc=typeof historyCurrentFC!=="undefined"?historyCurrentFC:null;if(fc&&fc.features&&fc.features.length&&document.getElementById("worldHistoryCheck").checked)window.applyHistory2D(fc);}catch(e){}});}
try{var chk=document.getElementById("worldHistoryCheck");if(chk)chk.addEventListener("change",function(){if(chk.checked)warm();});if(chk&&chk.checked)warm();}catch(e){}
})();
