/* ANAMBRO · Biblioteca didáctica · Biogeografía (motor común) · 2026-11-21 */
"use strict";
/* Copiado de juego-paisajes.html: mismos criterios de ANAMBRO para Köppen y el climograma (T izquierda, P derecha, P = 2T) */
function stats(T,P,lat){
  const north=lat>=0,S=[0,0,0,1,1,1,1,1,1,0,0,0].map(x=>north?!!x:!x);
  const MAT=T.reduce((a,b)=>a+b,0)/12,MAP=P.reduce((a,b)=>a+b,0),Tw=Math.max(...T),Tc=Math.min(...T);
  const secos=[];T.forEach((t,i)=>{if(P[i]<2*t)secos.push(i)});
  const Ps=P.reduce((a,p,i)=>a+(S[i]?p:0),0),Pw=MAP-Ps;
  const Psdry=Math.min(...P.filter((p,i)=>S[i])),Pwwet=Math.max(...P.filter((p,i)=>!S[i])),Pswet=Math.max(...P.filter((p,i)=>S[i])),Pwdry=Math.min(...P.filter((p,i)=>!S[i]));
  const Pth=(MAP>0&&Pw>=.7*MAP)?2*MAT:(MAP>0&&Ps>=.7*MAP)?2*MAT+28:2*MAT+14;
  return{MAT,MAP,Tw,Tc,amp:Tw-Tc,secos,Psdry,Pwwet,Pswet,Pwdry,umbral:10*Pth,m10:T.filter(t=>t>=10).length};
}
const KNOM={Af:"Ecuatorial",Am:"Tropical monzónico",Aw:"Tropical de sabana",BWh:"Desértico cálido",BWk:"Desértico frío",BSh:"Estepario cálido",BSk:"Estepario frío",Csa:"Mediterráneo de verano cálido",Csb:"Mediterráneo de verano templado",Csc:"Mediterráneo de verano fresco",Cwa:"Subtropical con invierno seco",Cwb:"Templado de altura con invierno seco",Cwc:"Templado frío de altura con invierno seco",Cfa:"Subtropical húmedo",Cfb:"Oceánico",Cfc:"Oceánico subpolar",Dsa:"Continental de verano seco y cálido",Dsb:"Continental de verano seco y templado",Dsc:"Subártico de verano seco",Dsd:"Subártico de verano seco e invierno extremo",Dwa:"Continental de invierno seco y verano cálido",Dwb:"Continental de invierno seco y verano templado",Dwc:"Subártico de invierno seco",Dwd:"Subártico de invierno seco y extremo",Dfa:"Continental húmedo de verano cálido",Dfb:"Continental húmedo de verano templado",Dfc:"Subártico",Dfd:"Subártico de invierno extremo",ET:"Polar de tundra",EF:"Polar de hielos perpetuos"};
function koppen(T,P,lat){
  const s=stats(T,P,lat);
  if(s.Tw<10)return s.Tw>0?"ET":"EF";
  if(s.MAP<s.umbral)return(s.MAP<s.umbral/2?"BW":"BS")+(s.MAT>=18?"h":"k");
  if(s.Tc>=18){const d=Math.min(...P);return d>=60?"Af":d>=100-s.MAP/25?"Am":"Aw"}
  const G=s.Tc>0?"C":"D",L2=(s.Psdry<40&&s.Psdry<s.Pwwet/3)?"s":(s.Pwdry<s.Pswet/10?"w":"f");
  return G+L2+(s.Tw>=22?"a":s.m10>=4?"b":(G==="D"&&s.Tc<-38?"d":"c"));
}

