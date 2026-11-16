(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var apresentador = /[?&]apresentador\b/.test(location.search);
  if (apresentador) document.body.classList.add("apresentador");

  /* ---------- entradas: só liga a classe se o script chegou até aqui ---------- */
  html.classList.add("rv");
  var rvs = $$("[data-rv]");
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    rvs.forEach(function (el) { io.observe(el); });
  } else {
    rvs.forEach(function (el) { el.classList.add("in"); });
  }
  // tela do herói abre como uma persiana
  var fone = $("#hero-phone"), stage = $(".stage");
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { if (fone) fone.classList.add("open"); if (stage) stage.classList.add("open"); });
  });

  /* ---------- foto da faixa e espinha: movimento ligado à rolagem (transform só) ---------- */
  var band = $("[data-band] img"), spine = $("[data-spine]"), minutos = $("#minutos");
  var ticking = false;
  var pend = rvs.slice();
  function quadro() {
    ticking = false;
    var vh = window.innerHeight;
    if (pend.length) {
      pend = pend.filter(function (el) {
        if (el.classList.contains("in")) return false;
        if (el.getBoundingClientRect().top < vh * 0.92) { el.classList.add("in"); return false; }
        return true;
      });
    }
    if (band && !reduce) {
      var r = band.parentNode.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        band.style.transform = "translate3d(0," + (p * -6).toFixed(2) + "%,0) scale(1.04)";
      }
    }
    if (spine && minutos) {
      var m = minutos.getBoundingClientRect();
      var total = m.height - vh * 0.6;
      var f = Math.max(0, Math.min(1, (vh * 0.6 - m.top) / total));
      spine.style.transform = "scaleY(" + (reduce ? 1 : f.toFixed(3)) + ")";
    }
  }
  function pede() { if (!ticking) { ticking = true; requestAnimationFrame(quadro); } }
  window.addEventListener("scroll", pede, { passive: true });
  window.addEventListener("resize", pede);
  quadro();

  /* ---------- Simular o alarme ---------- */
  var sim = $("#alarme");
  var GUARDIOES = ["Marina", "Paulo", "Helena"];
  var PASSOS = [
    ["Banco", "Ligue para o banco e peça para bloquear o cartão e o acesso pelo app. Se tiver mais de um banco, faça com todos."],
    ["Celular Seguro", "Bloqueie o celular e as linhas pelo Celular Seguro, o serviço do governo."],
    ["Operadora", "Ligue para a operadora e peça para bloquear o chip e a linha."],
    ["Senhas", "Troque a senha do e-mail e das contas que estavam no celular."],
    ["BO", "Avise que o BO será gerado pela própria pessoa, em outro aparelho."]
  ];
  var LIMITE = 60;
  var S = { fase: "idle", g: 0, restante: LIMITE, t0: 0, acelera: false, ultimo: 0, raf: 0, feitos: {} };

  function hhmm(d) { return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  function voz(txt) { var v = $("#sim-voz"); if (v) v.textContent = txt; }
  function mostra(fase) {
    S.fase = fase;
    sim.setAttribute("data-estado", fase === "alarm" ? "alarm" : fase === "idle" ? "idle" : "ack");
    var bloco = fase === "fim" ? "fim" : fase;
    $$("[data-s]", sim).forEach(function (el) { el.hidden = el.getAttribute("data-s") !== bloco; });
    var tela = fase === "alarm" ? "alarm" : fase === "ack" ? "passos" : "idle";
    $$("[data-t]", sim).forEach(function (el) { el.hidden = el.getAttribute("data-t") !== tela; });
  }
  function pintaEscada() {
    $$(".ladder li", sim).forEach(function (li) {
      var i = +li.getAttribute("data-g"), st, tx;
      if (S.fase === "alarm" && i === S.g) { st = "tocando"; tx = "alarme tocando"; }
      else if (i < S.g || (S.fase === "fim")) { st = "sem"; tx = "sem resposta"; }
      else { st = "espera"; tx = "aguardando"; }
      li.setAttribute("data-st", st);
      $(".gs", li).textContent = tx;
    });
    $("#sim-quem").textContent = GUARDIOES[Math.min(S.g, 2)];
    $("#sim-celular").textContent = "Celular do guardião " + (S.g + 1) + ": " + GUARDIOES[Math.min(S.g, 2)];
  }
  function tique(agora) {
    var dt = (agora - S.ultimo) / 1000; S.ultimo = agora;
    S.restante -= dt * (S.acelera ? 6 : 1);
    if (S.restante <= 0) {
      if (S.g < 2) {
        S.g += 1; S.restante = LIMITE;
        pintaEscada();
        voz("Sem resposta. O alarme passou para " + GUARDIOES[S.g] + ", guardião " + (S.g + 1) + " de 3. 60 segundos.");
        $("#sim-origem").textContent = "Chaveiro · " + hhmm(new Date(S.inicio));
        try { if (navigator.vibrate) navigator.vibrate([400, 200, 400]); } catch (e) {}
      } else {
        cancelAnimationFrame(S.raf);
        S.g = 3; mostra("fim"); pintaEscada();
        voz("Os três guardiões ficaram sem resposta. Nesta demonstração o ciclo para aqui.");
        return;
      }
    }
    var n = String(Math.max(0, Math.ceil(S.restante)));
    if (n !== S.shown) { S.shown = n; $("#sim-seg").textContent = n; }
    S.raf = requestAnimationFrame(tique);
  }
  function aperta() {
    if (S.fase !== "idle") return;
    S.inicio = Date.now(); S.g = 0; S.restante = LIMITE; S.ultimo = performance.now();
    $("#sim-origem").textContent = "Chaveiro · " + hhmm(new Date(S.inicio));
    $("#sim-seg").textContent = String(LIMITE); S.shown = String(LIMITE);
    mostra("alarm"); pintaEscada();
    voz("Alarme. O botão do chaveiro de Ana foi apertado. Marina tem 60 segundos para dizer Estou ciente.");
    try { if (navigator.vibrate) navigator.vibrate([500, 300, 500]); } catch (e) {}
    S.raf = requestAnimationFrame(tique);
    var b = $("#sim-ciente"); if (b) setTimeout(function () { try { b.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }
  function ciente() {
    if (S.fase !== "alarm") return;
    cancelAnimationFrame(S.raf);
    var quem = GUARDIOES[S.g];
    var decorrido = Math.max(1, Math.round((Date.now() - S.inicio) / 1000));
    mostra("ack");
    $("#sim-ackmsg").textContent = quem + " assumiu o alarme em " + decorrido + " s.";
    voz(quem + " disse Estou ciente. A escada parou. Agora o passo a passo.");
    S.cienteEm = Date.now();
    $("#sim-prog").textContent = "0 de 5 feitos";
    var area = $(".scroll", sim); if (area) area.scrollTop = 0;
  }
  function montaPassos() {
    var ol = $("#sim-passos");
    while (ol.firstChild) ol.removeChild(ol.firstChild);
    PASSOS.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "passo"; li.setAttribute("data-i", i);
      var h = document.createElement("h4"); h.textContent = p[0];
      var t = document.createElement("p"); t.textContent = p[1];
      var b = document.createElement("button"); b.type = "button"; b.className = "app-btn sm"; b.textContent = "Marcar como feito";
      b.setAttribute("aria-label", "Marcar como feito: " + p[0]);
      var f = document.createElement("p"); f.className = "feito";
      li.appendChild(h); li.appendChild(t); li.appendChild(b); li.appendChild(f);
      b.addEventListener("click", function () { marca(i, li, f); });
      ol.appendChild(li);
    });
  }
  function marca(i, li, f) {
    if (S.feitos[i]) return;
    var agora = new Date();
    S.feitos[i] = agora;
    li.classList.add("ok");
    f.textContent = "Feito às " + hhmm(agora);
    var n = Object.keys(S.feitos).length;
    $("#sim-prog").textContent = n + " de 5 feitos";
    var seg = Math.max(0, Math.round((agora.getTime() - S.inicio) / 1000));
    var rel = Math.floor(seg / 60) + ":" + ("0" + (seg % 60)).slice(-2);
    var log = $("#sim-log"), item = document.createElement("li");
    var lt = document.createElement("span"); lt.className = "lt"; lt.textContent = rel;
    var nome = document.createElement("span"); nome.className = "ln";
    nome.textContent = PASSOS[i][0];
    item.appendChild(lt); item.appendChild(nome);
    var sub = document.createElement("span"); sub.className = "lh";
    sub.textContent = "às " + hhmm(agora) + ", " + (Math.floor(seg / 60) ? Math.floor(seg / 60) + " min " : "") + (seg % 60) + " s depois do alarme";
    nome.appendChild(sub);
    log.appendChild(item);
    $("#sim-log-vazio").hidden = true;
    voz(PASSOS[i][0] + " marcado às " + hhmm(agora) + ". " + n + " de 5 feitos.");
  }
  function reinicia() {
    cancelAnimationFrame(S.raf);
    S.feitos = {}; S.g = 0; S.restante = LIMITE;
    while ($("#sim-log").firstChild) $("#sim-log").removeChild($("#sim-log").firstChild); $("#sim-log-vazio").hidden = false;
    montaPassos(); mostra("idle"); pintaEscada();
    voz("Demonstração reiniciada.");
    var f = $("#fob"); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  if (sim) {
    montaPassos();
    mostra("idle");
    $("#fob").addEventListener("click", aperta);
    $("#sim-ciente").addEventListener("click", ciente);
    $("#sim-reinicia").addEventListener("click", reinicia);
    var ac = $("#sim-acelera");
    ac.addEventListener("click", function () {
      S.acelera = !S.acelera;
      ac.setAttribute("aria-pressed", S.acelera ? "true" : "false");
      voz(S.acelera ? "Tempo 6 vezes mais rápido." : "Tempo real.");
    });
    // atalho do apresentador: A aperta o chaveiro, E marca ciente (fora de campos)
    document.addEventListener("keydown", function (e) {
      if (!apresentador || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "a" || e.key === "A") aperta();
      if (e.key === "e" || e.key === "E") ciente();
    });
  }

  /* ---------- serviços locais (rodapé; só o apresentador vê verde) ---------- */
  var SERVICOS = {
    api:    { url: "http://localhost:5080/health" },
    ponte:  { url: "http://localhost:8000/health" },
    painel: { url: "http://localhost:5174/painel-risco/" }
  };
  var NOMES = { api: "API Ampara", ponte: "Ponte Polícia", painel: "Painel de risco" };
  var estado = {};
  function anuncia(id, up) {
    var r = $("[data-anuncio]");
    if (r) r.textContent = NOMES[id] + (up ? ": respondendo." : ": sem resposta.");
  }
  function pinta(id, up) {
    var antes = estado[id];
    estado[id] = up;
    if (apresentador && antes !== undefined && antes !== up) anuncia(id, up);
    $$('[data-svc="' + id + '"]').forEach(function (el) {
      el.setAttribute("data-estado", up ? "up" : "down");
      var t = $(".st-text", el);
      if (t) t.textContent = up ? "respondendo" : "sem resposta";
    });
  }
  function checa(id) {
    var ctl = ("AbortController" in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 2500);
    var done = false;
    var fim = function (up) { if (done) return; done = true; clearTimeout(timer); pinta(id, up); };
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
    painel: { titulo: "Painel Risco Cidadão", desc: "Farol de 0 a 100 e frases claras sobre cada bloqueio. Use o simulador de ataque e veja o farol reagir.", desc2: "Roda só com AMPARA_DEMO ligado. O usuário de demonstração está no README da API.", url: "http://localhost:5174/painel-risco/", rotulo: "Abrir o painel de risco" },
    api: { titulo: "API Ampara no Scalar", desc: "Documentação interativa das rotas: auth, aparelhos, guardiões, chaveiros, rota, ocorrências e BO.", desc2: "A captura mostra as rotas de 14/11. As rotas de segurança vieram depois.", url: "http://localhost:5080/scalar", rotulo: "Abrir o Scalar" },
    ponte: { titulo: "Ponte Polícia no Swagger", desc: "Recebe ocorrências sem dado pessoal e devolve o retorno da polícia. Dá para testar a rota de saúde.", desc2: "As rotas de ocorrências pedem a chave de serviço.", url: "http://localhost:8000/docs", rotulo: "Abrir o Swagger" },
    policia: { titulo: "Painel da polícia", desc: "Mapa de pontos quentes, lista de ocorrências e mudança de status, de recebida a atendida.", desc2: "Pede a chave da polícia. A captura usa dados sintéticos.", url: "http://localhost:8000/policia", rotulo: "Abrir o painel da polícia" }
  };
  function escolhe(id) {
    var a = ABAS[id];
    $$("[data-tab]").forEach(function (b) {
      var on = b.getAttribute("data-tab") === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.setAttribute("tabindex", on ? "0" : "-1");
    });
    $$("[data-shot]").forEach(function (im) { im.hidden = im.getAttribute("data-shot") !== id; });
    $("[data-t-title]").textContent = a.titulo;
    $("[data-t-desc]").textContent = a.desc;
    $("[data-t-desc2]").textContent = a.desc2;
    var open = $("[data-t-open]");
    open.setAttribute("href", a.url);
    open.textContent = a.rotulo;
    var sr = document.createElement("span"); sr.className = "sr"; sr.textContent = " (abre em nova aba)";
    open.appendChild(sr);
    $('[role="tabpanel"]').setAttribute("aria-labelledby", "tab-" + id);
  }
  var abas = $$("[data-tab]");
  abas.forEach(function (b, i) {
    b.addEventListener("click", function () { escolhe(b.getAttribute("data-tab")); });
    b.addEventListener("keydown", function (e) {
      var n = null;
      if (e.key === "ArrowRight") n = (i + 1) % abas.length;
      else if (e.key === "ArrowLeft") n = (i - 1 + abas.length) % abas.length;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = abas.length - 1;
      if (n !== null) { e.preventDefault(); abas[n].focus(); escolhe(abas[n].getAttribute("data-tab")); }
    });
  });
  escolhe("painel");

  /* ---------- menu do celular fecha ao escolher ---------- */
  $$(".mnav a").forEach(function (a) { a.addEventListener("click", function () { var d = $(".mnav"); if (d) d.removeAttribute("open"); }); });
})();
