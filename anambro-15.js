/* ANAMBRO · Fotos de Wikimedia Commons cerca del punto tocado
   - Añade el botón «📷 Fotos de este lugar» al pie de las fichas del mapa (2D y, por copia de la ficha, globo 3D).
   - Busca en Wikimedia Commons fotos geolocalizadas cerca del punto (API pública geosearch, CORS).
   - Cada foto muestra autor, licencia y enlace a su página de Commons.
   Módulo independiente: no modifica ninguna función existente del visor. */
(function () {
  "use strict";
  if (window.__anambroFotosCerca) return;
  window.__anambroFotosCerca = true;

  var API = "https://commons.wikimedia.org/w/api.php";
  var RADIOS = [1000, 5000, 10000]; // metros (la API admite como máximo 10 km)
  var NO_FOTO = /\b(map|mapa|mappa|karte|carte|plano|logo|escudo|coat[_ ]of[_ ]arms|wappen|blason|bandera|flag|flagge|drapeau|diagram|diagrama|esquema|locator|location[_ ]map|situaci[oó]n|signature|firma|seal|sello)\b/i;
  var EXT_OK = /\.(jpe?g|png|webp)$/i;

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var limpia = function (html) {
    var d = document.createElement("div");
    d.innerHTML = String(html || "");
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  };
  var fmtDist = function (m) {
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",") + " km";
  };

  /* ---------- Estilos ---------- */
  var css = document.createElement("style");
  css.id = "anFotosCercaCss";
  css.textContent = [
    ".anFotosCercaBtn{display:block;width:100%;margin:8px 0 2px;padding:7px 10px;border:0;border-radius:8px;background:#17324d;color:#fff;font:600 13px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer}",
    ".anFotosCercaBtn:hover{background:#2e86de}",
    "#anFotosCerca{position:fixed;right:14px;bottom:14px;width:min(560px,calc(100vw - 28px));max-height:min(78vh,720px);display:none;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);z-index:100000;font:14px system-ui,-apple-system,'Segoe UI',sans-serif;color:#1d2a36;overflow:hidden}",
    "#anFotosCerca.on{display:flex}",
    "#anFotosCerca .afcHead{background:linear-gradient(120deg,#17324d,#2e86de);color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px}",
    "#anFotosCerca .afcHead b{font-size:15px;flex:1}",
    "#anFotosCerca .afcHead button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:8px;width:32px;height:32px;font-size:18px;cursor:pointer}",
    "#anFotosCerca .afcBar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid #e3e9ef;font-size:13px;color:#4a6178}",
    "#anFotosCerca .afcBar button{border:1px solid #d5dee7;background:#fff;border-radius:14px;padding:3px 10px;font:inherit;cursor:pointer}",
    "#anFotosCerca .afcBar button.on{background:#17324d;color:#fff;border-color:#17324d}",
    "#anFotosCerca .afcGrid{padding:10px 12px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));grid-auto-rows:120px;gap:8px;min-height:0;flex:1}",
    "#anFotosCerca .afcItem{border:0;padding:0;background:#dde5ec;border-radius:10px;overflow:hidden;cursor:pointer;position:relative;height:120px;width:100%}",
    "#anFotosCerca .afcItem img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s}",
    "#anFotosCerca .afcItem:hover img{transform:scale(1.05)}",
    "#anFotosCerca .afcItem span{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:2px 6px;border-radius:8px}",
    "#anFotosCerca .afcMsg{padding:16px;color:#4a6178}",
    "#anFotosCerca .afcPie{padding:6px 12px 10px;font-size:11.5px;color:#5b6b7a;border-top:1px solid #e3e9ef}",
    "#anFotosCercaVer{position:fixed;inset:0;background:rgba(8,18,28,.86);display:none;align-items:center;justify-content:center;flex-direction:column;z-index:100001;padding:16px}",
    "#anFotosCercaVer.on{display:flex}",
    "#anFotosCercaVer img{max-width:min(1400px,96vw);max-height:78vh;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)}",
    "#anFotosCercaVer .afcCred{color:#e8eef4;font:13px system-ui,-apple-system,sans-serif;margin-top:10px;text-align:center;max-width:900px}",
    "#anFotosCercaVer .afcCred a{color:#9fd0ff}",
    "#anFotosCercaVer .afcNav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:0;color:#fff;font-size:30px;width:48px;height:64px;border-radius:10px;cursor:pointer}",
    "#anFotosCercaVer .afcCierra{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.15);border:0;color:#fff;font-size:22px;width:44px;height:44px;border-radius:10px;cursor:pointer}"
  ].join("\n");
  document.head.appendChild(css);

  /* ---------- Panel ---------- */
  var panel = null, visor = null, estado = { lat: 0, lng: 0, radio: 10000, fotos: [], i: 0, pet: 0 };

  function crearPanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "anFotosCerca";
    panel.innerHTML =
      '<div class="afcHead"><b>📷 Fotos de este lugar</b><button type="button" class="afcX" title="Cerrar">✕</button></div>' +
      '<div class="afcBar">Radio: ' +
      RADIOS.map(function (r) { return '<button type="button" data-r="' + r + '">' + fmtDist(r) + "</button>"; }).join("") +
      '<span class="afcCoord" style="margin-left:auto"></span></div>' +
      '<div class="afcGrid"></div>' +
      '<div class="afcPie">Fotos geolocalizadas de <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>, ordenadas de la más cercana a la más lejana. Cada foto conserva su autor y su licencia. Commons no distingue paisajes de otros motivos: pueden aparecer edificios, plantas o personas.</div>';
    document.body.appendChild(panel);
    panel.querySelector(".afcX").addEventListener("click", function () { panel.classList.remove("on"); });
    panel.querySelector(".afcBar").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-r]");
      if (!b) return;
      estado.radio = +b.dataset.r;
      buscar();
    });
    panel.querySelector(".afcGrid").addEventListener("click", function (e) {
      var b = e.target.closest(".afcItem");
      if (b) ver(+b.dataset.i);
    });

    visor = document.createElement("div");
    visor.id = "anFotosCercaVer";
    visor.innerHTML =
      '<button type="button" class="afcCierra" title="Cerrar">✕</button>' +
      '<button type="button" class="afcNav" data-d="-1" style="left:14px" title="Anterior">‹</button>' +
      '<img alt="">' +
      '<button type="button" class="afcNav" data-d="1" style="right:14px" title="Siguiente">›</button>' +
      '<div class="afcCred"></div>';
    document.body.appendChild(visor);
    visor.addEventListener("click", function (e) {
      if (e.target.closest(".afcCierra") || e.target === visor) { visor.classList.remove("on"); return; }
      var n = e.target.closest(".afcNav");
      if (n) ver(estado.i + (+n.dataset.d));
    });
    document.addEventListener("keydown", function (e) {
      if (!visor.classList.contains("on")) return;
      if (e.key === "Escape") visor.classList.remove("on");
      else if (e.key === "ArrowRight") ver(estado.i + 1);
      else if (e.key === "ArrowLeft") ver(estado.i - 1);
    });
  }

  function credito(f) {
    return '<a href="' + esc(f.pagina) + '" target="_blank" rel="noopener">' + esc(f.autor || "Autor desconocido") + "</a> · " +
      esc(f.licencia || "licencia en Commons") + " · Wikimedia Commons · a " + fmtDist(f.dist) + " del punto";
  }

  function ver(i) {
    if (!estado.fotos.length) return;
    estado.i = (i + estado.fotos.length) % estado.fotos.length;
    var f = estado.fotos[estado.i];
    var img = visor.querySelector("img");
    img.src = f.grande || f.mini;
    img.alt = f.titulo;
    visor.querySelector(".afcCred").innerHTML = "<b>" + esc(f.titulo) + "</b><br>" + credito(f);
    visor.classList.add("on");
  }

  function abrir(lat, lng) {
    crearPanel();
    estado.lat = lat; estado.lng = lng;
    panel.querySelector(".afcCoord").textContent = lat.toFixed(4).replace(".", ",") + "°, " + lng.toFixed(4).replace(".", ",") + "°";
    panel.classList.add("on");
    buscar();
  }

  function buscar() {
    var pet = ++estado.pet;
    panel.querySelectorAll(".afcBar button").forEach(function (b) { b.classList.toggle("on", +b.dataset.r === estado.radio); });
    var grid = panel.querySelector(".afcGrid");
    grid.innerHTML = '<div class="afcMsg">Buscando fotos en Wikimedia Commons…</div>';
    var u1 = API + "?action=query&format=json&origin=*&list=geosearch&gsnamespace=6&gslimit=100" +
      "&gsradius=" + estado.radio + "&gscoord=" + estado.lat.toFixed(5) + "%7C" + estado.lng.toFixed(5);
    fetch(u1).then(function (r) { return r.json(); }).then(function (j) {
      if (pet !== estado.pet) return;
      var lista = ((j.query || {}).geosearch || []).filter(function (g) {
        return EXT_OK.test(g.title) && !NO_FOTO.test(g.title.replace(/^File:/, "").replace(/[_-]/g, " "));
      });
      if (!lista.length) { grid.innerHTML = '<div class="afcMsg">No hay fotos geolocalizadas en Commons a menos de ' + fmtDist(estado.radio) + (estado.radio < 10000 ? ". Prueba con un radio mayor." : " de este punto.") + "</div>"; return; }
      lista = lista.slice(0, 48);
      var dist = {};
      lista.forEach(function (g) { dist[g.title] = g.dist; });
      var trozos = [];
      for (var k = 0; k < lista.length; k += 50) trozos.push(lista.slice(k, k + 50));
      return Promise.all(trozos.map(function (t) {
        var u2 = API + "?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize" +
          "&iiurlwidth=420&iiextmetadatafilter=Artist%7CLicenseShortName%7CObjectName&titles=" +
          encodeURIComponent(t.map(function (g) { return g.title; }).join("|"));
        return fetch(u2).then(function (r) { return r.json(); });
      })).then(function (res) {
        if (pet !== estado.pet) return;
        var fotos = [];
        res.forEach(function (j2) {
          Object.values((j2.query || {}).pages || {}).forEach(function (p) {
            var ii = p.imageinfo && p.imageinfo[0];
            if (!ii || (ii.width && ii.width < 400)) return;
            var md = ii.extmetadata || {};
            var big = ii.thumburl ? ii.thumburl.replace(/\/\d+px-/, "/1600px-") : ii.url;
            if (ii.width && ii.width <= 1600) big = ii.url;
            fotos.push({
              titulo: limpia((md.ObjectName || {}).value) || p.title.replace(/^File:/, "").replace(/\.[^.]+$/, ""),
              mini: ii.thumburl || ii.url, grande: big, pagina: ii.descriptionurl,
              autor: limpia((md.Artist || {}).value), licencia: limpia((md.LicenseShortName || {}).value),
              dist: dist[p.title] || 0
            });
          });
        });
        fotos.sort(function (a, b) { return a.dist - b.dist; });
        estado.fotos = fotos;
        if (!fotos.length) { grid.innerHTML = '<div class="afcMsg">No hay fotos utilizables cerca de este punto.</div>'; return; }
        grid.innerHTML = fotos.map(function (f, i) {
          return '<button type="button" class="afcItem" data-i="' + i + '" title="' + esc(f.titulo) + '"><img src="' + esc(f.mini) +
            '" alt="' + esc(f.titulo) + '" loading="lazy" referrerpolicy="no-referrer"><span>' + fmtDist(f.dist) + "</span></button>";
        }).join("");
      });
    }).catch(function (e) {
      if (pet !== estado.pet) return;
      console.warn("[ANAMBRO] Fotos de Commons", e);
      grid.innerHTML = '<div class="afcMsg">No se ha podido conectar con Wikimedia Commons. Comprueba la conexión e inténtalo de nuevo.</div>';
    });
  }

  /* Delegación: funciona también cuando la ficha se copia al globo 3D */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".anFotosCercaBtn");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    var lat = +b.dataset.lat, lng = +b.dataset.lng;
    if (isFinite(lat) && isFinite(lng)) abrir(lat, lng);
  }, true);
  window.anambroFotosCerca = abrir;

  /* ---------- Botón en las fichas del mapa ---------- */
  function engancha() {
    if (typeof map === "undefined" || !map || !map.on) return setTimeout(engancha, 500);
    map.on("popupopen", function (ev) {
      var p = ev.popup;
      var ll = p && p.getLatLng && p.getLatLng();
      if (!ll) return;
      var pon = function () {
        try {
          var el = p.getElement && p.getElement();
          var c = el && el.querySelector(".leaflet-popup-content");
          if (!c || c.querySelector(".anFotosCercaBtn")) return;
          if (!c.textContent.trim()) return; // ficha aún vacía
          var b = document.createElement("button");
          b.type = "button";
          b.className = "anFotosCercaBtn";
          b.dataset.lat = ll.lat.toFixed(5);
          b.dataset.lng = (((ll.lng + 180) % 360 + 360) % 360 - 180).toFixed(5);
          b.textContent = "📷 Fotos de este lugar (Wikimedia Commons)";
          c.appendChild(b);
          // Recalcula tamaño y posición sin reescribir el contenido (update() borraría el botón)
          if (p._updateLayout) p._updateLayout();
          if (p._updatePosition) p._updatePosition();
        } catch (e) { }
      };
      pon();
      // Algunas fichas se rellenan después (consultas a servicios): se vuelve a comprobar
      [300, 900, 2000].forEach(function (t) { setTimeout(pon, t); });
    });
  }
  engancha();
})();