const MESES=["E","F","M","A","M","J","J","A","S","O","N","D"];
function climogramaSVG(T,P,{mini=false}={}){
  const W=mini?330:660,H=mini?210:380,m=mini?{l:34,r:30,t:10,b:24}:{l:58,r:58,t:22,b:42},fs=mini?12:14;
  const w=W-m.l-m.r,h=H-m.t-m.b;
  const corte=Math.max(...P)>300; // escala partida
  const Pb=200,fP=p=>corte&&p>Pb?Pb+(p-Pb)/10:p; // valor «equivalente» en mm de la escala normal
  let tMax=Math.max(10,Math.ceil(Math.max(...T,fP(Math.max(...P))/2)/10)*10),tMin=Math.min(0,Math.floor(Math.min(...T)/10)*10);
  const yT=v=>m.t+h*(1-(v-tMin)/(tMax-tMin)),yP=p=>yT(fP(p)/2);
  const bw=w/12,x=i=>m.l+bw*i+bw/2;
  let g=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Climograma">`;
  const paso=(tMax-tMin)>80?20:10;
  for(let v=Math.ceil(tMin/paso)*paso;v<=tMax;v+=paso){
    g+=`<line x1="${m.l}" x2="${m.l+w}" y1="${yT(v)}" y2="${yT(v)}" stroke="#e3e9ef"/>`;
    // modelo del visor y de la PAU: temperatura a la izquierda, precipitación a la derecha (P = 2T)
    g+=`<text x="${m.l-5}" y="${yT(v)+4}" font-size="${fs}" fill="#c0392b" text-anchor="end">${v}</text>`;
    if(v>=0){const pv=2*v;const lab=corte&&pv>Pb?Pb+(pv-Pb)*10:pv;g+=`<text x="${m.l+w+5}" y="${yT(v)+4}" font-size="${fs}" fill="#1f5fa8">${lab}</text>`}
  }
  if(corte){const y=yT(Pb/2);g+=`<line x1="${m.l}" x2="${m.l+w}" y1="${y}" y2="${y}" stroke="#1f5fa8" stroke-dasharray="4 4"/><text x="${m.l+4}" y="${y-4}" font-size="${fs-1}" fill="#1f5fa8">P: escala ×10 por encima de ${Pb} mm</text>`}
  P.forEach((p,i)=>{const y0=yT(0),y1=yP(p);g+=`<rect x="${x(i)-bw*.36}" y="${Math.min(y0,y1)}" width="${bw*.72}" height="${Math.abs(y0-y1)}" fill="#4a90d9"/>`});
  g+=`<line x1="${m.l}" x2="${m.l+w}" y1="${yT(0)}" y2="${yT(0)}" stroke="#7b8a99"/>`;
  g+=`<polyline points="${T.map((t,i)=>x(i)+","+yT(t)).join(" ")}" fill="none" stroke="#c0392b" stroke-width="${mini?2.5:3}"/>`;
  T.forEach((t,i)=>g+=`<circle cx="${x(i)}" cy="${yT(t)}" r="${mini?2.5:4}" fill="#c0392b"/>`);
  MESES.forEach((n,i)=>g+=`<text x="${x(i)}" y="${m.t+h+(mini?16:22)}" font-size="${fs}" text-anchor="middle" fill="#334">${n}</text>`);
  g+=`<rect x="${m.l}" y="${m.t}" width="${w}" height="${h}" fill="none" stroke="#7b8a99"/>`;
  if(!mini){g+=`<text x="16" y="${m.t+h/2}" font-size="14" font-weight="700" fill="#c0392b" transform="rotate(-90 16 ${m.t+h/2})" text-anchor="middle">Temperatura ºC</text><text x="${W-14}" y="${m.t+h/2}" font-size="14" font-weight="700" fill="#1f5fa8" transform="rotate(-90 ${W-14} ${m.t+h/2})" text-anchor="middle">Precipitación (mm)</text>`}
  return g+"</svg>";
}

/* ================= Motor de las animaciones de Biogeografía =================
   Mapa de unidades (vegetación potencial) y paisaje actual (cobertura real), ficha de cada unidad
   con climograma de una estación característica + Köppen, rasgos, usos humanos y fotos de Commons. */
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=(v,d=1)=>Number(v).toLocaleString("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d});
const hex=h=>{h=h.replace("#","");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
const MAR=[13,34,52],TIERRA=[58,66,60],TIERRA_ES=[92,98,90];

const BG={cfg:null,est:{},normales:null,fotos:null,escena:null,modo:"pot",resalte:null,sel:null,paso:0,lineas:false};

/* ---------- carga ---------- */
function cargaImg(u){return new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ko(new Error("No se pudo cargar "+u));i.src=u})}
function pixeles(img){const c=document.createElement("canvas");c.width=img.width;c.height=img.height;const x=c.getContext("2d");x.drawImage(img,0,0);return x.getImageData(0,0,c.width,c.height).data}

