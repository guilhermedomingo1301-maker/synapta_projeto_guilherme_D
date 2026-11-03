/**
 * Ponto de Entrada Principal da Aplicação
 * São Paulo Housing Analytics — Desafio SYNAPTA 2026
 * Conecta-se à API REST do servidor Flask (/api/dados) quando executado via HTTP,
 * mantendo fallback instantâneo para os dados locais (window.HOUSING_DATA).
 */
window.App = window.App || {};

function startModules() {
  if (window.App.MapModule) {
    window.App.MapModule.init();
  }

  if (window.App.UIModule) {
    window.App.UIModule.init();
  }

  window.addEventListener('resize', function () {
    if (window.App.MapModule) {
      window.App.MapModule.invalidateSize();
    }
    if (window.App.UIModule) {
      window.App.UIModule.resizeAllCharts();
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';

  if (isHttp) {
    fetch('/api/dados')
      .then(function (res) {
        if (!res.ok) throw new Error('Falha ao consultar /api/dados');
        return res.json();
      })
      .then(function (payload) {
        if (payload && payload.geral) {
          window.HOUSING_DATA = payload;
          const counterEl = document.getElementById('header-records-counter');
          const pillEl = document.getElementById('dataset-status-pill');
          if (counterEl) {
            counterEl.textContent = 'Flask API • ' + payload.geral.total_anuncios.toLocaleString('pt-BR') + ' imóveis';
          }
          if (pillEl) {
            pillEl.title = 'Conectado ao servidor local Flask (/api/dados)';
          }
        }
        startModules();
      })
      .catch(function () {
        startModules();
      });
  } else {
    startModules();
  }
});
