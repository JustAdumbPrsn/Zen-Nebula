// ==UserScript==
// @name           nebula-core.uc.js
// @description    Central engine for Nebula with modules (Polyfill + TitlebarNavBarURLBarBackgrounds + MediaCoverArt)
// @author         JustAdumbPrsn
// @version        v3.1
// @include        main
// @grant          none
// ==/UserScript==

(function() {
  'use strict';

  if (window.Nebula) {
    window.Nebula.destroy();
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

    register(name, ModuleClass) {
      if (this._modules.find(m => m._name === name)) {
        this.logger.warn(`Module "${name}" already registered.`);
        return;
      }
      const instance = new ModuleClass();
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
      this.compactObserver = null;
      this.modeObserver = null;
      this.root = document.documentElement;
      this.gradientSlider = null;
      this.updateGradientOpacityAttr = null;
    }

    init() {
      // Compact mode detection
      this.compactObserver = Nebula.observePresence(
        '[zen-compact-mode="true"]',
        'nebula-compact-mode'
      );

      // Toolbar mode detection (single, multi, collapsed)
      this.modeObserver = new MutationObserver(() => this.updateToolbarModes());
      this.modeObserver.observe(this.root, { attributes: true });
      this.updateToolbarModes();

      // Gradient contrast detection
      this.gradientSlider = document.querySelector("#PanelUI-zen-gradient-generator-opacity");
      if (this.gradientSlider) {
        this.updateGradientOpacityAttr = () => {
          const isMin = Number(this.gradientSlider.value) === Number(this.gradientSlider.min);
          this.root.toggleAttribute("nebula-zen-gradient-contrast-zero", isMin);
        };
        this.gradientSlider.addEventListener("input", this.updateGradientOpacityAttr);
        this.updateGradientOpacityAttr();
      } else {
        Nebula.logger.warn("⚠️ [Polyfill] Gradient slider not found.");
      }

      Nebula.logger.log('✅ [Polyfill] Detection active.');
    }

    updateToolbarModes() {
      const hasSidebar = this.root.hasAttribute('zen-sidebar-expanded');
      const isSingle = this.root.hasAttribute('zen-single-toolbar');

      this.root.toggleAttribute('nebula-single-toolbar', isSingle);
      this.root.toggleAttribute('nebula-multi-toolbar', hasSidebar && !isSingle);
      this.root.toggleAttribute('nebula-collapsed-toolbar', !hasSidebar && !isSingle);
    }

    destroy() {
      this.compactObserver?.disconnect();
      this.modeObserver?.disconnect();
      this.gradientSlider?.removeEventListener("input", this.updateGradientOpacityAttr);
      this.root.removeAttribute("nebula-zen-gradient-contrast-zero");
      Nebula.logger.log('🧹 [Polyfill] Destroyed.');
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

      this.update = this.update.bind(this);
      requestAnimationFrame(this.update);

      Nebula.logger.log("✅ [TitlebarBackground] Tracking initialized.");
    }

    update() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");

      if (!isCompact) {
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      const rect = this.titlebar.getBoundingClientRect();
      const changed = (
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height
      );

      this.lastRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };

      const isVisible = (
        rect.width > 5 &&
        rect.height > 5 &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight
      );

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
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    destroy() {
      cancelAnimationFrame(this.animationFrameId);
      this.overlay?.remove();
      this.overlay = null;
      this.lastVisible = false;
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

      this.update = this.update.bind(this);
      requestAnimationFrame(this.update);

      Nebula.logger.log("✅ [NavbarBackground] Tracking initialized.");
    }

    update() {
      const isCompact = this.root.hasAttribute("nebula-compact-mode");

      if (!isCompact) {
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      const rect = this.navbar.getBoundingClientRect();
      const changed = (
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height
      );

      this.lastRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };

      const isVisible = (
        rect.width > 5 &&
        rect.height > 5 &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight
      );

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
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    destroy() {
      cancelAnimationFrame(this.animationFrameId);
      this.overlay?.remove();
      this.overlay = null;
      this.lastVisible = false;
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

      this.update = this.update.bind(this);
      requestAnimationFrame(this.update);

      Nebula.logger.log("✅ [URLBarBackground] Tracking initialized.");
    }

    update() {
      const isOpen = this.urlbar.hasAttribute("open");

      if (!isOpen) {
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
        this.animationFrameId = requestAnimationFrame(this.update);
        return;
      }

      const rect = this.urlbar.getBoundingClientRect();
      const changed = (
        rect.top !== this.lastRect.top ||
        rect.left !== this.lastRect.left ||
        rect.width !== this.lastRect.width ||
        rect.height !== this.lastRect.height
      );

      this.lastRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };

      const isVisible = (
        rect.width > 5 &&
        rect.height > 5 &&
        rect.top >= 0 &&
        rect.bottom <= window.innerHeight
      );

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
        if (this.lastVisible) {
          this.overlay.classList.remove("visible");
          this.overlay.style.display = "none";
          this.lastVisible = false;
        }
      }

      this.animationFrameId = requestAnimationFrame(this.update);
    }

    destroy() {
      cancelAnimationFrame(this.animationFrameId);
      this.overlay?.remove();
      this.overlay = null;
      this.lastVisible = false;
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
      this._metadataChangeHandler = this._metadataChangeHandler.bind(this);
    }

    init() {
      this._waitForController();
    }
    
    _waitForController() {
      if (typeof window.gZenMediaController?.setupMediaController === 'function') {
        this._onControllerReady();
      } else {
        setTimeout(() => this._waitForController(), 300);
      }
    }

    _onControllerReady() {
      if (this.originalSetupMediaController) return;

      this.originalSetupMediaController = gZenMediaController.setupMediaController.bind(gZenMediaController);
      gZenMediaController.setupMediaController = this._setupMediaControllerPatcher.bind(this);

      const initialController = gZenMediaController._currentMediaController;
      if (initialController) {
        this._setBackgroundFromMetadata(initialController);
        initialController.addEventListener("metadatachange", this._metadataChangeHandler);
      } else {
        this._manageOverlayElement(false);
      }

      Nebula.logger.log("✅ [MediaCoverArt] Hooked into MediaPlayer.");
    }

    _setupMediaControllerPatcher(controller, browser) {
      this._setBackgroundFromMetadata(controller);
      
      if (controller) {
        controller.removeEventListener("metadatachange", this._metadataChangeHandler);
        controller.addEventListener("metadatachange", this._metadataChangeHandler);
      }

      return this.originalSetupMediaController(controller, browser);
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
      let coverUrl = null;

      if (Array.isArray(artwork) && artwork.length > 0) {
        const sorted = [...artwork].sort((a, b) => {
          const [aw, ah] = a.sizes?.split("x").map(Number) || [0, 0];
          const [bw, bh] = b.sizes?.split("x").map(Number) || [0, 0];
          return (bw * bh) - (aw * ah);
        });
        coverUrl = sorted[0]?.src || null;
      }
      
      if (coverUrl === this.lastArtworkUrl) return;
      
      this.lastArtworkUrl = coverUrl;
      this._manageOverlayElement(!!coverUrl);
      this._updateOverlayState(coverUrl);
    }
    
    _manageOverlayElement(shouldExist) {
        const toolbarItem = document.querySelector(this.TOOLBAR_ITEM_SELECTOR);
        if (!toolbarItem) return;

        let overlay = toolbarItem.querySelector(`#${this.OVERLAY_ID}`);
        if (shouldExist && !overlay) {
            overlay = document.createElement('div');
            overlay.id = this.OVERLAY_ID;
            toolbarItem.prepend(overlay);
        } else if (!shouldExist && overlay) {
            overlay.remove();
        }
    }

    _updateOverlayState(coverUrl) {
      const overlay = document.getElementById(this.OVERLAY_ID);
      if (!overlay) return;

      if (coverUrl) {
        overlay.style.backgroundImage = `url("${coverUrl}")`;
        overlay.classList.add('visible');
      } else {
        overlay.style.backgroundImage = 'none';
        overlay.classList.remove('visible');
      }
    }

    _cleanupToDefaultState() {
      this.lastArtworkUrl = null;
      this._updateOverlayState(null);
      this._manageOverlayElement(false);
    }
    
    destroy() {
      if (this.originalSetupMediaController) {
        gZenMediaController.setupMediaController = this.originalSetupMediaController;
        this.originalSetupMediaController = null;
      }
      
      const currentController = gZenMediaController?._currentMediaController;
      if (currentController) {
        currentController.removeEventListener("metadatachange", this._metadataChangeHandler);
      }

      this._cleanupToDefaultState();

      Nebula.logger.log("🧹 [MediaCoverArt] Destroyed.");
    }
  }

  // Register modules
  Nebula.register("NebulaPolyfillModule", NebulaPolyfillModule);
  Nebula.register("NebulaTitlebarBackgroundModule", NebulaTitlebarBackgroundModule);
  Nebula.register("NebulaNavbarBackgroundModule", NebulaNavbarBackgroundModule);
  Nebula.register("NebulaURLBarBackgroundModule", NebulaURLBarBackgroundModule);
  Nebula.register("NebulaMediaCoverArtModule", NebulaMediaCoverArtModule);

  // Start the core
  Nebula.init();
})();