async function preparaEscena(){
  const M=BG.cfg.mapa;
  if(M.tipo==="mundo"){
    const img=await cargaImg(M.img),d=pixeles(img),W=img.width,H=img.height;
    const y0=Math.round((90-M.latN)/180*H),y1=Math.round((90-M.latS)/180*H),h=y1-y0;
    const E={W,H:h,pot:new Uint8Array(W*h),real:new Uint8Array(W*h),tierra:new Uint8Array(W*h),geo:(x,y)=>({lon:-180+(x+.5)/W*360,lat:90-(y0+y+.5)/H*180}),xy:(lon,lat)=>[(lon+180)/360*W,(90-lat)/180*H-y0]};
    for(let y=0;y<h;y++)for(let x=0;x<W;x++){const i=(y0+y)*W+x,j=y*W+x;E.pot[j]=d[i*4];E.real[j]=d[i*4+1];E.tierra[j]=d[i*4+2]}
    BG.escena=E;return;
  }
  if(M.tipo==="espana"){
    const [ip,ic]=await Promise.all([cargaImg(M.img),cargaImg(M.imgCan)]);
    const dp=pixeles(ip),dc=pixeles(ic),W=ip.width,H=ip.height;
    const E={W,H,pot:new Uint8Array(W*H),real:new Uint8Array(W*H),tierra:new Uint8Array(W*H),recuadro:null};
    for(let i=0;i<W*H;i++){E.pot[i]=dp[i*4];E.real[i]=dp[i*4+1];E.tierra[i]=dp[i*4+2]}
    // recuadro de Canarias (abajo a la derecha, a la mitad de escala de su imagen = misma escala que la península)
    const s=M.escalaCan,cw=Math.round(ic.width*s),ch=Math.round(ic.height*s),rx=W-cw-10,ry=H-ch-10;
    E.recuadro={x:rx,y:ry,w:cw,h:ch};
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const sx=Math.min(ic.width-1,Math.floor(x/s)),sy=Math.min(ic.height-1,Math.floor(y/s)),i=sy*ic.width+sx,j=(ry+y)*W+rx+x;
      E.pot[j]=dc[i*4];E.real[j]=dc[i*4+1];E.tierra[j]=dc[i*4+2]||0;if(!E.tierra[j]&&!E.pot[j])E.tierra[j]=255}
    E.geo=(x,y)=>{const R=E.recuadro;if(x>=R.x&&y>=R.y&&x<R.x+R.w&&y<R.y+R.h)return{lon:M.bbCan[0]+(x-R.x+.5)/R.w*(M.bbCan[2]-M.bbCan[0]),lat:M.bbCan[3]-(y-R.y+.5)/R.h*(M.bbCan[3]-M.bbCan[1]),can:1};
      return{lon:M.bb[0]+(x+.5)/W*(M.bb[2]-M.bb[0]),lat:M.bb[3]-(y+.5)/H*(M.bb[3]-M.bb[1])}};
    E.xy=(lon,lat)=>{if(lon<-13){const R=E.recuadro;return[R.x+(lon-M.bbCan[0])/(M.bbCan[2]-M.bbCan[0])*R.w,R.y+(M.bbCan[3]-lat)/(M.bbCan[3]-M.bbCan[1])*R.h]}
      return[(lon-M.bb[0])/(M.bb[2]-M.bb[0])*W,(M.bb[3]-lat)/(M.bb[3]-M.bb[1])*H]};
    BG.escena=E;return;
  }
  // Canarias
  const img=await cargaImg(M.img),d=pixeles(img);
  const [x0,x1]=M.recorteX||[0,img.width],W=x1-x0,H=img.height;
  const E={W,H,pot:new Uint8Array(W*H),real:new Uint8Array(W*H),tierra:new Uint8Array(W*H)};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*img.width+x0+x,j=y*W+x;E.pot[j]=d[i*4];E.real[j]=d[i*4+1];E.tierra[j]=d[i*4+2]}
  const bb=M.bb,lx=(bb[2]-bb[0])/img.width;
  E.geo=(x,y)=>({lon:bb[0]+(x0+x+.5)*lx,lat:bb[3]-(y+.5)/H*(bb[3]-bb[1])});
  E.xy=(lon,lat)=>[(lon-bb[0])/lx-x0,(bb[3]-lat)/(bb[3]-bb[1])*H];
  BG.escena=E;
}

