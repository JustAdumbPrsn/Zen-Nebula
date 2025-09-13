// ==UserScript==
// @name           nebula-core.uc.js
// @description    Central engine for Nebula with all modules
// @author         JustAdumbPrsn
// @version        v3.3
// @include        main
// @grant          none
// ==/UserScript==

(function() {
  'use strict';

  if (window.Nebula) {
    try { window.Nebula.destroy(); } catch {}
  }

  window.Nebula = {
    _modules: [],
    _initialized: false,

    logger: {
      _prefix: '[Nebula]',
      log(msg) { console.log(`${this._prefix} ${msg}`); },
      warn(msg) { console.warn(`${this._prefix} ${msg}`); },
      error(msg) { console.error(`${this._prefix} ${msg}`); }
    },

    runOnLoad(callback) {
      if (document.readyState === 'complete') callback();
      else document.addEventListener('DOMContentLoaded', callback, { once: true });
    },

    register(ModuleClass) {
      const name = ModuleClass?.name || 'UnnamedModule';
      if (!ModuleClass) {
        this.logger.warn(`Module "${name}" is not defined, skipping registration.`);
        return;
      }
      if (this._modules.find(m => m._name === name)) {
        this.logger.warn(`Module "${name}" already registered.`);
        return;
      }

      let instance;
      try {
        instance = new ModuleClass();
      } catch (err) {
        this.logger.error(`Module "${name}" failed to construct:\n${err}`);
        return; // skip this module, keep others running
      }

      instance._name = name;
      this._modules.push(instance);

      if (this._initialized && typeof instance.init === 'function') {
        try {
          instance.init();
        } catch (err) {
          this.logger.error(`Module "${name}" failed to init:\n${err}`);
        }
      }
    },

    getModule(name) {
      return this._modules.find(m => m._name === name);
    },

    observePresence(selector, attrName) {
      const update = () => {
        const found = !!document.querySelector(selector);
        document.documentElement.toggleAttribute(attrName, found);
      };
      const observer = new MutationObserver(update);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      update();
      return observer;
    },

    init() {
      this.logger.log('⏳ Initializing core...');
      this._initialized = true;
      this.runOnLoad(() => {
        this._modules.forEach(m => {
          try {
            m.init?.();
          } catch (err) {
            this.logger.error(`Module "${m._name}" failed to init:\n${err}`);
          }
        });
      });
      window.addEventListener('unload', () => this.destroy(), { once: true });
    },

    destroy() {
      this._modules.forEach(m => {
        try {
          m.destroy?.();
        } catch (err) {
          this.logger.error(`Module "${m._name}" failed to destroy:\n${err}`);
        }
      });
      this.logger.log('🧹 All modules destroyed.');
      delete window.Nebula;
    },

    debug: {
      listModules() {
        return Nebula._modules.map(m => m._name || 'Unnamed');
      },
      destroyModule(name) {
        const mod = Nebula._modules.find(m => m._name === name);
        try {
          mod?.destroy?.();
        } catch (err) {
          Nebula.logger.error(`Module "${name}" failed to destroy:\n${err}`);
        }
      },
      reload() {
        Nebula.destroy();
        location.reload();
      }
    }
  };

  // ========== NebulaPolyfillModule ==========
  class NebulaPolyfillModule {
    constructor() {
      this.root = document.documentElement;
      this.compactObserver = null;
      this.modeObserver = null;

      this.updateFaviconColor = this.updateFaviconColor.bind(this);
    }

    async init() {
      // Wait until gBrowser is available
      if (!window.gBrowser) {
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (window.gBrowser?.tabContainer) {
              clearInterval(check);
              resolve();
            }
          }, 50);
        });
      }

      // Compact mode detection
      this.compactObserver = Nebula.observePresence(
        '[zen-compact-mode="true"]',
        "nebula-compact-mode"
      );

      // Toolbar mode detection
      this.modeObserver = new MutationObserver(() => this.updateToolbarModes());
      this.modeObserver.observe(this.root, { attributes: true });
      this.updateToolbarModes();

      // Favicon color detection
      gBrowser.tabContainer.addEventListener("TabSelect", this.updateFaviconColor);
      gBrowser.tabContainer.addEventListener("TabAttrModified", this.updateFaviconColor);

      // Initial run
      this.updateFaviconColor();

      Nebula.logger.log("✅ [Polyfill] Detection active.");
    }

    updateToolbarModes() {
      const hasSidebar = this.root.hasAttribute("zen-sidebar-expanded");
      const isSingle = this.root.hasAttribute("zen-single-toolbar");

      this.root.toggleAttribute("nebula-single-toolbar", isSingle);
      this.root.toggleAttribute("nebula-multi-toolbar", hasSidebar && !isSingle);
      this.root.toggleAttribute("nebula-collapsed-toolbar", !hasSidebar && !isSingle);
    }

    async updateFaviconColor(e) {
      if (e?.type === "TabAttrModified" && !e.detail.changed.includes("image")) return;

      const tab = gBrowser.selectedTab;
      const iconUrl = tab?.getAttribute("image");
      if (!iconUrl) return;

      // Debounce: delay update by 10ms
      if (this._faviconTimeout) clearTimeout(this._faviconTimeout);
      this._faviconTimeout = setTimeout(async () => {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = iconUrl;
          await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });

          const size = 16; // smaller canvas
          if (!this._faviconCanvas) {
            this._faviconCanvas = document.createElement("canvas");
            this._faviconCanvas.width = size;
            this._faviconCanvas.height = size;
            this._faviconCtx = this._faviconCanvas.getContext("2d");
          }

          const ctx = this._faviconCtx;
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);

          const data = ctx.getImageData(0, 0, size, size).data;
          const counts = [];

          for (let i = 0; i < data.length; i += 4) {
            const [r, g, b, a] = [data[i], data[i+1], data[i+2], data[i+3]];
            if (a < 128) continue;
            const key = `${r & 0xFC},${g & 0xFC},${b & 0xFC}`; // round to multiple of 4
            const index = counts.findIndex(c => c.key === key);
            if (index >= 0) counts[index].freq++;
            else counts.push({ key, r, g, b, freq: 1 });
          }

          let best = null;
          let brightCandidate = null;

          for (let c of counts) {
            const hsl = this.rgbToHsl(c.r, c.g, c.b);
            const vibrancy = hsl.s * (1 - Math.abs(0.5 - hsl.l) * 2);
            const brightness = (0.299*c.r + 0.587*c.g + 0.114*c.b) / 255;
            const score = c.freq * vibrancy * brightness;

            if (!best || score > best.score) best = { ...c, score, brightness, hsl };
            if (brightness > 0.5) {
              if (!brightCandidate || score > brightCandidate.score) brightCandidate = { ...c, score, brightness, hsl };
            }
          }

          if (best && (best.r + best.g + best.b) < 300 && brightCandidate) best = brightCandidate;

          if (best) {
            let { r, g, b, hsl } = best;
            const sum = r + g + b;
            if (sum < 180) { // very dark
              let newL = Math.max(hsl.l, 0.4);
              newL = Math.min(newL * 1.6, 0.8);
              let newS = Math.min(hsl.s * 1.2, 1);
              ({ r, g, b } = this.hslToRgb(hsl.h, newS, newL));
            }

            const finalColor = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
            this.root.style.setProperty("--nebula-selected-favicon-color", finalColor);
          }

        } catch(err) {
          console.error("[NebulaPolyfill] Favicon color error:", err);
        }
      }, 100); // 10ms delay
    }

    // helper: convert HSL to RGB
    hslToRgb(h, s, l) {
      let r, g, b;
      if (s === 0) {
        r = g = b = l; // achromatic
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return { r: r*255, g: g*255, b: b*255 };
    }

    // helper: convert RGB to HSL
    rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return { h, s, l };
    }

    destroy() {
      this.compactObserver?.disconnect();
      this.modeObserver?.disconnect();

      if (window.gBrowser) {
        gBrowser.tabContainer.removeEventListener("TabSelect", this.updateFaviconColor);
        gBrowser.tabContainer.removeEventListener("TabAttrModified", this.updateFaviconColor);
      }

      this.root.removeAttribute("nebula-single-toolbar");
      this.root.removeAttribute("nebula-multi-toolbar");
      this.root.removeAttribute("nebula-collapsed-toolbar");

      Nebula.logger.log("🧹 [Polyfill] Destroyed.");
    }
  }

  // ========== NebulaGradientSliderModule ==========
  class NebulaGradientSliderModule {
    constructor() {
      this.root = document.documentElement;
      this.gradientSlider = null;
      this._patched = false;
      this._sliderHandler = this.sync.bind(this);

      // Store original methods without polluting prototype
      this._origMethods = new WeakMap();
    }

    init() {
      this._waitFor(() => document.querySelector("#PanelUI-zen-gradient-generator-opacity"), (slider) => {
        this.gradientSlider = slider;
        slider.min = 0.0; // force min opacity
        slider.addEventListener("input", this._sliderHandler);

        this.sync();
        this._patchThemePicker();
      });
    }

    _waitFor(fn, callback, maxRetries = 40) {
      let retries = maxRetries;
      const tryFind = () => {
        const el = fn();
        if (el) return callback(el);
        if (retries-- > 0) {
          Nebula.logger.debug?.(`[GradientSlider] Waiting… retries left: ${retries}`);
          requestAnimationFrame(tryFind);
        } else {
          Nebula.logger.error("❌ [GradientSlider] Target not found.");
        }
      };
      tryFind();
    }

    sync() {
      if (!this.gradientSlider) return;
      const val = +this.gradientSlider.value;
      this.root.style.setProperty("--nebula-gradient-opacity", val === 0 ? "0" : null);
      Nebula.logger.debug?.(`[GradientSlider] Sync → ${val}`);
    }

    _patchThemePicker() {
      if (this._patched) return;

      this._waitFor(
        () => window.nsZenThemePicker?.prototype || window.browser?.gZenThemePicker?.constructor?.prototype,
        (proto) => {
          if (!proto?.blendWithWhiteOverlay) return;

          // Save original
          this._origMethods.set(proto, proto.blendWithWhiteOverlay);

          proto.blendWithWhiteOverlay = (baseColor, opacity) => {
            const val = +this.gradientSlider?.value ?? opacity;
            if (val === 0) {
              if (Array.isArray(baseColor)) {
                return `rgba(${baseColor.join(",")},0)`;
              }
              if (typeof baseColor === "string" && baseColor.startsWith("rgb")) {
                return baseColor.replace(/rgb(a)?\(([^)]+)\)/, "rgba($2, 0)");
              }
              return "rgba(0,0,0,0)";
            }
            return this._origMethods.get(proto).call(this, baseColor, opacity);
          };

          this._patched = true;
          Nebula.logger.log("✅ [GradientSlider] Patched blendWithWhiteOverlay");
        }
      );
    }

    destroy() {
      if (this.gradientSlider) {
        this.gradientSlider.removeEventListener("input", this._sliderHandler);
        this.gradientSlider = null;
      }

      if (this._patched) {
        const proto = window.nsZenThemePicker?.prototype || window.browser?.gZenThemePicker?.constructor?.prototype;
        if (proto && this._origMethods.has(proto)) {
          proto.blendWithWhiteOverlay = this._origMethods.get(proto);
          this._origMethods.delete(proto);
        }
        this._patched = false;
      }

      this.root.style.removeProperty("--nebula-gradient-opacity");
      Nebula.logger.log("🧹 [GradientSlider] Destroyed");
    }
  }
  
  // ========== NebulaTitlebarBackgroundModule ==========
  class NebulaTitlebarBackgroundModule {
    constructor() {
      this.root = document.documentElement;
      this.browser = document.getElementById("browser");
      this.titlebar = document.getElementById("titlebar");
      this.overlay = null;
      this.lastRect = {};
      this.lastVisible = false;
      this.animationFrameId = null;

      this.update = this.update.bind(this);
      this._compactCallback = this._compactCallback.bind(this);
      this.resizeObserver = null;
      this.intersectionObserver = null;
    }

    init() {
      if (!this.browser || !this.titlebar) {
        Nebula.logger.warn("⚠️ [TitlebarBackground] Required elements not found.");
        return;
      }

      this.overlay = document.createElement("div");
      this.overlay.id = "Nebula-titlebar-background";
      Object.assign(this.overlay.style, {
        position: "absolute",
        display: "none"
      });
      this.browser.appendChild(this.overlay);

      gZenCompactModeManager.addEventListener(this._compactCallback);

      if (this.root.hasAttribute("nebula-compact-mode")) {
        this.startLiveTracking();
      }

      Nebula.logger.log("✅ [TitlebarBackground] Tracking initialized.");
    }

    _compactCallback() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");
      if (isCompact) {
        this.startLiveTracking();
      } else {
        this.stopLiveTracking();
        this.hideOverlay();
      }
    }

    update() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");

      if (!isCompact) {
        this.stopLiveTracking();
        this.hideOverlay();
        return;
      }

      const rect = this.titlebar.getBoundingClientRect();
      const style = getComputedStyle(this.titlebar);

      const isVisible =
        rect.width > 5 &&
        rect.height > 5 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;

      const changed =
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height;

      if (!changed && this.lastVisible === isVisible) {
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      this.lastRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

      if (isVisible) {
        Object.assign(this.overlay.style, {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          display: "block"
        });

        if (!this.lastVisible) {
          this.overlay.classList.add("visible");
          this.lastVisible = true;
        }
      } else {
        this.hideOverlay();
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    hideOverlay() {
      if (this.lastVisible) {
        this.overlay.classList.remove("visible");
        this.overlay.style.display = "none";
        this.lastVisible = false;
      }
    }

    startLiveTracking() {
      this.stopLiveTracking();
      this.update();
    }

    stopLiveTracking() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    destroy() {
      gZenCompactModeManager.removeEventListener(this._compactCallback);
      this.stopLiveTracking();
      this.hideOverlay();
      this.overlay?.remove();
      this.overlay = null;
      Nebula.logger.log("🧹 [TitlebarBackground] Destroyed.");
    }
  }

  // ========== NebulaNavbarBackgroundModule ==========
  class NebulaNavbarBackgroundModule {
    constructor() {
      this.root = document.documentElement;
      this.browser = document.getElementById("browser");
      this.navbar = document.getElementById("nav-bar");
      this.overlay = null;
      this.lastRect = {};
      this.lastVisible = false;
      this.animationFrameId = null;

      this.update = this.update.bind(this);
      this._compactCallback = this._compactCallback.bind(this);
    }

    init() {
      if (!this.browser || !this.navbar) {
        Nebula.logger.warn("⚠️ [NavbarBackground] Required elements not found.");
        return;
      }

      this.overlay = document.createElement("div");
      this.overlay.id = "Nebula-navbar-background";
      Object.assign(this.overlay.style, {
        position: "absolute",
        display: "none"
      });
      this.browser.appendChild(this.overlay);

      gZenCompactModeManager.addEventListener(this._compactCallback);

      if (this.root.hasAttribute("nebula-compact-mode")) {
        this.startLiveTracking();
      }

      Nebula.logger.log("✅ [NavbarBackground] Tracking initialized.");
    }

    _compactCallback() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");
      if (isCompact) {
        this.startLiveTracking();
      } else {
        this.stopLiveTracking();
        this.hideOverlay();
      }
    }

    update() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");
      if (!isCompact) {
        this.stopLiveTracking();
        this.hideOverlay();
        return;
      }

      const rect = this.navbar.getBoundingClientRect();
      const style = getComputedStyle(this.navbar);

      const isVisible =
        rect.width > 5 &&
        rect.height > 5 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;

      const changed =
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height;

      if (!changed && this.lastVisible === isVisible) {
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      this.lastRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

      if (isVisible) {
        Object.assign(this.overlay.style, {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          display: "block"
        });

        if (!this.lastVisible) {
          this.overlay.classList.add("visible");
          this.lastVisible = true;
        }
      } else {
        this.hideOverlay();
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    hideOverlay() {
      if (this.lastVisible) {
        this.overlay.classList.remove("visible");
        this.overlay.style.display = "none";
        this.lastVisible = false;
      }
    }

    startLiveTracking() {
      this.stopLiveTracking();
      this.update();
    }

    stopLiveTracking() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    destroy() {
      gZenCompactModeManager.removeEventListener(this._compactCallback);
      this.stopLiveTracking();
      this.hideOverlay();
      this.overlay?.remove();
      this.overlay = null;
      Nebula.logger.log("🧹 [NavbarBackground] Destroyed.");
    }
  }

  // ========== NebulaURLBarBackgroundModule ==========
  class NebulaURLBarBackgroundModule {
    constructor() {
      this.root = document.documentElement;
      this.browser = document.getElementById("browser");
      this.urlbar = document.getElementById("urlbar");
      this.overlay = null;
      this.lastRect = {};
      this.lastVisible = false;
      this.animationFrameId = null;

      this.update = this.update.bind(this);
      this.mutationObserver = null;
    }

    init() {
      if (!this.browser || !this.urlbar) {
        Nebula.logger.warn("⚠️ [URLBarBackground] Required elements not found.");
        return;
      }

      this.overlay = document.createElement("div");
      this.overlay.id = "Nebula-urlbar-background";
      Object.assign(this.overlay.style, {
        position: "absolute",
        display: "none"
      });
      this.browser.appendChild(this.overlay);

      // Start mutation observer for `open` attribute change
      this.mutationObserver = new MutationObserver(() => this.onMutation());
      this.mutationObserver.observe(this.urlbar, { attributes: true, attributeFilter: ["open"] });

      if (this.urlbar.hasAttribute("open")) {
        this.startLiveTracking();
      }

      Nebula.logger.log("✅ [URLBarBackground] Tracking initialized.");
    }

    onMutation() {
      const isOpen = this.urlbar.hasAttribute("open");
      if (isOpen) {
        this.startLiveTracking();
      } else {
        this.stopLiveTracking();
        this.hideOverlay();
      }
    }

    update() {
      const isOpen = this.urlbar.hasAttribute("open");
      if (!isOpen) {
        this.stopLiveTracking();
        this.hideOverlay();
        return;
      }

      const rect = this.urlbar.getBoundingClientRect();
      const style = getComputedStyle(this.urlbar);

      const isVisible =
        rect.width > 5 &&
        rect.height > 5 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;

      const changed =
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height;

      if (!changed && this.lastVisible === isVisible) {
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      this.lastRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

      if (isVisible) {
        Object.assign(this.overlay.style, {
          top: `${rect.top + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          display: "block"
        });

        if (!this.lastVisible) {
          this.overlay.classList.add("visible");
          this.lastVisible = true;
        }
      } else {
        this.hideOverlay();
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    hideOverlay() {
      if (this.lastVisible) {
        this.overlay.classList.remove("visible");
        this.overlay.style.display = "none";
        this.lastVisible = false;
      }
    }

    startLiveTracking() {
      this.stopLiveTracking();
      this.update();
    }

    stopLiveTracking() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    destroy() {
      this.mutationObserver?.disconnect();
      this.stopLiveTracking();
      this.hideOverlay();
      this.overlay?.remove();
      this.overlay = null;
      Nebula.logger.log("🧹 [URLBarBackground] Destroyed.");
    }
  }

  // ========== NebulaMediaCoverArtModule ==========
  class NebulaMediaCoverArtModule {
    constructor() {
      this.OVERLAY_ID = 'Nebula-media-cover-art';
      this.TOOLBAR_ITEM_SELECTOR = '#zen-media-controls-toolbar > toolbaritem';
      
      this.lastArtworkUrl = null;
      this.originalSetupMediaController = null;
      this.overlay = null;
      this._metadataChangeHandler = this._metadataChangeHandler.bind(this);
    }

    init() {
      this._waitForController();
    }

    _waitForController() {
      if (typeof window.gZenMediaController?.setupMediaController === 'function') {
        this._onControllerReady();
      } else {
        requestIdleCallback(() => setTimeout(() => this._waitForController(), 200)); // gentle polling
      }
    }

    _onControllerReady() {
      if (this.originalSetupMediaController) return;

      this.originalSetupMediaController = gZenMediaController.setupMediaController.bind(gZenMediaController);
      gZenMediaController.setupMediaController = this._setupMediaControllerPatcher.bind(this);

      const initialController = gZenMediaController._currentMediaController;
      if (initialController) {
        this._attachMetadataHandler(initialController);
        this._setBackgroundFromMetadata(initialController);
      } else {
        this._manageOverlayVisibility(false);
      }

      Nebula.logger.log("✅ [MediaCoverArt] Hooked into MediaPlayer.");
    }

    _setupMediaControllerPatcher(controller, browser) {
      if (controller) {
        this._attachMetadataHandler(controller);
        this._setBackgroundFromMetadata(controller);
      }
      return this.originalSetupMediaController(controller, browser);
    }

    _attachMetadataHandler(controller) {
      controller.removeEventListener("metadatachange", this._metadataChangeHandler);
      controller.addEventListener("metadatachange", this._metadataChangeHandler);
    }

    _metadataChangeHandler(event) {
      const controller = event.target;
      if (controller && typeof controller.getMetadata === 'function') {
        this._setBackgroundFromMetadata(controller);
      } else {
        this._cleanupToDefaultState();
      }
    }

    _setBackgroundFromMetadata(controller) {
      const metadata = controller?.getMetadata?.();
      const artwork = metadata?.artwork;

      if (!Array.isArray(artwork) || !artwork.length) {
        return this._cleanupToDefaultState();
      }

      const sorted = [...artwork].sort((a, b) => {
        const [aw, ah] = a.sizes?.split("x").map(Number) || [0, 0];
        const [bw, bh] = b.sizes?.split("x").map(Number) || [0, 0];
        return (bw * bh) - (aw * ah);
      });

      const coverUrl = sorted[0]?.src || null;
      if (coverUrl === this.lastArtworkUrl) return;

      this.lastArtworkUrl = coverUrl;
      this._ensureOverlayElement();
      this._updateOverlayStyle(coverUrl);
    }

    _ensureOverlayElement() {
      if (this.overlay) return;

      const toolbarItem = document.querySelector(this.TOOLBAR_ITEM_SELECTOR);
      if (!toolbarItem) return;

      this.overlay = document.createElement('div');
      this.overlay.id = this.OVERLAY_ID;
      toolbarItem.prepend(this.overlay);
    }

    _updateOverlayStyle(coverUrl) {
      if (!this.overlay) return;

      if (coverUrl) {
        if (this.overlay.style.backgroundImage !== `url("${coverUrl}")`) {
          this.overlay.style.backgroundImage = `url("${coverUrl}")`;
        }
        this.overlay.classList.add('visible');
      } else {
        this._cleanupToDefaultState();
      }
    }

    _manageOverlayVisibility(show) {
      if (!this.overlay) return;

      if (show) {
        this.overlay.classList.add('visible');
      } else {
        this.overlay.classList.remove('visible');
        this.overlay.style.backgroundImage = 'none';
      }
    }

    _cleanupToDefaultState() {
      this.lastArtworkUrl = null;
      this._manageOverlayVisibility(false);
      this.overlay?.remove();
      this.overlay = null;
    }

    destroy() {
      if (this.originalSetupMediaController) {
        gZenMediaController.setupMediaController = this.originalSetupMediaController;
        this.originalSetupMediaController = null;
      }

      const current = gZenMediaController?._currentMediaController;
      if (current) {
        current.removeEventListener("metadatachange", this._metadataChangeHandler);
      }

      this._cleanupToDefaultState();

      Nebula.logger.log("🧹 [MediaCoverArt] Destroyed.");
    }
  }

  // ========== NebulaMenuModule ==========
  class NebulaMenuModule {
    constructor() {
      this.root = document.documentElement;
      this.STAGGER_DELAY = 15;
      this.MAX_DELAY = 200;
      this.MENU_ITEM_SELECTORS = [
        'menuitem',
        'menuseparator',
        '.subviewbutton',
        '.panel-menuitem',
        '.panel-list-item',
        '.PanelUI-subView .subviewbutton',
        '.panel-subview-body > *',
        '.panel-subview .subviewbutton',
        'toolbarbutton[class*="subviewbutton"]',
        '.cui-widget-panel .subviewbutton',
        'vbox.panel-subview-body > *',
        '.panel-subview-body > toolbarbutton',
        '.panel-subview-body > .subviewbutton'
      ];

      this.observers = new Map();

      // Bind methods
      this.handlePopupShowing = this.handlePopupShowing.bind(this);
      this.handlePopupHidden = this.handlePopupHidden.bind(this);
    }

    init() {
      document.addEventListener('popupshowing', this.handlePopupShowing, true);
      document.addEventListener('popuphidden', this.handlePopupHidden, true);
      document.addEventListener('ViewShowing', this.handlePopupShowing, true);
      document.addEventListener('ViewHiding', this.handlePopupHidden, true);

      Nebula.logger.log("✅ [MenuModule] Animations initialized.");
    }

    getMenuItems(popup) {
      if (!popup) return [];
      let items = [];
      // Cache selector string
      const selectorString = this._cachedSelectorString || (this._cachedSelectorString = this.MENU_ITEM_SELECTORS.join(','));

      if (popup.localName === 'menupopup') {
        items = Array.from(popup.children);
      } else {
        const subviewBody = popup.querySelector('.panel-subview-body');
        items = Array.from((subviewBody || popup).querySelectorAll(selectorString));
      }

      // Flatten children only if needed
      const flattenedItems = [];
      for (const item of items) {
        if (item.matches && item.matches('.panel-subview-body, .panel-subview')) {
          for (const child of item.children) {
            if (this.MENU_ITEM_SELECTORS.some(selector => child.matches(selector))) {
              flattenedItems.push(child);
            }
          }
        } else {
          flattenedItems.push(item);
        }
      }

      // Filter visible elements efficiently
      return flattenedItems.filter(item => {
        if (!item || item.nodeType !== 1) return false;
        const rect = item.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(item).display !== 'none';
      });
    }

    animateMenuItems(popup) {
      if (!popup) return;
      const items = this.getMenuItems(popup);
      // Batch DOM updates for animation
      window.requestAnimationFrame(() => {
        items.forEach((item, index) => this.animateItem(item, index));
      });
    }

    animateItem(item, index) {
      const shouldAnimate = getComputedStyle(this.root)
        .getPropertyValue('--nebula-menu-animation')
        .trim() === 'true';

      item.classList.remove('nebula-menu-anim');
      item.style.animationDelay = '';

      if (!shouldAnimate) return;

      const delay = Math.min(index * this.STAGGER_DELAY, this.MAX_DELAY);
      item.style.animationDelay = `${delay}ms`;
      item.classList.add('nebula-menu-anim');
    }

    cleanupMenuItems(popup) {
      if (!popup) return;
      // Batch DOM updates for cleanup
      window.requestAnimationFrame(() => {
        popup.querySelectorAll('.nebula-menu-anim').forEach(item => {
          item.classList.remove('nebula-menu-anim');
          item.style.animationDelay = '';
        });
      });
    }

    isTargetMenu(popup) {
      if (!popup || !popup.localName) return false;
      const menuTypes = [
        'menupopup',
        '#appMenu-popup',
        '#PanelUI-popup',
        '.panel-popup',
        '.panel-subview',
        '#PanelUI-history',
        '#PanelUI-bookmarks',
        '#PanelUI-downloads'
      ];
      return menuTypes.some(selector =>
        selector.startsWith('#') || selector.startsWith('.') ?
          (popup.matches && popup.matches(selector)) :
          popup.localName === selector
      ) || popup.classList.contains('panel-subview') ||
        popup.classList.contains('PanelUI-subView') ||
        popup.querySelector('.panel-subview-body');
    }

    setupMutationObserver(popup) {
      if (this.observers.has(popup)) return;

      const observer = new MutationObserver(mutations => {
        if (mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0 ||
                              m.type === 'attributes' && ['hidden', 'collapsed'].includes(m.attributeName))) {
          setTimeout(() => this.animateMenuItems(popup), 5);
        }
      });

      observer.observe(popup, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'collapsed', 'disabled']
      });

      this.observers.set(popup, observer);
    }

    handlePopupShowing(event) {
      const popup = event.target;
      if (!this.isTargetMenu(popup)) return;
      this.animateMenuItems(popup);
      this.setupMutationObserver(popup);
    }

    handlePopupHidden(event) {
      const popup = event.target;
      if (!this.isTargetMenu(popup)) return;
      this.cleanupMenuItems(popup);

      if (this.observers.has(popup)) {
        this.observers.get(popup).disconnect();
        this.observers.delete(popup);
      }
    }

    stop() {
      document.removeEventListener('popupshowing', this.handlePopupShowing, true);
      document.removeEventListener('popuphidden', this.handlePopupHidden, true);
      document.removeEventListener('ViewShowing', this.handlePopupShowing, true);
      document.removeEventListener('ViewHiding', this.handlePopupHidden, true);

      this.observers.forEach(observer => observer.disconnect());
      this.observers.clear();

      document.querySelectorAll('.nebula-menu-anim').forEach(item => {
        item.classList.remove('nebula-menu-anim');
        item.style.animationDelay = '';
      });

      Nebula.logger.log("🛑 [MenuModule] Animations disabled.");
    }

    destroy() {
      this.stop();
      Nebula.logger.log("🧹 [MenuModule] Module destroyed.");
    }
  }

  // ========== NebulaCtrlTabDualBackgroundModule ==========
  class NebulaCtrlTabDualBackgroundModule {
    constructor({ trackingMode = "both" } = {}) {
      this.browser = document.getElementById("browser");
      this.panel = document.getElementById("ctrlTab-panel");
      this.overlays = {};
      this.lastRect = null;
      this.lastVisible = false;
      this.rafId = null;
      this.trackingMode = trackingMode;

      this.update = this.update.bind(this);
      this.onPopupShown = this.startTracking.bind(this);
      this.onPopupHidden = this.stopTracking.bind(this);
    }

    init() {
      if (!this.browser || !this.panel) {
        return Nebula.logger.warn("⚠️ [CtrlTabDualBackground] Required elements not found.");
      }

      if (this.trackingMode !== "below")
        this.overlays.above = this.createOverlay("nebula-ctrltab-background-above", 2147483646, true);
      if (this.trackingMode !== "above")
        this.overlays.below = this.createOverlay("nebula-ctrltab-background-below", 0, false);

      this.panel.addEventListener("popupshown", this.onPopupShown);
      this.panel.addEventListener("popuphidden", this.onPopupHidden);

      Nebula.logger.log("✅ [CtrlTabDualBackground] Initialized.");
    }

    createOverlay(id, zIndex, interactive) {
      const o = document.createElement("div");
      o.id = id;
      Object.assign(o.style, {
        position: "absolute",
        display: "none",
        zIndex: interactive ? zIndex : "",
        pointerEvents: interactive ? "auto" : "none"
      });
      this.browser.appendChild(o);
      return o;
    }

    startTracking() {
      if (!this.rafId) this.update();
    }

    stopTracking() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.hideOverlays();
    }

    update() {
      const p = this.panel;
      if (!p) return;

      const r = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      const visible =
        r.width > 5 &&
        r.height > 5 &&
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0";

      if (!visible) return this.hideOverlays();

      const changed =
        !this.lastRect ||
        r.top !== this.lastRect.top ||
        r.left !== this.lastRect.left ||
        r.width !== this.lastRect.width ||
        r.height !== this.lastRect.height;

      if (!changed && this.lastVisible) {
        this.rafId = requestAnimationFrame(this.update);
        return;
      }

      this.lastRect = { top: r.top, left: r.left, width: r.width, height: r.height };
      const style = {
        top: `${r.top + window.scrollY}px`,
        left: `${r.left + window.scrollX}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        display: "block"
      };

      Object.values(this.overlays).forEach(o => o && Object.assign(o.style, style));

      this.lastVisible = true;
      this.rafId = requestAnimationFrame(this.update);
    }

    hideOverlays() {
      Object.values(this.overlays).forEach(o => o && (o.style.display = "none"));
      this.lastVisible = false;
    }

    destroy() {
      this.panel?.removeEventListener("popupshown", this.onPopupShown);
      this.panel?.removeEventListener("popuphidden", this.onPopupHidden);
      this.stopTracking();
      Object.values(this.overlays).forEach(o => o?.remove());
      this.overlays = {};
      Nebula.logger.log("🧹 [CtrlTabDualBackground] Destroyed.");
    }
  }

  // Register Nebula Modules
  Nebula.register(NebulaPolyfillModule);
  Nebula.register(NebulaGradientSliderModule);
  Nebula.register(NebulaTitlebarBackgroundModule);
  Nebula.register(NebulaNavbarBackgroundModule);
  Nebula.register(NebulaURLBarBackgroundModule);
  Nebula.register(NebulaMediaCoverArtModule);
  Nebula.register(NebulaMenuModule);
  Nebula.register(NebulaCtrlTabDualBackgroundModule);

  // Start the core
  Nebula.init();


})();


