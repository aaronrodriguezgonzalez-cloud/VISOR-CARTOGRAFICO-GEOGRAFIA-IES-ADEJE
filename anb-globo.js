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
  const ORIENT_CAN={"T55":[128,"S","TF"],"AC419X":[237,"S","TF"],"AC619X":[306,"B","GC"],"AC317B":[29,"B","LG"],"T61":[111,"S","TF"],"AC248E":[104,"S","FV"],"AC428T":[127,"S","TF"],"T1":[139,"S","TF"],"AC669B":[16,"B","GC"],"T80":[51,"S","TF"],"T70":[345,"B","TF"],"AC438N":[124,"S","TF"],"T74":[234,"S","TF"],"AC126A":[238,"S","LP"],"AC917E":[232,"S","EH"],"W60035":[95,"S","FV"],"T2":[187,"S","TF"],"W60030":[103,"S","GC"],"T12":[357,"B","TF"],"T5":[245,"S","TF"],"T75":[234,"S","TF"],"T9":[122,"S","TF"],"W60001":[61,"B","EH"],"T64":[241,"S","TF"],"W60010":[58,"S","TF"],"AC628B":[246,"S","GC"],"AC329B":[132,"S","LG"],"AC258K":[200,"S","FV"],"AC406G":[166,"S","TF"],"W60005":[80,"B","LP"],"W60040":[149,"S","LZ"],"AC658L":[40,"B","GC"],"AC658X":[37,"B","GC"],"T57":[341,"B","TF"],"AC689E":[145,"S","GC"],"AC639M":[164,"S","GC"],"T67":[307,"B","TF"],"T81":[133,"S","TF"],"AC629X":[192,"S","GC"],"AC629Q":[209,"S","GC"],"T7":[305,"B","TF"],"T65":[55,"B","TF"],"T71":[355,"B","TF"],"T77":[156,"S","TF"],"T76":[245,"S","TF"],"AC459Z":[338,"B","TF"],"AC117A":[275,"B","LP"],"T58":[353,"B","TF"],"T10":[336,"B","TF"],"T73":[344,"B","TF"],"AC623I":[300,"S","GC"],"AC625O":[245,"S","GC"],"AC639U":[160,"S","GC"],"AC635B":[163,"S","GC"],"AC446G":[156,"S","TF"],"T78":[158,"S","TF"],"W60020":[115,"S","TF"],"T69":[352,"B","TF"],"AC458A":[306,"B","TF"],"T66":[338,"B","TF"],"AC129Z":[243,"S","LP"],"T56":[344,"B","TF"],"AC839I":[129,"S","LZ"],"AC612F":[218,"B","GC"],"T11":[336,"B","TF"],"AC648N":[66,"B","GC"],"W60015":[59,"B","TF"],"W60025":[161,"S","TF"],"AC656V":[36,"B","GC"],"AC117Z":[165,"S","LP"],"T54":[99,"S","TF"],"T62":[322,"B","TF"],"AC018J":[170,"S","LZ"],"T63":[322,"B","TF"],"AC611E":[300,"S","GC"],"T68":[307,"B","TF"],"T13":[179,"S","TF"],"AC019V":[165,"S","LZ"],"ca_car_1":[128,"S","TF"],"ca_car_2":[237,"S","TF"],"ca_car_3":[104,"S","FV"],"ca_car_4":[127,"S","TF"],"ca_car_5":[139,"S","TF"],"ca_car_6":[16,"B","GC"],"ca_car_7":[124,"S","TF"],"ca_car_8":[95,"S","FV"],"ca_car_9":[187,"S","TF"],"ca_car_10":[103,"S","GC"],"ca_car_11":[245,"S","TF"],"ca_car_12":[246,"S","GC"],"ca_car_13":[132,"S","LG"],"ca_car_14":[200,"S","FV"],"ca_car_15":[80,"B","LP"],"ca_car_16":[149,"S","LZ"],"ca_car_17":[40,"B","GC"],"ca_car_18":[37,"B","GC"],"ca_car_19":[164,"S","GC"],"ca_car_20":[192,"S","GC"],"ca_car_21":[338,"B","TF"],"ca_car_22":[245,"S","GC"],"ca_car_23":[160,"S","GC"],"ca_car_24":[115,"S","TF"],"ca_car_25":[336,"B","TF"],"ca_car_26":[66,"B","GC"],"ca_car_27":[161,"S","TF"],"ca_car_28":[99,"S","TF"],"ca_ter_1":[111,"S","TF"],"ca_ter_2":[51,"S","TF"],"ca_ter_3":[234,"S","TF"],"ca_ter_4":[232,"S","EH"],"ca_ter_5":[357,"B","TF"],"ca_ter_6":[133,"S","TF"],"ca_ter_7":[305,"B","TF"],"ca_ter_8":[156,"S","TF"],"ca_ter_9":[245,"S","TF"],"ca_ter_10":[158,"S","TF"],"ca_ter_11":[306,"B","TF"],"ca_ter_12":[344,"B","TF"],"ca_mon_1":[29,"B","LG"],"ca_mon_2":[345,"B","TF"],"ca_mon_3":[307,"B","TF"],"ca_mon_4":[55,"B","TF"],"ca_mon_5":[355,"B","TF"],"ca_mon_6":[353,"B","TF"],"ca_mon_7":[336,"B","TF"],"ca_mon_8":[156,"S","TF"],"ca_mon_9":[352,"B","TF"],"ca_mon_10":[338,"B","TF"],"ca_mon_11":[59,"B","TF"],"ca_mon_12":[36,"B","GC"],"ca_mon_13":[322,"B","TF"],"ca_mon_14":[322,"B","TF"],"ca_mon_15":[307,"B","TF"],"ca_pin_1":[238,"S","LP"],"ca_pin_2":[234,"S","TF"],"ca_pin_3":[122,"S","TF"],"ca_pin_4":[241,"S","TF"],"ca_pin_5":[341,"B","TF"],"ca_pin_6":[275,"B","LP"],"ca_pin_7":[344,"B","TF"],"ca_pin_8":[300,"S","GC"],"ca_pin_9":[163,"S","GC"],"ca_pin_10":[218,"B","GC"],"ca_pin_11":[300,"S","GC"],"ca_pin_12":[179,"S","TF"],"ca_cum_1":[58,"S","TF"],"ca_cum_2":[166,"S","TF"]};
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
  // Pisos que existen en cada vertiente de cada isla (Mapa de Vegetación de Canarias, GRAFCAN; del Arco et al., 2006).
  // Si un piso falta, el siguiente ocupa su franja de altitud (p. ej., en La Gomera el monteverde llega a la cumbre).
  const PISOS_ISLA={
    TF:{B:["hal","car","ter","mon","pin","cum"],S:["hal","car","ter","pin","cum"]},
    LP:{B:["hal","car","ter","mon","pin","cum"],S:["hal","car","ter","pin","cum"]},
    GC:{B:["hal","car","ter","mon","pin"],S:["hal","car","ter","pin"]},
    LG:{B:["hal","car","ter","mon"],S:["hal","car","ter","mon"]},
    EH:{B:["hal","car","ter","mon"],S:["hal","car","ter","pin"]},
    FV:{B:["hal","car","ter"],S:["hal","car","ter"]},
    LZ:{B:["hal","car","ter"],S:["hal","car","ter"]}};
  // franjas [piso, desde, hasta] de una vertiente de una isla
  function franjas(isla,lado){const i=lado==="B"?1:0,L=(PISOS_ISLA[isla]||PISOS_ISLA.TF)[lado];let lo=0;const out=[];
    const pres=PISOS.filter(p=>L.includes(p.k));
    pres.forEach((p,n)=>{let hi=n===pres.length-1?9e9:null;
      if(hi==null){// el límite superior es el del último piso (presente o ausente) antes del siguiente presente
        const sig=pres[n+1],j=PISOS.indexOf(sig);for(let q=j-1;q>=0;q--){const h=PISOS[q].hasta[i];if(h!=null){hi=h;break}}}
      if(hi>lo)out.push([p,lo,hi]);lo=Math.max(lo,hi)});
    return out}
  function pisoModelo(z,lado,isla){const F=franjasH(isla||"TF",lado);for(const [p,lo,hi] of F)if(z<hi)return p;return F[F.length-1][0]}
  function orientacion(id){const o=ORIENT_CAN[id];return o?{asp:o[0],rumbo:rumbo(o[0]),lado:o[1],isla:o[2]}:null}
  // Cada isla con su cliserie: el perfil llega a su cumbre y solo tiene los pisos que caben en esa altura
  const ISLAS={TF:{n:"Tenerife",c:"Teide",z:3715},GC:{n:"Gran Canaria",c:"Pico de las Nieves",z:1949},LP:{n:"La Palma",c:"Roque de los Muchachos",z:2423},
    LG:{n:"La Gomera",c:"Garajonay",z:1487},EH:{n:"El Hierro",c:"Malpaso",z:1501},FV:{n:"Fuerteventura",c:"Pico de la Zarza",z:807},LZ:{n:"Lanzarote",c:"Peñas del Chache",z:670}};
  // Perfil real de cada isla (MDT25 IGN-CNIG): km² de cada vertiente por franja de altitud (ZM/48), pisos de vegetación potencial
  // de cada vertiente con su % de superficie (Mapa de Vegetación de Canarias, GRAFCAN; muestreo de ~7.000 puntos) y lo que queda hoy de cada piso.
  const PERFIL={"TF":{"km":49.6,"az":340,"z":[0,163,136,91,73,82,104,116,124,141,156,175,204,252,285,313,348,395,418,434,494,593,637,641,636,655,730,770,776,788,820,859,913,972,1013,1056,1108,1175,1253,1331,1393,1436,1497,1561,1630,1680,1708,1728,1755,1795,1852,1923,1997,2075,2182,2292,2371,2452,2546,2626,2678,2706,2711,2677,2594,2537,2480,2383,2337,2343,2378,2434,2517,2623,2728,2865,3056,3264,3447,3581,3674,3706,3692,3614,3455,3286,3136,2982,2808,2603,2413,2266,2133,2040,1970,1903,1833,1781,1743,1704,1660,1607,1547,1500,1465,1441,1412,1383,1348,1338,1339,1331,1296,1229,1165,1129,1111,1078,1031,1001,1004,1016,1020,1016,998,965,919,863,822,807,803,777,714,661,609,512,399,286,140,0]},"LP":{"km":27.2,"az":85,"z":[0,349,407,460,530,595,631,660,695,730,754,777,794,822,862,897,929,965,1002,1025,1050,1084,1126,1160,1188,1217,1254,1295,1331,1374,1435,1490,1528,1569,1615,1659,1695,1730,1774,1824,1878,1930,1973,2009,2044,2080,2111,2137,2167,2210,2256,2292,2308,2321,2335,2356,2371,2386,2399,2417,2424,2420,2408,2392,2375,2363,2350,2345,2343,2335,2317,2307,2310,2316,2325,2342,2348,2341,2322,2311,2308,2311,2317,2319,2315,2291,2235,2166,2104,2051,1999,1945,1896,1862,1830,1795,1752,1714,1679,1646,1612,1573,1528,1477,1433,1393,1358,1331,1299,1258,1218,1175,1136,1107,1070,1019,953,893,848,814,788,763,743,726,720,708,672,619,568,515,464,440,422,387,347,310,248,170,112,0]},"GC":{"km":54.0,"az":35,"z":[0,137,187,219,249,284,317,347,385,433,489,535,566,591,611,644,699,749,810,864,884,892,912,942,974,987,1001,1033,1074,1138,1194,1222,1276,1373,1415,1412,1393,1387,1413,1457,1491,1513,1532,1558,1569,1560,1516,1451,1432,1457,1509,1532,1534,1549,1598,1639,1669,1715,1772,1812,1852,1897,1923,1943,1952,1951,1942,1922,1890,1846,1809,1790,1773,1754,1715,1674,1641,1581,1513,1458,1385,1303,1245,1188,1140,1105,1072,1035,998,958,939,939,949,961,965,960,921,832,753,694,654,623,599,563,530,503,475,442,415,407,406,392,351,306,291,290,288,274,237,205,183,150,120,99,80,58,31,17,18,38,78,122,168,210,232,238,241,240,225,0]},"LG":{"km":21.4,"az":10,"z":[0,210,244,270,283,288,299,320,342,364,390,425,457,485,509,535,561,582,599,618,656,714,776,800,802,798,796,811,837,861,882,900,917,939,960,975,996,1020,1041,1062,1070,1073,1079,1094,1120,1154,1194,1229,1251,1269,1290,1317,1342,1354,1364,1382,1396,1402,1414,1444,1468,1477,1482,1484,1482,1475,1455,1426,1400,1382,1363,1359,1361,1358,1347,1331,1321,1308,1280,1256,1247,1244,1235,1206,1170,1142,1123,1108,1090,1073,1062,1055,1048,1053,1059,1059,1053,1040,1036,1036,1036,1035,1030,1011,980,957,945,934,913,896,892,894,895,893,890,890,891,891,886,875,869,857,823,788,776,773,761,734,708,686,665,641,608,575,540,490,426,365,298,0]},"EH":{"km":23.8,"az":5,"z":[0,53,83,118,161,188,197,212,234,244,246,252,268,283,293,311,338,368,394,425,451,466,482,493,501,518,541,568,601,642,703,753,769,770,773,788,819,858,911,964,993,999,1001,1013,1046,1094,1166,1227,1247,1257,1292,1352,1412,1453,1473,1486,1494,1496,1492,1468,1425,1392,1371,1366,1368,1371,1372,1368,1362,1364,1369,1370,1368,1362,1351,1339,1338,1340,1340,1337,1327,1301,1263,1242,1238,1237,1233,1232,1228,1215,1195,1178,1161,1138,1114,1098,1095,1100,1108,1115,1123,1128,1132,1135,1136,1132,1121,1105,1080,1047,1009,973,939,900,857,821,787,770,763,753,726,690,656,611,578,568,558,535,498,444,401,375,363,357,346,314,255,197,160,0]},"FV":{"km":40.8,"az":300,"z":[0,202,230,269,290,310,343,383,418,438,456,464,463,456,448,435,411,378,369,380,391,402,413,436,466,487,493,479,441,413,412,424,430,428,423,420,419,416,414,426,454,476,497,528,554,581,594,595,579,534,493,490,496,502,512,530,552,561,563,572,594,606,622,660,697,710,709,701,690,689,690,690,690,690,692,701,717,724,723,708,679,667,666,662,645,607,566,538,520,526,556,584,615,658,704,750,789,807,809,793,738,657,582,552,581,634,671,682,668,635,617,597,547,480,435,420,406,378,358,365,417,443,438,408,359,330,310,292,263,210,174,182,191,182,148,101,74,57,38,0]},"LZ":{"km":24.0,"az":320,"z":[0,13,16,24,38,45,48,53,55,58,66,76,82,86,94,107,136,187,223,232,231,226,225,227,243,281,311,319,313,293,282,305,319,320,322,325,328,328,323,322,349,393,428,441,450,484,542,580,589,584,567,553,557,560,554,536,517,510,531,548,553,564,585,598,600,591,574,578,595,605,607,611,623,644,665,672,672,664,648,635,629,616,600,595,595,591,568,529,516,527,542,560,586,599,603,604,599,575,533,505,495,480,455,442,440,448,462,475,480,480,470,441,412,394,388,381,370,359,334,292,245,217,202,179,154,144,134,118,107,100,92,84,77,70,65,60,54,46,37,0]}};
  const HIPSO={"TF":{"lados":{"S":{"km2":[118.65,106.55,93.63,83.46,75.86,69.93,65.2,59.74,52.06,44.36,38.98,35.96,34.45,33.41,32.5,31.66,30.4,28.44,26.2,24.48,23.34,22.02,20.17,18.47,18.1,19.59,21.61,21.94,19.76,15.43,10.31,6.16,3.67,2.46,1.87,1.51,1.27,1.16,1.08,0.9,0.66,0.45,0.34,0.28,0.23,0.17,0.09,0.04],"pisos":[["hal",0,4,0.5],["car",4,513,44.2],["ter",513,959,20.3],["pin",959,2094,28.4],["cum",2094,3715,6.6]],"area":1319.0},"B":{"km2":[33.47,32.78,32.14,32.19,33.2,35.03,37.53,39.55,38.84,34.89,30.14,26.66,24.46,22.84,21.15,19.17,17.37,16.1,14.97,13.62,12.29,11.15,10.21,9.55,9.73,11.72,15.43,18.36,17.87,13.97,8.96,5.12,3.02,2.09,1.72,1.55,1.42,1.34,1.3,1.25,1.15,1.02,0.85,0.66,0.47,0.3,0.17,0.09],"pisos":[["hal",0,5,0.4],["car",5,134,7.7],["ter",134,402,15.4],["mon",402,1153,42.4],["pin",1153,2103,22.7],["cum",2103,3715,11.3]],"area":718.9}},"isla":{"hal":0.5,"car":30.6,"ter":18.2,"mon":16.8,"pin":25.8,"cum":8.2},"km2":{"hal":8.9,"car":593.4,"ter":352.6,"mon":324.8,"pin":500.9,"cum":158.3},"queda":{"hal":{"q":46},"car":{"q":33},"ter":{"q":4},"mon":{"q":30,"lau":6,"fb":24},"pin":{"q":52},"cum":{"q":96}}},"LP":{"lados":{"S":{"km2":[8.91,7.54,6.51,6.55,7.62,9.04,9.97,10.16,9.88,9.42,8.99,8.7,8.64,8.78,9.04,9.38,9.62,9.49,9.04,8.57,8.23,8.0,7.77,7.4,6.8,6.09,5.4,4.78,4.23,3.75,3.37,3.02,2.73,2.52,2.34,2.11,1.78,1.44,1.19,1.07,0.99,0.9,0.83,0.77,0.68,0.52,0.32,0.18],"pisos":[["hal",0,24,1.8],["car",24,143,6.4],["ter",143,564,28.1],["pin",564,2423,63.7]],"area":265.0},"B":{"km2":[9.75,10.2,11.15,12.45,13.9,15.32,16.41,16.94,16.95,16.63,16.19,15.79,15.46,15.1,14.61,14.05,13.64,13.53,13.45,13.09,12.52,11.84,11.03,10.25,9.64,9.14,8.59,7.99,7.42,6.9,6.43,6.06,5.75,5.42,5.07,4.72,4.34,3.94,3.56,3.24,3.0,2.8,2.54,2.15,1.61,1.01,0.51,0.22],"pisos":[["hal",0,11,0.6],["car",11,176,7.6],["ter",176,397,15.3],["mon",397,1060,43.7],["pin",1060,2423,32.8]],"area":442.3}},"isla":{"hal":1.0,"car":6.9,"ter":19.1,"mon":28.3,"pin":42.1,"cum":2.4},"km2":{"hal":6.5,"car":46.1,"ter":126.9,"mon":188.0,"pin":279.5,"cum":16.2},"queda":{"hal":{"q":72},"car":{"q":32},"ter":{"q":3},"mon":{"q":59,"lau":18,"fb":41},"pin":{"q":81},"cum":{"q":93}}},"GC":{"lados":{"S":{"km2":[61.88,56.77,49.73,43.7,40.27,38.78,37.93,36.89,35.55,34.05,32.7,31.8,31.2,30.37,28.76,26.51,24.32,22.65,21.55,20.76,20.42,20.79,21.27,20.74,19.15,17.47,16.18,14.97,13.61,11.95,10.07,8.26,6.74,5.51,4.51,3.75,3.23,2.93,2.79,2.75,2.78,2.69,2.32,1.78,1.29,0.91,0.6,0.35],"pisos":[["hal",0,5,0.7],["car",5,631,63.4],["ter",631,828,11.4],["pin",828,1949,24.5]],"area":946.0},"B":{"km2":[39.31,37.4,36.11,35.48,34.2,31.26,27.19,23.58,21.39,20.43,20.06,19.67,18.91,17.96,17.08,16.31,15.57,14.83,13.93,12.84,11.9,11.27,10.77,10.39,10.15,9.9,9.47,8.94,8.36,7.63,6.69,5.7,4.85,4.21,3.78,3.49,3.27,3.05,2.72,2.2,1.62,1.12,0.75,0.49,0.31,0.17,0.08,0.03],"pisos":[["hal",0,6,1.7],["car",6,290,38.3],["ter",290,544,20.5],["mon",544,1168,30.8],["pin",1168,1949,8.7]],"area":616.8}},"isla":{"hal":1.1,"car":53.3,"ter":15.0,"mon":12.5,"pin":18.2},"km2":{"hal":16.9,"car":823.2,"ter":231.3,"mon":193.4,"pin":280.7},"queda":{"hal":{"q":21},"car":{"q":27},"ter":{"q":10},"mon":{"q":1,"lau":1,"fb":0},"pin":{"q":32}}},"LG":{"lados":{"S":{"km2":[4.96,5.13,5.71,6.55,7.33,7.92,8.25,8.3,8.14,7.96,7.88,7.86,7.8,7.66,7.44,7.2,7.0,6.85,6.77,6.67,6.47,6.17,5.83,5.5,5.25,5.06,4.91,4.81,4.76,4.71,4.6,4.43,4.15,3.67,3.09,2.54,2.09,1.79,1.63,1.63,1.67,1.59,1.33,0.97,0.62,0.35,0.19,0.11],"pisos":[["hal",0,4,0.5],["car",4,465,46.3],["ter",465,934,38.0],["mon",934,1487,15.3]],"area":233.3},"B":{"km2":[2.6,2.56,2.72,3.05,3.44,3.81,4.1,4.27,4.35,4.43,4.53,4.6,4.58,4.48,4.39,4.36,4.42,4.52,4.6,4.56,4.38,4.09,3.77,3.45,3.13,2.88,2.76,2.73,2.73,2.75,2.8,2.83,2.73,2.46,2.16,1.91,1.68,1.44,1.2,0.97,0.76,0.56,0.39,0.24,0.14,0.06,0.03,0.01],"pisos":[["hal",0,15,1.3],["car",15,210,14.3],["ter",210,575,38.7],["mon",575,1487,45.6]],"area":135.4}},"isla":{"hal":0.8,"car":33.5,"ter":37.6,"mon":26.3,"pin":1.8},"km2":{"hal":2.9,"car":121.2,"ter":135.8,"mon":95.1,"pin":6.5},"queda":{"hal":{"q":81},"car":{"q":26},"ter":{"q":33},"mon":{"q":73,"lau":27,"fb":46},"pin":{"q":0}}},"EH":{"lados":{"S":{"km2":[3.95,3.67,3.55,3.62,3.74,3.75,3.6,3.39,3.24,3.13,3.04,3.03,3.1,3.19,3.15,2.99,2.83,2.74,2.72,2.72,2.7,2.71,2.78,2.86,2.86,2.82,2.86,2.99,3.14,3.19,3.12,3.08,3.12,3.15,3.09,2.99,2.86,2.65,2.44,2.29,2.13,1.85,1.45,1.01,0.63,0.37,0.22,0.13],"pisos":[["hal",0,116,10.3],["car",116,340,19.0],["ter",340,886,38.4],["pin",886,1208,24.0],["mon",1208,1501,8.3]],"area":130.6},"B":{"km2":[5.78,5.72,5.33,4.83,4.41,4.13,4.06,4.18,4.29,4.25,4.13,3.99,3.87,3.78,3.75,3.74,3.71,3.64,3.53,3.42,3.33,3.24,3.11,2.96,2.8,2.65,2.55,2.51,2.55,2.63,2.71,2.81,2.9,2.82,2.47,1.97,1.58,1.36,1.23,1.09,0.97,0.86,0.74,0.59,0.42,0.26,0.17,0.12],"pisos":[["hal",0,29,3.5],["car",29,165,16.6],["ter",165,624,41.2],["mon",624,1501,38.8]],"area":138.0}},"isla":{"hal":6.8,"car":17.7,"ter":39.8,"mon":24.1,"pin":11.5},"km2":{"hal":16.6,"car":43.6,"ter":97.9,"mon":59.4,"pin":28.3},"queda":{"hal":{"q":97},"car":{"q":21},"ter":{"q":33},"mon":{"q":39,"lau":11,"fb":28},"pin":{"q":50}}},"FV":{"lados":{"S":{"km2":[77.75,84.62,91.68,96.42,98.57,98.5,96.65,94.21,92.5,90.55,86.5,80.2,72.45,64.11,55.97,49.42,45.06,41.36,36.91,31.71,26.66,22.44,19.03,16.1,13.53,11.4,9.77,8.59,7.53,6.38,5.3,4.43,3.76,3.19,2.63,2.07,1.57,1.16,0.86,0.61,0.42,0.28,0.19,0.13,0.08,0.05,0.03,0.02],"pisos":[["hal",0,25,7.1],["car",25,465,90.4],["ter",465,807,2.6]],"area":1653.3},"B":{"km2":[77.75,84.62,91.68,96.42,98.57,98.5,96.65,94.21,92.5,90.55,86.5,80.2,72.45,64.11,55.97,49.42,45.06,41.36,36.91,31.71,26.66,22.44,19.03,16.1,13.53,11.4,9.77,8.59,7.53,6.38,5.3,4.43,3.76,3.19,2.63,2.07,1.57,1.16,0.86,0.61,0.42,0.28,0.19,0.13,0.08,0.05,0.03,0.02],"pisos":[["hal",0,25,7.1],["car",25,465,90.4],["ter",465,807,2.6]],"area":1653.3}},"isla":{"hal":7.1,"car":90.4,"ter":2.6},"km2":{"hal":114.7,"car":1469.8,"ter":42.0},"queda":{"hal":{"q":70},"car":{"q":6},"ter":{"q":8}}},"LZ":{"lados":{"S":{"km2":[49.93,54.07,54.5,49.62,42.79,37.66,34.59,32.14,29.8,28.18,27.41,26.93,26.83,27.04,26.59,25.29,23.93,22.93,22.45,22.74,23.73,24.66,24.12,21.3,17.1,13.2,10.28,8.23,6.77,5.73,4.9,4.08,3.29,2.65,2.16,1.78,1.52,1.37,1.24,1.1,0.98,0.84,0.65,0.47,0.34,0.22,0.12,0.06],"pisos":[["hal",0,48,22.4],["car",48,441,75.3],["ter",441,670,2.3]],"area":848.3},"B":{"km2":[49.93,54.07,54.5,49.62,42.79,37.66,34.59,32.14,29.8,28.18,27.41,26.93,26.83,27.04,26.59,25.29,23.93,22.93,22.45,22.74,23.73,24.66,24.12,21.3,17.1,13.2,10.28,8.23,6.77,5.73,4.9,4.08,3.29,2.65,2.16,1.78,1.52,1.37,1.24,1.1,0.98,0.84,0.65,0.47,0.34,0.22,0.12,0.06],"pisos":[["hal",0,48,22.4],["car",48,441,75.3],["ter",441,670,2.3]],"area":848.3}},"isla":{"hal":22.4,"car":75.3,"ter":2.3},"km2":{"hal":154.0,"car":516.8,"ter":16.0},"queda":{"hal":{"q":29},"car":{"q":5},"ter":{"q":0}}}};
  const QUEDA_ARCH={"hal":{"q":49},"car":{"q":16},"ter":{"q":12},"mon":{"q":35,"lau":10,"fb":25},"pin":{"q":54},"cum":{"q":96}};
  function cssTabla(){if(document.getElementById("anbModeloCSS"))return;const st=document.createElement("style");st.id="anbModeloCSS";st.textContent=".anbModeloTab{width:100%;border-collapse:collapse;font:14px/1.3 system-ui,sans-serif;color:inherit}.anbModeloTab th{text-align:left;font-weight:800;border-bottom:1px solid #8aa5;padding:3px 5px}.anbModeloTab td{padding:3px 5px;border-bottom:1px solid #8aa3;vertical-align:middle}.anbModeloTab td.n,.anbModeloTab th.n{text-align:center}.anbModeloTab i.c{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:6px;vertical-align:-1px}.anbModeloTab small{font-size:14px;opacity:.85}.anbQ{display:inline-block;width:64px;height:10px;border-radius:5px;background:#c0392b66;margin-right:6px;vertical-align:middle;overflow:hidden}.anbQ span{display:block;height:100%;background:#2e8b57}.anbModeloNota{font-size:14px;opacity:.8;margin-top:4px}";document.head.appendChild(st)}
  // tabla de una isla: superficie potencial de cada piso y lo que queda hoy
  function tablaHTML(ik){cssTabla();const HI=HIPSO[ik]||HIPSO.TF,FS=franjasH(ik,"S"),FB=franjasH(ik,"B");
    const ord=["hal","car","ter","mon","pin","cum"].filter(k=>FS.some(f=>f[0].k===k)||FB.some(f=>f[0].k===k));
    const fila=k=>{const p=PISOS.find(p=>p.k===k),q=HI.queda[k],pc=HI.isla[k];if(pc==null)return"";
      const qq=q?(k==="mon"&&q.lau!=null?`<b>${q.q} %</b> <small>(laurisilva ${q.lau} % · fayal-brezal ${q.fb} %)</small>`:`<b>${q.q} %</b>`):"—";
      const pcs=pc<1?String(pc).replace(".",","):Math.round(pc);return `<tr><td><i class="c" style="background:${p.c}"></i>${p.n}</td><td class="n">${pcs} %</td><td><span class="anbQ"><span style="width:${q?q.q:0}%"></span></span>${qq}</td></tr>`};
    return `<table class="anbModeloTab"><thead><tr><th>Piso de vegetación (${(ISLAS[ik]||ISLAS.TF).n})</th><th class="n">% de la isla</th><th>Cuánto queda hoy del piso</th></tr></thead><tbody>${ord.map(fila).join("")}</tbody></table><div class="anbModeloNota">«% de la isla»: superficie de su vegetación potencial. «Cuánto queda hoy»: parte de ese espacio que conserva su vegetación (en verde); el resto es hoy espacio urbano y agrícola, matorral de sustitución o plantaciones. Mapa de Vegetación de Canarias (GRAFCAN): un punto por km² en el interior y uno cada 300 m en el primer kilómetro desde la costa; valores aproximados.</div>`}
  // tabla de todas las islas: cuánto queda hoy de cada piso
  function tablaQueda(){cssTabla();const IS=["TF","GC","LP","LG","EH","FV","LZ"],ab={TF:"TF",GC:"GC",LP:"LP",LG:"LG",EH:"EH",FV:"FV",LZ:"LZ"};
    const celda=(q)=>q?`${q.q} %`:"—";
    const filas=["hal","car","ter","mon","pin","cum"].map(k=>{const p=PISOS.find(p=>p.k===k),qa=QUEDA_ARCH[k];
      return `<tr><td><i class="c" style="background:${p.c}"></i>${p.n}</td>${IS.map(i=>{const H=HIPSO[i];const tiene=H&&(H.lados.S.pisos.some(f=>f[0]===k)||H.lados.B.pisos.some(f=>f[0]===k));return `<td class="n">${tiene?celda(H.queda[k]):"·"}</td>`}).join("")}<td class="n"><span class="anbQ"><span style="width:${qa?qa.q:0}%"></span></span><b>${qa?qa.q+" %":"—"}</b>${k==="mon"&&qa?`<br><small>laurisilva ${qa.lau} % · fayal-brezal ${qa.fb} %</small>`:""}</td></tr>`}).join("");
    return `<table class="anbModeloTab"><thead><tr><th>Cuánto queda hoy de cada piso</th>${IS.map(i=>`<th class="n" title="${ISLAS[i].n}">${ab[i]}</th>`).join("")}<th class="n">Canarias</th></tr></thead><tbody>${filas}</tbody></table><div class="anbModeloNota">Parte del espacio potencial de cada piso que conserva hoy su vegetación. «·»: el piso no existe en esa isla (o es testimonial). TF Tenerife, GC Gran Canaria, LP La Palma, LG La Gomera, EH El Hierro, FV Fuerteventura, LZ Lanzarote. Mapa de Vegetación de Canarias (GRAFCAN): un punto por km² en el interior y uno cada 300 m junto a la costa; valores aproximados.</div>`}
  function franjasH(ik,lado){const L=(HIPSO[ik]||HIPSO.TF).lados[lado].pisos;return L.map(([k,lo,hi,pc])=>[PISOS.find(p=>p.k===k),lo,hi,pc])}
  function modeloPisos(cont,op){
    if(!cont)return null;
    const o=op.id?orientacion(op.id):null,ik=op.isla||(o&&o.isla)||"TF",isla=ISLAS[ik]||ISLAS.TF,ZM=isla.z,z=Math.max(0,Math.min(ZM,+op.z||0));
    const HI=HIPSO[ik]||HIPSO.TF,baja=ik==="FV"||ik==="LZ";
    const W=560,H=400,base=352,top=74;
    const Y=a=>base-(Math.min(a,ZM)/ZM)*(base-top);
    // silueta real de la isla vista desde el mar, mirando a lo largo de su divisoria (MDT25): sotavento a la izquierda, barlovento a la derecha
    const PF=PERFIL[ik]||PERFIL.TF,PZ=PF.z,np_=PZ.length,XA=34,XB=W-128,px=i=>XA+(XB-XA)*i/(np_-1);
    let ip=0;PZ.forEach((v,i)=>{if(v>PZ[ip])ip=i});const XC=px(ip);
    const cruce=(a,dir)=>{let i=ip;while(i+dir>=0&&i+dir<np_&&PZ[i+dir]>=a)i+=dir;const j=i+dir;if(j<0||j>=np_)return px(i);const t=(PZ[i]-a)/Math.max(1e-6,PZ[i]-PZ[j]);return px(i)+(px(j)-px(i))*t};
    const xL=a=>cruce(Math.min(a,ZM-1),-1),xR=a=>cruce(Math.min(a,ZM-1),1),xFuera=a=>{let i=np_-1;while(i>ip&&PZ[i]<a)i--;return px(Math.min(np_-1,i+1))},wS=a=>XC-xL(a),wB=a=>xR(a)-XC;
    const pts=[[XA,base],...PZ.map((v,i)=>[px(i),Y(v)]),[XB,base]].map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
    const FS=franjasH(ik,"S"),FB=franjasH(ik,"B");
    const fb=k=>FB.find(f=>f[0].k===k),tB=(fb("ter")||[0,0,0])[2],mB=(fb("mon")||[0,0,0])[2]||tB;
    let g=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cliserie de ${isla.n}" style="width:100%;height:100%;display:block">`;
    const cid="anbIsla"+Math.random().toString(36).slice(2,8);
    g+=`<defs><linearGradient id="${cid}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#e9f6fd"/></linearGradient>
      <clipPath id="${cid}"><polygon points="${pts}"/></clipPath></defs>`;
    g+=`<rect width="${W}" height="${H}" fill="url(#${cid}c)"/><rect y="${base}" width="${W}" height="${H-base}" fill="#2f78b7"/>`;
    g+=`<g clip-path="url(#${cid})">`;
    const rect=(xa,xb,lo,hi,c)=>`<rect x="${xa}" y="${Y(hi)}" width="${xb-xa}" height="${Math.max(0,Y(lo)-Y(hi))}" fill="${c}" stroke="rgba(60,50,30,.55)" stroke-width="1.2"/>`;
    const hmin=a=>Math.max(a,ZM*7/(base-top)); // el cinturón halófilo es una franja litoral estrecha: se dibuja con un grosor mínimo para que se vea
    FS.forEach(([p,lo,hi])=>{g+=rect(XA-2,XC,lo,p.k==="hal"?hmin(hi):hi,p.c)});
    FB.forEach(([p,lo,hi])=>{g+=rect(XC,XB+2,lo,p.k==="hal"?hmin(hi):hi,p.c)});
    if(!baja)g+=`<line x1="${XC}" y1="${Y(ZM)}" x2="${XC}" y2="${base}" stroke="rgba(60,50,30,.5)" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    g+=`</g><polygon points="${pts}" fill="none" stroke="#5b4a32" stroke-width="2"/>`;
    // cumbre
    g+=`<text x="${XC}" y="${Y(ZM)-9}" font-size="15" font-weight="800" fill="#1d2a36" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">${isla.c} · ${ZM.toLocaleString("es-ES")} m</text>`;
    // mar de nubes y alisios (solo si la isla llega a la altura del mar de nubes)
    const nub=(cx,cy,s)=>`<g fill="#fff" stroke="#9fb3c4" stroke-width="1.2"><ellipse cx="${cx}" cy="${cy}" rx="${46*s}" ry="${17*s}"/><ellipse cx="${cx-30*s}" cy="${cy+4*s}" rx="${26*s}" ry="${13*s}"/><ellipse cx="${cx+32*s}" cy="${cy+4*s}" rx="${28*s}" ry="${13*s}"/><ellipse cx="${cx+4*s}" cy="${cy-10*s}" rx="${26*s}" ry="${14*s}"/></g>`;
    if(ZM>1000){const an=Math.min(1150,(tB+Math.min(mB,ZM))/2),cx=Math.min(W-82,xFuera(an)+40);g+=nub(cx,Y(an)+4,.6);
      g+=`<text x="${cx}" y="${Y(an)-14}" font-size="15" font-weight="700" fill="#24496b" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">mar de nubes</text>`}
    const aA=ZM>1000?Math.min(ZM*.9,1750):ZM*.6; // los alisios soplan por debajo de la inversión
    g+=`<g stroke="#24496b" stroke-width="2.5" fill="#24496b"><line x1="${W-62}" y1="${Y(aA)}" x2="${xR(aA)+30}" y2="${Y(aA)}"/><polygon points="${xR(aA)+22},${Y(aA)} ${xR(aA)+34},${Y(aA)-6} ${xR(aA)+34},${Y(aA)+6}"/></g>`;
    g+=`<text x="${W-62}" y="${Y(aA)-8}" font-size="15" font-weight="700" fill="#24496b" text-anchor="end">alisios (NE)</text>`;
    // rótulos de los pisos que existen en la isla, en el centro de su franja visible
    const rot=(t,x,y,c="#1d2a36",fs=17)=>`<text x="${x}" y="${y}" font-size="${fs}" font-weight="700" fill="${c}" text-anchor="middle" stroke="${c==="#fff"?"rgba(0,40,0,.55)":"rgba(255,255,255,.75)"}" stroke-width="3" paint-order="stroke">${t}</text>`;
    // rótulos: nombre y % de superficie de ese piso en esa vertiente, a la altitud donde su franja es más ancha
    const NOM={hal:["Halófilo","Halófilo"],car:["Cardonal-tabaibal","Cardonal"],ter:["Bosque termófilo","Termófilo"],mon:["Monteverde","Monteverde"],pin:["Pinar","Pinar"],cum:["Matorral de cumbre","Cumbre"]};
    const rotula=(F,lado)=>F.forEach(([p,lo,hi,pc])=>{const N=NOM[p.k];const alto=Y(lo)-Y(hi);if(!N||alto<15)return;
      const WF=lado==="S"?wS:wB;let best=lo,bw=-1;for(let n=0;n<=12;n++){const a=lo+(hi-lo)*(.15+.7*n/12),w=WF(a);if(w>bw){bw=w;best=a}}
      const fmax=alto<22?14:16;let t=null,fs=fmax;for(const [tt,f] of [[N[0],fmax],[N[0],14],[N[1],14]])if(f<=fmax&&tt.length*f*.56<=bw-8){t=tt;fs=f;break}
      if(t){g+=rot(t,lado==="S"?XC-bw/2:XC+bw/2,Y(best)+5,p.k==="mon"?"#fff":"#1d2a36",fs);return}
      // si no cabe dentro, el nombre va fuera del perfil, junto a su franja
      const am=(lo+Math.min(hi,ZM))/2,xe=lado==="S"?xL(am)-6:xR(am)+6;
      g+=`<text x="${xe}" y="${Y(am)+5}" font-size="14" font-weight="800" fill="#1d2a36" text-anchor="${lado==="S"?"end":"start"}" stroke="rgba(255,255,255,.85)" stroke-width="3" paint-order="stroke">${N[1]}</text>`});
    // el mismo piso arriba en las dos vertientes: un solo rótulo centrado sobre la divisoria
    let RS=FS.slice(),RB=FB.slice();const uS=RS[RS.length-1],uB=RB[RB.length-1];
    if(!baja&&uS&&uB&&uS[0]===uB[0]){RS.pop();RB.pop();const lo=Math.max(uS[1],uB[1]),N=NOM[uS[0].k];let best=lo,bw=-1;
      for(let n=0;n<=12;n++){const a=lo+(ZM-lo)*(.1+.6*n/12),w=wS(a)+wB(a);if(w>bw){bw=w;best=a}}
      let t=null,fs=16;for(const [tt,f2] of [[N[0],16],[N[0],14],[N[1],14]])if(tt.length*f2*.56<=bw-8){t=tt;fs=f2;break}
      if(t)g+=rot(t,(xL(best)+xR(best))/2,Y(best)+5,uS[0].k==="mon"?"#fff":"#1d2a36",fs);
      else g+=`<text x="${xL(best)-6}" y="${Y(best)+5}" font-size="14" font-weight="800" fill="#1d2a36" text-anchor="end" stroke="rgba(255,255,255,.85)" stroke-width="3" paint-order="stroke">${N[1]}</text>`}
    const sinHal=F=>F.filter(f=>f[0].k!=="hal"||Y(f[1])-Y(f[2])>=15);
    if(baja)rotula(sinHal(RS),"S");else{rotula(sinHal(RS),"S");rotula(sinHal(RB),"B")}
    if([...FS,...FB].some(f=>f[0].k==="hal"&&Y(f[1])-Y(f[2])<15))g+=`<text x="${XA+2}" y="${base+16}" font-size="14" font-weight="700" fill="#bff3e6">▲ cinturón halófilo (franja costera)</text>`;
    
    // laderas y título
    if(baja)g+=`<text x="${XC}" y="${base+40}" font-size="16" font-weight="800" fill="#fff" text-anchor="middle">Isla baja: sin barlovento ni sotavento marcados</text>`;
    else{g+=`<text x="10" y="${base+40}" font-size="17" font-weight="800" fill="#fff">◀ Sotavento · ${Math.round(HI.lados.S.area)} km²</text>`;
      g+=`<text x="${W-10}" y="${base+40}" font-size="17" font-weight="800" fill="#fff" text-anchor="end">Barlovento · ${Math.round(HI.lados.B.area)} km² ▶</text>`}
    g+=`<text x="10" y="22" font-size="16" font-weight="800" fill="#24496b">Cliserie de ${isla.n}</text><text x="10" y="40" font-size="14" font-style="italic" fill="#24496b">Silueta real vista desde el mar · altitud exagerada</text>`;
    // eje de altitudes de la isla
    const paso=ZM<=900?100:ZM<=2000?250:500;
    g+=`<g font-size="14" fill="#24496b">`;for(let a=0;a<=ZM;a+=paso){g+=`<line x1="${W-12}" x2="${W-4}" y1="${Y(a)}" y2="${Y(a)}" stroke="#24496b"/><text x="${W-15}" y="${Y(a)+5}" text-anchor="end">${a.toLocaleString("es-ES")}</text>`}
    g+=`<text x="${W-4}" y="22" text-anchor="end" font-weight="700">Altitud (m)</text></g>`;
    // la estación: solo el punto
    let piso=null;
    if(o){piso=pisoModelo(z,baja?"S":o.lado,ik);
      const x=(o.lado==="B"&&!baja)?Math.max(XC+12,xR(z)-12):Math.min(XC-12,xL(z)+12),y=Y(z)-2;
      g+=`<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#fff" stroke-width="5"/><circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#d62c1a" stroke-width="3"/>`;
      g+=`<circle cx="${x}" cy="${y}" r="6.5" fill="#d62c1a" stroke="#fff" stroke-width="2.5"/>`;
    }
    g+="</svg>";
    const tabla=op.tabla===true?tablaHTML(ik):"";
    cont.innerHTML=`<div class="anbModelo">${g}</div>`+tabla+(o?`<div class="anbModeloTxt">En la cliserie de ${isla.n}: <b>${o.lado==="B"?"barlovento":"sotavento"}</b> (ladera orientada al ${o.rumbo}) a ${Math.round(+op.z||0)} m → <b>${piso.n.toLowerCase()}</b> <span style="font-weight:400;opacity:.8">(límites aproximados)</span></div>`:(op.id?`<div class="anbModeloTxt">Sin orientación calculada para esta estación.</div>`:""));
    return o?{lado:o.lado,rumbo:o.rumbo,piso:piso.n,isla:isla.n}:null;
  }

  // Elige la escala: Canarias → mapa de Canarias; España → mapa de España; el resto → globo
  function lugar(cont,op){
    if(op.ambito==="can"||op.ambito==="esp")return mapa(cont,op);
    return globo(cont,op);
  }
  window.AnbGlobo={globo,mapa,lugar,centro,modeloPisos,orientacion,tablaPisos:(c,ik)=>{if(c)c.innerHTML=tablaHTML(ik||"TF")},tablaQueda:c=>{if(c)c.innerHTML=tablaQueda()},precargar:()=>cargar().catch(()=>null)};
})();