/* ---------- pintado ---------- */
let lienzo,ctx,capa=null;
function colorUnidad(id){const u=BG.cfg.unidades.find(u=>u.id===id);return u?hex(u.c):null}
function colorReal(id){const r=BG.cfg.real.find(r=>r.id===id);return r?hex(r.c):null}
function pintaEscena(){
  const E=BG.escena;if(!E)return;
  if(!capa){capa=document.createElement("canvas");capa.width=E.W;capa.height=E.H}
  const cx=capa.getContext("2d"),im=cx.createImageData(E.W,E.H),d=im.data;
  const CU={},CR={};BG.cfg.unidades.forEach(u=>CU[u.id]=hex(u.c));BG.cfg.real.forEach(r=>CR[r.id]=hex(r.c));
  const res=BG.resalte?new Set(BG.resalte):null,sel=BG.sel;
  for(let i=0;i<E.W*E.H;i++){
    const p=E.pot[i],r=E.real[i],t=E.tierra[i];let c;
    if(BG.modo==="pot"){
      c=p?CU[p]:null;
      if(c&&res&&!res.has(p))c=gris(c,.78);
      if(!c)c=t?(t===2?TIERRA_ES:TIERRA):MAR;
    }else{
      c=r?CR[r]:null;
      if(!c)c=p?[120,120,120]:(t?(t===2?TIERRA_ES:TIERRA):MAR);
      if(res&&p&&!res.has(p))c=gris(c,.8);
      if(res&&!p&&r)c=gris(c,.8);
    }
    d[i*4]=c[0];d[i*4+1]=c[1];d[i*4+2]=c[2];d[i*4+3]=255;
  }
  cx.putImageData(im,0,0);
  dibuja();
}
function gris(c,f){const g=(c[0]*.3+c[1]*.59+c[2]*.11)*.55+22;return[c[0]*(1-f)+g*f,c[1]*(1-f)+g*f,c[2]*(1-f)+g*f]}
function ajustaLienzo(){
  const r=lienzo.getBoundingClientRect(),dp=Math.min(2,devicePixelRatio||1);
  const w=Math.max(10,Math.round(r.width*dp)),h=Math.max(10,Math.round(r.height*dp));
  if(lienzo.width!==w||lienzo.height!==h){lienzo.width=w;lienzo.height=h}
  return{w:r.width,h:r.height,dp};
}
let vista=null;
function igualaPanel(){const F=$("bgFicha"),I=$("bgInfo");if(!F)return;
  if(innerWidth<=980){F.style.maxHeight="none";if(I)I.style.maxHeight="none";return}
  // la ficha (derecha) y la información (debajo del mapa) llegan hasta el borde inferior de la pantalla; si no cabe todo, se desplazan por dentro
  const abajo=innerHeight-12;
  // con una ficha abierta, el mapa se ajusta para dejar sitio a la información de debajo (unos 250 px)
  const card=document.querySelector(".bgCard"),L=$("bgLeyenda");
  if(card){const antes=card.style.width;card.style.width="";card.style.marginLeft=card.style.marginRight="";
    {const r=card.getBoundingClientRect(),ar=r.width/r.height,hueco=abajo-r.top-(L?L.offsetHeight+8:0)-(I&&!I.hidden?(I.dataset.alto?+I.dataset.alto:258):0);
      if(r.height>hueco){card.style.width=Math.max(300,Math.floor(hueco*ar))+"px";card.style.marginLeft=card.style.marginRight="auto"}}
    if(card.style.width!==antes)requestAnimationFrame(dibuja)}
  F.style.maxHeight=Math.max(300,abajo-F.getBoundingClientRect().top)+"px";
  if(I&&!I.hidden)I.style.maxHeight=Math.max(170,abajo-I.getBoundingClientRect().top)+"px";
}
function dibuja(){
  igualaPanel();
  if(!capa)return;const {w,h,dp}=ajustaLienzo(),E=BG.escena;
  ctx.setTransform(dp,0,0,dp,0,0);ctx.fillStyle="rgb(13,34,52)";ctx.fillRect(0,0,w,h);
  const s=Math.min(w/E.W,h/E.H),ox=(w-E.W*s)/2,oy=(h-E.H*s)/2;vista={s,ox,oy};
  ctx.imageSmoothingEnabled=s<1.3;ctx.imageSmoothingQuality="high";ctx.drawImage(capa,ox,oy,E.W*s,E.H*s);
  // recuadro de Canarias
  if(E.recuadro){const R=E.recuadro;ctx.strokeStyle="rgba(230,240,235,.85)";ctx.lineWidth=1.5;ctx.strokeRect(ox+R.x*s,oy+R.y*s,R.w*s,R.h*s);
    rot("Canarias",ox+(R.x+6)*s,oy+(R.y+4)*s+15,{a:"left",s:14})}
  // líneas imaginarias (mundo)
  if(BG.cfg.mapa.tipo==="mundo"&&BG.lineas){
    const L=[[0,"Ecuador","#ffd166"],[23.44,"Trópico de Cáncer","#ff9f6b"],[-23.44,"Trópico de Capricornio","#ff9f6b"],[66.56,"Círculo polar ártico","#8fd3ff"]];
    for(const [la,n,c] of L){const y=oy+E.xy(0,la)[1]*s;if(y<oy||y>oy+E.H*s)continue;ctx.strokeStyle=c;ctx.setLineDash([7,6]);ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(ox,y);ctx.lineTo(ox+E.W*s,y);ctx.stroke();ctx.setLineDash([]);rot(n,ox+8,y-5,{a:"left",c,s:14})}
  }
  // rótulos del paso
  (BG.rotulos||[]).forEach(r=>{const [x,y]=E.xy(r.lon,r.lat);rot(r.t,ox+x*s,oy+y*s,{s:r.s||15,c:r.c||"#fff"})});
  // unidad seleccionada: marca de su estación
  const u=BG.sel&&BG.cfg.unidades.find(u=>u.id===BG.sel),st=u&&estacion(u);
  if(st){const [x,y]=E.xy(st.lo,st.la),X=ox+x*s,Y=oy+y*s;
    ctx.beginPath();ctx.arc(X,Y,8,0,7);ctx.fillStyle="#d62c1a";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#fff";ctx.stroke();
    ctx.font="800 14px system-ui,sans-serif";const tw=ctx.measureText(st.n).width;
    if(X+14+tw>w-4)rot(st.n,X-12,Y+5,{a:"right",s:14});else rot(st.n,X+12,Y+5,{a:"left",s:14})}
}
function rot(t,x,y,o={}){ctx.save();ctx.font=`800 ${o.s||14}px system-ui,sans-serif`;ctx.textAlign=o.a||"center";ctx.lineJoin="round";ctx.lineWidth=4;ctx.strokeStyle="rgba(5,15,12,.85)";ctx.strokeText(t,x,y);ctx.fillStyle=o.c||"#fff";ctx.fillText(t,x,y);ctx.restore()}

