/* ANAMBRO · Biblioteca didáctica · utilidades comunes (2026-11-21)
   - Todo de un vistazo: la animación se encoge lo justo para caber en la pantalla (sin bajar con el ratón).
   - Letra mínima legible: 14 px en los textos y 13 px en los rótulos dibujados.
   - Reto final con valoración cualitativa (insuficiente, suficiente, bien, notable, sobresaliente).
   - Pie de fuentes y enlaces a animaciones relacionadas.
   Uso: AnbAula.init({reto:[{p,ops:[...],ok:0,exp}], fuentes:"…", relacionadas:[{t,url}], sinEncaje:false}) */
(function(){
  "use strict";
  const MIN_DOM=14,MIN_CANVAS=13,ZOOM_MIN=.75;
  const $=s=>document.querySelector(s);
  const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  /* ---------- Letra mínima en los rótulos dibujados en canvas ---------- */
  try{
    const d=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,"font");
    if(d&&d.set&&!CanvasRenderingContext2D.prototype.__anbFont){
      Object.defineProperty(CanvasRenderingContext2D.prototype,"font",{configurable:true,get:d.get,
        set(v){d.set.call(this,String(v).replace(/(\d+(?:\.\d+)?)px/,(m,n)=>(+n<MIN_CANVAS&&+n>=7?MIN_CANVAS:n)+"px"))}});
      CanvasRenderingContext2D.prototype.__anbFont=1;
    }
  }catch(e){}

  /* ---------- Letra mínima en el resto ---------- */
  function letraMinima(){
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const vistos=new Set();let n;
    while((n=walk.nextNode())){const e=n.parentElement;if(!e||vistos.has(e)||!n.textContent.trim())continue;vistos.add(e);
      if(e.closest("svg"))continue;
      const fs=parseFloat(getComputedStyle(e).fontSize);if(fs&&fs<MIN_DOM)e.style.fontSize=MIN_DOM+"px"}
    // textos de SVG: los muy pequeños se suben (en unidades del dibujo)
    document.querySelectorAll("svg text").forEach(t=>{const fs=parseFloat(t.getAttribute("font-size")||getComputedStyle(t).fontSize);
      if(fs&&fs<11)t.setAttribute("font-size","12")});
  }

  /* ---------- Todo de un vistazo ----------
     1.º se reduce el dibujo principal (manteniendo su proporción) para que quepa todo sin encoger la letra;
     2.º solo si aún no cabe, se encoge el conjunto lo mínimo imprescindible. */
  let raiz=null,sinEncaje=false,propio=false,firma="";
  const alto=()=>document.documentElement.scrollHeight;
  function candidatos(){
    const vw=innerWidth,vh=innerHeight,out=[];
    raiz.querySelectorAll("canvas,svg").forEach(g=>{
      let e=g;for(let k=0;k<3&&e.parentElement&&e.parentElement!==raiz;k++){const c=getComputedStyle(e.parentElement);if(c.aspectRatio&&c.aspectRatio!=="auto"){e=e.parentElement;break}if(e.parentElement.children.length>3)break;e=e.parentElement}
      const r=e.getBoundingClientRect();if(r.width*r.height>vw*vh*.06&&!out.includes(e)&&!e.closest(".anbVelo"))out.push(e)});
    return out.sort((a,b)=>{const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();return B.width*B.height-A.width*A.height});
  }
  function encajar(){
    letraMinima();
    if(sinEncaje||!raiz)return;
    const antes=firma;
    raiz.style.zoom="";raiz.querySelectorAll("[data-anb-enc]").forEach(e=>{e.style.maxWidth="";e.style.width="";e.style.alignSelf="";e.style.minHeight="";e.style.marginLeft="";e.style.marginRight="";e.removeAttribute("data-anb-enc")});
    const disp=innerHeight;
    if(alto()>disp+2&&innerWidth>700){
      // se reduce cada dibujo grande (de mayor a menor) solo si con ello baja la altura total; nunca por debajo del 80 %
      const quita=c=>{c.style.width=c.style.maxWidth=c.style.alignSelf=c.style.minHeight=c.style.marginLeft=c.style.marginRight="";c.removeAttribute("data-anb-enc")};
      const cs=candidatos(),ancho0=new Map(cs.map(c=>[c,c.getBoundingClientRect().width])),hIni=alto();
      for(const c of cs){
        const r1=c.getBoundingClientRect(),h1=alto();
        // nunca más ancho que al principio (si otra columna se ha estrechado, esta no debe crecer)
        const r0={width:Math.min(r1.width,ancho0.get(c)),height:r1.height*Math.min(1,ancho0.get(c)/r1.width)};
        const pon=f=>{c.style.width=Math.floor(r0.width*f)+"px";c.style.maxWidth="100%";c.style.alignSelf="center";c.style.minHeight="0";c.style.marginLeft=c.style.marginRight="auto";c.setAttribute("data-anb-enc","1")};
        pon(.8);const h6=alto();
        if(h6>=h1-4){quita(c);continue}            // no ayuda: se deja como estaba
        if(h6<=disp+2){let lo=.8,hi=1;for(let k=0;k<6;k++){const m=(lo+hi)/2;pon(m);if(alto()<=disp+2)lo=m;else hi=m}pon(lo);break}
      }
      // si al final no ha servido de nada, todo vuelve a su tamaño
      if(alto()>=hIni-4)cs.forEach(quita);
    }
    const natural=alto();
    // en el móvil no se encoge: mejor bajar con el dedo que leer letra diminuta
    const z=(natural<=disp+2||innerWidth<=700)?1:Math.max(ZOOM_MIN,disp/natural);
    raiz.style.zoom=z<.995?z:"";
    firma=[...raiz.querySelectorAll("[data-anb-enc]")].map(e=>e.style.width).join()+"|"+raiz.style.zoom;
    // si ha cambiado el tamaño, se avisa a la animación para que reajuste sus lienzos
    if(firma!==antes){propio=true;dispatchEvent(new Event("resize"));propio=false}
  }
  // (como mucho una vez cada 250 ms, aunque la animación cambie la página continuamente)
  let tEnc=0;const pedir=()=>{if(propio||tEnc)return;tEnc=setTimeout(()=>{tEnc=0;encajar()},250)};

  /* ---------- Reto ---------- */
  const NIVELES=[[2.5,"Insuficiente","#c0392b","Repasa la animación paso a paso y vuelve a intentarlo."],[3,"Suficiente","#d68910","Vas por buen camino; repasa lo que has fallado."],
    [3.5,"Bien","#b7950b","Bien hecho; te faltan algunos detalles."],[4.5,"Notable","#229954","¡Muy bien! Dominas casi todo."],[99,"Sobresaliente","#1e8449","¡Excelente! Lo has entendido todo."]];
  const nivel=p=>NIVELES.find(n=>p<n[0]);
  const barajar=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const CSS=`
.anbRetoBtn{border:1px solid #ffd166!important;background:#3b2c00!important;color:#ffd166!important}
.anbRetoBtn.flot{position:fixed;right:14px;top:12px;z-index:9000;border-radius:999px;padding:8px 14px;font:800 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.4)}
.anbVelo{position:fixed;inset:0;z-index:9500;background:rgba(2,8,14,.72);display:flex;align-items:center;justify-content:center;padding:14px}
.anbReto{width:min(760px,100%);max-height:calc(100vh - 28px);overflow:auto;background:#0f2433;color:#eef5f8;border:1px solid #3d6a82;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.5);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.anbReto header{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #2d536a}
.anbReto header b{color:#ffd166;font-size:19px}.anbReto header span{margin-left:auto;color:#a9c0cd;font-weight:700}
.anbReto header button{background:none;border:0;color:#cfe0ea;font-size:22px;cursor:pointer;padding:0 4px}
.anbReto .cuerpo{padding:16px 18px}
.anbReto .preg{font-size:19px;font-weight:700;margin-bottom:12px}
.anbReto .ops{display:grid;gap:8px}
.anbReto .ops button{text-align:left;font:600 16px/1.35 system-ui,sans-serif;padding:11px 14px;border-radius:10px;border:1px solid #3d6a82;background:#132e40;color:#eef5f8;cursor:pointer}
.anbReto .ops button:hover:not(:disabled){background:#1b3d54}
.anbReto .ops button.ok{background:#1e6b3a;border-color:#4fd18b}.anbReto .ops button.mal{background:#6b1e1e;border-color:#e06666;opacity:.9}
.anbReto .ops button:disabled{cursor:default}
.anbReto .exp{margin-top:12px;padding:10px 12px;border-radius:10px;background:#0a1a25;border:1px solid #2d536a;font-size:15.5px}
.anbReto .pie{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}
.anbReto .pie .btn{font:800 16px system-ui,sans-serif;padding:10px 16px;border-radius:999px;border:0;background:#ffd166;color:#2a1d00;cursor:pointer}
.anbReto .pie .btn.sec{background:#20435a;color:#eef5f8;border:1px solid #3d6a82}
.anbReto .barra{height:8px;border-radius:99px;background:#1b3546;overflow:hidden;margin-top:10px}.anbReto .barra i{display:block;height:100%;background:#ffd166}
.anbReto .nivel{text-align:center;padding:10px 0 4px}.anbReto .nivel .n{font-size:38px;font-weight:900}.anbReto .nivel p{margin:6px 0 0;font-size:17px}
.anbReto .rev{margin-top:14px;font-size:15px}.anbReto .rev li{margin-bottom:6px}
.anbPie{margin:10px auto 0;max-width:1300px;padding:0 14px 14px;font:14px/1.45 system-ui,sans-serif;color:#a9c0cd}
.anbPie b{color:#cfe0ea}.anbPie .rel{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center}
.anbPie .rel a{color:#ffd166;border:1px solid #5a4a1a;border-radius:999px;padding:3px 10px;text-decoration:none;font-weight:700}
.anbPie .rel a:hover{background:#3b2c00}
.anbGlo{border-bottom:2px dotted #ffd166;cursor:help}
.anbGlo:hover,.anbGlo:focus{background:rgba(255,209,102,.18);outline:none}
.anbGloTip{position:fixed;z-index:9600;max-width:320px;background:#fff8e1;color:#2a1d00;border:1px solid #d9b44a;border-radius:10px;padding:8px 11px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.stage:has(.anbSig),#stage:has(.anbSig){display:flow-root}.anbSig{float:right;margin:0 0 4px 12px;border:0;border-radius:999px;background:#ffd166;color:#2a1d00;font:800 15px system-ui,sans-serif;padding:7px 14px;cursor:pointer}
.anbSig:hover{filter:brightness(1.07)}`;
  function css(){if($("#anbAulaCss"))return;const s=document.createElement("style");s.id="anbAulaCss";s.textContent=CSS;document.head.appendChild(s)}

  function abrirReto(cfg){
    const banco=cfg.reto||[];if(!banco.length)return;
    const preguntas=barajar(banco).slice(0,Math.min(5,banco.length)).map(q=>{const orden=barajar(q.ops.map((t,i)=>({t,ok:i===q.ok})));return{...q,orden}});
    let i=0,puntos=0,intentos=0;const fallos=[];
    const velo=document.createElement("div");velo.className="anbVelo";
    velo.innerHTML=`<div class="anbReto" role="dialog" aria-modal="true"><header><b>🎯 Reto</b><span id="anbRetoCont"></span><button title="Cerrar" aria-label="Cerrar">✕</button></header><div class="cuerpo" id="anbRetoCuerpo"></div></div>`;
    document.body.appendChild(velo);
    const cerrar=()=>velo.remove();
    velo.querySelector("header button").onclick=cerrar;
    velo.addEventListener("click",e=>{if(e.target===velo)cerrar()});
    const cuerpo=velo.querySelector("#anbRetoCuerpo"),cont=velo.querySelector("#anbRetoCont");
    function pinta(){
      const q=preguntas[i];intentos=0;
      cont.textContent=`Pregunta ${i+1} de ${preguntas.length}`;
      cuerpo.innerHTML=`<div class="preg">${esc(q.p)}</div><div class="ops">${q.orden.map((o,k)=>`<button data-k="${k}">${esc(o.t)}</button>`).join("")}</div>
        <div class="exp" hidden></div><div class="pie"><span style="color:#a9c0cd">Si fallas, tienes una segunda oportunidad (vale la mitad).</span><button class="btn" hidden>Siguiente ▶</button></div>
        <div class="barra"><i style="width:${i/preguntas.length*100}%"></i></div>`;
      const exp=cuerpo.querySelector(".exp"),sig=cuerpo.querySelector(".pie .btn");
      cuerpo.querySelectorAll(".ops button").forEach(b=>b.onclick=()=>{
        const o=q.orden[+b.dataset.k];intentos++;
        if(o.ok){b.classList.add("ok");puntos+=intentos===1?1:.5;fin(true)}
        else{b.classList.add("mal");b.disabled=true;
          if(intentos>=2){const buena=[...cuerpo.querySelectorAll(".ops button")].find(x=>q.orden[+x.dataset.k].ok);buena.classList.add("ok");fallos.push(q);fin(false)}
          else{exp.hidden=false;exp.innerHTML="❌ No es esa. Piénsalo otra vez."}}
      });
      function fin(bien){cuerpo.querySelectorAll(".ops button").forEach(x=>x.disabled=true);
        exp.hidden=false;exp.innerHTML=(bien?(intentos===1?"✅ ¡Correcto! ":"✅ Correcto a la segunda. "):"❌ La respuesta correcta está en verde. ")+(q.exp?esc(q.exp):"");
        sig.hidden=false;sig.textContent=i<preguntas.length-1?"Siguiente ▶":"Ver resultado ▶";sig.focus()}
      sig.onclick=()=>{i++;if(i<preguntas.length)pinta();else resultado()};
    }
    function resultado(){
      const p=puntos*5/preguntas.length,n=nivel(p);
      cont.textContent="Resultado";
      cuerpo.innerHTML=`<div class="nivel"><div class="n" style="color:${n[2]}">${n[1]}</div><p>${n[3]}</p></div>
        ${fallos.length?`<div class="rev"><b>Para repasar:</b><ul>${fallos.map(q=>`<li>${esc(q.p)} → <b>${esc(q.ops[q.ok])}</b></li>`).join("")}</ul></div>`:""}
        <div class="pie"><button class="btn sec" id="anbCerrar">Volver a la animación</button><button class="btn" id="anbOtra">↺ Otro reto</button></div>`;
      cuerpo.querySelector("#anbCerrar").onclick=cerrar;
      cuerpo.querySelector("#anbOtra").onclick=()=>{cerrar();abrirReto(cfg)};
    }
    pinta();
  }


  /* ---------- Glosario: los términos clave del texto explicativo se pueden tocar para ver su definición ---------- */
  const GLOS={
    "afelio":"Punto de la órbita en el que la Tierra está más lejos del Sol (a principios de julio).",
    "perihelio":"Punto de la órbita en el que la Tierra está más cerca del Sol (a principios de enero).",
    "solsticio":"Día en que el Sol alcanza su posición más al norte o más al sur: el día más largo o el más corto del año (21 de junio y 21 de diciembre, aproximadamente).",
    "equinoccio":"Día en que el día y la noche duran casi lo mismo en toda la Tierra (hacia el 20 de marzo y el 22 de septiembre).",
    "cenit":"Punto del cielo situado justo encima de nuestra cabeza.",
    "rotación":"Giro de la Tierra sobre su propio eje; dura un día y produce el día y la noche.",
    "traslación":"Movimiento de la Tierra alrededor del Sol; dura un año.",
    "eclíptica":"Plano de la órbita de la Tierra alrededor del Sol.",
    "huso horario":"Cada una de las 24 franjas de 15° de longitud que tienen la misma hora.",
    "meridiano":"Línea imaginaria que une los polos. El de Greenwich es el meridiano 0°.",
    "latitud":"Distancia en grados de un lugar al ecuador, hacia el norte o hacia el sur (de 0° a 90°).",
    "longitud":"Distancia en grados de un lugar al meridiano de Greenwich, hacia el este o el oeste (de 0° a 180°).",
    "insolación":"Cantidad de energía del Sol que llega a una superficie.",
    "alisios":"Vientos constantes que soplan desde las altas presiones subtropicales hacia el ecuador; en Canarias llegan del nordeste.",
    "barlovento":"Ladera de una montaña que recibe de frente el viento húmedo; en Canarias, la orientada al norte.",
    "sotavento":"Ladera de una montaña resguardada del viento húmedo, más seca; en Canarias, la orientada al sur.",
    "mar de nubes":"Capa de nubes bajas que forman los alisios al chocar con las laderas del norte de las islas, entre unos 700 y 1.500 m.",
    "anticiclón":"Zona de altas presiones, con aire que baja y tiempo estable y seco.",
    "borrasca":"Zona de bajas presiones, con aire que sube, nubes y lluvia.",
    "continentalidad":"Influencia de la distancia al mar: lejos de la costa los inviernos son más fríos y los veranos más calurosos.",
    "litosfera":"Capa rígida de la Tierra formada por la corteza y la parte más alta del manto; está dividida en placas.",
    "subducción":"Hundimiento de una placa tectónica bajo otra.",
    "dorsal":"Cordillera submarina donde dos placas se separan y sale magma que forma nuevo fondo oceánico.",
    "magma":"Roca fundida que está bajo la superficie terrestre.",
    "piroclastos":"Fragmentos de roca que lanza un volcán al aire: cenizas, lapilli y bombas.",
    "lapilli":"Piroclastos de entre 2 y 64 mm; en Canarias se llaman picón.",
    "malpaís":"Campo de lava muy rugoso y difícil de recorrer.",
    "colada":"Río de lava que sale de un volcán y se enfría al avanzar.",
    "erosión":"Desgaste de las rocas y del suelo por el agua, el viento, el hielo o el mar.",
    "sedimentación":"Depósito de los materiales que transportan el agua, el viento o el hielo.",
    "meandro":"Curva muy cerrada que forma un río en una llanura.",
    "delta":"Acumulación de sedimentos en la desembocadura de un río, con forma de abanico.",
    "estuario":"Desembocadura ancha de un río donde entra el agua del mar con las mareas.",
    "morrena":"Acumulación de rocas que arrastra y deja un glaciar.",
    "acantilado":"Costa alta y vertical que el mar va desgastando.",
    "tómbolo":"Franja de arena que une una isla con la costa.",
    "calima":"Polvo del desierto suspendido en el aire, que llega a Canarias con vientos del este.",
    "dolina":"Hoyo o depresión cerrada que se forma en las zonas de roca caliza por disolución.",
    "estalactita":"Columna de caliza que cuelga del techo de una cueva.",
    "bioma":"Gran región de la Tierra con un mismo tipo de vegetación y de fauna, como la selva o la taiga.",
    "vegetación potencial":"La vegetación que habría en un lugar de forma natural si el ser humano no la hubiera cambiado.",
    "esclerófila":"Planta de hojas pequeñas, duras y siempre verdes, que pierde poca agua; típica del clima mediterráneo.",
    "esclerófilas":"Plantas de hojas pequeñas, duras y siempre verdes, que pierden poca agua; típicas del clima mediterráneo.",
    "cliserie":"Sucesión de pisos de vegetación que se escalonan al subir una montaña.",
    "azonal":"Vegetación que depende más del agua o del suelo (ríos, costas) que del clima de la zona.",
    "laurisilva":"Bosque siempre verde de laureles y otros árboles de hoja ancha, propio del monteverde canario.",
    "dehesa":"Bosque aclarado de encinas o alcornoques con pastos para el ganado.",
    "permafrost":"Suelo que permanece helado todo el año en las regiones frías.",
    "endemismo":"Especie que solo vive en un lugar concreto del mundo."
  };
  const claves=Object.keys(GLOS).sort((a,b)=>b.length-a.length);
  const reGlo=new RegExp("(^|[^\\p{L}])("+claves.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")(?=[^\\p{L}]|$)","iu");
  let globo=null;
  function verDef(el){
    if(!globo){globo=document.createElement("div");globo.className="anbGloTip";document.body.appendChild(globo);
      document.addEventListener("pointerdown",e=>{if(globo&&!e.target.closest(".anbGlo"))globo.hidden=true},true)}
    const t=el.dataset.t;globo.innerHTML="<b>"+esc(t.charAt(0).toUpperCase()+t.slice(1))+":</b> "+esc(GLOS[t]);globo.hidden=false;
    const r=el.getBoundingClientRect();globo.style.left=Math.max(8,Math.min(innerWidth-330,r.left))+"px";globo.style.top=(r.bottom+6)+"px";
  }
  function glosario(cont){
    if(!cont||cont.dataset.anbGlo===cont.innerHTML.length+"")return;
    const usados=new Set();
    const walk=document.createTreeWalker(cont,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(".anbGlo,button,a,svg,.anbSig")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const nodos=[];let n;while((n=walk.nextNode()))nodos.push(n);
    for(const nodo of nodos){
      let txt=nodo.nodeValue,m,frag=null,resto=nodo;
      while(resto&&(m=reGlo.exec(resto.nodeValue))){
        const t=m[2].toLowerCase();const ini=m.index+m[1].length;
        if(usados.has(t)||!GLOS[t]){break}
        usados.add(t);
        const tras=resto.splitText(ini);const despues=tras.splitText(m[2].length);
        const sp=document.createElement("span");sp.className="anbGlo";sp.tabIndex=0;sp.dataset.t=t;sp.title=GLOS[t];sp.textContent=tras.nodeValue;
        tras.replaceWith(sp);resto=despues;
      }
    }
    cont.querySelectorAll(".anbGlo").forEach(sp=>{if(sp.__anb)return;sp.__anb=1;sp.addEventListener("click",e=>{e.stopPropagation();verDef(sp)});sp.addEventListener("keydown",e=>{if(e.key==="Enter")verDef(sp)})});
    cont.dataset.anbGlo=cont.innerHTML.length+"";
  }

  /* ---------- Avanzar de paso: botón «Siguiente» y flechas del teclado ---------- */
  function botonesPaso(pasos){return pasos?[...pasos.querySelectorAll("button")].filter(b=>!b.classList.contains("anbRetoBtn")):[]}
  function actual(bs){return bs.findIndex(b=>b.classList.contains("on")||b.classList.contains("active")||b.getAttribute("aria-current")==="step")}
  function mover(pasos,d,cfg){const bs=botonesPaso(pasos),i=actual(bs);if(i<0)return;const j=i+d;
    if(j>=0&&j<bs.length){bs[j].click();bs[j].scrollIntoView({block:"nearest",inline:"nearest"})}
    else if(j>=bs.length&&cfg.reto&&cfg.reto.length)abrirReto(cfg)}
  function botonSiguiente(stage,pasos,cfg){
    if(!stage||!pasos)return;
    const bs=botonesPaso(pasos),i=actual(bs);if(i<0)return;
    let b=stage.querySelector(".anbSig");
    if(!b){b=document.createElement("button");b.type="button";b.className="anbSig";stage.insertBefore(b,stage.firstChild);
      b.addEventListener("click",e=>{e.stopPropagation();mover(pasos,1,cfg)})}
    const ultimo=i>=bs.length-1;
    const t=ultimo?(cfg.reto&&cfg.reto.length?"🎯 ¿Te atreves con el reto?":""):"Siguiente paso ▶";
    if(b.textContent!==t)b.textContent=t;if(b.hidden!==!t)b.hidden=!t;
    if(b!==stage.firstElementChild)stage.insertBefore(b,stage.firstChild);
  }

  /* ---------- Navegar a otra animación (dentro del visor, sin cerrarlo) ---------- */
  function irA(url,t){
    try{const P=window.parent;if(P&&P!==window&&typeof P.openAnambroExplanation==="function"){P.openAnambroExplanation(url,t);return}}catch(e){}
    location.href="../../"+url;
  }

  function init(cfg){
    cfg=cfg||{};css();sinEncaje=!!cfg.sinEncaje;
    raiz=document.querySelector(cfg.raiz||".app")||document.body;
    // botón del reto: al final de los pasos, con el mismo estilo; si no hay pasos, flotante
    if(cfg.reto&&cfg.reto.length){
      const pasos=document.querySelector(cfg.pasos||"#steps, nav.steps, .steps");
      const b=document.createElement("button");b.type="button";b.textContent=cfg.etiqueta||"🎯 Reto";b.className="anbRetoBtn";b.title="Pon a prueba lo que has aprendido";
      b.addEventListener("click",ev=>{ev.preventDefault();ev.stopPropagation();abrirReto(cfg)});
      const colocar=()=>{if(pasos&&!pasos.contains(b))pasos.appendChild(b)};
      if(pasos){colocar();new MutationObserver(colocar).observe(pasos,{childList:true})}
      else{b.classList.add("flot");document.body.appendChild(b)}
    }
    // pie: fuentes y animaciones relacionadas
    if(cfg.fuentes||(cfg.relacionadas&&cfg.relacionadas.length)){
      const pie=document.createElement("div");pie.className="anbPie";
      pie.innerHTML=(cfg.fuentes?`<div><b>Fuentes:</b> ${cfg.fuentes}</div>`:"")+
        (cfg.relacionadas&&cfg.relacionadas.length?`<div class="rel"><b>Relacionadas:</b>${cfg.relacionadas.map((r,k)=>`<a href="#" data-k="${k}">${esc(r.t)}</a>`).join("")}</div>`:"");
      pie.querySelectorAll(".rel a").forEach(a=>a.onclick=e=>{e.preventDefault();const r=cfg.relacionadas[+a.dataset.k];irA(r.url,r.t)});
      (cfg.pieEn?document.querySelector(cfg.pieEn):raiz).appendChild(pie);
    }
    // paso a paso: botón «Siguiente», teclado y glosario
    const pasosEl=document.querySelector(cfg.pasos||"#steps, nav.steps, .steps"),stage=document.querySelector(cfg.stage||"#stage");
    const repasa=()=>{if(stage){botonSiguiente(stage,pasosEl,cfg);if(cfg.glosario!==false)glosario(stage)}};
    if(stage){let ocupado=false;new MutationObserver(()=>{if(ocupado)return;ocupado=true;requestAnimationFrame(()=>{repasa();ocupado=false})}).observe(stage,{childList:true,subtree:true,characterData:true});
      if(pasosEl)new MutationObserver(()=>requestAnimationFrame(repasa)).observe(pasosEl,{subtree:true,attributes:true,attributeFilter:["class"]});repasa()}
    if(pasosEl)addEventListener("keydown",e=>{if(e.target.closest("input,select,textarea,[contenteditable]")||document.querySelector(".anbVelo"))return;
      if(e.key==="ArrowRight"||e.key==="PageDown"){e.preventDefault();mover(pasosEl,1,cfg)}else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();mover(pasosEl,-1,cfg)}});
    letraMinima();setTimeout(letraMinima,1200);
    addEventListener("resize",pedir);
    new MutationObserver(()=>{pedir()}).observe(raiz,{childList:true,subtree:true,attributes:true,attributeFilter:["class","hidden"]});
    pedir();setTimeout(pedir,600);setTimeout(()=>{letraMinima();pedir()},2500);
  }
  window.AnbAula={init,abrirReto,irA};
})();