/* ==== Tab groups ==== */
/* https://github.com/Anoms12/Advanced-Tab-Groups */
/* ====== V2.4.0 ====== */

class ZenGroups {
  #initialized = false;
  #animationState = null;
  #mouseTimer = null;
  #activeGroup = null;
  #iconsPrefName = "mod.zen-groups.icon.emoji";
  tabsListPopup = window.MozXULElement.parseXULToFragment(`
    <panel id="zen-group-tabs-popup" type="arrow" orient="vertical">
      <scrollbox class="tabs-list-scrollbox" flex="1">
        <vbox id="zen-group-tabs-list" class="panel-list"></vbox>
      </scrollbox>
    </panel>
  `);
  menuPopup = window.MozXULElement.parseXULToFragment(`
    <menupopup id="tab-group-actions-popup">
    <menuitem id="zenGroupsRenameGroup" label="Rename" tooltiptext="Rename Group" command="cmd_zenGroupsRenameGroup"/>
      <menuitem id="zenGroupsChangeIcon" label="Change Icon" tooltiptext="Change Icon" command="cmd_zenGroupsChangeIcon"/>
      <menuitem id="zenGroupsUngroupGroup" label="Ungroup" tooltiptext="Ungroup Group" command="cmd_zenGroupsUngroupGroup"/>
      <menuitem id="zenGroupsDeleteGroup" label="Delete" tooltiptext="Delete Group" command="cmd_zenGroupsDeleteGroup"/>
    </menupopup>
  `);
  folderSVG = new DOMParser().parseFromString(
    `
    <svg width="40px" height="40px" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="-67.409 -14.145 29.279 28.92">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" x1="-53.05" y1="-3.8" x2="-53.05" y2="8.998" id="gradient-1">
          <stop offset="0" style="stop-color: rgb(255, 255, 255);"/>
          <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" x1="-40.286" y1="-3.091" x2="-40.286" y2="13.31" id="gradient-0" gradientTransform="matrix(1, 0, 0, 1, -12.717999, -4.409)">
          <stop offset="0" style="stop-color: rgb(255, 255, 255);"/>
          <stop offset="1" style="stop-color: rgb(0% 0% 0%)"/>
        </linearGradient>
      </defs>
    <!--Back Folder (path)-->
      <path d="M -61.3 -5.25 C -61.3 -6.492 -60.293 -7.5 -59.05 -7.5 L -55.102 -7.5 C -54.591 -7.5 -54.096 -7.326 -53.697 -7.007 L -52.84 -6.321 C -52.175 -5.79 -51.349 -5.5 -50.498 -5.5 L -47.05 -5.5 C -45.807 -5.5 -44.8 -4.492 -44.8 -3.25 L -44.731 4.42 L -44.708 6.651 C -44.708 7.894 -45.715 8.901 -46.958 8.901 L -58.958 8.901 C -60.201 8.901 -61.208 7.894 -61.208 6.651 L -61.3 4.752 L -61.3 -5.25 Z" style="stroke-width: 0.5px; transform-box: fill-box; transform-origin: 50% 50%; fill: var(--zen-workspace-color-bg); stroke: var(--zen-workspace-color-stroke);">
        <animateTransform begin="0s" type="skewX" additive="sum" attributeName="transform" values="0;17" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="translate" additive="sum" attributeName="transform" values="0 0;-1 -1.2" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="scale" additive="sum" attributeName="transform" values="1 1;0.95 0.95" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
      </path>
      <path d="M -61.3 -5.25 C -61.3 -6.492 -60.293 -7.5 -59.05 -7.5 L -55.102 -7.5 C -54.591 -7.5 -54.096 -7.326 -53.697 -7.007 L -52.84 -6.321 C -52.175 -5.79 -51.349 -5.5 -50.498 -5.5 L -47.05 -5.5 C -45.807 -5.5 -44.8 -4.492 -44.8 -3.25 L -44.731 4.42 L -44.708 6.651 C -44.708 7.894 -45.715 8.901 -46.958 8.901 L -58.958 8.901 C -60.201 8.901 -61.208 7.894 -61.208 6.651 L -61.3 4.752 L -61.3 -5.25 Z" style="stroke-width: 0.5px; fill-opacity: 0.15; fill: url(&quot;#gradient-0&quot;); transform-origin: -53.004px 0.701px;">
        <animateTransform begin="0s" type="skewX" additive="sum" attributeName="transform" values="0;17" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="translate" additive="sum" attributeName="transform" values="0 0;-1 -1.2" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="scale" additive="sum" attributeName="transform" values="1 1;0.95 0.95" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
      </path>
    <!--Front Folder (rect)-->
      <rect x="-61.301" y="-3.768" width="16.5" height="12.798" rx="2.25" style="stroke-width: 0.5px; transform-box: fill-box; transform-origin: 50% 50%; fill: var(--zen-workspace-color-fg); stroke: var(--zen-workspace-color-stroke);" id="object-0">
        <animateTransform begin="0s" type="skewX" additive="sum" attributeName="transform" values="0;-17" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="translate" additive="sum" attributeName="transform" values="0 0;3 -0.5" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="scale" additive="sum" attributeName="transform" values="1 1;0.9 0.9" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
      </rect>
    <!--Emoji (text)-->
      <text x="-53.051" y="2.631" fill="black" font-size="8" text-anchor="middle" dominant-baseline="middle">
        <animateTransform begin="0s" type="skewX" additive="sum" attributeName="transform" values="0;-17" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="translate" additive="sum" attributeName="transform" values="0 0;-1 0" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="scale" additive="sum" attributeName="transform" values="1 1;0.9 0.9" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        </text>
      <rect x="-61.3" y="-3.8" width="16.5" height="12.798" style="stroke-width: 0.5px; fill-opacity: 0.15; transform-origin: -53.05px 2.599px; fill: url(&quot;#gradient-1&quot;);" id="rect-1" rx="2.25">
        <animateTransform begin="0s" type="skewX" additive="sum" attributeName="transform" values="0;-17" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="translate" additive="sum" attributeName="transform" values="0 0;3 -0.5" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
        <animateTransform begin="0s" type="scale" additive="sum" attributeName="transform" values="1 1;0.9 0.9" dur="0.3s" fill="freeze" keyTimes="0; 1" calcMode="spline" keySplines="0.42 0 0.58 1"/>
      </rect>
    </svg>
    `,
    "image/svg+xml",
  ).documentElement;