/* ---------- interacción ---------- */
function enEscena(ev){if(!vista)return null;const r=lienzo.getBoundingClientRect(),z=r.width/lienzo.clientWidth||1;
  const x=((ev.clientX-r.left)/z-vista.ox)/vista.s,y=((ev.clientY-r.top)/z-vista.oy)/vista.s;
  const E=BG.escena;if(x<0||y<0||x>=E.W||y>=E.H)return null;return{x:Math.floor(x),y:Math.floor(y)}}
function unidadEn(p){const E=BG.escena;
  for(let rad=0;rad<=3;rad++)for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){const x=p.x+dx,y=p.y+dy;if(x<0||y<0||x>=E.W||y>=E.H)continue;const i=y*E.W+x;if(E.pot[i])return{u:E.pot[i],r:E.real[i]}}
  return null}
function tip(ev){const p=enEscena(ev),T=$("bgTip");const q=p&&unidadEn(p);
  if(!q){T.hidden=true;lienzo.style.cursor="default";return}
  const u=BG.cfg.unidades.find(u=>u.id===q.u),rr=BG.cfg.real.find(r=>r.id===q.r);
  T.innerHTML=`<b>${esc(u?u.n:"")}</b>`+(BG.modo==="real"&&rr?`<br>Hoy: ${esc(rr.n)}`:"");
  const c=lienzo.parentElement.getBoundingClientRect(),z=c.width/lienzo.parentElement.clientWidth||1;
  T.style.left=Math.min((ev.clientX-c.left)/z+14,lienzo.parentElement.clientWidth-230)+"px";T.style.top=((ev.clientY-c.top)/z+12)+"px";T.hidden=false;lienzo.style.cursor="pointer"}
function clic(ev){const p=enEscena(ev),q=p&&unidadEn(p);if(q)selecciona(q.u,true)}

