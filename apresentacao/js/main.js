(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- estado ao vivo ---------- */
  var SERVICOS = {
    api:    { url: "http://localhost:5080/health" },
    ponte:  { url: "http://localhost:8000/health" },
    painel: { url: "http://localhost:5174/painel-risco/" }
  };
  var estado = {};

  var NOMES = { api: "API Ampara", ponte: "Ponte Polícia", painel: "Painel de risco" };
  function anuncia(id, up) {
    var r = document.querySelector("[data-anuncio]");
    if (r) r.textContent = NOMES[id] + (up ? ": respondendo." : ": sem resposta.");
  }

  function pinta(id, up, ms) {
    var antes = estado[id];
    estado[id] = up;
    if (antes !== undefined && antes !== up) anuncia(id, up);
    var els = document.querySelectorAll('[data-svc="' + id + '"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.setAttribute("data-estado", up ? "up" : "down");
      var t = el.querySelector(".st-text");
      if (t) t.textContent = up ? "respondendo" : "sem resposta";
      var m = el.querySelector(".st-ms");
      if (m) m.textContent = up ? "respondeu em " + ms + " ms" : "não sobe? use o launch.json";
    }
    atualizaAba();
  }

  function checa(id) {
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
    var t0 = performance.now();
    var done = false;
    var fim = function (up) {
      if (done) return; done = true; clearTimeout(timer);
      pinta(id, up, Math.round(performance.now() - t0));
    };
    try {
      fetch(SERVICOS[id].url, { mode: "no-cors", cache: "no-store", signal: ctl ? ctl.signal : undefined })
        .then(function () { fim(true); }, function () { fim(false); });
    } catch (e) { fim(false); }
    setTimeout(function () { fim(false); }, 3000);
  }

  function checaTudo() { Object.keys(SERVICOS).forEach(checa); }
  checaTudo();
  setInterval(checaTudo, 8000);

  /* ---------- abas da demo ---------- */
  var ABAS = {
    painel: {
      titulo: "Painel Risco Cidadão",
      desc: "Farol de 0 a 100 e frases claras sobre cada bloqueio. Use o simulador de ataque e veja o farol reagir.",
      desc2: "Roda só com AMPARA_DEMO ligado. O usuário de demonstração está no README da API.",
      url: "http://localhost:5174/painel-risco/", rotulo: "Abrir o painel de risco", svc: "painel"
    },
    api: {
      titulo: "API Ampara no Scalar",
      desc: "Documentação interativa das rotas: auth, aparelhos, guardiões, chaveiros, rota, ocorrências e BO.",
      desc2: "A captura mostra as rotas de 14/11. As rotas de segurança vieram depois.",
      url: "http://localhost:5080/scalar", rotulo: "Abrir o Scalar", svc: "api"
    },
    ponte: {
      titulo: "Ponte Polícia no Swagger",
      desc: "Recebe ocorrências sem dado pessoal e devolve o retorno da polícia. Dá para testar a rota de saúde.",
      desc2: "As rotas de ocorrências pedem a chave de serviço.",
      url: "http://localhost:8000/docs", rotulo: "Abrir o Swagger", svc: "ponte"
    },
    policia: {
      titulo: "Painel da polícia",
      desc: "Mapa de pontos quentes, lista de ocorrências e mudança de status, de recebida a atendida.",
      desc2: "Pede a chave da polícia. A captura usa dados sintéticos.",
      url: "http://localhost:8000/policia", rotulo: "Abrir o painel da polícia", svc: "ponte"
    }
  };
  var abaAtual = "painel";

  function atualizaAba() {
    var a = ABAS[abaAtual];
    var saude = document.querySelector("[data-t-health]");
    if (!saude) return;
    saude.setAttribute("data-svc", a.svc);
    saude.setAttribute("href", a.url);
    var up = estado[a.svc];
    saude.setAttribute("data-estado", up === undefined ? "wait" : up ? "up" : "down");
    var t = saude.querySelector(".st-text");
    t.textContent = up === undefined ? "verificando" : up ? "respondendo agora" : "sem resposta";
  }

  function escolhe(id) {
    abaAtual = id;
    var a = ABAS[id];
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      var on = b.getAttribute("data-tab") === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    document.querySelectorAll("[data-shot]").forEach(function (im) {
      var on = im.getAttribute("data-shot") === id;
      im.hidden = !on;
    });
    document.querySelector("[data-t-title]").textContent = a.titulo;
    document.querySelector("[data-t-desc]").textContent = a.desc;
    document.querySelector("[data-t-desc2]").textContent = a.desc2;
    var open = document.querySelector("[data-t-open]");
    open.setAttribute("href", a.url);
    open.textContent = a.rotulo;
    var sr = document.createElement("span");
    sr.className = "sr"; sr.textContent = " (abre em nova aba)";
    open.appendChild(sr);
    var painelTab = document.querySelector('[role="tabpanel"]');
    if (painelTab) painelTab.setAttribute("aria-labelledby", "tab-" + id);
    atualizaAba();
  }
  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () { escolhe(b.getAttribute("data-tab")); });
    b.addEventListener("keydown", function (e) {
      var ids = Object.keys(ABAS), i = ids.indexOf(abaAtual);
      if (e.key === "ArrowRight") i = (i + 1) % ids.length;
      else if (e.key === "ArrowLeft") i = (i + ids.length - 1) % ids.length;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = ids.length - 1;
      else return;
      e.preventDefault(); escolhe(ids[i]);
      document.querySelector('[data-tab="' + ids[i] + '"]').focus();
    });
  });
  escolhe("painel");

  /* ---------- menu do celular ---------- */
  var mnav = document.querySelector(".mnav");
  if (mnav) mnav.addEventListener("click", function (e) { if (e.target.closest("a")) mnav.removeAttribute("open"); });

  /* ---------- entrada das partes ---------- */
  var alvos = document.querySelectorAll("[data-rv], [data-print]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    alvos.forEach(function (el) { io.observe(el); });
    // rede de seguranca: nada fica escondido se o observador falhar
    setTimeout(function () { alvos.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < window.innerHeight) el.classList.add("in"); }); }, 1500);
  } else {
    alvos.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- foto da faixa: deriva lenta ---------- */
  var band = document.querySelector("[data-parallax] img");
  if (band && !reduce) {
    var tick = false;
    var move = function () {
      tick = false;
      var r = band.parentNode.getBoundingClientRect();
      var h = window.innerHeight;
      if (r.bottom < 0 || r.top > h) return;
      var p = (r.top + r.height / 2 - h / 2) / (h / 2 + r.height / 2);
      band.style.transform = "translate3d(0," + (p * -6).toFixed(2) + "%,0)";
    };
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(move); } }, { passive: true });
    move();
  }

})();
