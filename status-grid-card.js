const DEFAULT_TILES = [
  { key: "Tile_1", profile: "cpu", name: "CPU", entity: "", unit: "%", sub_entity: "", sub_unit: "", icon: "mdi:chip" },
  { key: "Tile_2", profile: "temperature", name: "Temp", entity: "", unit: "", sub_entity: "", sub_unit: "", icon: "mdi:thermometer" },
  { key: "Tile_3", profile: "memory", name: "Memory", entity: "", unit: "%", sub_entity: "", sub_unit: "", icon: "mdi:memory" },
  { key: "Tile_4", profile: "disk", name: "Disk", entity: "", unit: "%", sub_entity: "", sub_unit: "", icon: "mdi:harddisk" },
];

const CARD_VERSION = "2026.04.08-1";
const DEFAULT_TILE_COLUMNS = 2;
const AUTO_TILE_COLUMNS = "auto";
const VALID_TILE_COLUMNS = [1, 2, 4, AUTO_TILE_COLUMNS];
const DEFAULT_TILE_COUNT = 4;
const VALID_TILE_COUNTS = [2, 4, 6, 8];
const DEFAULT_SECTION_ROWS = 4;
const SMALL_SCREEN_STACK_BREAKPOINT = 480;
const INVALID_STATE_VALUES = ["unknown", "unavailable", "None", null, undefined];
const DEFAULT_PROFILE = "custom";

