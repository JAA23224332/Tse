// Faixa "ao vivo" da barra de navegação: placar da apuração do 2º turno em todas as páginas.
// Usada pelas páginas HTML (script na barra) e pelas páginas React (app/nav.tsx carrega este arquivo).
(function () {
  if (window.__aovivo) { window.__aovivo.render(); return; }
  var ABERTURA = Date.parse("2026-10-25T20:00:00Z");
  var texto = "", titulo = "", classe = "";
  var pc = function (x) { return x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"; };

  function render() {
    var el = document.getElementById("aovivo");
    if (!el) return;
    if (!texto) { el.hidden = true; return; }
    el.hidden = false;
    el.className = classe;
    el.title = titulo;
    el.textContent = texto;
  }

  function montar(d) {
    var b = d && d.brasil;
    if (!b) return;
    if (d.modo === "oficial" && b.lula + b.flavio > 0) {
      var tot = b.lula + b.flavio, fim = b.pst >= 100;
      texto = (fim ? "Resultado · " : "Ao vivo · ") + pc(b.pst) + " apurado · Lula " + pc(100 * b.lula / tot) + " × Flávio " + pc(100 * b.flavio / tot);
      titulo = "Contagem oficial do TSE, 2º turno. Abra a apuração para ver a projeção.";
      classe = fim ? "fim" : "vivo";
    } else if (d.modo === "aguardando" || (Date.now() < ABERTURA && Date.now() > ABERTURA - 12 * 3600e3)) {
      texto = Date.now() < ABERTURA ? "Apuração ao vivo às 17h" : "Apuração: aguardando as primeiras seções";
      titulo = "Os números do 2º turno aparecem aqui assim que o TSE começar a totalizar.";
      classe = "espera";
    } else {
      texto = "";
    }
    render();
  }

  function buscar() {
    if (document.hidden) return;
    fetch("/api/apuracao", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(montar).catch(function () {});
  }

  window.__aovivo = { render: render };
  buscar();
  setInterval(buscar, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) buscar(); });
})();
