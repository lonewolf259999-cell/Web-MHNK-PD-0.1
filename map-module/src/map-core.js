/* ========================================
   MHNK Map Module - Core Map Component
   ใช้ Leaflet + GTA V map tiles
   ======================================== */

const MHNK_MAP = {
  map: null,
  tileLayers: {},
  currentStyle: 'atlas',
  poiLayer: null,
  markers: [],
  _initialized: false,

  // ค่าเริ่มต้น
  config: {
    zoom: 3,
    minZoom: 0,
    maxZoom: 5,
    center: [0, 0],
    tileBaseUrl: '/map-module/map-styles',
    blipsUrl: '/map-module/blips',
    maxBounds: [[-6000, -8000], [12000, 10000]],
    maxBoundsViscosity: 0.8,
    styles: ['atlas'],
    styleLabels: { atlas: '🗺️ Atlas' },
    styleFolders: { atlas: 'styleAtlas' },
    styleExts: { atlas: 'jpg' },
    styleMaxZooms: { atlas: 5 }
  },

  /**
   * เริ่มต้นแผนที่
   */
  init(containerId, options = {}) {
    if (this._initialized) return;
    Object.assign(this.config, options);

    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[MHNK-MAP] Container not found:', containerId);
      return;
    }

    const CRS = this._createGtaCRS();
    this._buildTileLayers();

    const mapOptions = {
      crs: CRS,
      minZoom: this.config.minZoom,
      maxZoom: this.config.maxZoom,
      preferCanvas: true,
      layers: [this.tileLayers[this.currentStyle]],
      center: this.config.center,
      zoom: this.config.zoom,
      zoomControl: false
    };

    if (this.config.maxBounds) {
      mapOptions.maxBounds = L.latLngBounds(
        L.latLng(this.config.maxBounds[0][0], this.config.maxBounds[0][1]),
        L.latLng(this.config.maxBounds[1][0], this.config.maxBounds[1][1])
      );
      mapOptions.maxBoundsViscosity = this.config.maxBoundsViscosity ?? 0.8;
    }

    this.map = L.map(container, mapOptions);
    setTimeout(() => this.map.invalidateSize(), 100);
    this.map.getContainer().style.background = '#1a3a4a';
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.poiLayer = L.layerGroup().addTo(this.map);
    // Crosshair layer - แสดงเป้าเล็งเวลาคลิก
    this._crosshairLayer = L.layerGroup().addTo(this.map);
    this.map.on('click', (e) => this._onMapClick(e));
    // อัปเดตพิกัดเป้ากลางจอตามเมาส์
    this.map.on('mousemove', (e) => {
      const coordEl = document.getElementById('mhnk-crosshair-coords');
      if (coordEl) {
        coordEl.textContent = `X: ${e.latlng.lng.toFixed(1)}, Y: ${e.latlng.lat.toFixed(1)}`;
      }
    });

    this._initialized = true;
    console.log('[MHNK-MAP] Initialized');
    document.dispatchEvent(new CustomEvent('mhnk-map-ready', { detail: { map: this.map } }));
  },

  _createGtaCRS() {
    return Object.assign({}, L.CRS.Simple, {
      projection: L.Projection.LonLat,
      scale: (zoom) => Math.pow(2, zoom),
      zoom: (sc) => Math.log(sc) / Math.LN2,
      transformation: new L.Transformation(0.02072, 117.3, -0.0205, 172.8),
      infinite: true
    });
  },

  _buildTileLayers() {
    const { styles, styleFolders, styleExts, tileBaseUrl } = this.config;
    styles.forEach(style => {
      const folder = styleFolders[style];
      const ext = styleExts[style];
      const url = `${tileBaseUrl}/${folder}/{z}/{x}/{y}.${ext}`;
      const styleMaxZoom = (this.config.styleMaxZooms && this.config.styleMaxZooms[style]) || 5;
      const layer = L.tileLayer(url, {
        minZoom: 0,
        maxZoom: styleMaxZoom,
        noWrap: true,
        attribution: 'MHNK PD Map',
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQsvICAAEQAJ+lYp46AAAAAElFTkSuQmCC'
      });
      layer.on('tileerror', (e) => {
        e.tile.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQsvICAAEQAJ+lYp46AAAAAElFTkSuQmCC';
      });
      this.tileLayers[style] = layer;
    });
  },

  switchStyle(style) {
    if (!this.tileLayers[style] || style === this.currentStyle) return;
    this.map.removeLayer(this.tileLayers[this.currentStyle]);
    this.map.addLayer(this.tileLayers[style]);
    this.currentStyle = style;
  },

  _onMapClick(e) {
    const x = e.latlng.lng;
    const y = e.latlng.lat;
    const detail = { x, y };
    
    // แสดงเป้าเล็งชั่วคราว
    this._showCrosshair(x, y);
    
    document.dispatchEvent(new CustomEvent('mhnk-map-click', { detail }));
  },

  /**
   * แสดงเป้าเล็ง + ข้อความพิกัดชั่วคราว
   */
  _showCrosshair(x, y) {
    if (!this._crosshairLayer) return;
    
    // ลบอันเก่า
    this._crosshairLayer.clearLayers();
    
    const size = 20;
    
    // เป้าเล็ง (กากบาท)
    const crosshairIcon = L.divIcon({
      className: '',
      html: `
        <div style="
          width: 40px; height: 40px;
          position: relative;
          transform: translate(-50%, -50%);
        ">
          <!-- วงกลม -->
          <div style="
            position: absolute; top: 50%; left: 50%;
            width: 32px; height: 32px;
            border: 2px solid rgba(233,69,96,0.8);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 8px rgba(233,69,96,0.3);
          "></div>
          <!-- กากบาท -->
          <div style="
            position: absolute; top: 50%; left: 50%;
            width: 14px; height: 2px;
            background: rgba(233,69,96,0.9);
            transform: translate(-50%, -50%);
          "></div>
          <div style="
            position: absolute; top: 50%; left: 50%;
            width: 2px; height: 14px;
            background: rgba(233,69,96,0.9);
            transform: translate(-50%, -50%);
          "></div>
          <!-- พิกัด -->
          <div style="
            position: absolute; top: 24px; left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.7);
            color: #fff;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            white-space: nowrap;
            font-family: monospace;
          ">${x.toFixed(1)}, ${y.toFixed(1)}</div>
        </div>
      `,
      iconSize: [40, 60],
      iconAnchor: [0, 0]
    });
    
    const marker = L.marker([y, x], { icon: crosshairIcon, interactive: false }).addTo(this._crosshairLayer);
    
    // ลบออกหลังจาก 1.5 วิ
    setTimeout(() => {
      try { this._crosshairLayer.clearLayers(); } catch(e) {}
    }, 1500);
  },

  async loadPois() {
    try {
      const res = await fetch('/api/poi');
      const data = await res.json();
      if (data.success) {
        this.clearPois();
        data.data.forEach(poi => this.addPoi(poi));
      }
    } catch (err) {
      console.error('[MHNK-MAP] Load POIs failed:', err);
    }
  },

  addPoi(poi) {
    if (!this.map) return;
    const icon = this._createPoiIcon(poi.category);
    const marker = L.marker([poi.y, poi.x], { icon })
      .addTo(this.poiLayer)
      .bindPopup(this._createPopupHtml(poi));
    marker._poiData = poi;
    this.markers.push(marker);
    marker.on('click', () => {
      document.dispatchEvent(new CustomEvent('mhnk-poi-click', { detail: poi }));
    });
    // แสดงชื่อเมื่อเอาเมาส์ไปชี้
    marker.on('mouseover', (e) => {
      marker.bindTooltip(poi.name || 'ไม่มีชื่อ', {
        direction: 'top',
        offset: [0, -10],
        className: 'mhnk-poi-tooltip'
      }).openTooltip();
    });
    marker.on('mouseout', () => {
      marker.unbindTooltip();
    });
    return marker;
  },

  clearPois() {
    this.poiLayer.clearLayers();
    this.markers = [];
  },

  removePoi(id) {
    const marker = this.markers.find(m => m._poiData && m._poiData.id === id);
    if (marker) {
      this.poiLayer.removeLayer(marker);
      this.markers = this.markers.filter(m => m._poiData && m._poiData.id !== id);
      return true;
    }
    return false;
  },

  /**
   * สร้าง marker icon — ใช้ชื่อไฟล์จาก MAP_CATEGORIES (โหลดจาก blips/custom/)
   */
  _createPoiIcon(category) {
    const size = 24;
    const blipsUrl = this.config.blipsUrl || '/map-module/blips';

    // หาชื่อไฟล์จาก MAP_CATEGORIES
    let fileName = 'custom.png';
    try {
      const cat = MAP_CATEGORIES[category];
      if (cat && cat.file) {
        fileName = cat.file;
      }
    } catch (e) {
      // fallback
    }

    return L.icon({
      iconUrl: `${blipsUrl}/custom/${fileName}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  },

  _createPopupHtml(poi) {
    let catLabel = 'อื่นๆ';
    try {
      const cat = MAP_CATEGORIES[poi.category];
      if (cat) catLabel = cat.label;
    } catch (e) {}

    return `
      <div class="mhnk-poi-popup">
        <div class="mhnk-poi-popup-header">
          <strong>${poi.name || 'ไม่มีชื่อ'}</strong>
        </div>
        <div class="mhnk-poi-popup-body">
          <div class="mhnk-poi-popup-row">
            <span class="mhnk-poi-popup-label">หมวดหมู่:</span>
            <span>${catLabel}</span>
          </div>
          <div class="mhnk-poi-popup-row">
            <span class="mhnk-poi-popup-label">พิกัด:</span>
            <span>X: ${poi.x?.toFixed(2)}, Y: ${poi.y?.toFixed(2)}</span>
          </div>
          ${poi.description ? `
          <div class="mhnk-poi-popup-row">
            <span class="mhnk-poi-popup-label">รายละเอียด:</span>
            <span>${poi.description}</span>
          </div>` : ''}
        </div>
        <div class="mhnk-poi-popup-footer">
          <button class="mhnk-btn-sm mhnk-btn-danger" onclick="MHNK_POI.deletePoi('${poi.id}')">🗑️ ลบ</button>
        </div>
      </div>
    `;
  },

  destroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.tileLayers = {};
    this.markers = [];
    this._initialized = false;
  }
};