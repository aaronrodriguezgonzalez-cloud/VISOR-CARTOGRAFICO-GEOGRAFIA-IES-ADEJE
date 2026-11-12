/* ANAMBRO · interfaz: buscador a ras de la cabecera plegada y menú de botones plegable · nov 2026 */
(function(){
"use strict";
var d=document.documentElement,KEY="anTbMini";
function css(){
  if(document.getElementById("anUiCss"))return;
  var st=document.createElement("style");st.id="anUiCss";st.textContent=[
"@media (min-width:901px){html.anHdrMini #anFind{top:56px!important}}",
".toolbar .tool.anTbToggle{justify-content:flex-start;color:#5a6b7d;font-weight:700}",
"@media (min-width:901px){",
" html.anTbMini .toolbar{width:auto!important;min-width:0!important}",
" html.anTbMini .toolbar .tool{width:46px!important;min-width:46px!important;max-width:46px!important;height:36px!important;min-height:0!important;padding-left:0!important;padding-right:0!important;font-size:0!important;justify-content:center!important;text-align:center!important;overflow:hidden;white-space:nowrap}",
" html.anTbMini .toolbar .tool>span:first-child{font-size:17px!important;margin:0!important;display:inline-block}",
" html.anTbMini .toolbar .tool>span:not(:first-child){display:none!important}",
"}",
"@media (max-width:900px){.toolbar .tool.anTbToggle{display:none!important}}",
"#anTbTip{position:fixed;z-index:3000;background:#17324d;color:#fff;font:600 12px/1.2 system-ui,sans-serif;padding:5px 9px;border-radius:7px;pointer-events:none;white-space:nowrap;box-shadow:0 3px 10px #0004;display:none}"
  ].join("\n");document.head.appendChild(st);
}
function label(btn){var t=(btn.textContent||"").replace(/\s+/g," ").trim();var ic=btn.querySelector("span");if(ic)t=t.replace(ic.textContent,"").trim();return t;}
function set(mini,save){
  d.classList.toggle(KEY,mini);
  var b=document.querySelector(".toolbar .anTbToggle");
  if(b){b.innerHTML=mini?"<span>»</span> Desplegar menú":"<span>«</span> Plegar menú";b.title=mini?"Desplegar el menú de botones":"Plegar el menú de botones (solo iconos)";b.setAttribute("aria-expanded",mini?"false":"true");}
  if(save)try{localStorage.setItem(KEY,mini?"1":"0");}catch(e){}
  setTimeout(function(){try{window.dispatchEvent(new Event("resize"));}catch(e){}},80);
}
function tip(){
  var t=document.getElementById("anTbTip");if(!t){t=document.createElement("div");t.id="anTbTip";document.body.appendChild(t);}
  var tb=document.querySelector(".toolbar");if(!tb||tb.__anTip)return;tb.__anTip=true;
  tb.addEventListener("mouseover",function(e){if(!d.classList.contains(KEY))return;var b=e.target.closest(".tool");if(!b){t.style.display="none";return;}var r=b.getBoundingClientRect();t.textContent=label(b);t.style.left=(r.right+8)+"px";t.style.top=(r.top+r.height/2-12)+"px";t.style.display="block";});
  tb.addEventListener("mouseleave",function(){t.style.display="none";});
  tb.addEventListener("click",function(){t.style.display="none";});
}
function init(){
  css();
  var tb=document.querySelector(".toolbar");if(!tb)return;
  if(!tb.querySelector(".anTbToggle")){
    var b=document.createElement("button");b.type="button";b.className="tool anTbToggle";
    b.addEventListener("click",function(ev){ev.stopPropagation();set(!d.classList.contains(KEY),true);});
    tb.insertBefore(b,tb.firstChild);
  }
  var saved=null;try{saved=localStorage.getItem(KEY);}catch(e){}
  set(saved==="1",false);tip();
  window.anambroMenuLateral={set:set,get mini(){return d.classList.contains(KEY);}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