const TILE_PROFILES = {
  cpu: { name: "CPU", icon: "mdi:chip", unit: "%", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  memory: { name: "Memory", icon: "mdi:memory", unit: "%", thresholds_pct: { warn: 75, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  disk: { name: "Disk", icon: "mdi:harddisk", unit: "%", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  temperature: { name: "Temp", icon: "mdi:thermometer", unit: "", thresholds_pct: { warn: 65, bad: 80 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  power: { name: "Power", icon: "mdi:flash", unit: "W", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  network: { name: "Network", icon: "mdi:network", unit: "", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  fan: { name: "Fan", icon: "mdi:fan", unit: "RPM", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  time: { name: "Time", icon: "mdi:clock-outline", unit: "", thresholds: null, bar_max: null, supports_bar: false, supports_threshold_inversion: false, accepts_text_state: true },
  voltage: { name: "Voltage", icon: "mdi:sine-wave", unit: "V", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  battery: { name: "Battery", icon: "mdi:battery", unit: "%", thresholds_pct: { warn: 30, bad: 15, direction: "low" }, bar_max: 100, supports_bar: true, supports_threshold_inversion: false },
  humidity: { name: "Humidity", icon: "mdi:water-percent", unit: "%", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  energy: { name: "Energy", icon: "mdi:lightning-bolt", unit: "", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true },
  dbm: {
    name: "dBm",
    icon: "mdi:wifi",
    unit: " dBm",
    thresholds: { warn: -70, bad: -75, direction: "low" },
    bar_min: -100,
    bar_max: -50,
    supports_bar: true,
    supports_threshold_inversion: false,
  },
  custom: { name: "Custom", icon: "mdi:gauge", unit: "", thresholds_pct: { warn: 70, bad: 90 }, bar_max: 100, supports_bar: true, supports_threshold_inversion: true, accepts_text_state: true },
};

const DEFAULT_STATUS_COLORS = {
  good: "#34c759",
  warn: "#ff9f0a",
  bad: "#ff4d4d",
};

const EDITOR_FIELD_VISIBILITY = {
  unit: (profile) => profile?.accepts_text_state !== false,
  bar_max: (profile) => profile?.supports_bar !== false,
  invert_thresholds: (profile) => Boolean(profile?.supports_threshold_inversion),
  hide_bar: (profile) => profile?.supports_bar !== false,
};

function getDefaultTile(index) {
  if (index < DEFAULT_TILES.length) {
    return { ...DEFAULT_TILES[index] };
  }

  return {
    key: `Tile_${index + 1}`,
    profile: "custom",
    name: `Tile ${index + 1}`,
    entity: "",
    unit: "",
    sub_entity: "",
    sub_unit: "",
    icon: "mdi:gauge",
    bar_max: 100,
    invert_thresholds: false,
    hide_bar: false,
  };
}

class StatusGridCard extends HTMLElement {
  constructor() {
    super();
    this._renderedTitle = undefined;
    this._titleUnsubscribe = undefined;
    this._titleRequestId = 0;
    this._resizeObserver = undefined;
    this._layoutFrame = undefined;
  }

  static getConfigElement() {
    return document.createElement("status-grid-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:status-grid-card",
      title: "",
      tile_count: DEFAULT_TILE_COUNT,
      tile_columns: DEFAULT_TILE_COLUMNS,
      stack_on_small_screens: false,
      colors: { ...DEFAULT_STATUS_COLORS },
      tiles: Array.from({ length: DEFAULT_TILE_COUNT }, (_, index) => getDefaultTile(index)),
    };
  }

  setConfig(config) {
    const tileCount = this._normalizeTileCount(config?.tile_count ?? config?.tiles?.length);
    this._config = {
      ...(config || {}),
      type: "custom:status-grid-card",
      title: config?.title ?? "",
      tile_count: tileCount,
      tile_columns: this._normalizeTileColumns(config?.tile_columns),
      stack_on_small_screens: Boolean(config?.stack_on_small_screens),
      colors: this._normalizeColors(config?.colors),
      tiles: this._buildTiles(config?.tiles, tileCount),
    };
    this._updateTitleTemplate();
  }

  set hass(hass) {
    const previousConnection = this._hass?.connection;
    this._hass = hass;
    if (previousConnection !== hass?.connection) {
      this._updateTitleTemplate();
    }
    this.render();
  }

  connectedCallback() {
    this.render();
    this._ensureResizeObserver();
    this._updateTitleTemplate();
  }

  disconnectedCallback() {
    this._clearTitleTemplate();
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    if (this._layoutFrame) {
      cancelAnimationFrame(this._layoutFrame);
      this._layoutFrame = undefined;
    }
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    const gridColumns = this._normalizeTileColumns(this._config?.tile_columns);
    const columns = gridColumns === 1 ? 3 : gridColumns === 4 ? 12 : 6;

    return {
      rows: DEFAULT_SECTION_ROWS,
      min_rows: 2,
      max_rows: 12,
      columns,
      min_columns: 3,
      max_columns: 12,
    };
  }

  _normalizeTileColumns(value) {
    if (value === AUTO_TILE_COLUMNS) return AUTO_TILE_COLUMNS;
    const num = Number(value);
    if (VALID_TILE_COLUMNS.includes(num)) return num;
    return DEFAULT_TILE_COLUMNS;
  }

  _normalizeTileCount(value) {
    const num = Number(value);
    if (VALID_TILE_COUNTS.includes(num)) return num;
    return DEFAULT_TILE_COUNT;
  }

  _ensureResizeObserver() {
    if (this._resizeObserver) return;

    this._resizeObserver = new ResizeObserver(() => {
      this._scheduleDynamicLayout();
    });
    this._resizeObserver.observe(this);
  }

  _scheduleDynamicLayout() {
    if (this._layoutFrame) return;

    this._layoutFrame = requestAnimationFrame(() => {
      this._layoutFrame = undefined;
      this._syncDynamicLayout();
    });
  }

  _getRenderedColumnCount(grid) {
    const computed = getComputedStyle(grid);
    const template = computed.gridTemplateColumns.trim();
    if (!template || template === "none") return 1;

    const columns = template
      .split(/\s+/)
      .filter((segment) => segment && !segment.startsWith("["));

    return Math.max(1, columns.length);
  }

  _getTileRowCount(grid, tileCount) {
    const columns = this._getRenderedColumnCount(grid);
    return {
      columns,
      rows: Math.max(1, Math.ceil(tileCount / columns)),
    };
  }

  _getNaturalGridHeight(grid) {
    const tileElements = Array.from(grid.querySelectorAll(".tile"));
    return tileElements.reduce((maxBottom, tileEl) => {
      const bottom = tileEl.offsetTop + tileEl.offsetHeight;
      return Math.max(maxBottom, bottom);
    }, 0);
  }

  _getAvailableGridHeight(card, wrap) {
    const wrapStyle = getComputedStyle(wrap);
    const wrapGap = parseFloat(wrapStyle.rowGap || wrapStyle.gap || "0") || 0;
    const paddingTop = parseFloat(wrapStyle.paddingTop || "0") || 0;
    const paddingBottom = parseFloat(wrapStyle.paddingBottom || "0") || 0;
    const titleEl = wrap.querySelector(".title");
    const titleHeight = titleEl ? titleEl.getBoundingClientRect().height : 0;
    const titleGap = titleEl ? wrapGap : 0;

    return card.clientHeight - paddingTop - paddingBottom - titleHeight - titleGap;
  }

  _applyCenteredGridLayout(grid) {
    grid.style.gridTemplateRows = "";
    grid.style.alignContent = "center";
  }

  _applyStretchedGridLayout(grid, rows, rowHeight) {
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, ${rowHeight}px))`;
    grid.style.alignContent = "stretch";
  }

  _syncDynamicLayout() {
    const card = this.querySelector("ha-card");
    const wrap = this.querySelector(".wrap");
    const grid = this.querySelector(".grid");

    if (!card || !wrap || !grid) return;

    this._applyCenteredGridLayout(grid);

    const tileCount = this._normalizeTileCount(this._config?.tile_count);
    if (!tileCount) return;

    const { rows } = this._getTileRowCount(grid, tileCount);
    const naturalGridHeight = this._getNaturalGridHeight(grid);
    const availableGridHeight = this._getAvailableGridHeight(card, wrap);
    const gridGap = parseFloat(getComputedStyle(grid).rowGap || "0") || 0;

    if (!availableGridHeight || !naturalGridHeight) return;

    if (availableGridHeight <= naturalGridHeight + 2) {
      return;
    }

    const rowHeight = (availableGridHeight - (gridGap * (rows - 1))) / rows;
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) return;

    this._applyStretchedGridLayout(grid, rows, rowHeight);
  }

  _normalizeColors(colors) {
    return {
      good: colors?.good || DEFAULT_STATUS_COLORS.good,
      warn: colors?.warn || DEFAULT_STATUS_COLORS.warn,
      bad: colors?.bad || DEFAULT_STATUS_COLORS.bad,
    };
  }

  _normalizeProfile(value) {
    const profile = String(value || "").trim().toLowerCase();
    return TILE_PROFILES[profile] ? profile : DEFAULT_PROFILE;
  }

  _getLegacyProfile(tile) {
    switch (tile?.key) {
      case "cpu":
        return "cpu";
      case "ram":
        return "memory";
      case "disk":
        return "disk";
      case "temp":
        return "temperature";
      default:
        return DEFAULT_PROFILE;
    }
  }

  _normalizeTile(tile, fallbackTile = {}) {
    const explicitTile = tile || {};
    const mergedTile = {
      ...fallbackTile,
      ...explicitTile,
    };
    const profile = this._normalizeProfile(mergedTile.profile || this._getLegacyProfile(mergedTile));
    const defaults = TILE_PROFILES[profile] || TILE_PROFILES[DEFAULT_PROFILE];

    return {
      ...mergedTile,
      profile,
      name: Object.hasOwn(explicitTile, "name") ? (explicitTile.name || defaults.name || "") : (defaults.name || ""),
      icon: Object.hasOwn(explicitTile, "icon") ? (explicitTile.icon || defaults.icon || "") : (defaults.icon || ""),
      unit: Object.hasOwn(explicitTile, "unit") ? explicitTile.unit : (defaults.unit ?? ""),
      bar_min: Object.hasOwn(explicitTile, "bar_min") ? explicitTile.bar_min : (defaults.bar_min ?? ""),
      bar_max: Object.hasOwn(explicitTile, "bar_max") ? explicitTile.bar_max : (defaults.bar_max ?? ""),
      invert_thresholds: Boolean(mergedTile.invert_thresholds),
      hide_bar: Boolean(mergedTile.hide_bar),
    };
  }

  _buildTiles(tiles, tileCount) {
    return Array.from({ length: tileCount }, (_, index) => this._normalizeTile({
      ...getDefaultTile(index),
      ...(tiles?.[index] || {}),
    }, getDefaultTile(index)));
  }

  _getProfileConfig(tile) {
    const profile = this._normalizeProfile(tile?.profile || this._getLegacyProfile(tile));
    return TILE_PROFILES[profile] || TILE_PROFILES[DEFAULT_PROFILE];
  }

  _getBarRange(tile) {
    const profile = this._getProfileConfig(tile);
    const rawMin = tile?.bar_min ?? profile.bar_min ?? 0;
    const rawValue = tile?.bar_max ?? profile.bar_max;
    const min = Number(rawMin);
    const max = Number(rawValue);

    if (!Number.isFinite(max)) {
      return null;
    }

    if (!Number.isFinite(min)) {
      return max > 0 ? { min: 0, max } : null;
    }

    return max > min ? { min, max } : null;
  }

  _getThresholds(tile) {
    const profile = this._getProfileConfig(tile);
    const range = this._getBarRange(tile);
    const thresholds = profile.thresholds;
    const thresholdsPct = profile.thresholds_pct;

    if (thresholds) {
      const isProfileLowDirection = thresholds.direction === "low";
      const isInverted = Boolean(tile?.invert_thresholds);
      return {
        warn: isInverted ? thresholds.bad : thresholds.warn,
        bad: isInverted ? thresholds.warn : thresholds.bad,
        direction: isInverted
          ? (isProfileLowDirection ? undefined : "low")
          : thresholds.direction,
      };
    }

    if (!thresholdsPct || !range) {
      return null;
    }

    const span = range.max - range.min;
    const isProfileLowDirection = thresholdsPct.direction === "low";
    const isInverted = Boolean(tile?.invert_thresholds);
    const effectiveDirection = isInverted
      ? (isProfileLowDirection ? undefined : "low")
      : thresholdsPct.direction;
    const effectiveWarnPct = isInverted && !isProfileLowDirection
      ? 100 - thresholdsPct.warn
      : thresholdsPct.warn;
    const effectiveBadPct = isInverted && !isProfileLowDirection
      ? 100 - thresholdsPct.bad
      : thresholdsPct.bad;

    return {
      warn: range.min + (span * effectiveWarnPct) / 100,
      bad: range.min + (span * effectiveBadPct) / 100,
      direction: effectiveDirection,
    };
  }

  _getStateObject(entityId) {
    if (!entityId || !this._hass) return undefined;
    return this._hass.states[entityId];
  }

  _getNumericValue(entityId) {
    const stateObj = this._getStateObject(entityId);
    if (!stateObj) return null;
    const num = Number(stateObj.state);
    return Number.isFinite(num) ? num : null;
  }

  _getSubValue(tile) {
    const entityId = tile?.sub_entity;
    if (!entityId) return "";
    const stateObj = this._getStateObject(entityId);
    if (!stateObj) return "";
    const value = stateObj.state;
    if (INVALID_STATE_VALUES.includes(value)) {
      return "";
    }

    const unit = tile?.sub_unit || stateObj.attributes?.unit_of_measurement || "";
    return this._formatValueString(value, unit);
  }

  _getUnit(tile, stateObj) {
    if (tile.unit) return tile.unit;
    const profile = this._getProfileConfig(tile);
    if (profile.unit) return profile.unit;
    return stateObj?.attributes?.unit_of_measurement || "";
  }

  _getColor(tile, value) {
    if (!Number.isFinite(value)) return "var(--secondary-text-color)";
    const colors = this._normalizeColors(this._config?.colors);
    const thresholds = this._getThresholds(tile);

    if (!thresholds) {
      return colors.good;
    }

    if (thresholds.direction === "low") {
      if (value <= thresholds.bad) return colors.bad;
      if (value <= thresholds.warn) return colors.warn;
      return colors.good;
    }

    if (value >= thresholds.bad) return colors.bad;
    if (value >= thresholds.warn) return colors.warn;
    return colors.good;
  }

  _getBarWidth(tile, value) {
    if (!Number.isFinite(value)) return 0;
    const range = this._getBarRange(tile);

    if (!range) {
      return 0;
    }

    return Math.max(0, Math.min(((value - range.min) / (range.max - range.min)) * 100, 100));
  }

  _formatValue(value, unit) {
    if (!Number.isFinite(value)) return `--${unit || ""}`;
    const formatted = this._formatNumber(value);
    return `${formatted}${unit || ""}`;
  }

  _getDisplayValue(tile, stateObj, numericValue, unit) {
    if (Number.isFinite(numericValue)) {
      return this._formatValue(numericValue, unit);
    }

    const profile = this._getProfileConfig(tile);
    if (profile?.accepts_text_state) {
      const rawValue = stateObj?.state;
      if (!INVALID_STATE_VALUES.includes(rawValue)) {
        return this._formatValueString(rawValue, unit);
      }
    }

    return this._formatValue(numericValue, unit);
  }

  _formatValueString(value, unit) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return `${this._formatNumber(numericValue)}${unit || ""}`;
    }

    return `${value}${unit || ""}`;
  }

  _formatNumber(value) {
    if (!Number.isFinite(value)) return "--";
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  _escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _renderVerticalLabel(label) {
    const text = (String(label ?? "").replaceAll(" ", "").slice(0, 4) || "?");
    return [...text]
      .map((char) => `<span>${this._escapeHtml(char)}</span>`)
      .join("");
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId },
      }),
    );
  }

  _isTemplatedTitle(title) {
    if (!title) return false;
    return title.includes("{{") || title.includes("{%");
  }

  _clearTitleTemplate() {
    this._titleRequestId += 1;

    if (this._titleUnsubscribe) {
      this._titleUnsubscribe();
      this._titleUnsubscribe = undefined;
    }
  }

  async _updateTitleTemplate() {
    const title = this._config?.title ?? "";

    this._clearTitleTemplate();

    if (!this._isTemplatedTitle(title) || !this._hass?.connection) {
      this._renderedTitle = title;
      this.render();
      return;
    }

    const requestId = this._titleRequestId;

    try {
      const unsubscribe = await this._hass.connection.subscribeMessage(
        (message) => {
          if (requestId !== this._titleRequestId) return;
          this._renderedTitle = message?.result ?? title;
          this.render();
        },
        {
          type: "render_template",
          template: title,
        },
      );

      if (requestId !== this._titleRequestId) {
        unsubscribe?.();
        return;
      }

      this._titleUnsubscribe = unsubscribe;
    } catch (error) {
      this._renderedTitle = title;
      this.render();
    }
  }

  render() {
    if (!this._config) return;

    const gridColumns = this._normalizeTileColumns(this._config.tile_columns);
    const isAutoLayout = gridColumns === AUTO_TILE_COLUMNS;
    const stackOnSmallScreens = Boolean(this._config.stack_on_small_screens);
    const title = this._renderedTitle ?? this._config.title ?? "";
    const trimmedTitle = String(title).trim();
    const titleHtml = trimmedTitle
      ? `<div class="title">${this._escapeHtml(trimmedTitle)}</div>`
      : "";

    this.style.display = "block";
    this.style.height = "100%";
    this.style.minHeight = "0";

    const tilesHtml = this._config.tiles
      .map((rawTile) => {
        const tile = this._normalizeTile(rawTile);
        const stateObj = this._getStateObject(tile.entity);
        const value = this._getNumericValue(tile.entity);
        const subValue = this._getSubValue(tile);
        const unit = this._getUnit(tile, stateObj);
        const color = this._getColor(tile, value);
        const displayValue = this._getDisplayValue(tile, stateObj, value, unit);
        const barWidth = this._getBarWidth(tile, value);
        const visibleBarWidth = barWidth > 0 ? Math.max(barWidth, 2) : 0;
        const barHtml = tile.hide_bar
          ? ""
          : `
              <div class="tile__bar-track">
                <div
                  class="tile__bar-fill"
                  style="width:${visibleBarWidth}%; --tile-color:${color};"
                ></div>
              </div>
            `;

        return `
          <div
            class="tile"
            data-entity="${this._escapeHtml(tile.entity || "")}"
            role="button"
            tabindex="0"
          >
            <div class="tile__content">
              <div class="tile__label-stack">${this._renderVerticalLabel(tile.name || tile.key)}</div>
              <div class="tile__value-row">
                ${tile.icon ? `
                  <ha-icon
                    class="tile__icon"
                    icon="${this._escapeHtml(tile.icon)}"
                  ></ha-icon>
                ` : ""}
                <div class="tile__value-main">
                  <div class="tile__value" style="color:${color}">
                    ${this._escapeHtml(displayValue)}
                  </div>
                  ${subValue ? `
                    <button
                      type="button"
                      class="tile__sub"
                      data-sub-entity="${this._escapeHtml(tile.sub_entity || "")}"
                    >
                      ${this._escapeHtml(subValue)}
                    </button>
                  ` : ""}
                </div>
              </div>
              ${barHtml}
            </div>
          </div>
        `;
      })
      .join("");

    this.innerHTML = `
      <div class="status-grid-card">
        <ha-card>
          <div class="wrap ${trimmedTitle ? "wrap--with-title" : ""}">
            ${titleHtml}
            <div class="grid ${isAutoLayout ? "grid--auto" : ""} ${stackOnSmallScreens ? "grid--stack-small" : ""}" ${isAutoLayout ? "" : `style="--tile-columns:${gridColumns};"`}>${tilesHtml}</div>
          </div>
        </ha-card>
      </div>
      <style>
        .status-grid-card {
          display: block;
          height: 100%;
          min-height: 100%;
        }

        .status-grid-card ha-card {
          overflow: hidden;
          background: var(--ha-card-background, var(--card-background-color));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow);
          border-width: var(--ha-card-border-width, 1px);
          border-style: solid;
          border-color: var(--ha-card-border-color, var(--divider-color));
          color: var(--primary-text-color);
          height: 100%;
        }

        .status-grid-card .wrap {
          min-height: 100%;
          padding: 8px;
          box-sizing: border-box;
          display: grid;
          grid-template-rows: minmax(0, 1fr);
          gap: 6px;
          align-content: stretch;
        }

        .status-grid-card .wrap.wrap--with-title {
          grid-template-rows: auto minmax(0, 1fr);
        }

        .status-grid-card .title {
          font-size: 11px;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          text-align: center;
        }

        .status-grid-card .grid {
          display: grid;
          grid-template-columns: repeat(var(--tile-columns), minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
          min-height: 0;
          align-content: start;
        }

        .status-grid-card .grid.grid--auto {
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        }

        .status-grid-card .tile {
          border: 1px solid var(--divider-color);
          background: rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.07);
          color: inherit;
          text-align: left;
          padding: 8px;
          border-radius: calc(var(--ha-card-border-radius, 12px) * 0.8);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 50px;
          transition: transform 0.1s ease;
        }

        .status-grid-card .tile:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .status-grid-card .tile:active {
          transform: scale(0.97);
        }

        .status-grid-card .tile__content {
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-rows: 1fr auto;
          gap: 6px;
          align-items: stretch;
          flex: 1;
        }

        .status-grid-card .tile__label-stack {
          display: flex;
          flex-direction: column;
          justify-content: center;
          grid-row: 1 / span 2;
          gap: 1px;
          min-width: 10px;
          color: var(--secondary-text-color);
          font-size: 9px;
          font-weight: 700;
          line-height: 0.9;
          text-transform: uppercase;
        }

        .status-grid-card .tile__value-row {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          min-height: 0;
          padding-block: 2px;
        }

        .status-grid-card .tile__icon {
          --mdc-icon-size: 26px;
          flex: 0 0 auto;
          color: var(--state-icon-color, var(--icon-color, var(--secondary-text-color)));
        }

        .status-grid-card .tile__value-main {
          display: flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
          width: 100%;
        }

        .status-grid-card .tile__value {
          font-size: clamp(22px, 2.2vw, 28px);
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }

        .status-grid-card .tile__sub {
          display: inline-block;
          font: inherit;
          font-size: 14px;
          color: var(--secondary-text-color);
          margin-left: auto;
          text-align: right;
          white-space: nowrap;
          cursor: pointer;
          background: none;
          border: 0;
          padding: 0;
        }

        .status-grid-card .tile__bar-track {
          grid-column: 2;
          height: 4px;
          border-radius: 4px;
          overflow: hidden;
          background: rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.16);
          margin-top: 0;
        }

        .status-grid-card .tile__bar-fill {
          display: block;
          position: relative;
          height: 100%;
          width: var(--bar-width, 0);
          border-radius: inherit;
          background: var(--tile-color);
          opacity: 0.96;
        }

        @media (max-width: 420px) {
          .status-grid-card .wrap {
            padding: 8px;
            gap: 6px;
          }

          .status-grid-card .grid {
            gap: 6px;
          }

          .status-grid-card .tile {
            min-height: 48px;
            padding: 8px;
          }

          .status-grid-card .tile__value {
            font-size: 20px;
          }
        }

        @media (max-width: ${SMALL_SCREEN_STACK_BREAKPOINT}px) {
          .status-grid-card .grid.grid--stack-small {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      </style>
    `;

    this.querySelectorAll(".tile").forEach((tileEl) => {
      tileEl.addEventListener("click", () => {
        this._openMoreInfo(tileEl.dataset.entity);
      });
      tileEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this._openMoreInfo(tileEl.dataset.entity);
      });
    });

    this.querySelectorAll(".tile__sub").forEach((subEl) => {
      subEl.addEventListener("click", (event) => {
        event.stopPropagation();
        this._openMoreInfo(subEl.dataset.subEntity);
      });
      subEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        this._openMoreInfo(subEl.dataset.subEntity);
      });
    });

    this._ensureResizeObserver();
    this._scheduleDynamicLayout();
  }
}

class StatusGridCardEditor extends HTMLElement {
  constructor() {
    super();
    this._elements = {};
    this._initialized = false;
  }

  setConfig(config) {
    const tileCount = this._normalizeTileCount(config?.tile_count ?? config?.tiles?.length);
    this._config = {
      ...(config || {}),
      type: "custom:status-grid-card",
      title: config?.title ?? "",
      tile_count: tileCount,
      tile_columns: this._normalizeTileColumns(config?.tile_columns),
      stack_on_small_screens: Boolean(config?.stack_on_small_screens),
      colors: {
        ...DEFAULT_STATUS_COLORS,
        ...(config?.colors || {}),
      },
      tiles: this._buildTiles(config?.tiles, tileCount),
    };

    this._renderIfNeeded();
    this._syncTileVisibility();
    this._syncValues();
  }

  set hass(hass) {
    this._hass = hass;
    this._renderIfNeeded();
    this._syncHass();
  }

  _emitConfig() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: this._config },
      }),
    );
  }

  _getEventValue(event) {
    if (Object.hasOwn(event?.detail || {}, "value")) {
      return event.detail.value ?? "";
    }

    return event?.target?.value ?? "";
  }

  _updateTitle(value) {
    this._config = { ...this._config, title: value };
    this._emitConfig();
  }

  _updateTile(index, field, value) {
    const tiles = [...this._config.tiles];
    const nextTile = { ...tiles[index], [field]: value };

    if (field === "profile") {
      const previousProfile = TILE_PROFILES[this._normalizeProfile(tiles[index]?.profile)] || TILE_PROFILES[DEFAULT_PROFILE];
      const nextProfile = TILE_PROFILES[this._normalizeProfile(value)] || TILE_PROFILES[DEFAULT_PROFILE];

      if (!tiles[index]?.name || tiles[index].name === previousProfile.name) {
        nextTile.name = nextProfile.name || "";
      }

      if (!tiles[index]?.icon || tiles[index].icon === previousProfile.icon) {
        nextTile.icon = nextProfile.icon || "";
      }

      if ((tiles[index]?.unit ?? "") === (previousProfile.unit ?? "")) {
        nextTile.unit = nextProfile.unit ?? "";
      }

      if ((tiles[index]?.bar_min ?? "") === (previousProfile.bar_min ?? "")) {
        nextTile.bar_min = nextProfile.bar_min ?? "";
      }

      if ((tiles[index]?.bar_max ?? "") === (previousProfile.bar_max ?? "")) {
        nextTile.bar_max = nextProfile.bar_max ?? "";
      }
    }

    tiles[index] = this._normalizeTile(nextTile, getDefaultTile(index));
    this._config = { ...this._config, tiles };
    this._emitConfig();
  }

  _updateTileCount(value) {
    const tileCount = this._normalizeTileCount(value);
    const tiles = this._buildTiles(this._config.tiles, tileCount);
    this._config = { ...this._config, tile_count: tileCount, tiles };
    this._emitConfig();
    this._syncTileVisibility();
    this._syncValues();
  }

  _updateTileColumns(value) {
    const tileColumns = this._normalizeTileColumns(value);
    this._config = { ...this._config, tile_columns: tileColumns };
    this._emitConfig();
  }

  _updateStackOnSmallScreens(value) {
    this._config = { ...this._config, stack_on_small_screens: Boolean(value) };
    this._emitConfig();
  }

  _updateColor(key, value) {
    const colors = {
      ...DEFAULT_STATUS_COLORS,
      ...(this._config.colors || {}),
      [key]: value || DEFAULT_STATUS_COLORS[key],
    };
    this._config = { ...this._config, colors };
    this._emitConfig();
  }

  _getTileSummary(index) {
    const tile = this._normalizeTile(this._config?.tiles?.[index], getDefaultTile(index));
    const profile = this._getProfileConfig(tile);
    const title = tile.name || profile.name || `Tile ${index + 1}`;
    const metaParts = [profile.name || tile.profile || "Custom"];

    if (tile.entity) {
      metaParts.push(tile.entity);
    }

    return {
      title,
      meta: metaParts.filter(Boolean).join(" • "),
    };
  }

  _syncTileSummaries() {
    if (!this._initialized || !this._config) return;

    (this._config.tiles || []).forEach((_, index) => {
      const summary = this._getTileSummary(index);
      const titleEl = this.querySelector(`[data-tile-title="${index}"]`);
      const metaEl = this.querySelector(`[data-tile-meta="${index}"]`);

      if (titleEl) {
        titleEl.textContent = summary.title;
      }

      if (metaEl) {
        metaEl.textContent = summary.meta;
      }
    });
  }

  _renderIfNeeded() {
    if (this._initialized) return;

    this.innerHTML = `
      <div class="editor">
        <label class="editor-code">
          <span>Title</span>
          <ha-code-editor
            id="title"
            mode="yaml"
            autocomplete-entities=""
            dir="ltr"
          ></ha-code-editor>
        </label>
        <ha-selector id="tile_count"></ha-selector>
        <ha-selector id="tile_columns"></ha-selector>
        <ha-selector id="stack_on_small_screens"></ha-selector>
        <div class="editor-section">
          <div class="editor-section__title">COLORS</div>
          <label class="editor-color">
            <span>Normal</span>
            <input id="color_good" type="color" />
          </label>
          <label class="editor-color">
            <span>Medium</span>
            <input id="color_warn" type="color" />
          </label>
          <label class="editor-color">
            <span>Critical</span>
            <input id="color_bad" type="color" />
          </label>
        </div>
        ${Array.from({ length: Math.max(...VALID_TILE_COUNTS) }, (_, index) => `
          <ha-expansion-panel class="editor-tile" data-tile-panel="${index}" outlined>
            <div slot="header" class="editor-tile__summary">
              <span class="editor-tile__title" data-tile-title="${index}">Tile ${index + 1}</span>
              <span class="editor-tile__meta" data-tile-meta="${index}"></span>
            </div>
            <div class="editor-section editor-section--tile">
              <div class="editor-group">
                <div class="editor-group__title">Header Title</div>
                <div data-index="${index}" data-field-wrap="profile"><ha-selector data-index="${index}" data-field="profile" data-selector-type="profile"></ha-selector></div>
                <div data-index="${index}" data-field-wrap="name"><ha-textfield data-index="${index}" data-field="name" label="Label"></ha-textfield></div>
                <div data-index="${index}" data-field-wrap="icon"><ha-selector data-index="${index}" data-field="icon" data-selector-type="icon"></ha-selector></div>
              </div>
              <div class="editor-group">
                <div class="editor-group__title">Entity</div>
                <div data-index="${index}" data-field-wrap="entity"><ha-selector data-index="${index}" data-field="entity" data-selector-type="entity"></ha-selector></div>
                <div data-index="${index}" data-field-wrap="unit"><ha-textfield data-index="${index}" data-field="unit" label="Unit override"></ha-textfield></div>
              </div>
              <div class="editor-group">
                <div class="editor-group__title">Sub Entity</div>
                <div data-index="${index}" data-field-wrap="sub_entity"><ha-selector data-index="${index}" data-field="sub_entity" data-selector-type="sub_entity"></ha-selector></div>
                <div data-index="${index}" data-field-wrap="sub_unit"><ha-textfield data-index="${index}" data-field="sub_unit" label="Sub unit override"></ha-textfield></div>
              </div>
              <div class="editor-group">
                <div class="editor-group__title">Tile</div>
                <div data-index="${index}" data-field-wrap="bar_max"><ha-textfield data-index="${index}" data-field="bar_max" label="Bar max"></ha-textfield></div>
                <div data-index="${index}" data-field-wrap="invert_thresholds"><ha-selector data-index="${index}" data-field="invert_thresholds" data-selector-type="invert_thresholds"></ha-selector></div>
                <div data-index="${index}" data-field-wrap="hide_bar"><ha-selector data-index="${index}" data-field="hide_bar" data-selector-type="hide_bar"></ha-selector></div>
              </div>
            </div>
          </ha-expansion-panel>
        `).join("")}
        <div class="editor-version">Editor bundle ${CARD_VERSION}</div>
      </div>
      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px 0;
        }

        .editor-section {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          background: var(--card-background-color, rgba(127,127,127,0.08));
        }

        .editor-section--tile {
          margin-top: 8px;
        }

        .editor-group {
          display: grid;
          gap: 10px;
        }

        .editor-group__title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.7;
          padding-top: 2px;
        }

        .editor-section__title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          opacity: 0.7;
        }

        .editor-tile {
          --expansion-panel-content-padding: 0 0 12px 0;
        }

        .editor-tile__summary {
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
        }

        .editor-tile__title {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .editor-tile__meta {
          font-size: 12px;
          color: var(--secondary-text-color);
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .editor-code {
          display: grid;
          gap: 6px;
        }

        .editor-code span {
          font-size: 13px;
          opacity: 0.8;
        }

        .editor-code ha-code-editor {
          border-radius: 10px;
          overflow: hidden;
        }

        .editor-color {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .editor-color span {
          font-size: 13px;
          opacity: 0.8;
        }

        .editor-color input[type="color"] {
          width: 52px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
        }

        .editor-version {
          font-size: 12px;
          color: var(--secondary-text-color);
          opacity: 0.8;
          text-align: right;
        }
      </style>
    `;

    this._elements.title = this.querySelector("#title");
    this._elements.tileCount = this.querySelector("#tile_count");
    this._elements.tileColumns = this.querySelector("#tile_columns");
    this._elements.stackOnSmallScreens = this.querySelector("#stack_on_small_screens");
    this._elements.colorGood = this.querySelector("#color_good");
    this._elements.colorWarn = this.querySelector("#color_warn");
    this._elements.colorBad = this.querySelector("#color_bad");
    this._elements.fields = Array.from(this.querySelectorAll("[data-field]"));
    this._elements.fieldWraps = Array.from(this.querySelectorAll("[data-field-wrap]"));

    this._elements.title?.addEventListener("value-changed", (event) => {
      this._updateTitle(this._getEventValue(event));
    });

    this._elements.tileCount.selector = {
      select: {
        mode: "dropdown",
        options: VALID_TILE_COUNTS.map((count) => ({ value: String(count), label: String(count) })),
      },
    };
    this._elements.tileCount.label = "Tile count";

    this._elements.tileColumns.selector = {
      select: {
        mode: "dropdown",
        options: [
          { value: AUTO_TILE_COLUMNS, label: "Auto" },
          { value: "1", label: "Column" },
          { value: "2", label: "2 x 2" },
          { value: "4", label: "Row" },
        ],
      },
    };
    this._elements.tileColumns.label = "Widget layout";

    this._elements.stackOnSmallScreens.selector = { boolean: {} };
    this._elements.stackOnSmallScreens.label = "Stack on small screens";
    this._configureSelectors();

    const handleTileCountChange = (event) => {
      this._updateTileCount(this._getEventValue(event));
    };

    const handleTileColumnsChange = (event) => {
      this._updateTileColumns(this._getEventValue(event));
    };

    const handleStackOnSmallScreensChange = (event) => {
      this._updateStackOnSmallScreens(this._getEventValue(event));
    };

    this._elements.tileCount?.addEventListener("value-changed", handleTileCountChange);
    this._elements.tileColumns?.addEventListener("value-changed", handleTileColumnsChange);
    this._elements.stackOnSmallScreens?.addEventListener("value-changed", handleStackOnSmallScreensChange);

    this._elements.colorGood?.addEventListener("input", (event) => {
      this._updateColor("good", event.target.value);
    });

    this._elements.colorWarn?.addEventListener("input", (event) => {
      this._updateColor("warn", event.target.value);
    });

    this._elements.colorBad?.addEventListener("input", (event) => {
      this._updateColor("bad", event.target.value);
    });

    this._elements.fields.forEach((field) => {
      const eventName = field.tagName.toLowerCase() === "ha-selector"
        ? "value-changed"
        : "input";

      field.addEventListener(eventName, (event) => {
        const index = Number(field.dataset.index);
        const key = field.dataset.field;
        const value = this._getEventValue(event);
        this._updateTile(index, key, value);
      });
    });

    this._initialized = true;
    this._syncHass();
  }

  _normalizeTileColumns(value) {
    if (value === AUTO_TILE_COLUMNS) return AUTO_TILE_COLUMNS;
    const num = Number(value);
    if (VALID_TILE_COLUMNS.includes(num)) return num;
    return DEFAULT_TILE_COLUMNS;
  }

  _normalizeTileCount(value) {
    const num = Number(value);
    if (VALID_TILE_COUNTS.includes(num)) return num;
    return DEFAULT_TILE_COUNT;
  }

  _normalizeProfile(value) {
    const profile = String(value || "").trim().toLowerCase();
    return TILE_PROFILES[profile] ? profile : DEFAULT_PROFILE;
  }

  _getLegacyProfile(tile) {
    switch (tile?.key) {
      case "cpu":
        return "cpu";
      case "ram":
        return "memory";
      case "disk":
        return "disk";
      case "temp":
        return "temperature";
      default:
        return DEFAULT_PROFILE;
    }
  }

  _normalizeTile(tile, fallbackTile = {}) {
    const explicitTile = tile || {};
    const mergedTile = {
      ...fallbackTile,
      ...explicitTile,
    };
    const profile = this._normalizeProfile(mergedTile.profile || this._getLegacyProfile(mergedTile));
    const defaults = TILE_PROFILES[profile] || TILE_PROFILES[DEFAULT_PROFILE];

    return {
      ...mergedTile,
      profile,
      name: Object.hasOwn(explicitTile, "name") ? (explicitTile.name || defaults.name || "") : (defaults.name || ""),
      icon: Object.hasOwn(explicitTile, "icon") ? (explicitTile.icon || defaults.icon || "") : (defaults.icon || ""),
      unit: Object.hasOwn(explicitTile, "unit") ? explicitTile.unit : (defaults.unit ?? ""),
      bar_min: Object.hasOwn(explicitTile, "bar_min") ? explicitTile.bar_min : (defaults.bar_min ?? ""),
      bar_max: Object.hasOwn(explicitTile, "bar_max") ? explicitTile.bar_max : (defaults.bar_max ?? ""),
      invert_thresholds: Boolean(mergedTile.invert_thresholds),
      hide_bar: Boolean(mergedTile.hide_bar),
    };
  }

  _buildTiles(tiles, tileCount) {
    return Array.from({ length: tileCount }, (_, index) => this._normalizeTile({
      ...getDefaultTile(index),
      ...(tiles?.[index] || {}),
    }, getDefaultTile(index)));
  }

  _getProfileConfig(tile) {
    const profile = this._normalizeProfile(tile?.profile || this._getLegacyProfile(tile));
    return TILE_PROFILES[profile] || TILE_PROFILES[DEFAULT_PROFILE];
  }

  _isFieldVisibleForTile(tile, fieldName) {
    const visibilityRule = EDITOR_FIELD_VISIBILITY[fieldName];
    if (!visibilityRule) return true;
    return visibilityRule(this._getProfileConfig(tile), tile) !== false;
  }

  _configureSelectors() {
    this.querySelectorAll('ha-selector[data-selector-type="hide_bar"]').forEach((field) => {
      field.selector = { boolean: {} };
      field.label = "Hide bar";
    });

    this.querySelectorAll('ha-selector[data-selector-type="invert_thresholds"]').forEach((field) => {
      field.selector = { boolean: {} };
      field.label = "Invert thresholds";
    });

    this.querySelectorAll('ha-selector[data-selector-type="profile"]').forEach((field) => {
      field.selector = {
        select: {
          mode: "dropdown",
          options: [
            { value: "cpu", label: "CPU" },
            { value: "memory", label: "Memory" },
            { value: "disk", label: "Disk" },
            { value: "temperature", label: "Temperature" },
            { value: "power", label: "Power" },
            { value: "network", label: "Network" },
            { value: "fan", label: "Fan" },
            { value: "time", label: "Time" },
            { value: "voltage", label: "Voltage" },
            { value: "battery", label: "Battery" },
            { value: "humidity", label: "Humidity" },
            { value: "energy", label: "Energy" },
            { value: "dbm", label: "dBm" },
            { value: "custom", label: "Custom" },
          ],
        },
      };
      field.label = "Profile";
    });

    this.querySelectorAll('ha-selector[data-selector-type="icon"]').forEach((field) => {
      field.selector = { icon: {} };
      field.label = "Icon";
    });

    this.querySelectorAll('ha-selector[data-selector-type="entity"]').forEach((field) => {
      field.selector = { entity: {} };
      field.label = " ";
      field.required = true;
    });

    this.querySelectorAll('ha-selector[data-selector-type="sub_entity"]').forEach((field) => {
      field.selector = { entity: {} };
      field.label = " ";
      field.required = false;
      field.clearable = true;
    });
  }

  _syncHass() {
    if (!this._initialized || !this._hass) return;

    if (this._elements.title) {
      this._elements.title.hass = this._hass;
    }

    if (this._elements.tileCount) {
      this._elements.tileCount.hass = this._hass;
    }

    if (this._elements.tileColumns) {
      this._elements.tileColumns.hass = this._hass;
    }

    if (this._elements.stackOnSmallScreens) {
      this._elements.stackOnSmallScreens.hass = this._hass;
    }

    this._elements.fields?.forEach((field) => {
      field.hass = this._hass;
    });
  }

  _syncValues() {
    if (!this._initialized || !this._config) return;

    if (this._elements.title && this._elements.title.value !== this._config.title) {
      this._elements.title.value = this._config.title || "";
    }

    if (
      this._elements.tileCount &&
      this._elements.tileCount.value !== String(this._config.tile_count || DEFAULT_TILE_COUNT)
    ) {
      this._elements.tileCount.value = String(this._config.tile_count || DEFAULT_TILE_COUNT);
    }

    if (
      this._elements.tileColumns &&
      this._elements.tileColumns.value !== String(this._config.tile_columns || DEFAULT_TILE_COLUMNS)
    ) {
      this._elements.tileColumns.value = String(
        this._config.tile_columns || DEFAULT_TILE_COLUMNS,
      );
    }

    if (
      this._elements.stackOnSmallScreens
      && this._elements.stackOnSmallScreens.value !== Boolean(this._config.stack_on_small_screens)
    ) {
      this._elements.stackOnSmallScreens.value = Boolean(this._config.stack_on_small_screens);
    }

    const colors = {
      ...DEFAULT_STATUS_COLORS,
      ...(this._config.colors || {}),
    };

    if (this._elements.colorGood && this._elements.colorGood.value !== colors.good) {
      this._elements.colorGood.value = colors.good;
    }

    if (this._elements.colorWarn && this._elements.colorWarn.value !== colors.warn) {
      this._elements.colorWarn.value = colors.warn;
    }

    if (this._elements.colorBad && this._elements.colorBad.value !== colors.bad) {
      this._elements.colorBad.value = colors.bad;
    }

    this._elements.fields?.forEach((field) => {
      const index = Number(field.dataset.index);
      const key = field.dataset.field;
      const tile = this._config.tiles[index] || {};
      const nextValue = Object.hasOwn(tile, key) ? tile[key] : "";

      if (field.value !== nextValue) {
        field.value = nextValue;
      }
    });

    this._syncTileVisibility();
    this._syncTileSummaries();
  }

  _syncTileVisibility() {
    if (!this._initialized || !this._config) return;

    const tileCount = this._normalizeTileCount(this._config.tile_count);
    this.querySelectorAll("[data-tile-panel]").forEach((panel) => {
      const index = Number(panel.dataset.tilePanel);
      panel.hidden = index >= tileCount;
    });

    this._elements.fieldWraps?.forEach((wrap) => {
      const index = Number(wrap.dataset.index);
      const fieldName = wrap.dataset.fieldWrap;
      const tile = this._config.tiles[index] || getDefaultTile(index);
      wrap.hidden = !this._isFieldVisibleForTile(tile, fieldName);
    });
  }
}

if (!customElements.get("status-grid-card")) {
  customElements.define("status-grid-card", StatusGridCard);
}

if (!customElements.get("status-grid-card-editor")) {
  customElements.define("status-grid-card-editor", StatusGridCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "status-grid-card",
  name: "Status Grid Card",
  description: "Flexible status and metric grid card with a built-in visual editor.",
});
