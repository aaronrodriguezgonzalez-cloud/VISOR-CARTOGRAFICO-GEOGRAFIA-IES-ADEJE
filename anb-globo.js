/* ANAMBRO · Globo ligero de los juegos (2026-11-19)
   Al resolver una ronda, el globo gira hasta el lugar y lo marca. Se puede girar con el ratón o el dedo,
   acercar y alejar (rueda, pellizco o botones) y volver al lugar. Lleva las líneas imaginarias principales
   (ecuador, trópicos, círculos polares, meridiano de Greenwich) y, en los juegos de clima, las zonas
   cálida, templada y fría. Sin librerías: proyección ortográfica en un <canvas> con las tierras de
   Natural Earth 1:50m de ANAMBRO (anb-tierras-50m.json).
   Uso: AnbGlobo.globo(contenedor,{lat,lon,color,nombre,formas,colorForma,sinPunto,zonas}) */
(function(){
  "use strict";
  const RAD=Math.PI/180,TROP=23.44,POLAR=66.56;
  let T_GRUESA=null,T_FINA=null,cargando=null;
  let ultimo={lat:28.3,lon:-16.6}; // la primera vez sale desde Canarias
  const reducido=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};
  const FUENTE="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";

  /* ---------- Datos ---------- */
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
    return res.filter(p=>p.length).map(p=>{let y0=90,y1=-90;for(const [,y] of p[0]){if(y<y0)y0=y;if(y>y1)y1=y}p.y0=y0;p.y1=y1;return p});
  }
  function cargar(){
    if(T_GRUESA)return Promise.resolve();
    if(!cargando)cargando=fetch("anb-tierras-50m.json").then(r=>r.json()).then(j=>{T_GRUESA=anillosDe(j,.35);T_FINA=anillosDe(j,.06)}).catch(e=>{cargando=null;throw e});
    return cargando;
  }
  // Centro del trozo más grande (Francia en Europa y no a medio camino de la Guayana…)
  function centro(geo){
    let mejor=null,area=-1;
    for(const pol of anillosDe(geo,0)){const r=pol[0];if(!r)continue;
      let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const [x,y] of r){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      const a=(x1-x0)*(y1-y0)*Math.cos((y0+y1)/2*RAD);if(a>area){area=a;mejor={lat:(y0+y1)/2,lon:(x0+x1)/2}}}
    return mejor;
  }

  /* ---------- Proyección ortográfica ---------- */
  function proyector(lat0,lon0,R,cx,cy){
    const s0=Math.sin(lat0*RAD),c0=Math.cos(lat0*RAD);
    return(lon,lat)=>{
      const f=lat*RAD,l=(lon-lon0)*RAD,cf=Math.cos(f),sf=Math.sin(f),cl=Math.cos(l);
      const x=cf*Math.sin(l),y=c0*sf-s0*cf*cl,vis=s0*sf+c0*cf*cl;
      if(vis>=0)return[cx+R*x,cy-R*y,true];
      const n=Math.hypot(x,y)||1;return[cx+R*x/n,cy-R*y/n,false];
    };
  }
  // Polígonos recortados al hemisferio visible: lo de detrás se sustituye por el arco más corto del borde
  function trazar(ctx,pol,P,cx,cy,R){
    ctx.beginPath();
    for(const r of pol){
      const pts=r.map(([lo,la])=>P(lo,la));
      const i0=pts.findIndex(p=>p[2]);if(i0<0)continue;
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
  // Casquete al norte del paralelo φ (para las zonas): su borde oculto va por el horizonte
  // Casquete al norte del paralelo φ como Path2D. El borde oculto se lleva al horizonte; si esa figura
  // resulta ser el casquete del otro lado, se le suma el disco (regla par-impar) para invertirla.
  function casquete(ctx,phi,P,cx,cy,R,lat0){
    const disco=new Path2D();disco.moveTo(cx+R,cy);disco.arc(cx,cy,R,0,Math.PI*2);
    const pts=[];let mejor=null;
    for(let lo=-180;lo<=180;lo+=2){const p=P(lo,phi);pts.push(p);
      if(p[2]){const d=Math.hypot(p[0]-cx,p[1]-cy);if(!mejor||d<mejor.d)mejor={d,lo}}}
    if(!mejor)return lat0>phi?disco:new Path2D();
    const c=new Path2D();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();
    const q=P(mejor.lo,Math.min(89.9,phi+1.5));
    if(!q[2]||ctx.isPointInPath(c,q[0]*ctx.getTransform().a,q[1]*ctx.getTransform().d,"evenodd"))return c;
    const inv=new Path2D(c);inv.addPath(disco);return inv;
  }
  function linea(ctx,P,pts){ctx.beginPath();let d=false;for(const [lo,la] of pts){const p=P(lo,la);if(p[2]){d?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);d=true}else d=false}ctx.stroke()}
  const paralelo=la=>{const a=[];for(let lo=-180;lo<=180;lo+=2)a.push([lo,la]);return a};
  const meridiano=lo=>{const a=[];for(let la=-90;la<=90;la+=2)a.push([lo,la]);return a};
  function rotulo(ctx,t,x,y,color){
    ctx.font=`700 13px ${FUENTE}`;const w=ctx.measureText(t).width;
    ctx.fillStyle="rgba(11,29,51,.72)";ctx.beginPath();ctx.roundRect?ctx.roundRect(x-3,y-13,w+6,17,5):ctx.rect(x-3,y-13,w+6,17);ctx.fill();
    ctx.fillStyle=color;ctx.fillText(t,x,y);
  }

  // Zonas: un velo suave sobre el mar y un color pleno sobre las tierras
  const ZONAS={calida:{mar:"rgba(255,120,60,.22)",tierra:"#efa067"},templada:{mar:"rgba(255,225,90,.16)",tierra:"#efd98a"},fria:{mar:"rgba(225,240,255,.38)",tierra:"#eef5fb"}};
  const LINEAS=[
    {la:0,n:"Ecuador",c:"#ffffff",w:2.2,d:[]},
    {la:TROP,n:"Trópico de Cáncer",c:"#ffd27a",w:1.6,d:[7,5]},
    {la:-TROP,n:"Trópico de Capricornio",c:"#ffd27a",w:1.6,d:[7,5]},
    {la:POLAR,n:"Círculo Polar Ártico",c:"#bfe3ff",w:1.6,d:[3,4]},
    {la:-POLAR,n:"Círculo Polar Antártico",c:"#bfe3ff",w:1.6,d:[3,4]}];

  function dibujar(G){
    const cv=G.cv,ctx=cv.getContext("2d"),dpr=G.dpr,W=G.W,H=G.H;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const R=G.R0*G.zoom,cx=W/2,cy=H/2,lat0=G.lat,lon0=G.lon,P=proyector(lat0,lon0,R,cx,cy);
    ctx.fillStyle="#0b1d33";ctx.fillRect(0,0,W,H);
    const h=ctx.createRadialGradient(cx,cy,R*.95,cx,cy,R*1.12);h.addColorStop(0,"rgba(120,190,255,.5)");h.addColorStop(1,"rgba(120,190,255,0)");
    ctx.fillStyle=h;ctx.beginPath();ctx.arc(cx,cy,R*1.12,0,7);ctx.fill();
    const g=ctx.createRadialGradient(cx-R*.35,cy-R*.35,R*.1,cx,cy,R);g.addColorStop(0,"#4f9bd6");g.addColorStop(1,"#1b4f86");
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,R,0,7);ctx.fillStyle=g;ctx.fill();ctx.clip();
    // tierras
    const T=G.zoom>2.2?T_FINA:T_GRUESA;
    if(T&&!G.zonas){ctx.fillStyle="#ddd3ae";ctx.strokeStyle="rgba(90,70,40,.5)";ctx.lineWidth=.6;
      for(const pol of T){trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}}
    // países destacados
    if(G.formas){ctx.fillStyle=G.colorForma||"#2ecc71";ctx.strokeStyle="#0e5a2c";ctx.lineWidth=1.6;
      for(const pol of G.formas){trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}}
    // zonas climáticas (se pintan por casquetes, de sur a norte)
    if(G.zonas){ // cada franja = casquete menos el casquete siguiente (regla par-impar)
      const disco=new Path2D();disco.moveTo(cx+R,cy);disco.arc(cx,cy,R,0,Math.PI*2);
      const cap={};for(const f of [-POLAR,-TROP,TROP,POLAR])cap[f]=casquete(ctx,f,P,cx,cy,R,lat0);
      const franjas=[[null,-POLAR,ZONAS.fria,-90],[-POLAR,-TROP,ZONAS.templada],[-TROP,TROP,ZONAS.calida],[TROP,POLAR,ZONAS.templada],[POLAR,null,ZONAS.fria,90]];
      for(const [a,b,col] of franjas){const p=new Path2D();p.addPath(a===null?disco:cap[a]);if(b!==null)p.addPath(cap[b]);
        ctx.fillStyle=col.mar;ctx.fill(p,"evenodd");
        if(T){const y0=a===null?-90:a,y1=b===null?90:b;
          ctx.save();ctx.clip(p,"evenodd");ctx.fillStyle=col.tierra;ctx.strokeStyle="rgba(90,70,40,.55)";ctx.lineWidth=.6;
          for(const pol of T){if(pol.y1<y0||pol.y0>y1)continue;trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}
          ctx.restore()}
      }
      if(G.formas){ctx.fillStyle=G.colorForma||"#2ecc71";ctx.strokeStyle="#0e5a2c";ctx.lineWidth=1.6;
        for(const pol of G.formas){trazar(ctx,pol,P,cx,cy,R);ctx.fill("evenodd");ctx.stroke()}}
    }
    // retícula cada 30°
    ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=.7;ctx.setLineDash([]);
    for(let lo=-180;lo<180;lo+=30)linea(ctx,P,meridiano(lo));
    for(let la=-60;la<=60;la+=30)linea(ctx,P,paralelo(la));
    // líneas imaginarias
    for(const L of LINEAS){ctx.strokeStyle=L.c;ctx.lineWidth=L.w;ctx.setLineDash(L.d);linea(ctx,P,paralelo(L.la))}
    ctx.strokeStyle="#ffffff";ctx.lineWidth=1.8;ctx.setLineDash([10,4,2,4]);linea(ctx,P,meridiano(0));ctx.setLineDash([]);
    // sombreado del globo
    const s=ctx.createRadialGradient(cx-R*.4,cy-R*.45,R*.2,cx,cy,R*1.02);s.addColorStop(0,"rgba(255,255,255,.10)");s.addColorStop(.7,"rgba(0,0,0,0)");s.addColorStop(1,"rgba(0,10,30,.32)");
    ctx.fillStyle=s;ctx.fillRect(cx-R,cy-R,2*R,2*R);ctx.restore();
    // rótulos de las líneas, sobre el meridiano central visible
    const ocup=[];if(G.punto){const p=P(G.punto.lon,G.punto.lat);if(p[2])ocup.push([p[0]-60,p[1]-30],[p[0]-60,p[1]-12],[p[0]-60,p[1]+4])}
    const libre=(x,y)=>ocup.every(o=>Math.abs(o[0]-x)>150||Math.abs(o[1]-y)>18);
    for(const L of LINEAS){
      for(const dl of [-28,-14,0,14,28]){const p=P(lon0+dl,L.la);
        if(p[2]&&p[0]>8&&p[0]<W-170&&p[1]>18&&p[1]<H-8&&libre(p[0],p[1])){rotulo(ctx,L.n,p[0]+5,p[1]-4,L.c);ocup.push([p[0],p[1]]);break}}
    }
    for(const la of [lat0+18,lat0-18,lat0+34,lat0-34]){const p=P(0,Math.max(-80,Math.min(80,la)));
      if(p[2]&&p[0]>8&&p[0]<W-175&&p[1]>18&&p[1]<H-8&&libre(p[0],p[1])){rotulo(ctx,"Meridiano de Greenwich",p[0]+5,p[1],"#ffffff");ocup.push([p[0],p[1]]);break}}
    // el lugar
    if(G.punto){const p=P(G.punto.lon,G.punto.lat);if(p[2]){
      const pul=G.pulso;
      if(pul>0){ctx.beginPath();ctx.arc(p[0],p[1],8+pul*18,0,7);ctx.strokeStyle=`rgba(255,255,255,${.9*(1-pul)})`;ctx.lineWidth=3;ctx.stroke()}
      ctx.beginPath();ctx.arc(p[0],p[1],7.5,0,7);ctx.fillStyle="#d62c1a";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#fff";ctx.stroke();
      if(G.punto.nombre&&G.etiqueta){ctx.font=`700 15px ${FUENTE}`;
        const t=G.punto.nombre,w=ctx.measureText(t).width,x=Math.min(W-w-14,Math.max(6,p[0]-w/2-6)),y=Math.max(6,p[1]-40);
        ctx.fillStyle="rgba(255,255,255,.95)";ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w+12,24,8):ctx.rect(x,y,w+12,24);ctx.fill();
        ctx.fillStyle="#17324d";ctx.fillText(t,x+6,y+17);}
    }}
  }
  const suave=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  const CSS=`.anbGlobo{position:relative;overflow:hidden;background:#0b1d33;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.anbGlobo.arrastrando{cursor:grabbing}
.anbGlobo canvas{display:block;width:100%;height:100%}
.anbGloboCtl{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:2}
.anbGloboCtl button{width:38px;height:38px;border-radius:50%;border:2px solid #fff;background:#17324dcc;color:#fff;font:700 20px/1 ${FUENTE};cursor:pointer;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.anbGloboCtl button:hover{background:#1f4f7a}
.anbGloboLey{position:absolute;left:8px;bottom:8px;z-index:2;background:rgba(11,29,51,.78);color:#fff;border-radius:8px;padding:5px 8px;font:600 14px/1.35 ${FUENTE}}
.anbGloboLey i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;border:1px solid rgba(255,255,255,.6)}
.anbGloboAyuda{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:2;background:rgba(11,29,51,.7);color:#fff;border-radius:10px;padding:3px 10px;font:600 13px ${FUENTE};pointer-events:none;transition:opacity .6s;white-space:nowrap}
.anbMapa{background:#a9cfe8}
.anbModelo{border-radius:10px;overflow:hidden;border:1px solid #c9d6e2;background:#e9f6fd}
.anbModeloTxt{font:600 14px/1.35 ${FUENTE};color:#1d2a36;margin-top:6px}
.anbLeyBtn{position:absolute;left:8px;bottom:8px;z-index:3;font:700 13px ${FUENTE};background:#fff;color:#17324d;border:1px solid #9fb3c4;border-radius:8px;padding:4px 9px;cursor:pointer}
.anbLeyCaja{position:absolute;left:8px;bottom:40px;top:44px;z-index:4;width:min(300px,70%);overflow:auto;background:#fff;border:1px solid #9fb3c4;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.25);padding:6px}
.anbLeyCaja img{width:100%;display:block}
.anbMapa .anbGloboFuente{color:rgba(23,50,77,.8)}
.anbMapaTit{position:absolute;left:8px;top:8px;z-index:2;background:rgba(255,255,255,.94);color:#17324d;border-radius:8px;padding:4px 10px;font:700 14px ${FUENTE};box-shadow:0 1px 4px rgba(0,0,0,.2);max-width:calc(100% - 70px)}
.anbGloboFuente{position:absolute;right:8px;bottom:6px;z-index:2;color:rgba(255,255,255,.75);font:11px ${FUENTE};pointer-events:none}`;
  function css(){if(document.getElementById("anbGloboCss"))return;const s=document.createElement("style");s.id="anbGloboCss";s.textContent=CSS;document.head.appendChild(s)}

  function globo(cont,op){
    op=op||{};
    if(!cont||!isFinite(op.lat)||!isFinite(op.lon))return null;
    css();
    if(cont._anbGlobo)cont._anbGlobo.destruir();
    cont.innerHTML="";cont.classList.add("anbGlobo");
    const cv=document.createElement("canvas");cont.appendChild(cv);
    const ctl=document.createElement("div");ctl.className="anbGloboCtl";
    ctl.innerHTML='<button type="button" data-g="mas" title="Acercar">+</button><button type="button" data-g="menos" title="Alejar">−</button><button type="button" data-g="lugar" title="Volver al lugar">⌖</button>';
    cont.appendChild(ctl);
    if(op.zonas){const l=document.createElement("div");l.className="anbGloboLey";
      l.innerHTML=`<div><i style="background:#efa067"></i>Zona cálida</div><div><i style="background:#efd98a"></i>Zonas templadas</div><div><i style="background:#eef5fb"></i>Zonas frías</div>`;cont.appendChild(l)}
    const ay=document.createElement("div");ay.className="anbGloboAyuda";ay.textContent="Arrastra para girar el globo";cont.appendChild(ay);setTimeout(()=>{ay.style.opacity="0"},4500);
    const fu=document.createElement("div");fu.className="anbGloboFuente";fu.textContent="Natural Earth · ANAMBRO";cont.appendChild(fu);

    const destino={lat:Math.max(-85,Math.min(85,op.lat)),lon:op.lon};
    const G={cv,W:0,H:0,dpr:1,R0:0,zoom:1,lat:ultimo.lat,lon:ultimo.lon,zonas:!!op.zonas,
      formas:op.formas?anillosDe(op.formas,.05):null,colorForma:op.colorForma,
      punto:op.sinPunto?null:{lat:destino.lat,lon:destino.lon,color:op.color,nombre:op.nombre},pulso:0,etiqueta:false};
    let vivo=true,raf=0,anim=null,sucio=true;
    const medir=()=>{const W=Math.max(160,cont.clientWidth),H=Math.max(160,cont.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);
      if(W!==G.W||H!==G.H||dpr!==G.dpr){G.W=W;G.H=H;G.dpr=dpr;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);G.R0=Math.min(W,H)*.45;sucio=true}};
    const bucle=ts=>{if(!vivo)return;medir();
      if(anim){const k=Math.min(1,(ts-anim.t0)/anim.dur),e=suave(k);
        G.lat=anim.a.lat+(anim.b.lat-anim.a.lat)*e;G.lon=anim.a.lon+anim.dl*e;G.zoom=anim.a.z+(anim.b.z-anim.a.z)*e;
        if(k>=1){anim=null;G.etiqueta=true;pulsoHasta=ts+2100}sucio=true}
      if(pulsoHasta>ts){G.pulso=((pulsoHasta-ts)%700)/700;G.pulso=1-G.pulso;sucio=true}else if(G.pulso){G.pulso=0;sucio=true}
      if(sucio){dibujar(G);sucio=false}
      raf=requestAnimationFrame(bucle)};
    let pulsoHasta=0;
    const irA=(lat,lon,zoom,dur)=>{let dl=lon-G.lon;dl=((dl+540)%360)-180;
      anim={t0:performance.now(),dur:reducido()?1:dur,a:{lat:G.lat,lon:G.lon,z:G.zoom},b:{lat,z:zoom},dl}};
    const zoomA=z=>{G.zoom=Math.max(1,Math.min(8,z));sucio=true};
    // arrastrar (ratón y dedo) y pellizcar
    const dedos=new Map();let base=null;
    cont.addEventListener("pointerdown",ev=>{if(ev.target.closest("button"))return;anim=null;G.etiqueta=true;
      dedos.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});try{cont.setPointerCapture(ev.pointerId)}catch(e){}
      cont.classList.add("arrastrando");ay.style.opacity="0";base=null;ev.preventDefault()});
    cont.addEventListener("pointermove",ev=>{const d=dedos.get(ev.pointerId);if(!d)return;
      if(dedos.size===1){const R=G.R0*G.zoom,k=180/Math.PI/R;
        G.lon-=(ev.clientX-d.x)*k;G.lat=Math.max(-89,Math.min(89,G.lat+(ev.clientY-d.y)*k));
        G.lon=((G.lon+540)%360)-180;sucio=true}
      d.x=ev.clientX;d.y=ev.clientY;
      if(dedos.size===2){const [a,b]=[...dedos.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);
        if(base)zoomA(base.z*dist/base.d);else base={d:dist,z:G.zoom}}});
    const soltar=ev=>{dedos.delete(ev.pointerId);base=null;if(!dedos.size)cont.classList.remove("arrastrando")};
    cont.addEventListener("pointerup",soltar);cont.addEventListener("pointercancel",soltar);
    cont.addEventListener("wheel",ev=>{ev.preventDefault();anim=null;zoomA(G.zoom*(ev.deltaY<0?1.15:1/1.15))},{passive:false});
    cont.addEventListener("dblclick",ev=>{if(ev.target.closest("button"))return;zoomA(G.zoom*1.6)});
    ctl.addEventListener("click",ev=>{const b=ev.target.closest("button");if(!b)return;ev.stopPropagation();anim=null;
      if(b.dataset.g==="mas")zoomA(G.zoom*1.4);else if(b.dataset.g==="menos")zoomA(G.zoom/1.4);
      else irA(destino.lat,destino.lon,op.zoomFinal||1.35,1200)});
    const ro=window.ResizeObserver?new ResizeObserver(()=>{sucio=true}):null;if(ro)ro.observe(cont);
    medir();dibujar(G);
    cargar().catch(()=>null).then(()=>{if(!vivo)return;sucio=true;irA(destino.lat,destino.lon,op.zoomFinal||1.35,1800)});
    raf=requestAnimationFrame(bucle);
    ultimo={...destino};
    const api={destruir(){vivo=false;cancelAnimationFrame(raf);if(ro)ro.disconnect();cont._anbGlobo=null}};
    cont._anbGlobo=api;
    // si el contenedor desaparece (siguiente ronda), se para solo
    const vigila=setInterval(()=>{if(!cont.isConnected){api.destruir();clearInterval(vigila)}},2000);
    return api;
  }

  /* =====================================================================================
     Mapas ligeros de Canarias (municipios, GRAFCAN) y de España (comunidades autónomas, IGN,
     con Canarias en su recuadro). Mismo manejo que el globo: arrastrar, rueda, pellizco, + − ⌖.
     ===================================================================================== */
  const DATOS={can:"data/clima/canarias/municipios_canarias.json",esp:"data/admin/egrn_ccaa.json"};
  const MAPAS={};const cargandoM={};
  // Recuadro de Canarias en el mapa de España (abajo a la izquierda, como en los mapas de la PAU)
  const INS={dx:8.0,dy:5.9,caja:[-10.3,33.45,-5.2,35.55]};
  const enCanarias=(lo,la)=>lo<-13&&lo>-18.6&&la>27.4&&la<29.6;
  // GRAFCAN trae «Granadilla De Abona»: se escribe «Granadilla de Abona», «Puerto de la Cruz», «Santa Cruz de La Palma»
  function bienEscrito(n){
    const w=n.split(" ");
    for(let i=1;i<w.length;i++){const l=w[i].toLowerCase();
      if(l==="de"||l==="del"||l==="y")w[i]=l;
      else if((l==="la"||l==="los"||l==="las")&&w[i-1]==="de"&&!/^(Palma|Gomera)$/.test(w[i+1]||""))w[i]=l;}
    return w.join(" ");
  }
  function cargarMapa(t){
    if(MAPAS[t])return Promise.resolve(MAPAS[t]);
    if(!cargandoM[t])cargandoM[t]=fetch(DATOS[t]).then(r=>r.json()).then(j=>{
      const u=j.features.map(ft=>{const p=ft.properties||{};
        const nombre=t==="can"?bienEscrito(p.n||""):(p.NAMEUNIT||"");const extra=t==="can"?p.i:"";
        const pols=anillosDe(ft,t==="can"?.003:.01);
        return{nombre,extra,pols,sinNombre:/Territorio no asociado/.test(nombre)}});
      return MAPAS[t]=u}).catch(e=>{cargandoM[t]=null;throw e});
    return cargandoM[t];
  }
  function dentro(pols,lo,la){
    let c=false;
    for(const pol of pols)for(const r of pol){for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];
      if(((yi>la)!==(yj>la))&&(lo<(xj-xi)*(la-yi)/(yj-yi)+xi))c=!c}}
    return c;
  }
  function mapa(cont,op){
    op=op||{};const tipo=op.ambito==="can"?"can":"esp";
    if(!cont)return null;css();
    if(cont._anbGlobo)cont._anbGlobo.destruir();
    cont.innerHTML="";cont.classList.add("anbGlobo","anbMapa");
    const cv=document.createElement("canvas");cont.appendChild(cv);
    const ctl=document.createElement("div");ctl.className="anbGloboCtl";
    ctl.innerHTML='<button type="button" data-g="mas" title="Acercar">+</button><button type="button" data-g="menos" title="Alejar">−</button><button type="button" data-g="lugar" title="Ver todo el mapa">⌖</button>';
    cont.appendChild(ctl);
    const tit=document.createElement("div");tit.className="anbMapaTit";cont.appendChild(tit);
    const fu=document.createElement("div");fu.className="anbGloboFuente";
    const veg=tipo==="can"&&!!op.vegPot;
    fu.textContent=veg?"Veg. potencial y municipios: GRAFCAN":tipo==="can"?"Municipios: GRAFCAN · ANAMBRO":"Comunidades: IGN · Natural Earth · ANAMBRO";cont.appendChild(fu);
    // Vegetación potencial de Canarias (WMS de GRAFCAN, la misma capa que usa el visor): se pide una imagen de la vista
    const WMS="https://idecan2.grafcan.es/ServicioWMS/Vegetacion";
    let wms=null,tWms=0,vistaWms="";
    function pedirWms(){
      if(!veg||!M.W)return;
      const lo0=M.lon-(M.W/2)/(kx*M.k),lo1=M.lon+(M.W/2)/(kx*M.k),la0=M.lat-(M.H/2)/M.k,la1=M.lat+(M.H/2)/M.k;
      const w=Math.min(2048,Math.round(M.W*M.dpr)),h=Math.min(2048,Math.round(M.H*M.dpr)),clave=[lo0,la0,lo1,la1,w,h].map(v=>v.toFixed(4)).join();
      if(clave===vistaWms)return;vistaWms=clave;
      const img=new Image();
      img.onload=()=>{if(!vivo)return;wms={img,b:[lo0,la0,lo1,la1]};sucio=true};
      img.src=`${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=VPOT&STYLES=&SRS=EPSG:4326&BBOX=${lo0},${la0},${lo1},${la1}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png&TRANSPARENT=TRUE`;
    }
    const pideWms=()=>{if(!veg)return;clearTimeout(tWms);tWms=setTimeout(pedirWms,280)};
    if(veg){
      const lb=document.createElement("button");lb.type="button";lb.className="anbLeyBtn";lb.textContent="🌳 Leyenda";
      lb.addEventListener("pointerdown",ev=>ev.stopPropagation());
      lb.addEventListener("click",ev=>{ev.stopPropagation();let c=cont.querySelector(".anbLeyCaja");
        if(c){c.remove();return}
        c=document.createElement("div");c.className="anbLeyCaja";c.innerHTML=`<img alt="Leyenda de la vegetación potencial de Canarias (GRAFCAN)" src="${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=VPOT&FORMAT=image/png">`;
        ["pointerdown","wheel"].forEach(t=>c.addEventListener(t,e=>e.stopPropagation(),{passive:true}));cont.appendChild(c)});
      cont.appendChild(lb);
    }
    const ref=tipo==="can"?28.5:40;const kx=Math.cos(ref*RAD);
    const ext=tipo==="can"?[-18.25,27.55,-13.25,29.5]:[-10.4,33.35,4.5,44.0];// se puede reencuadrar (isla de la estación)
    const M={W:0,H:0,dpr:1,k:1,lon:(ext[0]+ext[2])/2,lat:(ext[1]+ext[3])/2,kFit:1,datos:null,sel:null};
    const pto=(isFinite(op.lat)&&isFinite(op.lon))?{lat:op.lat,lon:op.lon}:null;
    let vivo=true,raf=0,sucio=true;
    const medir=()=>{const W=Math.max(160,cont.clientWidth),H=Math.max(160,cont.clientHeight),dpr=Math.min(2,window.devicePixelRatio||1);
      if(W!==M.W||H!==M.H||dpr!==M.dpr){const prim=!M.W;M.W=W;M.H=H;M.dpr=dpr;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
        M.kFit=Math.min((W-20)/((ext[2]-ext[0])*kx),(H-20)/(ext[3]-ext[1]));if(prim)M.k=M.kFit;sucio=true}};
    // en el mapa de España, lo de Canarias se dibuja dentro del recuadro
    const desplaza=(lo,la)=>tipo==="esp"&&enCanarias(lo,la)?[lo+INS.dx,la+INS.dy]:[lo,la];
    const X=(lo,la)=>{[lo,la]=desplaza(lo,la);return[M.W/2+(lo-M.lon)*kx*M.k,M.H/2-(la-M.lat)*M.k]};
    function trazo(ctx,pols){ctx.beginPath();for(const pol of pols)for(const r of pol){r.forEach(([lo,la],i)=>{const [x,y]=X(lo,la);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}}
    function pinta(){
      const ctx=cv.getContext("2d"),W=M.W,H=M.H;ctx.setTransform(M.dpr,0,0,M.dpr,0,0);
      ctx.fillStyle="#a9cfe8";ctx.fillRect(0,0,W,H);
      // tierras del entorno (Portugal, Francia, África) en gris
      if(tipo==="esp"&&T_GRUESA){ctx.fillStyle="#e6e2d8";ctx.strokeStyle="rgba(120,110,90,.5)";ctx.lineWidth=.6;
        for(const pol of T_GRUESA){if(pol.y1<30||pol.y0>46)continue;ctx.beginPath();for(const r of pol){r.forEach(([lo,la],i)=>{const x=M.W/2+(lo-M.lon)*kx*M.k,y=M.H/2-(la-M.lat)*M.k;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fill("evenodd");ctx.stroke()}
        // recuadro de Canarias
        const [a,b]=[M.W/2+(INS.caja[0]-M.lon)*kx*M.k,M.H/2-(INS.caja[3]-M.lat)*M.k],[c,d]=[M.W/2+(INS.caja[2]-M.lon)*kx*M.k,M.H/2-(INS.caja[1]-M.lat)*M.k];
        ctx.fillStyle="#a9cfe8";ctx.fillRect(a,b,c-a,d-b);ctx.strokeStyle="#17324d";ctx.lineWidth=1.5;ctx.strokeRect(a,b,c-a,d-b);}
      if(veg&&M.datos){ // islas en claro, encima la vegetación potencial y encima los límites municipales
        for(const u of M.datos){trazo(ctx,u.pols);ctx.fillStyle="#f3ecd6";ctx.fill("evenodd")}
        if(wms){const [a,b]=X(wms.b[0],wms.b[3]),[c,d]=X(wms.b[2],wms.b[1]);ctx.drawImage(wms.img,a,b,c-a,d-b)}
        for(const u of M.datos){trazo(ctx,u.pols);ctx.strokeStyle="rgba(60,50,40,.55)";ctx.lineWidth=.6;ctx.stroke()}
        if(M.sel){trazo(ctx,M.sel.pols);ctx.strokeStyle="#1d2a36";ctx.lineWidth=2.4;ctx.stroke()}
      }
      else if(M.datos){
        for(const u of M.datos){trazo(ctx,u.pols);
          const sel=u===M.sel||(op.resaltar&&op.resaltar(u.nombre));
          ctx.fillStyle=sel?(op.colorForma||"#f6c453"):"#f3ecd6";ctx.fill("evenodd");
          ctx.strokeStyle=sel?"#7a4d00":"rgba(110,90,60,.75)";ctx.lineWidth=sel?2:(tipo==="can"?.7:1);ctx.stroke()}
        if(M.sel){trazo(ctx,M.sel.pols);ctx.strokeStyle="#7a4d00";ctx.lineWidth=2.2;ctx.stroke()}
      }
      if(pto){const [x,y]=X(pto.lon,pto.lat);
        ctx.beginPath();ctx.arc(x,y,7.5,0,7);ctx.fillStyle="#d62c1a";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#fff";ctx.stroke();
        if(op.nombre){ctx.font=`700 15px ${FUENTE}`;const t=op.nombre,w=ctx.measureText(t).width,lx=Math.min(W-w-14,Math.max(6,x-w/2-6)),ly=Math.max(6,y-40);
          ctx.fillStyle="rgba(255,255,255,.95)";ctx.beginPath();ctx.roundRect?ctx.roundRect(lx,ly,w+12,24,8):ctx.rect(lx,ly,w+12,24);ctx.fill();
          ctx.strokeStyle="rgba(23,50,77,.25)";ctx.lineWidth=1;ctx.stroke();ctx.fillStyle="#17324d";ctx.fillText(t,lx+6,ly+17)}}
    }
    let ultVista="";
    const bucle=()=>{if(!vivo)return;medir();if(sucio){pinta();sucio=false;const v=[M.lon,M.lat,M.k,M.W,M.H].join();if(v!==ultVista){ultVista=v;pideWms()}}raf=requestAnimationFrame(bucle)};
    const zoomA=(z,px,py)=>{const k2=Math.max(M.kFit*(veg?.18:.8),Math.min(M.kFit*(tipo==="can"?30:12),z));
      if(px!=null){const lo=M.lon+(px-M.W/2)/(kx*M.k),la=M.lat-(py-M.H/2)/M.k;M.lon=lo-(px-M.W/2)/(kx*k2);M.lat=la+(py-M.H/2)/k2}
      M.k=k2;sucio=true};
    const dedos=new Map();let base=null;
    cont.addEventListener("pointerdown",ev=>{if(ev.target.closest("button"))return;dedos.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
      try{cont.setPointerCapture(ev.pointerId)}catch(e){}cont.classList.add("arrastrando");base=null;ev.preventDefault()});
    cont.addEventListener("pointermove",ev=>{const d=dedos.get(ev.pointerId);if(!d)return;
      if(dedos.size===1){M.lon-=(ev.clientX-d.x)/(kx*M.k);M.lat+=(ev.clientY-d.y)/M.k;sucio=true}
      d.x=ev.clientX;d.y=ev.clientY;
      if(dedos.size===2){const [a,b]=[...dedos.values()],dist=Math.hypot(a.x-b.x,a.y-b.y);if(base)zoomA(base.k*dist/base.d);else base={d:dist,k:M.k}}});
    const soltar=ev=>{dedos.delete(ev.pointerId);base=null;if(!dedos.size)cont.classList.remove("arrastrando")};
    cont.addEventListener("pointerup",soltar);cont.addEventListener("pointercancel",soltar);
    cont.addEventListener("wheel",ev=>{ev.preventDefault();const r=cont.getBoundingClientRect(),z=r.width/cont.clientWidth||1;
      zoomA(M.k*(ev.deltaY<0?1.2:1/1.2),(ev.clientX-r.left)/z,(ev.clientY-r.top)/z)},{passive:false});
    ctl.addEventListener("click",ev=>{const b=ev.target.closest("button");if(!b)return;ev.stopPropagation();
      if(b.dataset.g==="mas")zoomA(M.k*1.4);else if(b.dataset.g==="menos")zoomA(M.k/1.4);
      else{M.k=M.kFit;M.lon=(ext[0]+ext[2])/2;M.lat=(ext[1]+ext[3])/2;sucio=true}});
    const ro=window.ResizeObserver?new ResizeObserver(()=>{sucio=true}):null;if(ro)ro.observe(cont);
    medir();
    Promise.all([cargarMapa(tipo),tipo==="esp"?cargar().catch(()=>null):null]).then(([d])=>{if(!vivo)return;M.datos=d;
      if(pto)M.sel=d.find(u=>!u.sinNombre&&dentro(u.pols,pto.lon,pto.lat))||null;
      if(veg&&M.sel){ // se encuadra la isla de la estación para que se lea la vegetación
        let a=180,b=90,c=-180,e2=-90;for(const u of d)if(u.extra===M.sel.extra)for(const pol of u.pols)for(const [x,y] of pol[0]){if(x<a)a=x;if(y<b)b=y;if(x>c)c=x;if(y>e2)e2=y}
        ext[0]=a-.04;ext[1]=b-.04;ext[2]=c+.04;ext[3]=e2+.04;
        M.kFit=Math.min((M.W-20)/((ext[2]-ext[0])*kx),(M.H-20)/(ext[3]-ext[1]));M.k=M.kFit;M.lon=(ext[0]+ext[2])/2;M.lat=(ext[1]+ext[3])/2}
      const res=op.resaltar?d.filter(u=>op.resaltar(u.nombre)).map(u=>u.nombre):[];
      const t=M.sel?(tipo==="can"?`${M.sel.nombre} · ${M.sel.extra}`:M.sel.nombre):res.join(", ");
      tit.textContent=t||"";tit.style.display=t?"":"none";sucio=true;
      if(veg&&pto){const d=.01,u=`${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=VPOT&QUERY_LAYERS=VPOT&STYLES=&SRS=EPSG:4326&BBOX=${pto.lon-d},${pto.lat-d},${pto.lon+d},${pto.lat+d}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=text/html`;
        fetch(u).then(r=>r.text()).then(h=>{const m=h.replace(/&oacute;/g,"ó").replace(/&aacute;/g,"á").replace(/&eacute;/g,"é").replace(/&iacute;/g,"í").replace(/&uacute;/g,"ú").replace(/&ntilde;/g,"ñ")
          .replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").match(/Vegetaci[oó]n Potencial:\s*(.+?)\s+Documentaci/i);
          if(m&&vivo){const v=m[1].trim().replace(/\.$/,"");tit.innerHTML="";const b=document.createElement("b");b.textContent="🌳 "+v;tit.append(b);
            if(t){const sm=document.createElement("div");sm.style.cssText="font-weight:600;font-size:13px;opacity:.8";sm.textContent=t;tit.append(sm)}tit.style.display="";if(op.alVeg)op.alVeg(v)}}).catch(()=>{})}
    }).catch(()=>{tit.textContent="No se pudo cargar el mapa";});
    raf=requestAnimationFrame(bucle);
    const api={destruir(){vivo=false;cancelAnimationFrame(raf);if(ro)ro.disconnect();cont._anbGlobo=null;cont.classList.remove("anbMapa")}};
    cont._anbGlobo=api;
    const vigila=setInterval(()=>{if(!cont.isConnected){api.destruir();clearInterval(vigila)}},2000);
    return api;
  }
  /* =====================================================================================
     Canarias: modelo de pisos de vegetación (perfil de una isla alta, sotavento a la izquierda y
     barlovento a la derecha) con la estación situada por su altitud y su orientación.
     La orientación se ha calculado con el MDT25 (IGN-CNIG) de ANAMBRO: orientación de la ladera en un
     entorno de 1,5 km (5 km si sale E u W, para ver la vertiente); NW, N, NE → barlovento; SE, S, SW → sotavento.
     ===================================================================================== */
  const ORIENT_CAN={"T55":[128,"S"],"AC419X":[237,"S"],"AC619X":[306,"B"],"AC317B":[29,"B"],"T61":[111,"S"],"AC248E":[104,"S"],"AC428T":[127,"S"],"T1":[139,"S"],"AC669B":[16,"B"],"T80":[51,"B"],"T70":[345,"B"],"AC438N":[124,"S"],"T74":[234,"S"],"AC126A":[238,"S"],"AC917E":[232,"S"],"W60035":[95,"S"],"T2":[187,"S"],"W60030":[103,"S"],"T12":[357,"B"],"T5":[245,"S"],"T75":[234,"S"],"T9":[122,"S"],"W60001":[61,"B"],"T64":[241,"S"],"W60010":[58,"B"],"AC628B":[246,"S"],"AC329B":[132,"S"],"AC258K":[200,"S"],"AC406G":[166,"S"],"W60005":[80,"B"],"W60040":[149,"S"],"AC658L":[40,"B"],"AC658X":[37,"B"],"T57":[341,"B"],"AC689E":[145,"S"],"AC639M":[164,"S"],"T67":[307,"B"],"T81":[133,"S"],"AC629X":[192,"S"],"AC629Q":[209,"S"],"T7":[305,"B"],"T65":[55,"B"],"T71":[355,"B"],"T77":[156,"S"],"T76":[245,"S"],"AC459Z":[338,"B"],"AC117A":[275,"B"],"T58":[353,"B"],"T10":[336,"B"],"T73":[344,"B"],"AC623I":[300,"B"],"AC625O":[245,"S"],"AC639U":[160,"S"],"AC635B":[163,"S"],"AC446G":[156,"S"],"T78":[158,"S"],"W60020":[115,"S"],"T69":[352,"B"],"AC458A":[306,"B"],"T66":[338,"B"],"AC129Z":[243,"S"],"T56":[344,"B"],"AC839I":[129,"S"],"AC612F":[218,"S"],"T11":[336,"B"],"AC648N":[66,"B"],"W60015":[59,"B"],"W60025":[161,"S"],"AC656V":[36,"B"],"AC117Z":[165,"S"],"T54":[99,"S"],"T62":[322,"B"],"AC018J":[170,"S"],"T63":[322,"B"],"AC611E":[300,"B"],"T68":[307,"B"],"T13":[179,"S"],"AC019V":[165,"S"],"ca_car_1":[128,"S"],"ca_car_2":[237,"S"],"ca_car_3":[104,"S"],"ca_car_4":[127,"S"],"ca_car_5":[139,"S"],"ca_car_6":[16,"B"],"ca_car_7":[124,"S"],"ca_car_8":[95,"S"],"ca_car_9":[187,"S"],"ca_car_10":[103,"S"],"ca_car_11":[245,"S"],"ca_car_12":[246,"S"],"ca_car_13":[132,"S"],"ca_car_14":[200,"S"],"ca_car_15":[80,"B"],"ca_car_16":[149,"S"],"ca_car_17":[40,"B"],"ca_car_18":[37,"B"],"ca_car_19":[164,"S"],"ca_car_20":[192,"S"],"ca_car_21":[338,"B"],"ca_car_22":[245,"S"],"ca_car_23":[160,"S"],"ca_car_24":[115,"S"],"ca_car_25":[336,"B"],"ca_car_26":[66,"B"],"ca_car_27":[161,"S"],"ca_car_28":[99,"S"],"ca_ter_1":[111,"S"],"ca_ter_2":[51,"B"],"ca_ter_3":[234,"S"],"ca_ter_4":[232,"S"],"ca_ter_5":[357,"B"],"ca_ter_6":[133,"S"],"ca_ter_7":[305,"B"],"ca_ter_8":[156,"S"],"ca_ter_9":[245,"S"],"ca_ter_10":[158,"S"],"ca_ter_11":[306,"B"],"ca_ter_12":[344,"B"],"ca_mon_1":[29,"B"],"ca_mon_2":[345,"B"],"ca_mon_3":[307,"B"],"ca_mon_4":[55,"B"],"ca_mon_5":[355,"B"],"ca_mon_6":[353,"B"],"ca_mon_7":[336,"B"],"ca_mon_8":[156,"S"],"ca_mon_9":[352,"B"],"ca_mon_10":[338,"B"],"ca_mon_11":[59,"B"],"ca_mon_12":[36,"B"],"ca_mon_13":[322,"B"],"ca_mon_14":[322,"B"],"ca_mon_15":[307,"B"],"ca_pin_1":[238,"S"],"ca_pin_2":[234,"S"],"ca_pin_3":[122,"S"],"ca_pin_4":[241,"S"],"ca_pin_5":[341,"B"],"ca_pin_6":[275,"B"],"ca_pin_7":[344,"B"],"ca_pin_8":[300,"B"],"ca_pin_9":[163,"S"],"ca_pin_10":[218,"S"],"ca_pin_11":[300,"B"],"ca_pin_12":[179,"S"],"ca_cum_1":[58,"B"],"ca_cum_2":[166,"S"]};
  const RUMBOS=["N","NE","E","SE","S","SW","W","NW"];
  const rumbo=a=>RUMBOS[Math.floor(((a+22.5)%360)/45)];
  // Límites de los pisos (m) [sotavento, barlovento], los del modelo de cliserie que usa Aarón en clase,
  // con el cinturón halófilo costero añadido en la orilla
  const PISOS=[
    {k:"hal",n:"Cinturón halófilo costero",c:"#7fc6b6",hasta:[50,50]},
    {k:"car",n:"Cardonal-tabaibal",c:"#f1d48c",hasta:[450,350]},
    {k:"ter",n:"Bosque termófilo",c:"#a3a865",hasta:[1050,700]},
    {k:"mon",n:"Monteverde",c:"#2f8f3e",hasta:[null,1450]},
    {k:"pin",n:"Pinar",c:"#9ad25a",hasta:[2000,2000]},
    {k:"cum",n:"Matorral de cumbre",c:"#c9786a",hasta:[9e9,9e9]}];
  function pisoModelo(z,lado){const i=lado==="B"?1:0;for(const p of PISOS){const h=p.hasta[i];if(h!=null&&z<h)return p}return PISOS[PISOS.length-1]}
  function orientacion(id){const o=ORIENT_CAN[id];return o?{asp:o[0],rumbo:rumbo(o[0]),lado:o[1]}:null}
  function modeloPisos(cont,op){
    if(!cont)return null;
    const o=orientacion(op.id),z=Math.max(0,+op.z||0);
    const W=560,H=400,base=352,top=40,ZMAX=2800,X0=70,X1=470,XC=270;
    const Y=a=>base-(Math.min(a,ZMAX)/ZMAX)*(base-top);
    const xL=a=>X0+(XC-X0)*Math.min(a,ZMAX)/ZMAX, xR=a=>X1-(X1-XC)*Math.min(a,ZMAX)/ZMAX;
    // franjas: polígono entre la línea inferior (sotavento aL1 → barlovento aR1) y la superior (aL2 → aR2)
    const banda=(aL1,aR1,aL2,aR2)=>`${xL(aL1)},${Y(aL1)} ${xR(aR1)},${Y(aR1)} `+
      (aR2>aR1?`${xR(aR2)},${Y(aR2)} `:"")+(aR2>=ZMAX&&aL2>=ZMAX?`${XC},${Y(ZMAX)} `:"")+`${xL(aL2)},${Y(aL2)}`+(aL1<aL2?"":"");
    const pol=(pts,c)=>`<polygon points="${pts}" fill="${c}" stroke="rgba(60,50,30,.55)" stroke-width="1.2"/>`;
    let g=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Modelo de pisos de vegetación de Canarias" style="width:100%;height:100%;display:block">`;
    g+=`<defs><linearGradient id="anbCielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#e9f6fd"/></linearGradient></defs>`;
    g+=`<rect width="${W}" height="${H}" fill="url(#anbCielo)"/><rect y="${base}" width="${W}" height="${H-base}" fill="#2f78b7"/>`;
    // pisos (de abajo arriba), con los límites de PISOS
    const L=k=>PISOS.find(p=>p.k===k).hasta;
    const [hS,hB]=L("hal"),[cS,cB]=L("car"),[tS,tB]=L("ter"),[,mB]=L("mon"),[pS,pB]=L("pin");
    g+=pol(`${X0},${base} ${X1},${base} ${xR(hB)},${Y(hB)} ${xL(hS)},${Y(hS)}`,PISOS[0].c);
    g+=pol(`${xL(hS)},${Y(hS)} ${xR(hB)},${Y(hB)} ${xR(cB)},${Y(cB)} ${xL(cS)},${Y(cS)}`,PISOS[1].c);
    g+=pol(`${xL(cS)},${Y(cS)} ${xR(cB)},${Y(cB)} ${xR(tB)},${Y(tB)} ${xL(tS)},${Y(tS)}`,PISOS[2].c);
    g+=pol(`${xL(tS)},${Y(tS)} ${xR(tB)},${Y(tB)} ${xR(mB)},${Y(mB)}`,PISOS[3].c);
    g+=pol(`${xL(tS)},${Y(tS)} ${xR(mB)},${Y(mB)} ${xR(pB)},${Y(pB)} ${xL(pS)},${Y(pS)}`,PISOS[4].c);
    g+=pol(`${xL(pS)},${Y(pS)} ${xR(pB)},${Y(pB)} ${XC},${Y(ZMAX)}`,PISOS[5].c);
    // mar de nubes en barlovento
    const nub=(cx,cy,s)=>`<g fill="#fff" stroke="#9fb3c4" stroke-width="1.2"><ellipse cx="${cx}" cy="${cy}" rx="${46*s}" ry="${17*s}"/><ellipse cx="${cx-30*s}" cy="${cy+4*s}" rx="${26*s}" ry="${13*s}"/><ellipse cx="${cx+32*s}" cy="${cy+4*s}" rx="${28*s}" ry="${13*s}"/><ellipse cx="${cx+4*s}" cy="${cy-10*s}" rx="${26*s}" ry="${14*s}"/></g>`;
    g+=nub(xR(1150)+20,Y(1150),.85)+nub(xR(1150)+78,Y(1080),.6);
    g+=`<text x="${xR(1150)+40}" y="${Y(1150)-22}" font-size="15" font-weight="700" fill="#24496b" text-anchor="middle">mar de nubes</text>`;
    // alisios
    g+=`<g stroke="#24496b" stroke-width="2.5" fill="#24496b"><line x1="${W-60}" y1="${Y(1950)}" x2="${xR(1950)+30}" y2="${Y(1950)}"/><polygon points="${xR(1950)+22},${Y(1950)} ${xR(1950)+34},${Y(1950)-6} ${xR(1950)+34},${Y(1950)+6}"/></g>`;
    g+=`<text x="${W-60}" y="${Y(1950)-8}" font-size="15" font-weight="700" fill="#24496b" text-anchor="end">alisios (NE)</text>`;
    // rótulos de los pisos
    const rot=(t,x,y,c="#1d2a36")=>`<text x="${x}" y="${y}" font-size="17" font-weight="700" fill="${c}" text-anchor="middle" stroke="rgba(255,255,255,.75)" stroke-width="3" paint-order="stroke">${t}</text>`;
    g+=rot("Cardonal-tabaibal",XC,Y(200));
    g+=rot("Bosque termófilo",XC-30,Y(660));
    g+=rot("Monteverde",xR(1050)-95,Y(1050)+6,"#fff").replace('stroke="rgba(255,255,255,.75)"','stroke="rgba(0,40,0,.55)"');
    g+=rot("Pinar",XC-30,Y(1650));
    g+=rot("Matorral de cumbre",XC,Y(2250)).replace('font-size="17"','font-size="14"');
    g+=`<text x="10" y="${top-18}" font-size="14" font-style="italic" fill="#24496b">Límites de altitud orientativos</text>`;
    g+=`<text x="${X0-2}" y="${base-8}" font-size="14" font-weight="700" fill="#0d5e50" text-anchor="end" stroke="#fff" stroke-width="3" paint-order="stroke">cinturón</text><text x="${X0-2}" y="${base+9}" font-size="14" font-weight="700" fill="#0d5e50" text-anchor="end" stroke="#fff" stroke-width="3" paint-order="stroke">halófilo</text>`;
    // laderas
    g+=`<text x="10" y="${base+32}" font-size="17" font-weight="800" fill="#fff">◀ Sotavento (S, SE, SW)</text>`;
    g+=`<text x="${W-10}" y="${base+32}" font-size="17" font-weight="800" fill="#fff" text-anchor="end">Barlovento (N, NE, NW) ▶</text>`;
    // eje de altitudes
    g+=`<g font-size="14" fill="#24496b">`;for(let a=0;a<=2700;a+=300){g+=`<line x1="${W-12}" x2="${W-4}" y1="${Y(a)}" y2="${Y(a)}" stroke="#24496b"/><text x="${W-15}" y="${Y(a)+5}" text-anchor="end">${a}</text>`}
    g+=`<text x="${W-4}" y="${top-18}" text-anchor="end" font-weight="700">Altitud (m)</text></g>`;
    // la estación
    let piso=null;
    if(o){piso=pisoModelo(z,o.lado);
      const x=o.lado==="B"?xR(z)-10:xL(z)+10,y=Y(z)-2;
      g+=`<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#d62c1a" stroke-width="3"/>`;
      g+=`<circle cx="${x}" cy="${y}" r="6.5" fill="#d62c1a" stroke="#fff" stroke-width="2.5"/>`;
      if(op.nombre){const izq=o.lado==="B",tx=izq?x-20:x+20,anc=izq?"end":"start";
        g+=`<text x="${tx}" y="${y-12}" font-size="17" font-weight="800" fill="#1d2a36" text-anchor="${anc}" stroke="#fff" stroke-width="4" paint-order="stroke">${op.nombre.replace(/[<&>]/g,"").replace(/ \(.*\)$/,"")}</text>`;
        g+=`<text x="${tx}" y="${y+8}" font-size="15" font-weight="700" fill="#1d2a36" text-anchor="${anc}" stroke="#fff" stroke-width="4" paint-order="stroke">${Math.round(z)} m · ladera ${o.rumbo}</text>`}
    }
    g+="</svg>";
    cont.innerHTML=`<div class="anbModelo">${g}</div>`+(o?`<div class="anbModeloTxt">En el modelo: <b>${o.lado==="B"?"barlovento":"sotavento"}</b> (ladera orientada al ${o.rumbo}) a ${Math.round(z)} m → <b>${piso.n.toLowerCase()}</b> <span style="font-weight:400;opacity:.8">(límites orientativos)</span></div>`:`<div class="anbModeloTxt">Sin orientación calculada para esta estación.</div>`);
    return o?{lado:o.lado,rumbo:o.rumbo,piso:piso.n}:null;
  }

  // Elige la escala: Canarias → mapa de Canarias; España → mapa de España; el resto → globo
  function lugar(cont,op){
    if(op.ambito==="can"||op.ambito==="esp")return mapa(cont,op);
    return globo(cont,op);
  }
  window.AnbGlobo={globo,mapa,lugar,centro,modeloPisos,orientacion,precargar:()=>cargar().catch(()=>null)};
})();