  constructor() {
    this.#patchUnload();
    this.#patchGroup();
  }

  #patchUnload() {
    const origUnload = gBrowser.explicitUnloadTabs?.bind(gBrowser);
    if (!origUnload) return;
    gBrowser.explicitUnloadTabs = (tabs) => {
      origUnload(tabs);
      for (const tab of tabs) {
        const group = tab.group;
        if (
          !group ||
          group.hasAttribute("split-view-group") ||
          group.hasAttribute("header")
        ) continue;
        this._hideTab(tab);
        this._watchTabState(tab, () => {
          if (!this._hasSelectedTabs(group) && group.hasAttribute("has-active")) {
            group.removeAttribute("has-active");
            group.removeAttribute("was-collapsed");
            group.collapsed = true;
          }
        });
      }
    };
  }

  #patchGroup() {
    customElements.whenDefined("tab-group").then(() => {
      const ctor = customElements.get("tab-group");
      if (!ctor) return;
      ctor.markup = `
        <hbox class="tab-group-label-container" pack="center">
          <html:div class="tab-group-icon"/>
          <label class="tab-group-label" role="button"/>
          <toolbarbutton class="toolbarbutton-1 tab-group-tabs-button" tooltiptext="Group tabs button"/>
          <toolbarbutton class="toolbarbutton-1 tab-group-action-button" tooltiptext="Group action button"/>
        <html:slot/>
        </hbox>
        <html:div class="tab-group-container">
          <html:div class="tab-group-start" />
        </html:div>
      `;
    });
  }

  _watchTabState(tab, callback, attributeList = ["pending"]) {
    if (!tab || !callback) return;
    const observer = new MutationObserver(() => {
      observer.disconnect();
      callback(tab);
    });
    observer.observe(tab, {
      attributes: true,
      attributeFilter: attributeList,
    });
  }

  init() {
    if (this.#initialized) return;
    this.#initialized = true;
    this.handlers = new WeakMap();
    this.#initHandlers();

    const groups = this._groups();
    console.log("Setting up initial groups:", groups.length);
    for (const group of groups) {
      this.#setupGroup(group);
    }
  }

  #initHandlers() {
    // Add the new attribute change observer
    window.addEventListener(
      "TabAttrModified",
      this.#onTabGroupAttributeChanged.bind(this)
    );

    window.addEventListener(
      "TabGroupCreate",
      this.#onTabGroupCreate.bind(this),
    );
    window.addEventListener("TabUngrouped", this.#onTabUngrouped.bind(this));
    window.addEventListener(
      "TabGroupRemoved",
      this.#onTabGroupRemoved.bind(this),
    );
    window.addEventListener("TabGrouped", this.#onTabGrouped.bind(this));
    window.addEventListener(
      "TabGroupExpand",
      this.#onTabGroupExpand.bind(this),
    );
    window.addEventListener(
      "TabGroupCollapse",
      this.#onTabGroupCollapse.bind(this),
    );

    gBrowser.tabContainer.addEventListener(
      "TabSelect",
      this.#handleGlobalTabSelect.bind(this),
    );
  }

  // Add new method to handle attribute changes
  #onTabGroupAttributeChanged(event) {
    const group = event.target;
    if (!group.tagName || group.tagName !== "tabgroup") return;

    const attrName = event.detail.changed[0];
    console.log("Attribute changed:", {
      group: group.id,
      attribute: attrName,
      hasHeader: group.hasAttribute("header"),
      hasSplitView: group.hasAttribute("split-view-group")
    });

    // Handle both header and split-view-group attributes
    if (attrName === "header" || attrName === "split-view-group") {
      if (group.hasAttribute("header") || group.hasAttribute("split-view-group")) {
        console.log("Removing customizations for filtered group:", group.id);
        this._resetGroupState(group);
        this.#removeGroupIcon(group);
        const handlers = this.handlers.get(group);
        if (handlers) {
          group.removeEventListener("mouseenter", handlers.handleMouseEnter);
          group.removeEventListener("mouseleave", handlers.handleMouseLeave);
          const labelContainer = group.querySelector(".tab-group-label-container");
          if (labelContainer) {
            labelContainer.removeEventListener("click", handlers.handleClick);
          }
          this.handlers.delete(group);
        }
      } else {
        console.log("Re-applying customizations for unfiltered group:", group.id);
        this.#setupGroup(group);
      }
    }
  }

  _groups() {
    const groups = gBrowser.getAllTabGroups();
    console.log("All groups:", groups.length);
    
    const filteredGroups = groups.filter(group => {
      const hasHeader = group.hasAttribute("header");
      const hasSplitView = group.hasAttribute("split-view-group");
      console.log(`Group ${group.id}:`, {
        hasHeader,
        hasSplitView
      });
      return !hasSplitView && !hasHeader;
    });
    
    console.log("Filtered groups:", filteredGroups.length);
    return filteredGroups;
  }

  _resetTabsStyle(group) {
    for (const tab of group.tabs) {
      tab.style.removeProperty("display");
      tab.style.removeProperty("transform");
    }
  }

  _hideTab(tab) {
    tab.style.setProperty("display", "none", "important");
  }

  _hasSelectedTabs(group) {
    return group.tabs.some((tab) => 
      tab.matches("[selected], [visuallyselected], [multiselected]")
    );
  }
  _updateTabVisibility(group) {
    const isHoverOpened = group.hasAttribute("has-focus");

    this._resetTabsStyle(group);

    for (const tab of group.tabs) {
      let shouldBeHidden = false;
      tab.style.setProperty("display", "flex", "important");

      if (isHoverOpened) {
        shouldBeHidden = !tab.matches("[selected], [visuallyselected], [multiselected]");
      }

      if (shouldBeHidden) {
        this._hideTab(tab);
      }
    }
  }

  _resetGroupState(group) {
    const wasCollapsed = group.hasAttribute("was-collapsed");

    group.removeAttribute("was-collapsed");
    group.removeAttribute("has-focus");

    if (wasCollapsed) {
      group.collapsed = true;
    }

    if (group.collapsed) {
      this._resetTabsStyle(group);
    } else {
      this._updateTabVisibility(group);
    }
  }

  _renameGroup() {
    const label = this.#activeGroup.querySelector(".tab-group-label");
    const originalText = label.textContent;

    const input = document.createElement("input");
    input.id = "tab-group-rename-input";
    input.value = originalText;
    const labelEditing = (saveChanges) => {
      if (saveChanges) {
        const newValue = input.value.trim();
        if (newValue.length > 0 && newValue !== originalText) {
          this.#activeGroup.label = newValue;
        } else {
          label.textContent = originalText;
        }
      } else {
        label.textContent = originalText;
      }
      input.remove();
    };

    input.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "Enter":
          labelEditing(true);
          break;
        case "Escape":
          labelEditing(false);
          break;
      }
    });

    input.addEventListener("blur", () => {
      labelEditing(false);
    });

    label.textContent = "";
    label.appendChild(input);

    input.focus();
    input.select();
  }

  #setupGroup(group) {
    console.log("Attempting to setup group:", group.id);
    
    if (this.handlers.has(group)) {
      console.log("Group already has handlers:", group.id);
      return;
    }

    if (group.hasAttribute("header") || group.hasAttribute("split-view-group")) {
      console.log("Group has header or split-view-group attribute - skipping setup:", group.id);
      // Still set up observer even if we don't apply customizations initially
      this.#setupGroupObserver(group);
      return;
    }

    this.#setupGroupObserver(group);
    this.#applyGroupCustomizations(group);
  }

  #setupGroupObserver(group) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && 
            (mutation.attributeName === "header" || 
             mutation.attributeName === "split-view-group")) {
          console.log(`Group ${group.id} attribute changed:`, {
            attributeName: mutation.attributeName,
            hasHeader: group.hasAttribute("header"),
            hasSplitView: group.hasAttribute("split-view-group")
          });

          if (group.hasAttribute("header") || group.hasAttribute("split-view-group")) {
            console.log("Removing customizations due to attribute addition");
            this._resetGroupState(group);
            this.#removeGroupIcon(group);
            this.#removeGroupHandlers(group);
          } else {
            console.log("Re-applying customizations due to attribute removal");
            this.#applyGroupCustomizations(group);
          }
        }
      });
    });

    // Start observing the group for attribute changes
    observer.observe(group, {
      attributes: true,
      attributeFilter: ["header", "split-view-group"]
    });
  }

  #applyGroupCustomizations(group) {
    if (group.hasAttribute("header") || group.hasAttribute("split-view-group")) {
      return;
    }
    console.log("Applying customizations to group:", group.id);
    this.#setupFolderIcon(group);
    this.#createGroupButton(group);

    const groupHandlers = {
      handleMouseEnter: this.#handleMouseEnter.bind(this),
      handleMouseLeave: this.#handleMouseLeave.bind(this),
      handleClick: this.#handleClick.bind(this),
    };
    this.handlers.set(group, groupHandlers);

    group.addEventListener("mouseenter", groupHandlers.handleMouseEnter);
    group.addEventListener("mouseleave", groupHandlers.handleMouseLeave);

    const labelContainer = group.querySelector(".tab-group-label-container");
    if (labelContainer) {
      labelContainer.addEventListener("click", groupHandlers.handleClick);
    }
  }

  #removeGroupHandlers(group) {
    const handlers = this.handlers.get(group);
    if (handlers) {
      group.removeEventListener("mouseenter", handlers.handleMouseEnter);
      group.removeEventListener("mouseleave", handlers.handleMouseLeave);
      const labelContainer = group.querySelector(".tab-group-label-container");
      if (labelContainer) {
        labelContainer.removeEventListener("click", handlers.handleClick);
      }
      this.handlers.delete(group);
    }
  }

  #onTabGroupCreate(event) {
    const group = event.target;
    console.log("New group created:", {
      id: group.id,
      hasHeader: group.hasAttribute("header"),
      hasSplitView: group.hasAttribute("split-view-group")
    });

    // Check if group should be filtered out
    if (group.hasAttribute("header") || group.hasAttribute("split-view-group")) {
      console.log("Skipping setup for filtered group:", group.id);
      return;
    }

    this.#setupGroup(group);
  }

  #onTabUngrouped(event) {
    const tab = event.target;
    tab.style.removeProperty("display");
  }

  #onTabGrouped(event) {
    // TODO: WRITE ME PLZ
  }

  #onTabGroupRemoved(event) {
    const group = event.target;
    this._resetGroupState(group);
    this.#removeGroupIcon(group);
  }
  async #onTabGroupExpand(event) {
    const group = event.target;
    const animations = [];

    animations.push(...this.#handleGroupAnimation(group, this.#animationState));

    await Promise.all(animations);
    this.#animationState = null;
  }
  async #onTabGroupCollapse(event) {
    const group = event.target;
    const animations = [];
    animations.push(...this.#handleGroupAnimation(group, this.#animationState));

    await Promise.all(animations);
    this.#animationState = null;
  }

  #handleMouseEnter(event) {
    const group = event.target;

    if (group.collapsed && this._hasSelectedTabs(group)) {
      this.#mouseTimer = setTimeout(() => {
        group.setAttribute("has-focus", "");
        group.setAttribute("was-collapsed", "");
        this._updateTabVisibility(group);
        group.collapsed = false;
      }, 300);
    }
  }

  #handleMouseLeave(event) {
    const group = event.target;

    clearTimeout(this.#mouseTimer);
    if (this._hasSelectedTabs(group)) {
      this._updateTabVisibility(group);
    } else {
      this._resetGroupState(group);
    }
  }

  #handleClick(event) {
    if (event.button !== 0) return;
    const group = event.currentTarget.parentElement;
    event.stopImmediatePropagation();
    event.preventDefault();

    if (this._hasSelectedTabs(group)) {
      group.toggleAttribute("has-focus");
      group.toggleAttribute("was-collapsed");
      this._updateTabVisibility(group);
      if (
        !group.hasAttribute("was-collapsed") &&
        !group.hasAttribute("has-focus")
      ) {
        this.#animationState = "open";
      } else {
        this.#animationState = "close";
      }
      group.collapsed = false;
      return;
    }

    this._resetGroupState(group);
  }

  #handleGlobalTabSelect(event) {
    const selectedTab = event.target;

    for (const group of this._groups()) {
      if (!group.tabs.includes(selectedTab)) {
        this._resetGroupState(group);
      }
    }
  }

  #setupFolderIcon(group) {
    const labelContainer = group.querySelector(".tab-group-label-container");
    let iconContainer = labelContainer.querySelector(".tab-group-icon");
    if (!iconContainer) {
      const frag = window.MozXULElement.parseXULToFragment('<div class="tab-group-icon"/>' );
      iconContainer = frag.firstElementChild;
      labelContainer.insertBefore(iconContainer, labelContainer.firstChild);
    }
    // Always ensure SVG is present
    if (!iconContainer.querySelector("svg")) {
      const svgElem = this.folderSVG.cloneNode(true);
      iconContainer.appendChild(svgElem);
      svgElem
        .querySelectorAll("animate, animateTransform, animateMotion")
        .forEach((anim) => {
          const vals = anim.getAttribute("values");
          if (vals) {
            anim.dataset.origValues = vals;
          }
        });
      const savedIcon = this.#loadGroupIcon(group);
      if (savedIcon) {
        this.#setGroupIconText(group, savedIcon);
      }
      iconContainer.addEventListener("dblclick", (event) => {
        event.stopImmediatePropagation();
        event.preventDefault();
        this.#handleChangeGroupIcon(event, group);
      });
      this.#handleGroupAnimation(group, this.#animationState, false);
    }
  }

  #createGroupButton(group) {
    const labelContainer = group.querySelector(".tab-group-label-container");
    // Action Button
    let actionButton = labelContainer.querySelector(".tab-group-action-button");
    if (!actionButton) {
      const frag = window.MozXULElement.parseXULToFragment('<toolbarbutton class="toolbarbutton-1 tab-group-action-button" tooltiptext="Group action button"/>' );
      actionButton = frag.firstElementChild;
      labelContainer.appendChild(actionButton);
    }
    actionButton.addEventListener("click", this.activeGroupPopup.bind(this));
    this.#createGroupButtonPopup(group);
    // Tabs Button
    let tabsButton = labelContainer.querySelector(".tab-group-tabs-button");
    if (!tabsButton) {
      const frag = window.MozXULElement.parseXULToFragment('<toolbarbutton class="toolbarbutton-1 tab-group-tabs-button" tooltiptext="Group tabs button"/>' );
      tabsButton = frag.firstElementChild;
      labelContainer.appendChild(tabsButton);
    }
    tabsButton.addEventListener("click", this.activeGroupTabsPopup.bind(this));
  }

  activeGroupPopup(event) {
    event.stopPropagation();
    // Find the group from the button
    const group = event.currentTarget.closest('tab-group');
    this.#activeGroup = group;
    // Use the group's own popup
    const popup = group._zenGroupActionsPopup || group.querySelector('.tab-group-actions-popup');
    if (!popup) return;
    const target = event.target;
    target.setAttribute("open", "true");
    const handlePopupHidden = (event) => {
      if (event.target !== popup) return;
      target.removeAttribute("open");
      popup.removeEventListener("popuphidden", handlePopupHidden);
    };
    popup.addEventListener("popuphidden", handlePopupHidden);
    try {
      popup.openPopup(event.target, "after_start");
    } catch (e) {
      console.error("Failed to open popup:", e);
    }
  }

  #createGroupButtonPopup(group) {
    // Check if a popup already exists for this group
    let popup = group.querySelector('.tab-group-actions-popup');
    if (!popup) {
      // Clone the menuPopup and append it to the group (scoped to group)
      const frag = this.menuPopup.cloneNode(true);
      popup = frag.firstElementChild;
      popup.classList.add('tab-group-actions-popup');
      group.appendChild(popup);

      // Use popup.querySelector to get the menu items
      const commandButtons = {
        zenGroupsChangeIcon: popup.querySelector("#zenGroupsChangeIcon"),
        zenGroupsRenameGroup: popup.querySelector("#zenGroupsRenameGroup"),
        zenGroupsUngroupGroup: popup.querySelector("#zenGroupsUngroupGroup"),
        zenGroupsDeleteGroup: popup.querySelector("#zenGroupsDeleteGroup"),
      };
      commandButtons.zenGroupsChangeIcon.addEventListener("click", (event) => {
        const iconElem = group.querySelector('.tab-group-icon');
        this.#handleChangeGroupIcon(event, group, iconElem);
      });
      commandButtons.zenGroupsRenameGroup.addEventListener(
        "click",
        this._renameGroup.bind(this),
      );
      commandButtons.zenGroupsUngroupGroup.addEventListener("click", (event) => {
        console.log("Ungrouping group:", group.id);
        group.ungroupTabs({
          isUserTriggered: true,
        });
      });
      commandButtons.zenGroupsDeleteGroup.addEventListener("click", (event) => {
        console.log("Deleting group:", group.id);
        gBrowser.removeTabGroup(group);
      });
    }
    // Store a reference for later use
    group._zenGroupActionsPopup = popup;
  }

  #setGroupIconText(group, text) {
    const svgText = group.querySelector(".tab-group-icon svg text");
    if (!svgText) return;

    let textNode = null;
    for (const node of svgText.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        textNode = node;
        break;
      }
    }

    if (textNode) {
      textNode.nodeValue = text;
    } else {
      const newTextNode = document.createTextNode(text);
      svgText.insertBefore(newTextNode, svgText.firstChild);
    }
  }

  #handleChangeGroupIcon(event, group, iconElem) {
    if (!group) {
      return;
    }
    if (!iconElem) {
      iconElem = group.querySelector('.tab-group-icon');
    }
    gZenEmojiPicker
      .open(iconElem)
      .then(async (emoji) => {
        console.log("Selected emoji:", emoji);
        this.#setGroupIconText(group, emoji);
        await this.#saveGroupIcon(group, emoji); // Write real method to save group icon
      })
      .catch((error) => {
        return;
      });
  }

  #handleGroupAnimation(group, state, playAnimation = true) {
    const svgElement = group.querySelector("svg");
    if (!svgElement) return [];

    const isCollapsed = group.collapsed;

    svgElement.unpauseAnimations();

    if (!playAnimation) {
      svgElement.pauseAnimations();

      switch (state) {
        case "open":
          svgElement.setCurrentTime(0.3);
          break;
        case "close":
          svgElement.setCurrentTime(0);
          break;
        default:
          svgElement.setCurrentTime(isCollapsed ? 0 : 0.3);
          break;
      }
      return [];
    }

    const animations = svgElement.querySelectorAll(
      "animate, animateTransform, animateMotion",
    );

    animations.forEach((anim) => {
      const origValues = anim.dataset.origValues;
      const [fromVal, toVal] = origValues.split(";");

      let newValues;

      switch (state) {
        case "open":
          newValues = `${fromVal};${toVal}`;
          break;
        case "close":
          newValues = `${toVal};${fromVal}`;
          break;
        default:
          newValues = isCollapsed
            ? `${toVal};${fromVal}`
            : `${fromVal};${toVal}`;
          break;
      }

      anim.setAttribute("values", newValues);
      anim.beginElement();
    });
    return [];
  }

  // FIX: This is a hack to save group icons to prefs
  #getAllIconsObject() {
    try {
      const jsonString = Services.prefs.getStringPref(this.#iconsPrefName);
      return jsonString ? JSON.parse(jsonString) : {};
    } catch (e) {
      return {};
    }
  }

  async #saveGroupIcon(group, emoji) {
    try {
      const allIcons = this.#getAllIconsObject();
      allIcons[group.id] = emoji;
      const newJsonString = JSON.stringify(allIcons);
      Services.prefs.setStringPref(this.#iconsPrefName, newJsonString);
    } catch (e) {
      console.error("Failed to save group icons JSON:", e);
    }
  }

  #removeGroupIcon(group) {
    console.log("Removing group icon for:", group.id);
    const iconContainer = group.querySelector(".tab-group-icon");
    if (iconContainer) {
      iconContainer.remove();
    }
    
    // Also remove button if it exists
    const button = group.querySelector(".tab-group-button");
    if (button) {
      button.remove();
    }

    try {
      const allIcons = this.#getAllIconsObject();
      delete allIcons[group.id];
      const newJsonString = JSON.stringify(allIcons);
      Services.prefs.setStringPref(this.#iconsPrefName, newJsonString);
    } catch (e) {
      console.error("Failed to remove group icon from prefs:", e);
    }
  }

  #loadGroupIcon(group) {
    const allIcons = this.#getAllIconsObject();
    return allIcons[group.id] || "";
  }

  #formatRelativeTime(timestamp) {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 60) {
      return "Just now";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  #populateTabsList(group, popup) {
    const tabsList = popup.querySelector("#zen-group-tabs-list");
    tabsList.replaceChildren();
    for (const tab of group.tabs) {
      if (tab.hidden) continue;
      const item = document.createElement("div");
      item.className = "tabs-list-item";
      const background = document.createElement("div");
      background.className = "tabs-list-item-background";
      const content = document.createElement("div");
      content.className = "tabs-list-item-content";
      const icon = document.createElement("img");
      icon.className = "tabs-list-item-icon";
      let iconURL = gBrowser.getIcon(tab) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3C/svg%3E";
      if (iconURL) {
        icon.src = iconURL;
      }
      const labelsContainer = document.createElement("div");
      labelsContainer.className = "tabs-list-item-labels";
      const mainLabel = document.createElement("div");
      mainLabel.className = "tabs-list-item-label";
      mainLabel.textContent = tab.label;
      const secondaryLabel = document.createElement("div");
      secondaryLabel.className = "tab-list-item-secondary-label";
      secondaryLabel.textContent = this.#formatRelativeTime(tab.lastAccessed);
      labelsContainer.append(mainLabel, secondaryLabel);
      content.append(icon, labelsContainer);
      item.append(background, content);
      if (tab.selected) {
        item.setAttribute("selected", "true");
      }
      item.setAttribute("data-label", tab.label.toLowerCase());
      item.addEventListener("click", () => {
        if (group.collapsed) {
          this.#animationState = "close";
          group.collapsed = false;
          group.toggleAttribute("has-active");
          group.toggleAttribute("was-collapsed");
        }
        gBrowser.selectedTab = tab;
        popup.hidePopup();
        this._updateTabVisibility(group);
      });
      tabsList.appendChild(item);
    }
  }

  #createGroupTabsPopup() {
    if (document.getElementById("zen-group-tabs-popup")) return;
    const frag = this.tabsListPopup.cloneNode(true);
    document.querySelector("#mainPopupSet").appendChild(frag.firstElementChild);
  }

  activeGroupTabsPopup(event) {
    event.stopPropagation();
    this.#activeGroup = event.currentTarget.closest("tab-group");
    let popup = document.getElementById("zen-group-tabs-popup");
    if (!popup) {
      this.#createGroupTabsPopup();
      popup = document.getElementById("zen-group-tabs-popup");
    }
    this.#populateTabsList(this.#activeGroup, popup);
    const target = event.currentTarget;
    target.setAttribute("open", "true");
    const handlePopupHidden = (e) => {
      if (e.target !== popup) return;
      target.removeAttribute("open");
      popup.removeEventListener("popuphidden", handlePopupHidden);
    };
    popup.addEventListener("popuphidden", handlePopupHidden);
    popup.openPopup(target, "after_start");
  }
}

(function () {
if (!globalThis.zenGroupsInstance) {
  window.addEventListener(
    "load",
    () => {
      globalThis.zenGroupsInstance = new ZenGroups();
      globalThis.zenGroupsInstance.init();
    },
    { once: true },
  );
}
})();