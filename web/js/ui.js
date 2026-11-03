/**
 * Módulo de Interface e Visualização Analítica (Chart.js, Regiões, Bairros, Anúncios Separados & Legenda)
 * Desafio SYNAPTA - São Paulo Housing Analytics
 */
window.App = window.App || {};

window.App.UIModule = (function () {
  let charts = {
    typeComparison: null,
    bedrooms: null,
    rankings: null
  };

  let activeRegion = 'all';
  let activeDistrict = 'all';
  let activePropertyType = 'all';
  let activePriceTier = null;

  let listingsSearchQuery = '';
  let listingsSortMode = 'zone_grouped';
  let listingsVisibleLimit = 30;
  let highlightedListingId = null;
  let searchDebounceTimer = null;
  let tableDebounceTimer = null;

  const TIER_CONFIG = {
    'low': { label: '≤ R$ 2.000', color: '#10b981', min: 0, max: 2000 },
    'mid-low': { label: 'R$ 2k-3.5k', color: '#3b82f6', min: 2000.01, max: 3500 },
    'mid-high': { label: 'R$ 3.5k-5k', color: '#f59e0b', min: 3500.01, max: 5000 },
    'high': { label: '> R$ 5k', color: '#ef4444', min: 5000.01, max: Infinity }
  };

  const ZONE_DOT_COLORS = {
    'Centro': '#8b5cf6',
    'Zona Norte': '#06b6d4',
    'Zona Sul': '#10b981',
    'Zona Leste': '#f59e0b',
    'Zona Oeste': '#ec4899',
    'Região Metropolitana': '#64748b',
    'Não Classificado': '#94a3b8'
  };

  function init() {
    initTheme();
    initTabs();
    initResizer();
    initMobileSwitcher();

    if (window.HOUSING_DATA) {
      populateDistrictSelect('all');
      populateDistrictsTable();
      updateKPIsAndSummary();
      initCharts();
      bindFilters();
      bindListingsControls();
      renderIndividualListings();
    }
  }

  function getFilterState() {
    return {
      regiao: activeRegion,
      district: activeDistrict,
      propertyType: activePropertyType,
      priceTier: activePriceTier
    };
  }

  /* ----------------------------------------------------
   * TEMA & ESTILOS
   * ---------------------------------------------------- */
  function initTheme() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    const savedTheme = localStorage.getItem('projeto-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    applyTheme(initialTheme);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('projeto-theme', next);
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const labelEl = document.getElementById('theme-toggle-label');
    if (labelEl) {
      labelEl.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
    }
    if (window.App.MapModule) {
      window.App.MapModule.setThemeTiles(theme);
    }
    updateChartsTheme();
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  /* ----------------------------------------------------
   * ABAS E NAVEGAÇÃO
   * ---------------------------------------------------- */
  function activateTab(targetName) {
    const tabButtons = document.querySelectorAll('[data-tab-target]');
    const tabPanes = document.querySelectorAll('[data-tab-pane]');

    tabButtons.forEach(function (b) {
      const active = b.getAttribute('data-tab-target') === targetName;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', String(active));
    });

    tabPanes.forEach(function (pane) {
      const isMatch = pane.getAttribute('data-tab-pane') === targetName;
      pane.classList.toggle('is-active', isMatch);
    });

    if (targetName === 'indicadores') {
      resizeAllCharts();
    }
  }

  function initTabs() {
    const tabButtons = document.querySelectorAll('[data-tab-target]');
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-tab-target');
        activateTab(target);
      });
    });

    const kpiAnunciosCard = document.getElementById('kpi-card-anuncios');
    if (kpiAnunciosCard) {
      kpiAnunciosCard.addEventListener('click', function () {
        activateTab('anuncios');
      });
    }
  }

  /* ----------------------------------------------------
   * REDIMENSIONADOR CENTRAL & OBSERVADOR DE PAINÉIS
   * ---------------------------------------------------- */
  function initResizer() {
    const resizer = document.getElementById('panel-resizer');
    const workspace = document.getElementById('workspace');
    const mapPanel = document.getElementById('map-panel');
    const infoPanel = document.getElementById('info-panel');

    if (!resizer || !workspace || !mapPanel) return;

    let isDragging = false;
    let rafId = null;

    resizer.addEventListener('pointerdown', function (e) {
      isDragging = true;
      resizer.classList.add('is-dragging');
      resizer.setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    resizer.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      const rect = workspace.getBoundingClientRect();
      if (rect.width <= 0) return;

      const resizerWidth = resizer.offsetWidth || 6;
      const minMapPx = 300;
      const minInfoPx = 320;
      const maxMapPx = Math.max(minMapPx, rect.width - minInfoPx - resizerWidth);

      const offsetX = e.clientX - rect.left;
      const clampedPx = Math.min(maxMapPx, Math.max(minMapPx, offsetX));
      const percentage = (clampedPx / rect.width) * 100;

      document.documentElement.style.setProperty('--map-panel-width', `${percentage.toFixed(2)}%`);
    });

    function stopDragging(e) {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (e && e.pointerId !== undefined && resizer.hasPointerCapture(e.pointerId)) {
        resizer.releasePointerCapture(e.pointerId);
      }
      if (window.App.MapModule) {
        window.App.MapModule.invalidateSize();
      }
      resizeAllCharts();
    }

    resizer.addEventListener('pointerup', stopDragging);
    resizer.addEventListener('pointercancel', stopDragging);
  }

  function initMobileSwitcher() {
    const workspace = document.getElementById('workspace');
    const buttons = document.querySelectorAll('[data-mobile-mode]');
    if (!workspace || !buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const mode = btn.getAttribute('data-mobile-mode');
        if (mode === 'split') {
          workspace.removeAttribute('data-mobile-view');
        } else {
          workspace.setAttribute('data-mobile-view', mode);
        }

        buttons.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });

        if (window.App.MapModule) {
          setTimeout(window.App.MapModule.invalidateSize, 80);
        }
        setTimeout(resizeAllCharts, 80);
      });
    });
  }

  /* ----------------------------------------------------
   * FILTROS DE REGIÃO, BAIRRO E LEGENDA
   * ---------------------------------------------------- */
  function populateDistrictSelect(regiaoFilter) {
    const select = document.getElementById('select-district');
    if (!select || !window.HOUSING_DATA) return;

    select.innerHTML = '';
    const firstOpt = document.createElement('option');
    firstOpt.value = 'all';
    firstOpt.textContent = (!regiaoFilter || regiaoFilter === 'all')
      ? 'Todos os Bairros (Geral SP)'
      : `Todos da ${regiaoFilter}`;
    select.appendChild(firstOpt);

    const bairros = window.HOUSING_DATA.bairros.filter(function (b) {
      return !regiaoFilter || regiaoFilter === 'all' || b.regiao === regiaoFilter;
    });

    bairros.forEach(function (b) {
      const opt = document.createElement('option');
      opt.value = b.nome;
      opt.textContent = `${b.nome} (${b.qtd_imoveis})`;
      select.appendChild(opt);
    });
  }

  function bindFilters() {
    const selectRegionEl = document.getElementById('select-region');
    const selectDistrictEl = document.getElementById('select-district');
    const selectTypeEl = document.getElementById('select-property-type');
    const btnReset = document.getElementById('btn-reset-selection');
    const btnMapClear = document.getElementById('btn-map-clear-filters');
    const btnListingsClear = document.getElementById('btn-listings-clear-filters');
    const tableSearch = document.getElementById('table-search-input');

    if (selectRegionEl) {
      selectRegionEl.addEventListener('change', function () {
        selectRegion(selectRegionEl.value, false);
      });
    }

    if (selectDistrictEl) {
      selectDistrictEl.addEventListener('change', function () {
        selectDistrictAction(selectDistrictEl.value);
      });
    }

    if (selectTypeEl) {
      selectTypeEl.addEventListener('change', function () {
        activePropertyType = selectTypeEl.value;
        listingsVisibleLimit = 60;
        if (window.App.MapModule) {
          window.App.MapModule.applySpatialFilters({
            regiao: activeRegion,
            district: activeDistrict,
            propertyType: activePropertyType,
            priceTier: activePriceTier,
            zoom: false
          });
        }
        refreshViewFromFilters();
      });
    }

    [btnReset, btnMapClear, btnListingsClear].forEach(function (btn) {
      if (btn) {
        btn.addEventListener('click', function () {
          resetSelection();
        });
      }
    });

    if (tableSearch) {
      tableSearch.addEventListener('input', function () {
        if (tableDebounceTimer) clearTimeout(tableDebounceTimer);
        tableDebounceTimer = setTimeout(function () {
          filterDistrictsTable(tableSearch.value);
        }, 140);
      });
    }
  }

  function syncZoneUI(regiao) {
    const selectRegion = document.getElementById('select-region');
    if (selectRegion) selectRegion.value = regiao;

    const zoneButtons = document.querySelectorAll('[data-zone-filter]');
    zoneButtons.forEach(function (btn) {
      const z = btn.getAttribute('data-zone-filter');
      btn.classList.toggle('is-active', z === regiao);
    });

    const listingsZoneBtns = document.querySelectorAll('[data-listings-zone]');
    listingsZoneBtns.forEach(function (btn) {
      const z = btn.getAttribute('data-listings-zone');
      btn.classList.toggle('is-active', z === regiao);
    });
  }

  function selectRegion(regiao, allowToggle) {
    const nextRegion = (allowToggle && activeRegion === regiao && regiao !== 'all') ? 'all' : (regiao || 'all');
    activeRegion = nextRegion;
    activeDistrict = 'all';
    listingsVisibleLimit = 60;
    highlightedListingId = null;

    syncZoneUI(activeRegion);
    populateDistrictSelect(activeRegion);

    if (window.App.MapModule) {
      window.App.MapModule.applySpatialFilters({
        regiao: activeRegion,
        district: 'all',
        priceTier: activePriceTier,
        zoom: true
      });
    }

    refreshViewFromFilters();
  }

  function selectDistrictAction(nome, fromMapCircleClick) {
    activeDistrict = nome;
    listingsVisibleLimit = 60;
    const selectDistrict = document.getElementById('select-district');

    if (nome !== 'all' && window.HOUSING_DATA) {
      const b = window.HOUSING_DATA.bairros.find(function (item) { return item.nome === nome; });
      if (b && b.regiao && ['Centro', 'Zona Norte', 'Zona Sul', 'Zona Leste', 'Zona Oeste', 'Região Metropolitana'].includes(b.regiao)) {
        if (activeRegion !== b.regiao) {
          activeRegion = b.regiao;
          syncZoneUI(activeRegion);
          populateDistrictSelect(activeRegion);
        }
      }
      if (selectDistrict) selectDistrict.value = nome;
      if (window.App.MapModule) {
        window.App.MapModule.applySpatialFilters({
          regiao: activeRegion,
          district: nome,
          priceTier: activePriceTier,
          zoom: false
        });
        window.App.MapModule.focusDistrict(nome, !fromMapCircleClick);
      }
    } else {
      if (selectDistrict) selectDistrict.value = 'all';
      if (window.App.MapModule) {
        window.App.MapModule.applySpatialFilters({
          regiao: activeRegion,
          district: 'all',
          priceTier: activePriceTier,
          zoom: true
        });
      }
    }

    refreshViewFromFilters();
  }

  function selectDistrict(nome, fromMapCircleClick) {
    selectDistrictAction(nome, fromMapCircleClick);
  }

  /**
   * Abre diretamente a aba de Anúncios Separados para a zona/bairro clicado no mapa ou tabela
   */
  function openDistrictListings(nomeBairro, anuncioId) {
    highlightedListingId = anuncioId || null;
    if (nomeBairro && nomeBairro !== 'all') {
      selectDistrictAction(nomeBairro, true);
    }
    activateTab('anuncios');

    if (anuncioId) {
      setTimeout(function () {
        const cardEl = document.getElementById('listing-card-' + anuncioId);
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'auto', block: 'center' });
          cardEl.classList.add('is-highlighted');
        }
      }, 60);
    }
  }

  function handlePriceTierClick(tier) {
    const tierButtons = document.querySelectorAll('[data-price-tier]');
    const colorScale = document.querySelector('.legend-color-scale');
    const btnClear = document.getElementById('btn-clear-tier-filter');

    if (!tier || activePriceTier === tier) {
      activePriceTier = null;
      tierButtons.forEach(function (b) { b.classList.remove('is-active'); });
      if (colorScale) colorScale.classList.remove('has-filter');
      if (btnClear) btnClear.style.display = 'none';
    } else {
      activePriceTier = tier;
      activeDistrict = 'all';
      const selectDistrict = document.getElementById('select-district');
      if (selectDistrict) selectDistrict.value = 'all';

      tierButtons.forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-price-tier') === tier);
      });
      if (colorScale) colorScale.classList.add('has-filter');
      if (btnClear) btnClear.style.display = 'inline-block';
    }

    if (window.App.MapModule) {
      window.App.MapModule.applySpatialFilters({
        regiao: activeRegion,
        district: activeDistrict,
        priceTier: activePriceTier,
        zoom: true
      });
    }

    refreshViewFromFilters();
  }

  function resetSelection() {
    activeRegion = 'all';
    activeDistrict = 'all';
    activePropertyType = 'all';
    activePriceTier = null;
    listingsSearchQuery = '';
    listingsVisibleLimit = 60;
    highlightedListingId = null;

    syncZoneUI('all');
    populateDistrictSelect('all');

    const selectType = document.getElementById('select-property-type');
    if (selectType) selectType.value = 'all';

    const searchInput = document.getElementById('listings-search-input');
    if (searchInput) searchInput.value = '';

    const tableSearch = document.getElementById('table-search-input');
    if (tableSearch) tableSearch.value = '';

    const tierButtons = document.querySelectorAll('[data-price-tier]');
    const colorScale = document.querySelector('.legend-color-scale');
    const btnClear = document.getElementById('btn-clear-tier-filter');
    tierButtons.forEach(function (b) { b.classList.remove('is-active'); });
    if (colorScale) colorScale.classList.remove('has-filter');
    if (btnClear) btnClear.style.display = 'none';

    if (window.App.MapModule) {
      window.App.MapModule.applySpatialFilters({ regiao: 'all', district: 'all', priceTier: null, zoom: false });
      window.App.MapModule.resetView();
    }

    refreshViewFromFilters();
  }

  function updateClearButtonsState() {
    const hasFilter = (
      activeRegion !== 'all' ||
      activeDistrict !== 'all' ||
      activePropertyType !== 'all' ||
      Boolean(activePriceTier) ||
      Boolean(listingsSearchQuery && listingsSearchQuery.trim())
    );
    const ids = ['btn-map-clear-filters', 'btn-reset-selection', 'btn-listings-clear-filters'];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('has-active-filters', hasFilter);
    });
  }

  function refreshViewFromFilters() {
    updateClearButtonsState();
    updateKPIsAndSummary();
    updateChartsData();
    populateDistrictsTable(getFilteredBairrosList());
    renderIndividualListings();
  }

  function getFilteredBairrosList() {
    if (!window.HOUSING_DATA) return [];
    const cfg = activePriceTier ? TIER_CONFIG[activePriceTier] : null;

    return window.HOUSING_DATA.bairros.filter(function (b) {
      const matchReg = activeRegion === 'all' || b.regiao === activeRegion;
      const matchTier = !cfg || (b.aluguel_medio >= cfg.min && b.aluguel_medio <= cfg.max);
      return matchReg && matchTier;
    });
  }

  /* ----------------------------------------------------
   * ABA DE ANÚNCIOS SEPARADOS POR ZONA / BAIRRO
   * ---------------------------------------------------- */
  function bindListingsControls() {
    const zoneBtns = document.querySelectorAll('[data-listings-zone]');
    const searchInput = document.getElementById('listings-search-input');
    const sortSelect = document.getElementById('listings-sort-select');
    const btnClearDistrict = document.getElementById('btn-clear-district-listings');
    const btnLoadMore = document.getElementById('btn-load-more-listings');
    const btnShowPins = document.getElementById('btn-listings-show-pins');

    zoneBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const z = btn.getAttribute('data-listings-zone');
        selectRegion(z, false);
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function () {
          listingsSearchQuery = searchInput.value || '';
          listingsVisibleLimit = 30;
          updateClearButtonsState();
          renderIndividualListings();
        }, 140);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        listingsSortMode = sortSelect.value;
        renderIndividualListings();
      });
    }

    if (btnClearDistrict) {
      btnClearDistrict.addEventListener('click', function () {
        selectDistrictAction('all');
      });
    }

    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', function () {
        listingsVisibleLimit += 50;
        renderIndividualListings();
      });
    }

    if (btnShowPins) {
      btnShowPins.addEventListener('click', function () {
        if (window.App.MapModule) {
          window.App.MapModule.setPinsMode(true, getFilterState());
        }
      });
    }
  }

  function getFilteredListings() {
    if (!window.HOUSING_DATA || !window.HOUSING_DATA.anuncios) return [];

    const cfg = activePriceTier ? TIER_CONFIG[activePriceTier] : null;
    const term = listingsSearchQuery.trim().toLowerCase();

    // Se houver filtro de faixa da legenda (que é baseado na média do bairro), identificar bairros elegíveis
    let allowedDistrictsSet = null;
    if (cfg) {
      allowedDistrictsSet = new Set(
        window.HOUSING_DATA.bairros
          .filter(function (b) { return b.aluguel_medio >= cfg.min && b.aluguel_medio <= cfg.max; })
          .map(function (b) { return b.nome; })
      );
    }

    return window.HOUSING_DATA.anuncios.filter(function (a) {
      if (activeRegion !== 'all' && a.regiao !== activeRegion) return false;
      if (activeDistrict !== 'all' && a.district !== activeDistrict) return false;
      if (activePropertyType !== 'all' && a.type !== activePropertyType) return false;
      if (allowedDistrictsSet && !allowedDistrictsSet.has(a.district)) return false;
      if (term) {
        const hay = `${a.address} ${a.district} ${a.regiao} ${a.type}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  function buildListingCardHtml(a) {
    const zColor = ZONE_DOT_COLORS[a.regiao] || '#64748b';
    const isHigh = highlightedListingId === a.id ? ' is-highlighted' : '';
    const hasPin = Array.isArray(a.coords);
    const escapedDistrict = a.district.replace(/'/g, "\\'");

    return `
      <article class="listing-item-card${isHigh}" id="listing-card-${a.id}">
        <div class="listing-card-top">
          <div class="listing-badges-group">
            <span class="listing-type-badge">${a.type}</span>
            <span class="zone-table-badge">
              <span class="zone-dot" style="background: ${zColor};"></span>${a.regiao}
            </span>
            <button type="button" class="listing-district-pill" onclick="window.App.UIModule.selectDistrict('${escapedDistrict}')" title="Filtrar zona deste bairro">
              ${a.district}
            </button>
          </div>
          <span class="listing-id-tag">#${a.id}</span>
        </div>

        <div class="listing-card-body">
          <div class="listing-address-col">
            <h4 class="listing-address-title">${a.address || ('Imóvel em ' + a.district)}</h4>
            <div class="listing-specs-row">
              <span class="listing-spec-chip"><strong>${a.area}</strong> m²</span>
              <span class="listing-spec-chip"><strong>${a.bedrooms}</strong> quarto(s)</span>
              <span class="listing-spec-chip"><strong>${a.garage}</strong> vaga(s)</span>
              <span class="listing-spec-chip">R$ <strong>${a.rent_m2.toLocaleString('pt-BR')}</strong>/m²</span>
            </div>
          </div>

          <div class="listing-price-col">
            <div class="listing-rent-main">R$ ${a.rent.toLocaleString('pt-BR')}<small>/mês</small></div>
            <div class="listing-total-sub">Total c/ taxas: R$ ${a.total.toLocaleString('pt-BR')}</div>
            ${hasPin ? `
              <button type="button" class="listing-pin-btn" onclick="window.App.MapModule.focusListingPin(${a.id})">
                &#128205; Localizar no Mapa
              </button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  function renderIndividualListings() {
    const container = document.getElementById('individual-listings-container');
    const summaryStrip = document.getElementById('listings-summary-strip');
    const loadMoreWrap = document.getElementById('listings-load-more-wrap');
    const btnLoadMore = document.getElementById('btn-load-more-listings');
    const tabBadge = document.getElementById('tab-anuncios-badge');
    const districtBanner = document.getElementById('listings-active-district-banner');
    const bannerName = document.getElementById('listings-banner-district-name');
    const bannerStats = document.getElementById('listings-banner-district-stats');

    if (!container || !window.HOUSING_DATA) return;

    const filtrados = getFilteredListings();
    if (tabBadge) {
      tabBadge.textContent = filtrados.length.toLocaleString('pt-BR');
    }

    // Banner quando um círculo/bairro específico está selecionado
    if (districtBanner) {
      if (activeDistrict !== 'all') {
        const bObj = window.HOUSING_DATA.bairros.find(function (item) { return item.nome === activeDistrict; });
        districtBanner.style.display = 'flex';
        if (bannerName) bannerName.textContent = `${activeDistrict} (${activeRegion})`;
        if (bannerStats && bObj) {
          bannerStats.textContent = `• ${filtrados.length} anúncio(s) | Média R$ ${bObj.aluguel_medio.toLocaleString('pt-BR')} | Mediana R$ ${bObj.aluguel_mediano.toLocaleString('pt-BR')}`;
        }
      } else {
        districtBanner.style.display = 'none';
      }
    }

    if (filtrados.length === 0) {
      if (summaryStrip) {
        summaryStrip.innerHTML = 'Nenhum anúncio encontrado para os filtros aplicados.';
      }
      container.innerHTML = `
        <div class="placeholder-box" style="padding: 1.5rem;">
          <span class="placeholder-title">Sem anúncios para este filtro</span>
          <span class="placeholder-desc">Limpe a busca ou altere a região/tipo de imóvel selecionado.</span>
        </div>
      `;
      if (loadMoreWrap) loadMoreWrap.style.display = 'none';
      return;
    }

    // Estatísticas rápidas dos anúncios listados (sem Math.min.apply para evitar estouro de pilha em arrays grandes)
    let minR = Infinity;
    let maxR = -Infinity;
    let sumR = 0;
    for (let i = 0; i < filtrados.length; i++) {
      const r = filtrados[i].rent;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      sumR += r;
    }
    const avgR = Math.round(sumR / filtrados.length);

    const contextText = activeDistrict !== 'all'
      ? `na zona <strong>${activeDistrict}</strong> (${activeRegion})`
      : (activeRegion !== 'all' ? `na <strong>${activeRegion}</strong>` : 'em <strong>Todas as Zonas</strong>');

    if (summaryStrip) {
      summaryStrip.innerHTML = `
        Mostrando <strong>${filtrados.length.toLocaleString('pt-BR')} anúncio(s)</strong> ${contextText} &bull;
        Média: <strong>R$ ${avgR.toLocaleString('pt-BR')}</strong> &bull;
        Faixa: R$ ${minR.toLocaleString('pt-BR')} a R$ ${maxR.toLocaleString('pt-BR')}
      `;
    }

    // Ordenação
    const sorted = filtrados.slice();
    if (listingsSortMode === 'rent_desc') {
      sorted.sort(function (a, b) { return b.rent - a.rent; });
    } else if (listingsSortMode === 'rent_asc') {
      sorted.sort(function (a, b) { return a.rent - b.rent; });
    } else if (listingsSortMode === 'area_desc') {
      sorted.sort(function (a, b) { return b.area - a.area; });
    } else if (listingsSortMode === 'm2_asc') {
      sorted.sort(function (a, b) { return (a.rent_m2 || 999999) - (b.rent_m2 || 999999); });
    } else if (listingsSortMode === 'total_desc') {
      sorted.sort(function (a, b) { return b.total - a.total; });
    }

    const visibleSlice = sorted.slice(0, listingsVisibleLimit);

    // Se o modo for "Separar por Zona / Bairro" (zone_grouped) e não estivermos em um único bairro,
    // agrupamos visualmente por Macrozona de São Paulo para que cada Zona tenha seu próprio bloco!
    if (listingsSortMode === 'zone_grouped' && activeDistrict === 'all') {
      const zoneOrder = ['Centro', 'Zona Oeste', 'Zona Sul', 'Zona Leste', 'Zona Norte', 'Região Metropolitana', 'Não Classificado'];
      const groupsByZone = {};
      const countsByZone = {};

      filtrados.forEach(function (item) {
        const z = item.regiao || 'Não Classificado';
        countsByZone[z] = (countsByZone[z] || 0) + 1;
      });

      visibleSlice.forEach(function (item) {
        const z = item.regiao || 'Não Classificado';
        if (!groupsByZone[z]) groupsByZone[z] = [];
        groupsByZone[z].push(item);
      });

      const sectionsHtml = [];
      zoneOrder.forEach(function (zName) {
        const zItems = groupsByZone[zName];
        if (!zItems || zItems.length === 0) return;

        const zColor = ZONE_DOT_COLORS[zName] || '#64748b';
        const totalInZone = countsByZone[zName] || zItems.length;

        sectionsHtml.push(`
          <div class="zone-listings-section">
            <div class="zone-listings-section-header" style="border-left: 4px solid ${zColor};">
              <div class="zone-section-title-group">
                <span class="zone-dot" style="background: ${zColor};"></span>
                <strong>${zName}</strong>
                <span class="zone-section-count">${totalInZone.toLocaleString('pt-BR')} anúncio(s) nesta zona</span>
              </div>
              ${activeRegion === 'all' ? `
                <button type="button" class="table-action-btn" onclick="window.App.UIModule.selectRegion('${zName}', false)">
                  Isolar ${zName}
                </button>
              ` : ''}
            </div>
            <div class="zone-listings-cards">
              ${zItems.map(buildListingCardHtml).join('')}
            </div>
          </div>
        `);
      });

      container.innerHTML = sectionsHtml.join('');
    } else {
      container.innerHTML = visibleSlice.map(buildListingCardHtml).join('');
    }

    if (loadMoreWrap && btnLoadMore) {
      const remaining = sorted.length - visibleSlice.length;
      if (remaining > 0) {
        loadMoreWrap.style.display = 'block';
        btnLoadMore.textContent = `Carregar mais anúncios (+${Math.min(80, remaining)} de ${remaining.toLocaleString('pt-BR')} restantes)`;
      } else {
        loadMoreWrap.style.display = 'none';
      }
    }
  }

  function calcMean(arr) {
    if (!arr || !arr.length) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
  }

  function calcMedian(arr) {
    if (!arr || !arr.length) return 0;
    const sorted = arr.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function computeDynamicBlockFromListings() {
    if (!window.HOUSING_DATA || !window.HOUSING_DATA.anuncios) return null;
    const cfg = activePriceTier ? TIER_CONFIG[activePriceTier] : null;
    let allowedDistrictsSet = null;
    if (cfg) {
      allowedDistrictsSet = new Set(
        window.HOUSING_DATA.bairros
          .filter(function (b) { return b.aluguel_medio >= cfg.min && b.aluguel_medio <= cfg.max; })
          .map(function (b) { return b.nome; })
      );
    }

    const itens = window.HOUSING_DATA.anuncios.filter(function (a) {
      if (activeRegion !== 'all' && a.regiao !== activeRegion) return false;
      if (activeDistrict !== 'all' && a.district !== activeDistrict) return false;
      if (activePropertyType !== 'all' && a.type !== activePropertyType) return false;
      if (allowedDistrictsSet && !allowedDistrictsSet.has(a.district)) return false;
      return true;
    });

    const rents = itens.map(function (x) { return x.rent; });
    const totals = itens.map(function (x) { return x.total; });
    const areas = itens.filter(function (x) { return x.area > 0; }).map(function (x) { return x.area; });
    const m2s = itens.filter(function (x) { return x.rent_m2 > 0; }).map(function (x) { return x.rent_m2; });

    const tiposOrdem = ['Apartamento', 'Casa', 'Studio e kitnet', 'Casa em condomínio'];
    const porTipo = [];
    tiposOrdem.forEach(function (tName) {
      const sub = itens.filter(function (x) { return x.type === tName; }).map(function (x) { return x.rent; });
      if (sub.length > 0) {
        porTipo.push({
          tipo: tName,
          qtd: sub.length,
          aluguel_medio: Number(calcMean(sub).toFixed(2)),
          aluguel_mediano: Number(calcMedian(sub).toFixed(2))
        });
      }
    });

    const quartosOrdem = ['0', '1', '2', '3', '4+'];
    const porQuartos = [];
    quartosOrdem.forEach(function (qLabel) {
      const sub = itens.filter(function (x) {
        const q = x.bedrooms < 4 ? String(x.bedrooms) : '4+';
        return q === qLabel;
      }).map(function (x) { return x.rent; });
      if (sub.length > 0) {
        porQuartos.push({
          quartos: qLabel,
          qtd: sub.length,
          aluguel_medio: Number(calcMean(sub).toFixed(2)),
          aluguel_mediano: Number(calcMedian(sub).toFixed(2))
        });
      }
    });

    const baseReg = (activeRegion !== 'all' && window.HOUSING_DATA.por_regiao && window.HOUSING_DATA.por_regiao[activeRegion])
      ? window.HOUSING_DATA.por_regiao[activeRegion]
      : null;

    let minRentVal = 0;
    let maxRentVal = 0;
    if (rents.length > 0) {
      minRentVal = rents[0];
      maxRentVal = rents[0];
      for (let i = 1; i < rents.length; i++) {
        if (rents[i] < minRentVal) minRentVal = rents[i];
        if (rents[i] > maxRentVal) maxRentVal = rents[i];
      }
    }

    return {
      total_anuncios: itens.length,
      aluguel_medio: Number(calcMean(rents).toFixed(2)),
      aluguel_mediano: Number(calcMedian(rents).toFixed(2)),
      aluguel_min: minRentVal,
      aluguel_max: maxRentVal,
      custo_total_medio: Number(calcMean(totals).toFixed(2)),
      area_media: Number(calcMean(areas).toFixed(1)),
      preco_m2_medio: Number(calcMean(m2s).toFixed(2)),
      por_tipo: porTipo,
      por_quartos: porQuartos,
      mais_caros: baseReg ? baseReg.mais_caros : window.HOUSING_DATA.rankings.mais_caros.slice(0, 5),
      mais_acessiveis: baseReg ? baseReg.mais_acessiveis : window.HOUSING_DATA.rankings.mais_acessiveis.slice(0, 5)
    };
  }

  /* ----------------------------------------------------
   * ATUALIZAÇÃO DE KPIS, TÍTULOS E SÍNTESE
   * ---------------------------------------------------- */
  function updateKPIsAndSummary() {
    if (!window.HOUSING_DATA) return;

    const data = window.HOUSING_DATA;
    const badgeEl = document.getElementById('map-current-region-badge');
    const titleEl = document.getElementById('selected-region-title');
    const tagEl = document.getElementById('panel-context-tag');
    const captionEl = document.getElementById('legend-status-caption');
    const kpiMetaEl = document.getElementById('kpi-records-meta');

    let meanRent = 0, medianRentText = '--', rentM2 = 0, totalRecords = 0;
    let meanArea = 0, meanTotal = 0, rangeText = '--';
    const typeSuffix = activePropertyType !== 'all' ? ` • ${activePropertyType}` : '';

    // Se houver filtro específico de Bairro, Tipo de Imóvel ou Faixa da Legenda, calcula dinamicamente da amostra filtrada
    if (activeDistrict !== 'all' || activePropertyType !== 'all' || activePriceTier) {
      const dyn = computeDynamicBlockFromListings();
      if (dyn) {
        meanRent = dyn.aluguel_medio;
        medianRentText = `R$ ${dyn.aluguel_mediano.toLocaleString('pt-BR')}`;
        rentM2 = dyn.preco_m2_medio;
        totalRecords = dyn.total_anuncios;
        meanArea = dyn.area_media;
        meanTotal = dyn.custo_total_medio;
        rangeText = dyn.total_anuncios > 0
          ? `R$ ${dyn.aluguel_min.toLocaleString('pt-BR')} a R$ ${dyn.aluguel_max.toLocaleString('pt-BR')}`
          : '--';
      }

      if (activeDistrict !== 'all') {
        const b = data.bairros.find(function (item) { return item.nome === activeDistrict; });
        const regName = b ? b.regiao : activeRegion;
        if (badgeEl) badgeEl.textContent = `${activeDistrict} (${regName})${typeSuffix}`;
        if (titleEl) titleEl.textContent = `${activeDistrict}${typeSuffix}`;
        if (tagEl) tagEl.textContent = `Zona do Bairro • ${regName}`;
        if (kpiMetaEl) kpiMetaEl.innerHTML = `Ver os ${totalRecords.toLocaleString('pt-BR')} anúncios &rarr;`;
      } else if (activePriceTier) {
        const cfg = TIER_CONFIG[activePriceTier];
        const matching = getFilteredBairrosList();
        const regPrefix = activeRegion === 'all' ? 'SP' : activeRegion;
        if (badgeEl) badgeEl.textContent = `${regPrefix} • ${cfg.label} (${matching.length} bairros)${typeSuffix}`;
        if (titleEl) titleEl.textContent = `${regPrefix}: Faixa ${cfg.label}${typeSuffix}`;
        if (tagEl) tagEl.textContent = 'Filtro Combinado (Região + Faixa)';
        if (captionEl) {
          captionEl.innerHTML = `<strong>${matching.length} bairros</strong> em ${regPrefix} na faixa <strong>${cfg.label}</strong>`;
        }
        if (kpiMetaEl) kpiMetaEl.innerHTML = `Ver os ${totalRecords.toLocaleString('pt-BR')} anúncios &rarr;`;
      } else {
        const regPrefix = activeRegion === 'all' ? 'São Paulo' : activeRegion;
        if (badgeEl) badgeEl.textContent = `${regPrefix}${typeSuffix}`;
        if (titleEl) titleEl.textContent = `${regPrefix}${typeSuffix}`;
        if (tagEl) tagEl.textContent = 'Filtro por Tipologia de Imóvel';
        if (kpiMetaEl) kpiMetaEl.innerHTML = `Ver os ${totalRecords.toLocaleString('pt-BR')} anúncios &rarr;`;
      }
    }
    // Caso 3: Região de São Paulo selecionada (sem subfiltros de bairro/tipo/faixa)
    else if (activeRegion !== 'all' && data.por_regiao && data.por_regiao[activeRegion]) {
      const regStats = data.por_regiao[activeRegion];
      meanRent = regStats.aluguel_medio;
      medianRentText = `R$ ${regStats.aluguel_mediano.toLocaleString('pt-BR')}`;
      rentM2 = regStats.preco_m2_medio;
      totalRecords = regStats.total_anuncios;
      meanArea = regStats.area_media;
      meanTotal = regStats.custo_total_medio;
      rangeText = `R$ ${regStats.aluguel_min.toLocaleString('pt-BR')} a R$ ${regStats.aluguel_max.toLocaleString('pt-BR')}`;

      if (badgeEl) badgeEl.textContent = `${activeRegion} (${regStats.qtd_bairros} bairros)`;
      if (titleEl) titleEl.textContent = `${activeRegion} — São Paulo`;
      if (tagEl) tagEl.textContent = 'Macrozona de São Paulo';
      if (captionEl) captionEl.textContent = `Exibindo bairros da ${activeRegion} (clique em um círculo para ver os anúncios)`;
      if (kpiMetaEl) kpiMetaEl.innerHTML = `Ver anúncios da ${activeRegion} &rarr;`;
    }
    // Caso 4: Visão Geral de São Paulo
    else {
      const geral = data.geral;
      meanRent = geral.aluguel_medio;
      medianRentText = `R$ ${geral.aluguel_mediano.toLocaleString('pt-BR')}`;
      rentM2 = geral.preco_m2_medio;
      totalRecords = geral.total_anuncios;
      meanArea = geral.area_media;
      meanTotal = geral.custo_total_medio;
      rangeText = `R$ ${geral.aluguel_min.toLocaleString('pt-BR')} a R$ ${geral.aluguel_max.toLocaleString('pt-BR')}`;

      if (badgeEl) badgeEl.textContent = 'São Paulo (Visão Geral)';
      if (titleEl) titleEl.textContent = 'Município de São Paulo';
      if (tagEl) tagEl.textContent = 'Visão Consolidada';
      if (captionEl) captionEl.textContent = 'Clique em uma faixa ou círculo para ver os anúncios separadamente';
      if (kpiMetaEl) kpiMetaEl.innerHTML = 'Ver anúncios separadamente &rarr;';
    }

    const kpiMeanEl = document.getElementById('kpi-rent-mean');
    const kpiMedianEl = document.getElementById('kpi-rent-median');
    const kpiM2El = document.getElementById('kpi-rent-m2');
    const kpiCountEl = document.getElementById('kpi-records-count');
    const summaryAreaEl = document.getElementById('summary-area');
    const summaryTotalEl = document.getElementById('summary-total');
    const summaryRangeEl = document.getElementById('summary-range');

    if (kpiMeanEl) kpiMeanEl.textContent = `R$ ${meanRent.toLocaleString('pt-BR')}`;
    if (kpiMedianEl) kpiMedianEl.textContent = medianRentText;
    if (kpiM2El) kpiM2El.textContent = `R$ ${rentM2.toLocaleString('pt-BR')}/m²`;
    if (kpiCountEl) kpiCountEl.textContent = totalRecords.toLocaleString('pt-BR');

    if (summaryAreaEl) summaryAreaEl.textContent = `${meanArea} m²`;
    if (summaryTotalEl) summaryTotalEl.textContent = `R$ ${meanTotal.toLocaleString('pt-BR')}`;
    if (summaryRangeEl) summaryRangeEl.textContent = rangeText;
  }

  /* ----------------------------------------------------
   * TABELA DE BAIRROS (RENDERIZAÇÃO ENXUTA SOB DEMANDA)
   * ---------------------------------------------------- */
  function populateDistrictsTable(customList, searchQuery) {
    const tbody = document.getElementById('districts-table-body');
    if (!tbody || !window.HOUSING_DATA) return;

    const term = (searchQuery || '').trim().toLowerCase();
    let bairros = customList || getFilteredBairrosList();

    if (term) {
      bairros = bairros.filter(function (b) {
        return b.nome.toLowerCase().includes(term) || (b.regiao || '').toLowerCase().includes(term);
      });
    }

    // Limita a 80 linhas no DOM para evitar lentidão de layout em processadores modestos
    const slice = bairros.slice(0, 80);
    const rowsHtml = slice.map(function (b) {
      const zColor = ZONE_DOT_COLORS[b.regiao] || '#64748b';
      const escapedName = b.nome.replace(/'/g, "\\'");

      return `
        <tr>
          <td><strong>${b.nome}</strong></td>
          <td>
            <span class="zone-table-badge">
              <span class="zone-dot" style="background: ${zColor};"></span>${b.regiao || 'SP'}
            </span>
          </td>
          <td>${b.qtd_imoveis}</td>
          <td>R$ ${b.aluguel_medio.toLocaleString('pt-BR')}</td>
          <td>R$ ${b.aluguel_mediano.toLocaleString('pt-BR')}</td>
          <td>R$ ${b.preco_m2_medio.toLocaleString('pt-BR')}/m²</td>
          <td>
            <div style="display: flex; gap: 0.3rem; flex-wrap: nowrap;">
              <button type="button" class="table-action-btn" onclick="window.App.UIModule.openDistrictListings('${escapedName}')" title="Ver todos os ${b.qtd_imoveis} anúncios desta zona separadamente">
                Ver Anúncios (${b.qtd_imoveis})
              </button>
              <button type="button" class="btn-ghost" style="padding: 0.22rem 0.45rem; font-size: 0.72rem;" onclick="window.App.UIModule.selectDistrict('${escapedName}')" title="Filtrar gráficos para este bairro">
                Gráficos
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml.join('');
  }

  function filterDistrictsTable(query) {
    populateDistrictsTable(getFilteredBairrosList(), query);
  }

  /* ----------------------------------------------------
   * GRÁFICOS (CHART.JS) DINÂMICOS POR REGIÃO
   * ---------------------------------------------------- */
  function getChartThemeColors() {
    const isDark = isDarkTheme();
    return {
      textColor: isDark ? '#cbd5e1' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      accentPrimary: isDark ? '#3b82f6' : '#2563eb',
      accentSecondary: isDark ? '#10b981' : '#059669',
      accentWarm: isDark ? '#f59e0b' : '#d97706',
      accentDanger: isDark ? '#ef4444' : '#dc2626'
    };
  }

  function getActiveStatsBlock() {
    const data = window.HOUSING_DATA;
    if (activeDistrict !== 'all' || activePropertyType !== 'all' || activePriceTier) {
      const dyn = computeDynamicBlockFromListings();
      if (dyn) return dyn;
    }
    if (activeRegion !== 'all' && data.por_regiao && data.por_regiao[activeRegion]) {
      return data.por_regiao[activeRegion];
    }
    return {
      por_tipo: data.por_tipo,
      por_quartos: data.por_quartos,
      mais_caros: data.rankings.mais_caros.slice(0, 5),
      mais_acessiveis: data.rankings.mais_acessiveis.slice(0, 5)
    };
  }

  function initCharts() {
    if (typeof window.Chart === 'undefined' || !window.HOUSING_DATA) return;

    if (Chart.defaults) {
      Chart.defaults.animation = false;
    }

    const colors = getChartThemeColors();
    const block = getActiveStatsBlock();

    const ctxType = document.getElementById('chart-type-comparison');
    if (ctxType) {
      charts.typeComparison = new Chart(ctxType, {
        type: 'bar',
        data: {
          labels: block.por_tipo.map(function (i) { return i.tipo; }),
          datasets: [
            {
              label: 'Aluguel Médio (R$)',
              data: block.por_tipo.map(function (i) { return i.aluguel_medio; }),
              backgroundColor: colors.accentPrimary,
              borderRadius: 4
            },
            {
              label: 'Mediana (R$)',
              data: block.por_tipo.map(function (i) { return i.aluguel_mediano; }),
              backgroundColor: colors.accentSecondary,
              borderRadius: 4
            }
          ]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: colors.textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) { return `${ctx.dataset.label}: R$ ${ctx.raw.toLocaleString('pt-BR')}`; }
              }
            }
          },
          scales: {
            x: { ticks: { color: colors.textColor, font: { size: 10 } }, grid: { display: false } },
            y: {
              ticks: { color: colors.textColor, callback: function (val) { return 'R$ ' + val; } },
              grid: { color: colors.gridColor }
            }
          }
        }
      });
    }

    const ctxBedrooms = document.getElementById('chart-bedrooms');
    if (ctxBedrooms) {
      charts.bedrooms = new Chart(ctxBedrooms, {
        type: 'bar',
        data: {
          labels: block.por_quartos.map(function (i) { return `${i.quartos} qto(s)`; }),
          datasets: [
            {
              label: 'Média (R$)',
              data: block.por_quartos.map(function (i) { return i.aluguel_medio; }),
              backgroundColor: colors.accentWarm,
              borderRadius: 4
            },
            {
              label: 'Mediana (R$)',
              data: block.por_quartos.map(function (i) { return i.aluguel_mediano; }),
              backgroundColor: colors.accentPrimary,
              borderRadius: 4
            }
          ]
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: colors.textColor, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) { return `${ctx.dataset.label}: R$ ${ctx.raw.toLocaleString('pt-BR')}`; }
              }
            }
          },
          scales: {
            x: { ticks: { color: colors.textColor, font: { size: 10 } }, grid: { display: false } },
            y: {
              ticks: { color: colors.textColor, callback: function (val) { return 'R$ ' + val; } },
              grid: { color: colors.gridColor }
            }
          }
        }
      });
    }

    const ctxRankings = document.getElementById('chart-rankings');
    if (ctxRankings) {
      const combined = [...(block.mais_caros || []), ...(block.mais_acessiveis || [])];
      const topCount = (block.mais_caros || []).length;

      charts.rankings = new Chart(ctxRankings, {
        type: 'bar',
        data: {
          labels: combined.map(function (i) { return i.nome; }),
          datasets: [
            {
              label: 'Aluguel Médio (R$)',
              data: combined.map(function (i) { return i.aluguel_medio; }),
              backgroundColor: combined.map(function (_, idx) {
                return idx < topCount ? colors.accentDanger : colors.accentSecondary;
              }),
              borderRadius: 4
            }
          ]
        },
        options: {
          animation: false,
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) { return `Aluguel Médio: R$ ${ctx.raw.toLocaleString('pt-BR')}`; }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: colors.textColor, callback: function (val) { return 'R$ ' + val; } },
              grid: { color: colors.gridColor }
            },
            y: { ticks: { color: colors.textColor, font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }
  }

  function updateChartsData() {
    if (!window.HOUSING_DATA) return;
    const colors = getChartThemeColors();
    const block = getActiveStatsBlock();

    if (charts.typeComparison && block.por_tipo) {
      charts.typeComparison.data.labels = block.por_tipo.map(function (i) { return i.tipo; });
      charts.typeComparison.data.datasets[0].data = block.por_tipo.map(function (i) { return i.aluguel_medio; });
      charts.typeComparison.data.datasets[1].data = block.por_tipo.map(function (i) { return i.aluguel_mediano; });
      charts.typeComparison.update('none');
    }

    if (charts.bedrooms && block.por_quartos) {
      charts.bedrooms.data.labels = block.por_quartos.map(function (i) { return `${i.quartos} qto(s)`; });
      charts.bedrooms.data.datasets[0].data = block.por_quartos.map(function (i) { return i.aluguel_medio; });
      charts.bedrooms.data.datasets[1].data = block.por_quartos.map(function (i) { return i.aluguel_mediano; });
      charts.bedrooms.update('none');
    }

    if (charts.rankings) {
      const topExp = block.mais_caros || window.HOUSING_DATA.rankings.mais_caros.slice(0, 5);
      const topAff = block.mais_acessiveis || window.HOUSING_DATA.rankings.mais_acessiveis.slice(0, 5);
      const combined = [...topExp, ...topAff];

      charts.rankings.data.labels = combined.map(function (i) { return i.nome; });
      charts.rankings.data.datasets[0].data = combined.map(function (i) { return i.aluguel_medio; });
      charts.rankings.data.datasets[0].backgroundColor = combined.map(function (_, idx) {
        return idx < topExp.length ? colors.accentDanger : colors.accentSecondary;
      });
      charts.rankings.update('none');
    }
  }

  function updateChartsTheme() {
    const colors = getChartThemeColors();

    Object.values(charts).forEach(function (chart) {
      if (!chart) return;
      if (chart.options.scales.x) {
        if (chart.options.scales.x.ticks) chart.options.scales.x.ticks.color = colors.textColor;
        if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = colors.gridColor;
      }
      if (chart.options.scales.y) {
        if (chart.options.scales.y.ticks) chart.options.scales.y.ticks.color = colors.textColor;
        if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
      }
      if (chart.options.plugins && chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = colors.textColor;
      }
      chart.update('none');
    });
  }

  function resizeAllCharts() {
    Object.values(charts).forEach(function (chart) {
      if (chart) chart.resize();
    });
  }

  return {
    init: init,
    selectRegion: selectRegion,
    selectDistrict: selectDistrict,
    openDistrictListings: openDistrictListings,
    getFilterState: getFilterState,
    resetSelection: resetSelection,
    handlePriceTierClick: handlePriceTierClick,
    resizeAllCharts: resizeAllCharts
  };
})();