/* ---------- datos de clima y fotos ---------- */
function estacion(u){if(!u.est||!BG.normales)return null;return BG.normales.get(u.est)||null}
function serie(st){const p=st.p||{};const k=p["9120"]?"9120":Object.keys(p)[0];return k?{...p[k],per:k==="9120"?"1991–2020":k==="6190"?"1961–1990":k}:null}
async function cargaNormales(){
  const fs=[].concat(BG.cfg.normales);BG.normales=new Map();
  for(const f of fs){try{const d=await fetch(f).then(r=>r.json());(d.s||[]).forEach(s=>BG.normales.set(s.id,s));BG.fuentesClima=Object.assign(BG.fuentesClima||{},d.src||{})}catch(e){}}
}
const API_C="https://commons.wikimedia.org/w/api.php";
const limpiar=h=>{const d=document.createElement("div");d.innerHTML=h||"";return d.textContent.trim().replace(/\s+/g," ")};
const cacheFotos=new Map();
async function infoArchivos(nombres){
  const falta=nombres.filter(n=>!cacheFotos.has(n));
  if(falta.length){
    const u=API_C+"?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&iiextmetadatafilter=Artist|LicenseShortName|Credit&titles="+encodeURIComponent(falta.map(n=>"File:"+n).join("|"));
    try{const r=await fetch(u).then(r=>r.json());const pags=Object.values(r?.query?.pages||{});const norm=new Map((r?.query?.normalized||[]).map(n=>[n.to,n.from]));
      for(const n of falta){const p=pags.find(p=>p.title==="File:"+n||norm.get(p.title)==="File:"+n||p.title.replace(/_/g," ")===("File:"+n).replace(/_/g," "));
        const ii=p?.imageinfo?.[0];if(!ii){cacheFotos.set(n,null);continue}const md=ii.extmetadata||{};
        cacheFotos.set(n,{src:ii.thumburl||ii.url,pagina:ii.descriptionurl,autor:limpiar(md.Artist?.value)||limpiar(md.Credit?.value)||"autor en Wikimedia Commons",licencia:limpiar(md.LicenseShortName?.value)||"ver ficha"})}
    }catch(e){}
  }
  return nombres.map(n=>cacheFotos.get(n)?{...cacheFotos.get(n),archivo:n}:null).filter(Boolean);
}
function fotosDe(u){
  const F=BG.fotos||{},out={veg:[],agr:[]};
  const toma=(arr,filtro)=>(arr||[]).filter(f=>!filtro||filtro.test(f.et+" "+(f.cat||""))).map(f=>({...f,f:String(f.f).replace(/^.*\/wiki\//,"").replace(/^(File|Archivo):/i,"").replace(/_/g," ")}));
  for(const g of [].concat(u.fotos||[])){const c=F[g.cat];if(!c)continue;out.veg.push(...toma(c.vegetacion,g.veg?new RegExp(g.veg,"i"):null));out.agr.push(...toma(c.agrario,g.agr?new RegExp(g.agr,"i"):null))}
  (u.fotosExtra||[]).forEach(f=>out.veg.push(f));(u.agrExtra||[]).forEach(f=>out.agr.push(f));
  return out;
}

/* ---------- ficha ---------- */
function barraReal(u){
  const e=BG.est[u.id];if(!e)return"";
  const filas=BG.cfg.real.map(r=>({r,v:+(e.real[r.id]||0)})).filter(x=>x.v>=.5).sort((a,b)=>b.v-a.v);
  const hum=filas.filter(x=>x.r.humano).reduce((a,x)=>a+x.v,0);
  return `<p class="bgHum">🏙️ <b>${fmt(hum,0)} %</b> de su espacio está hoy ocupado por ${esc(BG.cfg.textoHumano||"cultivos y ciudades")}.</p>
   <div class="bgBarra">${filas.map(x=>`<i style="width:${x.v}%;background:${x.r.c}" title="${esc(x.r.n)}: ${fmt(x.v,0)} %"></i>`).join("")}</div>
   <div class="bgLeyBar">${filas.slice(0,5).map(x=>`<span><i style="background:${x.r.c}"></i>${esc(x.r.n)} ${fmt(x.v,0)} %</span>`).join("")}</div>`;
}
async function ficha(u){
  const F=$("bgFicha");const st=estacion(u),se=st&&serie(st);
  let clim="";
  if(se&&se.T&&se.P&&se.T.length===12){
    const k=koppen(se.T,se.P,st.la),s=stats(se.T,se.P,st.la);
    clim=`<div class="bgSec"><h3>📍 El clima: una estación característica</h3><div class="bgEst"><b>${esc(st.n)}</b>${st.cn?" · "+esc(st.cn):""}${st.z!=null?" · "+fmt(st.z,0)+" m":""}</div>
      <div class="bgClim">${climogramaSVG(se.T,se.P)}</div>
      <div class="bgKop"><span class="kop">${k}</span> ${esc(KNOM[k]||"")} · T media ${fmt(s.MAT)} °C · amplitud ${fmt(s.amp)} °C · P ${fmt(s.MAP,0)} mm/año${s.secos.length?` · ${s.secos.length} meses secos`:""}</div>
      <div class="bgNota">Normal ${se.per}${BG.fuentesClima&&BG.fuentesClima[se.src]?" · "+esc(BG.fuentesClima[se.src].t.split(" · ")[0]):""}</div></div>`;
  }else if(u.sinEstacion)clim=`<div class="bgSec"><h3>📍 Clima</h3><p>${u.sinEstacion}</p></div>`;
  const fot=fotosDe(u);
  // debajo del mapa: qué es, dónde está y para qué se usa; a la derecha: el clima y las fotos
  const I=$("bgInfo");delete I.dataset.alto;
  I.innerHTML=`<div class="bgCab" style="--c:${u.c}"><i></i><div><h2>${esc(u.n)}</h2>${u.sub?`<div class="sub">${esc(u.sub)}</div>`:""}</div>${u.clave?`<div class="bgClave">💡 ${u.clave}</div>`:""}</div>
    <div class="bgInfoGrid">
     <div class="bgSec"><h3>🌿 La formación vegetal</h3><p>${u.rasgos}</p></div>
     <div class="bgSec"><h3>🗺️ Dónde está y cómo está hoy</h3>${u.dist?`<p>${u.dist}</p>`:""}${barraReal(u)}<button class="bgBtn" id="bgVerReal">${BG.modo==="real"?"🌿 Ver su área potencial":"🏙️ Ver cómo está hoy en el mapa"}</button></div>
     <div class="bgSec"><h3>🧑‍🌾 Usos humanos</h3><p>${u.usos}</p></div>
    </div>`;
  I.hidden=false;
  F.innerHTML=`${clim||`<div class="bgSec"><h3>📍 Clima</h3><p>Sin estación característica.</p></div>`}
    <div class="bgSec"><h3>📷 ${esc(u.corto||u.n)} en fotos</h3><div class="bgFotos" id="bgFotos"><span class="bgNota">Cargando fotos de Wikimedia Commons…</span></div></div>`;
  igualaPanel();
  $("bgVerReal").onclick=()=>{ponModo(BG.modo==="real"?"pot":"real");ficha(u)};
  F.scrollTop=0;
  const elegir=(arr,n)=>{const vistos=new Set();return arr.filter(f=>!vistos.has(f.f)&&vistos.add(f.f)).slice(0,n)};
  const lista=[...elegir(fot.veg,3).map(f=>({...f,tipo:"veg"})),...elegir(fot.agr,1).map(f=>({...f,tipo:"agr"}))];
  const info=await infoArchivos(lista.map(f=>f.f));
  if(BG.sel!==u.id)return;
  const cont=$("bgFotos");
  if(!info.length){cont.innerHTML=`<span class="bgNota">No se han podido cargar las fotos (sin conexión con Wikimedia Commons).</span>`;return}
  cont.innerHTML=info.map(im=>{const f=lista.find(x=>x.f===im.archivo);return`<figure><a href="${esc(im.pagina)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(f.et)}" loading="lazy"></a>
    <figcaption><b>${f.tipo==="agr"?"🧑‍🌾 ":""}${esc(f.et)}</b>${f.lugar?" · "+esc(f.lugar):""}<br><span>${esc(im.autor)} · ${esc(im.licencia)} · Wikimedia Commons</span></figcaption></figure>`}).join("");
  cont.querySelectorAll("img").forEach(img=>img.addEventListener("click",e=>{e.preventDefault();ampliar(img.src.replace(/\/\d+px-/,"/1400px-"),img.alt)}));
}
function ampliar(src,alt){const v=document.createElement("div");v.className="bgLupa";v.innerHTML=`<img src="${esc(src)}" alt="${esc(alt)}"><span>✕</span>`;v.onclick=()=>v.remove();document.body.appendChild(v)}

/* ---------- leyenda, modos y pasos ---------- */
function leyenda(){
  const L=$("bgLeyenda"),u=BG.sel&&BG.cfg.unidades.find(u=>u.id===BG.sel);
  const nombre=BG.cfg.nombreUnidades||"todas las unidades";
  // con una unidad elegida, la leyenda se recoge para dejar sitio a la ficha (se despliega con el botón)
  if(u&&!BG.leyAbierta){
    L.innerHTML=`<button class="on" data-u="${u.id}"><i style="background:${u.c}"></i>${esc(u.corto||u.n)}</button><button class="bgVerTodo" id="bgVerTodo">☰ Ver ${esc(nombre)}</button><span class="bgNota">o toca otra zona del mapa</span>`;
    $("bgVerTodo").onclick=()=>{BG.leyAbierta=true;leyenda();igualaPanel()};return;
  }
  if(BG.modo==="pot")L.innerHTML=BG.cfg.unidades.filter(u=>!u.oculta).map(u=>`<button data-u="${u.id}" class="${BG.sel===u.id?"on":""}${BG.resalte&&!BG.resalte.includes(u.id)?" apag":""}"><i style="background:${u.c}"></i>${esc(u.corto||u.n)}</button>`).join("");
  else L.innerHTML=`<div class="bgLeyReal">${BG.cfg.real.map(r=>`<span><i style="background:${r.c}"></i>${esc(r.n)}${r.humano?" ✱":""}</span>`).join("")}</div><div class="bgNota">✱ Espacios transformados por el ser humano. ${esc(BG.cfg.fuenteReal||"")}</div>`;
  if(u)L.innerHTML+=`<button class="bgVerTodo" id="bgRecoge">▴ Recoger la leyenda</button>`;
  L.querySelectorAll("button[data-u]").forEach(b=>b.onclick=()=>selecciona(+b.dataset.u,true));
  const rc=$("bgRecoge");if(rc)rc.onclick=()=>{BG.leyAbierta=false;leyenda();igualaPanel()};
}
function ponModo(m){BG.modo=m;$("bgPot").classList.toggle("on",m==="pot");$("bgReal").classList.toggle("on",m==="real");pintaEscena();leyenda();
  $("bgModoTxt").innerHTML=m==="pot"?BG.cfg.textoPot:BG.cfg.textoReal}
function selecciona(id,abrir){
  BG.sel=id;BG.resalte=[id];BG.rotulos=[];BG.leyAbierta=false;
  const u=BG.cfg.unidades.find(u=>u.id===id);if(!u)return;
  if(BG.paso!==BG.cfg.pasos.length-1)irPaso(BG.cfg.pasos.length-1,true);
  pintaEscena();leyenda();igualaPanel();if(abrir)ficha(u);
}
function irPaso(i,silencio){
  BG.paso=i;const P=BG.cfg.pasos[i];
  document.querySelectorAll("#steps button[data-p]").forEach((b,k)=>b.classList.toggle("on",k===i));
  $("stage").innerHTML=`<b class="t">${P.t}</b><p>${P.txt}</p>`;
  if(silencio)return;
  BG.sel=null;BG.resalte=P.resaltar||null;BG.lineas=!!P.lineas;BG.rotulos=P.rotulos||[];
  if(P.modo&&P.modo!==BG.modo){BG.modo=P.modo;$("bgPot").classList.toggle("on",P.modo==="pot");$("bgReal").classList.toggle("on",P.modo==="real");$("bgModoTxt").innerHTML=P.modo==="pot"?BG.cfg.textoPot:BG.cfg.textoReal}
  pintaEscena();leyenda();
  const I=$("bgInfo");if(I){I.hidden=!P.abajo;I.innerHTML="";delete I.dataset.alto;if(P.abajo){I.dataset.alto=P.altoAbajo||258;P.abajo(I)}}
  const F=$("bgFicha");F.innerHTML=P.panel?(typeof P.panel==="function"?"":P.panel):`<div class="bgVacio">👆 Toca una zona del mapa o un nombre de la leyenda para abrir su ficha.</div>`;
  if(typeof P.panel==="function")P.panel(F);
  F.scrollTop=0;igualaPanel();requestAnimationFrame(igualaPanel);
}

/* ---------- arranque ---------- */
async function iniciaBiogeo(cfg){
  BG.cfg=cfg;lienzo=$("bgMapa");ctx=lienzo.getContext("2d");
  const nav=$("steps");nav.innerHTML=cfg.pasos.map((p,i)=>`<button data-p="${i}">${i+1} · ${esc(p.corto)}</button>`).join("");
  nav.querySelectorAll("button[data-p]").forEach(b=>b.onclick=()=>irPaso(+b.dataset.p));
  $("bgPot").onclick=()=>{ponModo("pot");const u=BG.sel&&cfg.unidades.find(u=>u.id===BG.sel);if(u)ficha(u)};
  $("bgReal").onclick=()=>{ponModo("real");const u=BG.sel&&cfg.unidades.find(u=>u.id===BG.sel);if(u)ficha(u)};
  $("bgModoTxt").innerHTML=cfg.textoPot;
  lienzo.addEventListener("pointermove",tip);lienzo.addEventListener("pointerleave",()=>$("bgTip").hidden=true);
  lienzo.addEventListener("click",clic);
  addEventListener("resize",()=>dibuja());addEventListener("scroll",()=>igualaPanel(),{passive:true});
  if(window.ResizeObserver)new ResizeObserver(()=>dibuja()).observe(lienzo);
  irPaso(0,true);$("stage").innerHTML+=`<p class="bgNota">Cargando mapas y datos…</p>`;
  try{
    const [est,fot]=await Promise.all([fetch(cfg.mapa.est).then(r=>r.json()),fetch(cfg.fotosUrl).then(r=>r.json()).catch(()=>({})),preparaEscena(),cargaNormales()]);
    BG.est=est;BG.fotos=fot.categorias||{};
  }catch(e){$("stage").innerHTML=`<b class="t">No se han podido cargar los datos</b><p>${esc(e.message)}</p>`;return}
  irPaso(0);
}
