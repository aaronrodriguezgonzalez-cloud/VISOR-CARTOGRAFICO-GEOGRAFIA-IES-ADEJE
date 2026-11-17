/* ANAMBRO · rendimiento y diagnóstico de red (2026-11-17)
   1) Los datos que antes se descargaban de GitHub/jsDelivr en cada uso se sirven desde el propio ANAMBRO.
   2) Se evitan los intentos que siempre fallan (jsDelivr devuelve 403 con repositorios grandes).
   3) Los indicadores del Banco Mundial se guardan 7 días en el navegador.
   4) El buscador espera a que se deje de escribir.
   5) Modo diagnóstico: anambro.es/?diagnostico o anambroDiagnostico() en la consola. */
(function () {
  "use strict";
  var V = "20261117";
  var LOCAL = [
    [/natural-earth-vector.*\/ne_10m_populated_places_simple\.geojson/, "anb-toponimos-mundo.json?v=" + V],
    [/natural-earth-vector.*\/ne_50m_land\.geojson/, "anb-tierras-50m.json?v=" + V],
    [/natural-earth-vector.*\/ne_50m_rivers_lake_centerlines\.geojson/, "anb-rios-50m.json?v=" + V],
    [/tectonicplates.*\/PB2002_plates\.json/, "anb-placas.json?v=" + V],
    [/tectonicplates.*\/PB2002_boundaries\.json/, "anb-limites-placas.json?v=" + V]
  ];
  var JSD_GRANDES = /^https:\/\/cdn\.jsdelivr\.net\/gh\/(nvkelso\/natural-earth-vector|fraxen\/tectonicplates|Seshat-Global-History-Databank\/cliopatria)@([^\/]+)\/(.*)$/;
  var WDPA_META = /data-gis\.unep-wcmc\.org\/server\/rest\/services\/ProtectedSites\/The_World_Database_of_Protected_Areas\/MapServer\?f=json$/;
  var WB = /^https:\/\/api\.worldbank\.org\//;

  /* ---------- Registro para el diagnóstico ---------- */
  var D = window.__anDiag = { inicio: Date.now(), recursos: [], fallos: [], bloqueos: [], redirigidas: 0, cacheBM: 0 };
  function host(u) { try { return new URL(u, location.href).host || location.host; } catch (e) { return "?"; } }
  function fallo(u, motivo) { if (D.fallos.length < 3000) D.fallos.push({ t: Math.round(performance.now()), host: host(u), url: String(u).slice(0, 300), motivo: motivo }); }
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        if (D.recursos.length < 20000) D.recursos.push({ host: host(e.name), url: e.name.slice(0, 300), tipo: e.initiatorType, ms: Math.round(e.duration), kb: Math.round((e.transferSize || e.encodedBodySize || 0) / 1024), t: Math.round(e.startTime) });
      });
    }).observe({ type: "resource", buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) { if (D.bloqueos.length < 5000) D.bloqueos.push({ t: Math.round(e.startTime), ms: Math.round(e.duration) }); });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) {}
  window.addEventListener("error", function (ev) {
    var el = ev.target;
    if (el && (el.tagName === "IMG" || el.tagName === "SCRIPT" || el.tagName === "LINK")) fallo(el.src || el.href, "no se pudo cargar (" + el.tagName.toLowerCase() + ")");
  }, true);

  /* ---------- fetch con datos locales, sin intentos inútiles y con caché del Banco Mundial ---------- */
  var fetchOriginal = window.fetch.bind(window);
  function urlDe(input) { return typeof input === "string" ? input : (input && input.url) || String(input); }
  function respuestaJSON(obj) { return new Response(JSON.stringify(obj), { status: 200, headers: { "Content-Type": "application/json" } }); }
  async function conRegistro(input, init) {
    var u = urlDe(input);
    try {
      var r = await fetchOriginal(input, init);
      if (!r.ok) fallo(u, "HTTP " + r.status);
      return r;
    } catch (e) { fallo(u, "sin respuesta (" + (e && e.message || e) + ")"); throw e; }
  }
  async function bancoMundial(u, init) {
    var caja = null, guardada = null;
    try { if (window.caches) { caja = await caches.open("anambro-bancomundial-v1"); guardada = await caja.match(u); } } catch (e) { caja = null; }
    if (guardada) {
      var f = Date.parse(guardada.headers.get("x-anambro-guardado") || "");
      if (f && Date.now() - f < 7 * 864e5) { D.cacheBM++; return guardada; }
    }
    try {
      var r = await conRegistro(u, init && init.cache === "no-store" ? Object.assign({}, init, { cache: "default" }) : init);
      if (r.ok && caja) {
        try { var h = new Headers(r.headers); h.set("x-anambro-guardado", new Date().toISOString()); var b = await r.clone().blob(); await caja.put(u, new Response(b, { status: 200, headers: h })); } catch (e) {}
      }
      return r;
    } catch (e) { if (guardada) return guardada; throw e; }
  }
  window.fetch = async function (input, init) {
    var u = urlDe(input);
    if ((!init || !init.method || init.method === "GET") && typeof u === "string") {
      if (WDPA_META.test(u)) return respuestaJSON({});            // solo servía para actualizar el año de la cita
      for (var i = 0; i < LOCAL.length; i++) {
        if (LOCAL[i][0].test(u)) {
          D.redirigidas++;
          try { var rl = await fetchOriginal(LOCAL[i][1]); if (rl.ok) return rl; } catch (e) {}
          break;                                                   // si falta la copia local, se sigue con el original
        }
      }
      var m = JSD_GRANDES.exec(u);
      if (m) { D.redirigidas++; return conRegistro("https://raw.githubusercontent.com/" + m[1] + "/" + (m[2] === "main" || m[2] === "master" ? m[2] : m[2]) + "/" + m[3], init); }
      if (WB.test(u)) return bancoMundial(u, init);
    }
    return conRegistro(input, init);
  };

  /* ---------- Buscador: busca cuando se deja de escribir ---------- */
  var tBusca = 0;
  document.addEventListener("input", function (ev) {
    var el = ev.target;
    if (!el || el.id !== "anFindIn" || ev.__anDebounced) return;
    ev.stopImmediatePropagation();
    clearTimeout(tBusca);
    tBusca = setTimeout(function () { var e2 = new Event("input", { bubbles: true }); e2.__anDebounced = true; el.dispatchEvent(e2); }, 160);
  }, true);

  /* ---------- Panel de diagnóstico ---------- */
  function resumen() {
    var porHost = {};
    D.recursos.forEach(function (r) {
      var h = porHost[r.host] || (porHost[r.host] = { host: r.host, n: 0, ms: 0, max: 0, kb: 0, fallos: 0 });
      h.n++; h.ms += r.ms; h.max = Math.max(h.max, r.ms); h.kb += r.kb;
    });
    D.fallos.forEach(function (f) { var h = porHost[f.host] || (porHost[f.host] = { host: f.host, n: 0, ms: 0, max: 0, kb: 0, fallos: 0 }); h.fallos++; });
    return Object.values(porHost).map(function (h) { h.medio = h.n ? Math.round(h.ms / h.n) : 0; return h; })
      .sort(function (a, b) { return (b.fallos * 1e6 + b.max) - (a.fallos * 1e6 + a.max); });
  }
  function csv() {
    var filas = [["tipo", "servidor", "url", "ms", "kb", "detalle"]];
    D.recursos.forEach(function (r) { filas.push(["recurso", r.host, r.url, r.ms, r.kb, r.tipo]); });
    D.fallos.forEach(function (f) { filas.push(["fallo", f.host, f.url, "", "", f.motivo]); });
    D.bloqueos.forEach(function (b) { filas.push(["bloqueo", "", "", b.ms, "", "a los " + (b.t / 1000).toFixed(1) + " s"]); });
    return filas.map(function (f) { return f.map(function (c) { c = String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\n");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pintar(p) {
    var r = resumen(), bl = D.bloqueos, tb = bl.reduce(function (s, b) { return s + b.ms; }, 0);
    var lentos = D.recursos.slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 10);
    p.querySelector(".anDiagCuerpo").innerHTML =
      "<p><b>Abierto hace " + Math.round((Date.now() - D.inicio) / 1000) + " s</b> · " + D.recursos.length + " descargas · " + D.fallos.length + " fallos · navegador bloqueado " + (tb / 1000).toFixed(1) + " s en " + bl.length + " ocasiones" +
      " · " + D.redirigidas + " datos servidos desde ANAMBRO · " + D.cacheBM + " consultas del Banco Mundial desde la caché</p>" +
      "<table><tr><th>Servidor</th><th>Descargas</th><th>Tiempo medio</th><th>Más lenta</th><th>KB</th><th>Fallos</th></tr>" +
      r.map(function (h) { return "<tr" + (h.fallos ? ' class="mal"' : h.max > 3000 ? ' class="lento"' : "") + "><td>" + esc(h.host) + "</td><td>" + h.n + "</td><td>" + h.medio + " ms</td><td>" + h.max + " ms</td><td>" + h.kb + "</td><td>" + h.fallos + "</td></tr>"; }).join("") + "</table>" +
      "<h4>Las 10 descargas más lentas</h4><ol>" + lentos.map(function (x) { return "<li>" + (x.ms / 1000).toFixed(1) + " s · " + esc(x.host) + " · <small>" + esc(x.url.replace(/^https?:\/\/[^\/]+/, "").slice(0, 90)) + "</small></li>"; }).join("") + "</ol>" +
      (D.fallos.length ? "<h4>Últimos fallos</h4><ol>" + D.fallos.slice(-10).reverse().map(function (f) { return "<li>" + esc(f.host) + " · " + esc(f.motivo) + " · <small>" + esc(f.url.replace(/^https?:\/\/[^\/]+/, "").slice(0, 90)) + "</small></li>"; }).join("") + "</ol>" : "");
  }
  window.anambroDiagnostico = function () {
    var p = document.getElementById("anDiagPanel");
    if (!p) {
      var st = document.createElement("style");
      st.textContent = "#anDiagPanel{position:fixed;right:12px;bottom:12px;width:min(720px,94vw);max-height:80vh;overflow:auto;background:#fff;color:#1d2a36;border:2px solid #17324d;border-radius:12px;box-shadow:0 8px 30px #0005;z-index:99999;font:14px system-ui,sans-serif;padding:12px 14px}" +
        "#anDiagPanel table{border-collapse:collapse;width:100%;margin:6px 0}#anDiagPanel th,#anDiagPanel td{border:1px solid #d5dee7;padding:4px 6px;text-align:left}#anDiagPanel th{background:#eef3f8}" +
        "#anDiagPanel tr.mal td{background:#fdecea}#anDiagPanel tr.lento td{background:#fff6e0}#anDiagPanel h3{margin:0 0 6px}#anDiagPanel h4{margin:10px 0 4px}#anDiagPanel button{margin-right:6px;padding:6px 10px;border-radius:7px;border:1px solid #17324d;background:#eaf3fd;cursor:pointer}";
      document.head.appendChild(st);
      p = document.createElement("div"); p.id = "anDiagPanel";
      p.innerHTML = '<h3>🩺 Diagnóstico de velocidad de ANAMBRO</h3><div><button data-a="act">Actualizar</button><button data-a="csv">Descargar informe (CSV)</button><button data-a="copia">Copiar resumen</button><button data-a="cerrar">Cerrar</button></div><div class="anDiagCuerpo"></div><p style="font-size:12px;color:#5b6b7a">Usa ANAMBRO con normalidad (capas, globo, análisis…) y pulsa «Actualizar». En rojo, servidores con fallos; en naranja, descargas de más de 3 s.</p>';
      document.body.appendChild(p);
      p.addEventListener("click", function (ev) {
        var a = ev.target && ev.target.dataset && ev.target.dataset.a; if (!a) return;
        if (a === "cerrar") p.remove();
        else if (a === "act") pintar(p);
        else if (a === "csv") { var b = new Blob(["﻿" + csv()], { type: "text/csv" }), l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = "anambro-diagnostico-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".csv"; l.click(); setTimeout(function () { URL.revokeObjectURL(l.href); }, 2000); }
        else if (a === "copia") { var t = resumen().map(function (h) { return h.host + "\t" + h.n + " descargas\t" + h.medio + " ms de media\t" + h.max + " ms máx\t" + h.fallos + " fallos"; }).join("\n"); try { navigator.clipboard.writeText(t); ev.target.textContent = "¡Copiado!"; } catch (e) {} }
      });
    }
    pintar(p);
    return resumen();
  };
  if (/diagnostico/i.test(location.search + location.hash)) {
    window.addEventListener("load", function () { setTimeout(window.anambroDiagnostico, 3000); });
  }
})();
