/* ANAMBRO · Globo ligero de los juegos (2026-11-19)
   Al resolver una ronda, un globo terráqueo gira hasta el lugar, lo marca y se acerca hasta el mapa
   de la ficha. Sin librerías: proyección ortográfica dibujada en un <canvas> con las tierras de
   Natural Earth 1:50m de ANAMBRO (anb-tierras-50m.json).
   Uso: AnbGlobo.mostrar(contenedorDelMapa,{lat,lon,color,nombre,formas}) → promesa que se cumple
   cuando el globo se ha acercado y deja ver el mapa (ahí se hace el flyTo del mapa). */
(function(){
  "use strict";
  const RAD=Math.PI/180;
  let TIERRAS=null,cargando=null;
  let ultimo={lat:28.3,lon:-16.6}; // la primera vez sale desde Canarias
  const reducido=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};

  // Tierras simplificadas (un vértice cada ~0,35°): ligeras para dibujar 60 veces por segundo
  function simplificar(anillo,paso){
    const out=[anillo[0]];let [x0,y0]=anillo[0];
    for(let i=1;i<anillo.length-1;i++){const [x,y]=anillo[i];if(Math.abs(x-x0)+Math.abs(y-y0)>=paso){out.push(anillo[i]);x0=x;y0=y}}
    out.push(anillo[anillo.length-1]);return out;
  }
  function anillosDe(geo,paso){
    const res=[];
    const add=g=>{if(!g)return;
      if(g.type==="Polygon")res.push(g.coordinates.map(r=>simplificar(r,paso)).filter(r=>r.length>3));
      else if(g.type==="MultiPolygon")g.coordinates.forEach(p=>res.push(p.map(r=>simplificar(r,paso)).filter(r=>r.length>3)));
      else if(g.type==="GeometryCollection")g.geometries.forEach(add);};
    (geo.type==="FeatureCollection"?geo.features.map(f=>f.geometry):geo.type==="Feature"?[geo.geometry]:[geo]).forEach(add);
    return res.filter(p=>p.length);
  }
  function cargar(){
    if(TIERRAS)return Promise.resolve(TIERRAS);
    if(!cargando)cargando=fetch("anb-tierras-50m.json").then(r=>r.json()).then(j=>TIERRAS=anillosDe(j,.35)).catch(e=>{cargando=null;throw e});
    return cargando;
  }

  // Proyección ortográfica centrada en (lat0,lon0)
  function proyector(lat0,lon0,R,cx,cy){
    const s0=Math.sin(lat0*RAD),c0=Math.cos(lat0*RAD);
    return(lon,lat)=>{
      const f=lat*RAD,l=(lon-lon0)*RAD,cf=Math.cos(f),sf=Math.sin(f),cl=Math.cos(l);
      const x=cf*Math.sin(l),y=c0*sf-s0*cf*cl,vis=s0*sf+c0*cf*cl;
      if(vis>=0)return[cx+R*x,cy-R*y,true];
      const n=Math.hypot(x,y)||1;return[cx+R*x/n,cy-R*y/n,false]; // lo de detrás se lleva al borde
    };
  }
  // Recorta cada anillo al hemisferio visible: lo que queda detrás se sustituye por el arco del borde
  // más corto entre el punto por donde sale y el punto por donde vuelve a entrar
  function trazar(ctx,pol,P,cx,cy,R){
    ctx.beginPath();
    for(const r of pol){
      const pts=r.map(([lo,la])=>P(lo,la));
      let i0=pts.findIndex(p=>p[2]);if(i0<0)continue;
      const n=pts.length;let fuera=null;
      ctx.moveTo(pts[i0][0],pts[i0][1]);
      for(let k=1;k<=n;k++){const p=pts[(i0+k)%n],ant=pts[(i0+k-1)%n];
        if(p[2]){
          if(fuera!==null){const a1=Math.atan2(ant[1]-cy,ant[0]-cx);let d=a1-fuera;d=Math.atan2(Math.sin(d),Math.cos(d));
            ctx.arc(cx,cy,R,fuera,fuera+d,d<0);fuera=null}
          ctx.lineTo(p[0],p[1]);
        }else if(fuera===null){ctx.lineTo(p[0],p[1]);fuera=Math.atan2(p[1]-cy,p[0]-cx)}
      }
      ctx.closePath();
    }
  }
  function dibujar(cv,o){
    const ctx=cv.getContext("2d"),dpr=cv._dpr,W=cv.width/dpr,H=cv.height/dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const R=o.R,cx=W/2,cy=H/2,P=proyector(o.lat,o.lon,R,cx,cy);
    // fondo de espacio
    ctx.fillStyle="#0b1d33";ctx.fillRect(0,0,W,H);
    // halo
    const h=ctx.createRadialGradient(cx,cy,R*.95,cx,cy,R*1.12);h.addColorStop(0,"rgba(120,190,255,.55)");h.addColorStop(1,"rgba(120,190,255,0)");
    ctx.fillStyle=h;ctx.beginPath();ctx.arc(cx,cy,R*1.12,0,7);ctx.fill();
    // océano
    const g=ctx.createRadialGradient(cx-R*.35,cy-R*.35,R*.1,cx,cy,R);g.addColorStop(0,"#4f9bd6");g.addColorStop(1,"#1b4f86");
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fillStyle=g;ctx.fill();ctx.clip();
    // retícula cada 30°
    ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=.7;
    for(let lo=-180;lo<180;lo+=30){ctx.beginPath();let d=false;for(let la=-90;la<=90;la+=3){const p=P(lo,la);if(p[2]){d?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);d=true}else d=false}ctx.stroke()}
    for(let la=-60;la<=60;la+=30){ctx.beginPath();let d=false;for(let lo=-180;lo<=180;lo+=3){const p=P(lo,la);if(p[2]){d?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);d=true}else d=false}ctx.stroke()}
    // tierras
    if(TIERRAS){ctx.fillStyle="#d9cfa9";ctx.strokeStyle="rgba(90,70,40,.45)";ctx.lineWidth=.5;
      for(const pol of TIERRAS){trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}}
    // formas destacadas (países del juego)
    if(o.formas){ctx.fillStyle=o.color||"#2ecc71";ctx.strokeStyle="#0e5a2c";ctx.lineWidth=1.4;
      for(const pol of o.formas){trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}}
    // luz y sombra del globo
    const s=ctx.createRadialGradient(cx-R*.4,cy-R*.45,R*.2,cx,cy,R*1.02);s.addColorStop(0,"rgba(255,255,255,.12)");s.addColorStop(.7,"rgba(0,0,0,0)");s.addColorStop(1,"rgba(0,10,30,.35)");
    ctx.fillStyle=s;ctx.fillRect(cx-R,cy-R,2*R,2*R);ctx.restore();
    // punto del lugar
    if(o.punto){const p=P(o.punto.lon,o.punto.lat);if(p[2]){
      const pul=o.pulso||0;
      if(pul>0){ctx.beginPath();ctx.arc(p[0],p[1],8+pul*18,0,7);ctx.strokeStyle=`rgba(255,255,255,${.9*(1-pul)})`;ctx.lineWidth=3;ctx.stroke()}
      ctx.beginPath();ctx.arc(p[0],p[1],7,0,7);ctx.fillStyle=o.punto.color||"#c0392b";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#fff";ctx.stroke();
      if(o.punto.nombre&&o.etiqueta){ctx.font="700 15px system-ui,-apple-system,Segoe UI,Arial,sans-serif";
        const t=o.punto.nombre,w=ctx.measureText(t).width,x=Math.min(W-w-14,Math.max(6,p[0]-w/2-6)),y=Math.max(6,p[1]-38);
        ctx.fillStyle="rgba(255,255,255,.93)";ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w+12,24,8):ctx.rect(x,y,w+12,24);ctx.fill();
        ctx.fillStyle="#17324d";ctx.fillText(t,x+6,y+17);}
    }}
  }
  const suave=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  function mostrar(cont,op){
    op=op||{};
    if(!cont||!isFinite(op.lat)||!isFinite(op.lon))return Promise.resolve();
    // quitar un globo anterior en el mismo contenedor
    const viejo=cont.querySelector(":scope > .anbGlobo");if(viejo)viejo._fin&&viejo._fin(true);
    if(getComputedStyle(cont).position==="static")cont.style.position="relative";
    const caja=document.createElement("div");caja.className="anbGlobo";
    caja.style.cssText="position:absolute;inset:0;z-index:1000;border-radius:inherit;overflow:hidden;cursor:pointer;background:#0b1d33";
    caja.title="Toca para ir directamente al mapa";
    const cv=document.createElement("canvas");cv.style.cssText="width:100%;height:100%;display:block";caja.appendChild(cv);
    cont.appendChild(caja);
    const W=Math.max(120,cont.clientWidth),H=Math.max(120,cont.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv._dpr=dpr;
    const R0=Math.min(W,H)*.44;
    const formas=op.formas?anillosDe(op.formas,.1):null;
    const destino={lat:Math.max(-80,Math.min(80,op.lat)),lon:op.lon};
    const desde={...ultimo};let dl=destino.lon-desde.lon;dl=((dl+540)%360)-180;
    const tGiro=reducido()?0:1700,tPausa=reducido()?600:1100,tZoom=reducido()?0:900;
    return new Promise(res=>{
      let raf=0,acabado=false,t0=0;
      const fin=(rapido)=>{if(acabado)return;acabado=true;cancelAnimationFrame(raf);ultimo={...destino};
        if(rapido){caja.remove();res();return}
        caja.style.transition="opacity .35s";caja.style.opacity="0";setTimeout(()=>caja.remove(),380);res();};
      caja._fin=fin;caja.addEventListener("click",()=>fin(false));
      const marco=(ts)=>{
        if(!caja.isConnected){fin(true);return}
        if(!t0)t0=ts;const t=ts-t0;
        let lat,lon,R=R0,pulso=0,alfa=1,etiqueta=false;
        if(t<tGiro){const k=suave(t/tGiro);lat=desde.lat+(destino.lat-desde.lat)*k;lon=desde.lon+dl*k}
        else{lat=destino.lat;lon=destino.lon;const t2=t-tGiro;etiqueta=true;
          if(t2<tPausa)pulso=(t2%700)/700;
          else{const k=Math.min(1,(t2-tPausa)/(tZoom||1));R=R0*(1+Math.pow(k,2)*5);alfa=1-Math.max(0,(k-.45)/.55);
            if(k>=1||!tZoom){caja.style.opacity="0";fin(true);return}}}
        caja.style.opacity=alfa;
        dibujar(cv,{lat,lon,R,formas,color:op.colorForma,punto:op.sinPunto?null:{lat:destino.lat,lon:destino.lon,color:op.color,nombre:op.nombre},pulso,etiqueta});
        raf=requestAnimationFrame(marco);
      };
      // primer dibujo inmediato (aunque las tierras aún estén cargando) y animación cuando lleguen
      dibujar(cv,{lat:desde.lat,lon:desde.lon,R:R0});
      cargar().catch(()=>null).then(()=>{if(!acabado)raf=requestAnimationFrame(marco)});
      // seguridad: nunca se queda tapando el mapa
      setTimeout(()=>fin(false),9000);
    });
  }
  // Botón 🌍 para volver a ver el globo sobre el mapa
  function boton(cont,repetir){
    if(!cont||cont.querySelector(":scope > .anbGloboBtn"))return;
    const b=document.createElement("button");b.type="button";b.className="anbGloboBtn";b.textContent="🌍";b.title="Ver otra vez en el globo";
    b.style.cssText="position:absolute;right:10px;top:10px;z-index:999;width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:#17324d;color:#fff;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);padding:0";
    b.addEventListener("click",ev=>{ev.stopPropagation();repetir()});
    ["mousedown","dblclick","touchstart","pointerdown","wheel"].forEach(t=>b.addEventListener(t,ev=>ev.stopPropagation()));
    cont.appendChild(b);
  }
  // Centro del trozo más grande (Francia en Europa, no a medio camino de la Guayana; EE. UU. sin Alaska…)
  function centro(geo){
    let mejor=null,area=-1;
    for(const pol of anillosDe(geo,0)){const r=pol[0];if(!r)continue;
      let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      const a=(x1-x0)*(y1-y0)*Math.cos((y0+y1)/2*RAD);if(a>area){area=a;mejor={lat:(y0+y1)/2,lon:(x0+x1)/2}}}
    return mejor;
  }
  window.AnbGlobo={mostrar,boton,centro,precargar:()=>cargar().catch(()=>null)};
})();
