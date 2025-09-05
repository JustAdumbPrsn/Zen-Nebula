// ==UserScript==
// @name           nebula-core.uc.js
// @description    Central engine for Nebula with all modules
// @author         JustAdumbPrsn
// @version        v3.2
// @include        main
// @grant          none
// ==/UserScript==
// test workflow update

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
    }

    init() {
      // Compact mode detection
      this.compactObserver = Nebula.observePresence(
        '[zen-compact-mode="true"]',
        'nebula-compact-mode'
      );

      // Toolbar mode detection
      this.modeObserver = new MutationObserver(() => this.updateToolbarModes());
      this.modeObserver.observe(this.root, { attributes: true });
      this.updateToolbarModes();

      Nebula.logger.log("✅ [Polyfill] Detection active.");
    }

    updateToolbarModes() {
      const hasSidebar = this.root.hasAttribute("zen-sidebar-expanded");
      const isSingle = this.root.hasAttribute("zen-single-toolbar");

      this.root.toggleAttribute("nebula-single-toolbar", isSingle);
      this.root.toggleAttribute("nebula-multi-toolbar", hasSidebar && !isSingle);
      this.root.toggleAttribute("nebula-collapsed-toolbar", !hasSidebar && !isSingle);
    }

    destroy() {
      this.compactObserver?.disconnect();
      this.modeObserver?.disconnect();
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
      this.observer = null;
      this._workspacePatched = false;
    }

    init() {
      this.waitForSlider(slider => {
        this.setupGradientSlider(slider);

        // Extra sync a bit later to catch Zen’s startup overwrite
        setTimeout(() => this.sync(), 300);
        requestIdleCallback(() => this.sync());
      });

      this.patchWorkspaceChanges();
      Nebula.logger.log("✅ [GradientSlider] Initialized.");
    }

    waitForSlider(callback, retries = 20) {
      const tryFind = () => {
        const slider = document.querySelector("#PanelUI-zen-gradient-generator-opacity");
        if (slider) {
          callback(slider);
        } else if (retries > 0) {
          requestIdleCallback(() => tryFind(), { timeout: 200 });
        } else {
          Nebula.logger.warn("❌ [GradientSlider] Not found after retries.");
        }
      };
      requestIdleCallback(tryFind);
    }

    setupGradientSlider(slider) {
      if (this.gradientSlider === slider) return;

      this.gradientSlider = slider;

      // Clean up any old observer
      this.observer?.disconnect();

      // Watch for DOM value changes (user dragging)
      this.observer = new MutationObserver(() => this.sync());
      this.observer.observe(slider, { attributes: true, attributeFilter: ["value"] });

      // Also catch real-time user input
      slider.addEventListener("input", () => this.sync());

      this.sync(); // initial sync
    }

    patchWorkspaceChanges() {
      if (this._workspacePatched || !window.ZenWorkspacesStorage) return;

      const original = ZenWorkspacesStorage._notifyWorkspacesChanged;
      ZenWorkspacesStorage._notifyWorkspacesChanged = (...args) => {
        // Let Zen apply its workspace settings first
        requestIdleCallback(() => this.sync());
        return original.apply(ZenWorkspacesStorage, args);
      };

      this._workspacePatched = true;
    }

    sync() {
      if (!this.gradientSlider) return;
      const isMin = Number(this.gradientSlider.value) === Number(this.gradientSlider.min);
      this.root.toggleAttribute("nebula-zen-gradient-contrast-zero", isMin);
    }

    destroy() {
      this.observer?.disconnect();
      this.gradientSlider?.removeEventListener("input", () => this.sync());
      this.root.removeAttribute("nebula-zen-gradient-contrast-zero");
      Nebula.logger.log("🧹 [GradientSlider] Destroyed.");
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
      this.NS_ITEM = "nebula-menu-anim";
      this.NS_SEPARATOR = "nebula-menu-separator-anim";
      this.STAGGER = 35;
      this.MAX_DELAY = 400;

      this.MAIN_MENU_SELECTORS = ["#appMenu-popup", "#PanelUI-popup"];
      this.observedMenus = new WeakMap();

      this.onPopupShowing = this.onPopupShowing.bind(this);
      this.onPopupHidden = this.onPopupHidden.bind(this);
    }

    init() {
      if (window.NebulaMenuModule?.destroy) {
        try { window.NebulaMenuModule.destroy(); } catch {}
      }

      document.addEventListener("popupshowing", this.onPopupShowing, true);
      document.addEventListener("popuphidden", this.onPopupHidden, true);

      window.NebulaMenuModule = this;
      Nebula.logger.log("✅ [MenuModule] Initialized.");
    }

    getMenuItems(popup) {
      if (!popup) {
        Nebula.logger.warn("⚠️ [MenuModule] getMenuItems called with null popup.");
        return [];
      }

      const name = popup.localName?.toLowerCase();
      if (name === "menupopup") {
        return Array.from(popup.children).filter(el => !el.hidden);
      } else {
        const MAIN_ITEM_SELECTORS = [".subviewbutton", ".panel-menuitem"];
        return Array.from(popup.querySelectorAll(MAIN_ITEM_SELECTORS.join(",")))
                    .filter(el => !el.hidden);
      }
    }

    animateMenuItems(popup) {
      const children = this.getMenuItems(popup);
      children.forEach((el, index) => {
        const name = el.localName?.toLowerCase();
        const targetClass = (name === "menuseparator" || name === "separator")
                            ? this.NS_SEPARATOR
                            : this.NS_ITEM;

        const delay = Math.min(index * this.STAGGER, this.MAX_DELAY);
        if (el.style.animationDelay !== `${delay}ms`) el.style.animationDelay = `${delay}ms`;
        if (!el.classList.contains(targetClass)) el.classList.add(targetClass);
      });
    }

    cleanupMenu(popup) {
      if (!popup?.children) return;

      Array.from(popup.children).forEach(el => {
        el.classList.remove(this.NS_ITEM, this.NS_SEPARATOR);
        el.style.animationDelay = "";
        el.style.opacity = "";
      });

      if (this.observedMenus.has(popup)) {
        this.observedMenus.get(popup).disconnect();
        this.observedMenus.delete(popup);
      }
    }

    onPopupShowing(e) {
      const popup = e.target;
      if (!popup) {
        Nebula.logger.warn("⚠️ [MenuModule] popupshowing event without target.");
        return;
      }

      const isMenu = popup.localName === "menupopup" ||
                    this.MAIN_MENU_SELECTORS.some(sel => popup.matches(sel));
      if (!isMenu) return;

      this.animateMenuItems(popup);

      if (!this.observedMenus.has(popup)) {
        const observer = new MutationObserver(() => this.animateMenuItems(popup));
        observer.observe(popup, { childList: true, subtree: true });
        this.observedMenus.set(popup, observer);
      }
    }

    onPopupHidden(e) {
      const popup = e.target;
      if (!popup) {
        Nebula.logger.warn("⚠️ [MenuModule] popuphidden event without target.");
        return;
      }

      const isMenu = popup.localName === "menupopup" ||
                    this.MAIN_MENU_SELECTORS.some(sel => popup.matches(sel));
      if (!isMenu) return;

      this.cleanupMenu(popup);
    }

    destroy() {
      document.removeEventListener("popupshowing", this.onPopupShowing, true);
      document.removeEventListener("popuphidden", this.onPopupHidden, true);

      const popups = Array.from(document.querySelectorAll("menupopup"))
                          .concat(Array.from(document.querySelectorAll(this.MAIN_MENU_SELECTORS.join(","))));
      popups.forEach(popup => this.cleanupMenu(popup));

      try { delete window.NebulaMenuModule; } catch { window.NebulaMenuModule = undefined; }
      Nebula.logger.log("🧹 [MenuModule] Destroyed.");
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



