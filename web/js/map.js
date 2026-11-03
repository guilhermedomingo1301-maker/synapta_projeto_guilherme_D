/**
 * Módulo de Mapa Interativo (São Paulo) - Desafio SYNAPTA (Otimizado para Baixo Uso de CPU)
 * Utiliza renderização via HTML5 Canvas (preferCanvas: true) e transições diretas
 * sem interpolação pesada de quadros (sem flyTo), garantindo fluidez em qualquer processador.
 */
window.App = window.App || {};

window.App.MapModule = (function () {
  const SP_CENTER = [-23.5505, -46.6333];
  const SP_ZOOM = 11;

  const ZONE_COLORS = {
    'Centro': '#8b5cf6',
    'Zona Norte': '#06b6d4',
    'Zona Sul': '#10b981',
    'Zona Leste': '#f59e0b',
    'Zona Oeste': '#ec4899',
    'Região Metropolitana': '#64748b'
  };

  // Provedores 100% gratuitos e abertos
  const TILE_PROVIDERS = {
    streets: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 1
      }
    },
    dark: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16,
        updateWhenIdle: true,
        keepBuffer: 1
      }
    },
    light_clean: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
        updateWhenIdle: true,
        keepBuffer: 1
      }
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 18,
        updateWhenIdle: true,
        keepBuffer: 1
      }
    }
  };

  let mapInstance = null;
  let baseTileLayer = null;
  let labelsLayer = null;
  let zonesGeoJsonLayer = null;
  let circlesLayerGroup = null;
  let pinsLayerGroup = null;
  let currentBaseKey = 'streets';
  let pinsModeActive = false;
  const markerLookup = {};
  const pinLookup = {};

  function init() {
    const container = document.getElementById('map-container');
    if (!container) return;

    if (typeof window.L === 'undefined') {
      renderOfflineFallback(container);
      bindControlButtons();
      return;
    }

    // Configuração leve com renderizador SVG nativo do Leaflet (garante que cada polígono/círculo
    // tenha seu próprio hit-test no DOM sem que um <canvas> bloqueie cliques nas camadas inferiores)
    mapInstance = L.map(container, {
      center: SP_CENTER,
      zoom: SP_ZOOM,
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    });

    const zonesPane = mapInstance.createPane('zonesPane');
    zonesPane.style.zIndex = '350';
    zonesPane.style.pointerEvents = 'none';

    const circlesPane = mapInstance.createPane('circlesPane');
    circlesPane.style.zIndex = '420';
    circlesPane.style.pointerEvents = 'none';

    const pinsPane = mapInstance.createPane('pinsPane');
    pinsPane.style.zIndex = '460';
    pinsPane.style.pointerEvents = 'none';

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    currentBaseKey = isDark ? 'dark' : 'streets';
    setBaseTile(currentBaseKey);

    circlesLayerGroup = L.layerGroup().addTo(mapInstance);
    pinsLayerGroup = L.layerGroup().addTo(mapInstance);

    initFixedBalloonEvents();
    bindMapEvents();
    bindControlButtons();
    bindLayerSelector();
    bindLegendButtons();
    bindZoneButtons();
    bindPinsToggle();

    renderZonesMesh();
    renderDistricts();
  }

  /* ----------------------------------------------------
   * BALÃO FIXO DE INFORMAÇÕES (INDEPENDENTE DO ZOOM)
   * ---------------------------------------------------- */
  function initFixedBalloonEvents() {
    const balloon = document.getElementById('map-fixed-balloon');
    if (!balloon || typeof window.L === 'undefined') return;
    L.DomEvent.disableClickPropagation(balloon);
    L.DomEvent.disableScrollPropagation(balloon);
  }

  function closeFixedBalloon() {
    const balloon = document.getElementById('map-fixed-balloon');
    if (balloon) {
      balloon.style.display = 'none';
      balloon.classList.remove('is-minimized');
    }
  }

  function toggleMinimizeBalloon() {
    const balloon = document.getElementById('map-fixed-balloon');
    const btnMin = document.getElementById('btn-balloon-minimize');
    if (!balloon) return;
    const isMin = balloon.classList.toggle('is-minimized');
    if (btnMin) {
      btnMin.innerHTML = isMin ? '&#43;' : '&minus;';
      btnMin.title = isMin ? 'Expandir informações' : 'Minimizar balão';
    }
  }

  function getDistrictListings(nomeBairro) {
    if (!window.HOUSING_DATA || !window.HOUSING_DATA.anuncios) return [];
    return window.HOUSING_DATA.anuncios.filter(function (a) {
      return a.district === nomeBairro;
    });
  }

  function showDistrictFixedBalloon(b) {
    const balloon = document.getElementById('map-fixed-balloon');
    if (!balloon || !b) return;

    const escapedName = b.nome.replace(/'/g, "\\'");
    const anunciosBairro = getDistrictListings(b.nome);
    // Limita a prévia no balão a 20 itens para manter o DOM instantâneo
    const previewSlice = anunciosBairro.slice(0, 20);

    let listingsHtml = '';
    if (previewSlice.length > 0) {
      const rows = previewSlice.map(function (a) {
        return `
          <div class="popup-mini-listing" onclick="window.App.MapModule.focusListingPin(${a.id})" title="Clique para focar neste anúncio">
            <div class="popup-mini-top">
              <span class="popup-mini-type">${a.type}</span>
              <strong class="popup-mini-rent">R$ ${a.rent.toLocaleString('pt-BR')}</strong>
            </div>
            <div class="popup-mini-addr">${a.address || b.nome}</div>
            <div class="popup-mini-meta">${a.area} m² &bull; ${a.bedrooms} qto(s) &bull; ${a.garage} vaga(s)</div>
          </div>
        `;
      }).join('');

      const rest = anunciosBairro.length - previewSlice.length;
      const moreNote = rest > 0
        ? `<div style="font-size: 0.7rem; color: var(--text-muted); text-align: center; padding-top: 0.2rem;">+ ${rest} anúncios (veja todos na aba ao lado)</div>`
        : '';

      listingsHtml = `
        <div class="popup-listings-box">
          <div class="popup-listings-header">Anúncios Englobados (${b.qtd_imoveis}):</div>
          <div class="popup-listings-scroll">${rows}${moreNote}</div>
        </div>
      `;
    }

    balloon.classList.remove('is-minimized');
    balloon.innerHTML = `
      <div class="balloon-top-bar">
        <div style="min-width: 0;">
          <div style="font-size: 0.66rem; font-weight: 700; text-transform: uppercase; color: ${getZoneColor(b.regiao)};">
            ${b.regiao}
          </div>
          <h4 style="margin: 0; font-size: 0.94rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${b.nome}
          </h4>
        </div>
        <div class="balloon-top-actions">
          <button type="button" id="btn-balloon-minimize" class="balloon-icon-btn" onclick="window.App.MapModule.toggleMinimizeBalloon()" title="Minimizar balão">
            &minus;
          </button>
          <button type="button" class="balloon-icon-btn" onclick="window.App.MapModule.closeFixedBalloon()" title="Fechar balão">
            &times;
          </button>
        </div>
      </div>

      <div class="balloon-collapsible-body">
        <div class="balloon-metrics-grid">
          <div><strong>Média:</strong> R$ ${b.aluguel_medio.toLocaleString('pt-BR')}</div>
          <div><strong>Mediana:</strong> R$ ${b.aluguel_mediano.toLocaleString('pt-BR')}</div>
          <div><strong>Preço/m²:</strong> R$ ${b.preco_m2_medio.toLocaleString('pt-BR')}</div>
          <div><strong>Anúncios:</strong> ${b.qtd_imoveis}</div>
        </div>

        ${listingsHtml}

        <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.35rem;">
          <button type="button" class="popup-btn-primary" onclick="window.App.UIModule.openDistrictListings('${escapedName}')">
            Ver os ${b.qtd_imoveis} Anúncios no Painel &rarr;
          </button>
          <button type="button" class="table-action-btn" onclick="window.App.UIModule.selectDistrict('${escapedName}', true)" style="width: 100%; text-align: center;">
            Filtrar Gráficos neste Bairro
          </button>
        </div>
      </div>
    `;

    balloon.style.display = 'flex';
  }

  function showPinFixedBalloon(a) {
    const balloon = document.getElementById('map-fixed-balloon');
    if (!balloon || !a) return;

    const escapedDistrict = a.district.replace(/'/g, "\\'");

    balloon.classList.remove('is-minimized');
    balloon.innerHTML = `
      <div class="balloon-top-bar">
        <div style="min-width: 0;">
          <div style="font-size: 0.66rem; font-weight: 700; text-transform: uppercase; color: ${getZoneColor(a.regiao)};">
            ${a.regiao} &bull; ${a.district}
          </div>
          <h4 style="margin: 0; font-size: 0.88rem; color: var(--text-primary);">
            ${a.address || ('Imóvel em ' + a.district)}
          </h4>
        </div>
        <div class="balloon-top-actions">
          <button type="button" id="btn-balloon-minimize" class="balloon-icon-btn" onclick="window.App.MapModule.toggleMinimizeBalloon()" title="Minimizar balão">
            &minus;
          </button>
          <button type="button" class="balloon-icon-btn" onclick="window.App.MapModule.closeFixedBalloon()" title="Fechar balão">
            &times;
          </button>
        </div>
      </div>

      <div class="balloon-collapsible-body">
        <div class="balloon-metrics-grid">
          <div><strong>Aluguel:</strong> <span style="color: var(--accent-primary); font-weight: 700;">R$ ${a.rent.toLocaleString('pt-BR')}</span></div>
          <div><strong>Total:</strong> R$ ${a.total.toLocaleString('pt-BR')}</div>
          <div><strong>Área:</strong> ${a.area} m²</div>
          <div><strong>R$/m²:</strong> R$ ${a.rent_m2.toLocaleString('pt-BR')}</div>
          <div><strong>Quartos:</strong> ${a.bedrooms}</div>
          <div><strong>Vagas:</strong> ${a.garage}</div>
        </div>
        <div style="font-size: 0.74rem; color: var(--text-muted); margin-bottom: 0.45rem;">
          Tipologia: <strong style="color: var(--text-primary);">${a.type}</strong> (Anúncio #${a.id})
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
          <button type="button" class="popup-btn-primary" onclick="window.App.UIModule.openDistrictListings('${escapedDistrict}', ${a.id})">
            Destacar na Aba de Anúncios &rarr;
          </button>
          <button type="button" class="table-action-btn" onclick="window.App.MapModule.openDistrictBalloonByName('${escapedDistrict}')" style="width: 100%; text-align: center;">
            &larr; Voltar para resumo de ${a.district}
          </button>
        </div>
      </div>
    `;

    balloon.style.display = 'flex';
  }

  function openDistrictBalloonByName(nome) {
    if (!window.HOUSING_DATA || !window.HOUSING_DATA.bairros) return;
    const b = window.HOUSING_DATA.bairros.find(function (item) { return item.nome === nome; });
    if (b) {
      showDistrictFixedBalloon(b);
    }
  }

  function setBaseTile(key) {
    if (!mapInstance || typeof window.L === 'undefined') return;

    const provider = TILE_PROVIDERS[key] || TILE_PROVIDERS.streets;

    if (baseTileLayer) {
      mapInstance.removeLayer(baseTileLayer);
    }
    if (labelsLayer) {
      mapInstance.removeLayer(labelsLayer);
      labelsLayer = null;
    }

    baseTileLayer = L.tileLayer(provider.url, provider.options).addTo(mapInstance);

    if (key === 'dark') {
      labelsLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', maxZoom: 16, updateWhenIdle: true }
      ).addTo(mapInstance);
    }

    currentBaseKey = key;

    const selectLayer = document.getElementById('select-map-layer');
    if (selectLayer) {
      selectLayer.value = key;
    }
  }

  function setThemeTiles(theme) {
    if (!mapInstance) return;
    if (currentBaseKey !== 'satellite') {
      const target = theme === 'dark' ? 'dark' : 'streets';
      setBaseTile(target);
    }
  }

  function bindLayerSelector() {
    const selectLayer = document.getElementById('select-map-layer');
    if (selectLayer) {
      selectLayer.addEventListener('change', function () {
        setBaseTile(selectLayer.value);
      });
    }
  }

  function bindPinsToggle() {
    const btnPins = document.getElementById('btn-toggle-map-pins');
    if (btnPins) {
      btnPins.addEventListener('click', function () {
        setPinsMode(!pinsModeActive);
      });
    }
  }

  function setPinsMode(enabled, customFilter) {
    pinsModeActive = Boolean(enabled);
    const btnPins = document.getElementById('btn-toggle-map-pins');
    if (btnPins) {
      btnPins.classList.toggle('is-active', pinsModeActive);
      btnPins.innerHTML = pinsModeActive
        ? '&#128205; Ocultar Pinos Individuais'
        : '&#128205; Ver Pinos Individuais';
    }

    if (pinsModeActive) {
      const state = customFilter || (window.App.UIModule ? window.App.UIModule.getFilterState() : {});
      renderIndividualPins(state);
    } else {
      clearIndividualPins();
    }
  }

  function getZoneColor(regiao) {
    return ZONE_COLORS[regiao] || '#64748b';
  }

  function getRentColor(val) {
    if (val <= 2000) return '#10b981';
    if (val <= 3500) return '#3b82f6';
    if (val <= 5000) return '#f59e0b';
    return '#ef4444';
  }

  function getPriceTier(val) {
    if (val <= 2000) return 'low';
    if (val <= 3500) return 'mid-low';
    if (val <= 5000) return 'mid-high';
    return 'high';
  }

  /* ----------------------------------------------------
   * MALHA TERRITORIAL DAS REGIÕES (SVG LEVE E INTERATIVO)
   * ---------------------------------------------------- */
  function renderZonesMesh() {
    if (!mapInstance || !window.SP_ZONES_GEOJSON) return;

    if (zonesGeoJsonLayer) {
      mapInstance.removeLayer(zonesGeoJsonLayer);
    }

    zonesGeoJsonLayer = L.geoJSON(window.SP_ZONES_GEOJSON, {
      pane: 'zonesPane',
      style: function (feature) {
        const regiao = feature.properties.regiao;
        const c = getZoneColor(regiao);
        return {
          color: c,
          weight: 1.1,
          opacity: 0.5,
          fillColor: c,
          fillOpacity: 0.1
        };
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.on('click', function () {
          if (window.App.UIModule && p.regiao) {
            window.App.UIModule.selectRegion(p.regiao, false);
          }
        });
      }
    }).addTo(mapInstance);
  }

  /* ----------------------------------------------------
   * CÍRCULOS DE BAIRROS COM RAIO FIXO EM PIXELS
   * ---------------------------------------------------- */
  function renderDistricts() {
    if (!mapInstance || !window.HOUSING_DATA || !window.HOUSING_DATA.bairros) return;

    circlesLayerGroup.clearLayers();

    const bairros = window.HOUSING_DATA.bairros;

    bairros.forEach(function (b) {
      if (!b.coords || !Array.isArray(b.coords)) return;

      const color = getRentColor(b.aluguel_medio);
      const tier = getPriceTier(b.aluguel_medio);
      const radiusPx = Math.max(7, Math.min(20, Math.round(Math.sqrt(b.qtd_imoveis) * 1.15 + 5)));

      const circle = L.circleMarker(b.coords, {
        pane: 'circlesPane',
        color: color,
        weight: 1.8,
        fillColor: color,
        fillOpacity: 0.55,
        radius: radiusPx
      });

      circle.districtData = b;
      circle.priceTier = tier;
      circle.baseColor = color;
      circle.baseRadius = radiusPx;

      circle.bindTooltip(`
        <strong>${b.nome}</strong> <span style="opacity:0.75;">(${b.regiao})</span><br/>
        Média: <b>R$ ${b.aluguel_medio.toLocaleString('pt-BR')}</b> &bull; Anúncios: <b>${b.qtd_imoveis}</b>
      `, { direction: 'top', offset: [0, -8], opacity: 0.95 });

      circle.on('click', function (e) {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        showDistrictFixedBalloon(b);
        if (window.App.UIModule) {
          window.App.UIModule.selectDistrict(b.nome, true);
        }
      });

      circle.addTo(circlesLayerGroup);
      markerLookup[b.nome] = circle;
    });
  }

  /* ----------------------------------------------------
   * PINOS INDIVIDUAIS DE ANÚNCIOS
   * ---------------------------------------------------- */
  function clearIndividualPins() {
    if (pinsLayerGroup) {
      pinsLayerGroup.clearLayers();
    }
    Object.keys(pinLookup).forEach(function (k) {
      delete pinLookup[k];
    });
  }

  function renderIndividualPins(filterOpts) {
    if (!mapInstance || !pinsLayerGroup || !window.HOUSING_DATA || !window.HOUSING_DATA.anuncios) return;

    clearIndividualPins();

    const regiao = (filterOpts && filterOpts.regiao) ? filterOpts.regiao : 'all';
    const district = (filterOpts && filterOpts.district) ? filterOpts.district : 'all';
    const propertyType = (filterOpts && filterOpts.propertyType) ? filterOpts.propertyType : 'all';

    let lista = window.HOUSING_DATA.anuncios.filter(function (a) {
      if (!a.coords || !Array.isArray(a.coords)) return false;
      if (district && district !== 'all' && a.district !== district) return false;
      if (regiao && regiao !== 'all' && a.regiao !== regiao) return false;
      if (propertyType && propertyType !== 'all' && a.type !== propertyType) return false;
      return true;
    });

    // Limite enxuto para garantir fluidez em qualquer CPU
    const maxPins = (district !== 'all') ? 220 : 180;
    if (lista.length > maxPins) {
      lista = lista.slice(0, maxPins);
    }

    lista.forEach(function (a) {
      const pinColor = getRentColor(a.rent);
      const pin = L.circleMarker(a.coords, {
        pane: 'pinsPane',
        radius: district !== 'all' ? 5.5 : 4.5,
        color: '#ffffff',
        weight: 1.3,
        fillColor: pinColor,
        fillOpacity: 0.92
      });

      pin.bindTooltip(`
        <strong>${a.address || a.district}</strong><br/>
        ${a.type} &bull; <b>R$ ${a.rent.toLocaleString('pt-BR')}</b> (${a.area} m²)
      `, { direction: 'top', offset: [0, -5], opacity: 0.95 });

      pin.on('click', function (e) {
        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
        }
        showPinFixedBalloon(a);
      });

      pin.addTo(pinsLayerGroup);
      pinLookup[a.id] = pin;
    });
  }

  function focusListingPin(anuncioId) {
    if (!mapInstance || !window.HOUSING_DATA || !window.HOUSING_DATA.anuncios) return;
    const item = window.HOUSING_DATA.anuncios.find(function (a) { return a.id === anuncioId; });
    if (!item) return;

    setPinsMode(true, { regiao: item.regiao, district: item.district, propertyType: 'all' });
    showPinFixedBalloon(item);

    const pin = pinLookup[anuncioId];
    if (pin) {
      mapInstance.setView(pin.getLatLng(), 15, { animate: false });
    } else if (item.district && markerLookup[item.district]) {
      focusDistrict(item.district, true);
    }
  }

  function getLayersLatLngBounds(layers) {
    const bounds = L.latLngBounds([]);
    layers.forEach(function (l) {
      if (typeof l.getBounds === 'function') {
        bounds.extend(l.getBounds());
      } else if (typeof l.getLatLng === 'function') {
        bounds.extend(l.getLatLng());
      }
    });
    return bounds;
  }

  /* ----------------------------------------------------
   * FILTRAGEM COMBINADA (SEM MUTAR EVENT PARENTS DO LEAFLET)
   * ---------------------------------------------------- */
  function applySpatialFilters(opts) {
    const regiao = (opts && opts.regiao) ? opts.regiao : 'all';
    const district = (opts && opts.district) ? opts.district : 'all';
    const priceTier = (opts && opts.priceTier) ? opts.priceTier : null;
    const shouldZoom = !opts || opts.zoom !== false;

    const hasRegionFilter = regiao && regiao !== 'all';
    const hasDistrictFilter = district && district !== 'all';
    const hasTierFilter = Boolean(priceTier && priceTier !== 'all');

    const activeZonePolygons = [];
    if (zonesGeoJsonLayer) {
      zonesGeoJsonLayer.eachLayer(function (layer) {
        const featRegiao = layer.feature.properties.regiao;
        const c = getZoneColor(featRegiao);

        if (!hasRegionFilter) {
          layer.setStyle({
            color: c,
            weight: 1.1,
            opacity: 0.5,
            fillColor: c,
            fillOpacity: hasTierFilter ? 0.05 : 0.1
          });
        } else if (featRegiao === regiao) {
          layer.setStyle({
            color: c,
            weight: 2,
            opacity: 0.85,
            fillColor: c,
            fillOpacity: 0.18
          });
          activeZonePolygons.push(layer);
        } else {
          layer.setStyle({
            color: c,
            weight: 0.8,
            opacity: 0.22,
            fillColor: c,
            fillOpacity: 0.04
          });
        }
      });
    }

    const activeCircles = [];
    if (circlesLayerGroup) {
      circlesLayerGroup.getLayers().forEach(function (circle) {
        const b = circle.districtData;
        const matchRegiao = !hasRegionFilter || b.regiao === regiao;
        const isSelectedDistrict = hasDistrictFilter && b.nome === district;
        const matchTier = !hasTierFilter || circle.priceTier === priceTier;

        if (isSelectedDistrict) {
          circle.setStyle({
            color: '#ffffff',
            weight: 3,
            fillColor: circle.baseColor,
            fillOpacity: 0.9,
            opacity: 1
          });
          activeCircles.push(circle);
        } else if (!hasRegionFilter && !hasTierFilter) {
          circle.setStyle({
            color: circle.baseColor,
            weight: 1.8,
            fillColor: circle.baseColor,
            fillOpacity: 0.55,
            opacity: 1
          });
          activeCircles.push(circle);
        } else if (matchRegiao && matchTier) {
          circle.setStyle({
            color: circle.baseColor,
            weight: 2,
            fillColor: circle.baseColor,
            fillOpacity: 0.72,
            opacity: 1
          });
          activeCircles.push(circle);
        } else {
          circle.setStyle({
            color: circle.baseColor,
            weight: 1,
            fillColor: circle.baseColor,
            fillOpacity: 0.16,
            opacity: 0.35
          });
        }
      });
    }

    if (hasDistrictFilter) {
      openDistrictBalloonByName(district);
      if (pinsModeActive) {
        renderIndividualPins({ regiao: regiao, district: district, propertyType: (opts && opts.propertyType) || 'all' });
      }
    } else if (pinsModeActive) {
      renderIndividualPins({ regiao: regiao, district: 'all', propertyType: (opts && opts.propertyType) || 'all' });
    } else {
      clearIndividualPins();
      if (!hasRegionFilter && !hasTierFilter) {
        closeFixedBalloon();
      }
    }

    // Reposicionamento instantâneo (animate: false) sem criar L.featureGroup temporário
    if (shouldZoom && mapInstance) {
      if (!hasRegionFilter && !hasDistrictFilter && !hasTierFilter) {
        resetView();
      } else if (hasTierFilter && activeCircles.length > 0) {
        const bounds = getLayersLatLngBounds(activeCircles);
        if (bounds.isValid()) {
          mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
        }
      } else if (hasRegionFilter && activeZonePolygons.length > 0) {
        const bounds = getLayersLatLngBounds(activeZonePolygons);
        if (bounds.isValid()) {
          mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: false });
        }
      } else if (activeCircles.length > 0) {
        const bounds = getLayersLatLngBounds(activeCircles);
        if (bounds.isValid()) {
          mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
        }
      }
    }

    return activeCircles.map(function (c) { return c.districtData; });
  }

  function filterByPriceTier(tier, activeRegion) {
    return applySpatialFilters({ regiao: activeRegion || 'all', priceTier: tier, zoom: true });
  }

  function focusDistrict(nome, shouldZoom) {
    const circle = markerLookup[nome];
    if (circle && mapInstance) {
      if (shouldZoom !== false) {
        const latlng = circle.getLatLng();
        mapInstance.setView(latlng, 14, { animate: false });
      }
      openDistrictBalloonByName(nome);
    }
  }

  function resetView() {
    setPinsMode(false);
    closeFixedBalloon();
    if (mapInstance) {
      mapInstance.setView(SP_CENTER, SP_ZOOM, { animate: false });
    }
  }

  function bindMapEvents() {
    const coordsEl = document.getElementById('map-coords');
    if (!mapInstance || !coordsEl) return;

    let lastUpdate = 0;
    mapInstance.on('mousemove', function (e) {
      const now = performance.now();
      if (now - lastUpdate < 120) return;
      lastUpdate = now;
      coordsEl.textContent = `Lat: ${e.latlng.lat.toFixed(4)} | Lng: ${e.latlng.lng.toFixed(4)}`;
    });

    mapInstance.on('mouseout', function () {
      coordsEl.textContent = 'Lat: -23.5505 | Lng: -46.6333';
    });
  }

  function bindControlButtons() {
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnReset = document.getElementById('btn-reset-view');
    const btnMaximize = document.getElementById('btn-toggle-maximize');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', function () {
        if (mapInstance) mapInstance.zoomIn(1, { animate: false });
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', function () {
        if (mapInstance) mapInstance.zoomOut(1, { animate: false });
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        if (window.App.UIModule) {
          window.App.UIModule.resetSelection();
        } else {
          resetView();
        }
      });
    }

    if (btnMaximize) {
      btnMaximize.addEventListener('click', function () {
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        const isMax = workspace.classList.toggle('is-map-maximized');
        btnMaximize.setAttribute('aria-pressed', String(isMax));
        btnMaximize.title = isMax ? 'Restaurar painel lateral' : 'Expandir mapa';
        invalidateSize();
      });
    }
  }

  function bindLegendButtons() {
    const tierButtons = document.querySelectorAll('[data-price-tier]');
    const btnClear = document.getElementById('btn-clear-tier-filter');

    tierButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tier = btn.getAttribute('data-price-tier');
        if (window.App.UIModule) {
          window.App.UIModule.handlePriceTierClick(tier);
        }
      });
    });

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (window.App.UIModule) {
          window.App.UIModule.handlePriceTierClick(null);
        }
      });
    }
  }

  function bindZoneButtons() {
    const zoneButtons = document.querySelectorAll('[data-zone-filter]');
    zoneButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const z = btn.getAttribute('data-zone-filter');
        if (window.App.UIModule) {
          window.App.UIModule.selectRegion(z, true);
        }
      });
    });
  }

  function renderOfflineFallback(container) {
    container.classList.add('map-fallback-grid');
    container.innerHTML = `
      <div class="placeholder-box" style="background: var(--bg-surface); box-shadow: var(--shadow-md);">
        <span class="placeholder-title">Visualização Geográfica de São Paulo</span>
        <span class="placeholder-desc">
          Conecte à internet para carregar os mapas e as camadas georreferenciadas dos bairros.
        </span>
      </div>
    `;
  }

  function invalidateSize() {
    if (!mapInstance) return;
    mapInstance.invalidateSize({ animate: false, pan: false });
  }

  return {
    init: init,
    setThemeTiles: setThemeTiles,
    setBaseTile: setBaseTile,
    invalidateSize: invalidateSize,
    focusDistrict: focusDistrict,
    focusListingPin: focusListingPin,
    openDistrictBalloonByName: openDistrictBalloonByName,
    closeFixedBalloon: closeFixedBalloon,
    toggleMinimizeBalloon: toggleMinimizeBalloon,
    setPinsMode: setPinsMode,
    renderIndividualPins: renderIndividualPins,
    resetView: resetView,
    applySpatialFilters: applySpatialFilters,
    filterByPriceTier: filterByPriceTier,
    getZoneColor: getZoneColor,
    getMapInstance: function () {
      return mapInstance;
    }
  };
})();
