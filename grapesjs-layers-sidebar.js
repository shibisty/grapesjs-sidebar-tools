/**
 * grapesjs-layers-sidebar
 * -----------------------
 * GrapesJS plugin: turns the Layers panel into a split sidebar.
 * (Part 2 of 2. The right-click menu and hierarchy picker live in the
 * separate `grapesjs-layers-context-menu` plugin.)
 *
 *   - top    -> the layer tree (unchanged)
 *   - bottom -> tabs "Style Manager" / "Component Settings". Shown only
 *               while the Layers tab is open AND a component is selected.
 *   - a drag handle between the two halves (double-click = 50/50)
 *
 * The real Style Manager / Trait Manager DOM is MOVED into the bottom half
 * while the layers tab is open and moved back when you leave it (never
 * re-rendered), so their own top tabs keep working.
 *
 * Remembered in localStorage (`storageKey`): open Style Manager sectors,
 * the active bottom tab, the layers/manager height split, and the active
 * GLOBAL tab (top panel: styles / settings / layers / blocks).
 *
 * Registers commands (the context-menu plugin uses the first one):
 *   layers-sidebar:show-styles    -> show the bottom half on the Style Manager tab
 *   layers-sidebar:show-settings  -> ... on the Component Settings tab
 *
 * Usage:  grapesjsLayersSidebar(editor, { ...options });
 *         // or: grapesjs.init({ plugins: [grapesjsLayersSidebar], ... })
 *
 * Options: injectCss, persist, storageKey, globalTabCommands, restoreGlobalTab, labels
 * Uses `layerManager.appendTo` (and styleManager/traitManager `appendTo`)
 * from your editor config.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.grapesjsLayersSidebar = factory()));
})(this, function () {
  'use strict';

  var DEFAULTS = {
    injectCss: true,
    // Remember sectors / bottom tab / height split / global tab in localStorage.
    persist: true,
    storageKey: 'gjs-lsb-state',
    // Commands that switch the GLOBAL (top panel) tab. The last one run is
    // remembered and re-activated after a reload via its panel button.
    globalTabCommands: ['open-sm', 'open-tm', 'open-layers', 'open-blocks'],
    // false = never re-open the remembered global tab.
    restoreGlobalTab: true,
    labels: {
      styleManagerTab: 'Style Manager',
      settingsTab: 'Component Settings',
      resizerTitle: 'Потяните, чтобы изменить высоту (двойной клик — 50/50)',
    },
  };

  function mergeDeep(base, extra) {
    var out = Object.assign({}, base);
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        if (
          extra[k] &&
          typeof extra[k] === 'object' &&
          !Array.isArray(extra[k]) &&
          base[k] &&
          typeof base[k] === 'object'
        ) {
          out[k] = mergeDeep(base[k], extra[k]);
        } else {
          out[k] = extra[k];
        }
      });
    }
    return out;
  }

  var CSS =
    '.gjs-lsb-split{display:flex;flex-direction:column;height:100%;min-height:0;--lsb-top:50%;}' +
    '.gjs-lsb-top{flex:1 1 auto;min-height:0;overflow:auto;}' +
    '.gjs-lsb-split--open .gjs-lsb-top{flex:0 0 var(--lsb-top,50%);}' +
    '.gjs-lsb-resizer{display:none;flex:0 0 6px;cursor:row-resize;background:rgba(255,255,255,.08);touch-action:none;}' +
    '.gjs-lsb-resizer:hover,.gjs-lsb-resizing .gjs-lsb-resizer{background:#3b97e3;}' +
    '.gjs-lsb-resizing{user-select:none;}' +
    '.gjs-lsb-split--open .gjs-lsb-resizer{display:block;}' +
    '.gjs-lsb-bottom{display:none;flex:1 1 0;min-height:0;overflow:hidden;flex-direction:column;}' +
    '.gjs-lsb-split--open .gjs-lsb-bottom{display:flex;}' +
    '.gjs-lsb-tabs{display:flex;flex:0 0 auto;}' +
    '.gjs-lsb-tab{flex:1 1 50%;padding:8px 6px;text-align:center;font-size:12px;background:transparent;border:none;color:#b8b8b8;cursor:pointer;border-bottom:2px solid transparent;}' +
    '.gjs-lsb-tab:hover{color:#fff;}' +
    '.gjs-lsb-tab--active{color:#fff;border-bottom-color:#3b97e3;}' +
    '.gjs-lsb-tab-content{flex:1 1 auto;min-height:0;overflow:auto;}' +
    '.gjs-lsb-panel{height:100%;}';

  function injectCss() {
    if (document.getElementById('gjs-lsb-styles')) return;
    var style = document.createElement('style');
    style.id = 'gjs-lsb-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function resolveEl(target) {
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector(target) : target;
  }

  function plugin(editor, opts) {
    var options = mergeDeep(DEFAULTS, opts || {});
    if (options.injectCss) injectCss();

    var split = null; // { root, bottomPane, smContainer, tmContainer, showTab }

    // ---- Persistence ---------------------------------------------------------
    var state = { tab: 'style', ratio: 0.5, sectors: {}, globalTab: null };
    if (options.persist) {
      try {
        var saved = JSON.parse(localStorage.getItem(options.storageKey) || 'null');
        if (saved && typeof saved === 'object') {
          state.tab = saved.tab === 'settings' ? 'settings' : 'style';
          state.ratio = typeof saved.ratio === 'number' ? saved.ratio : 0.5;
          state.sectors = saved.sectors && typeof saved.sectors === 'object' ? saved.sectors : {};
          state.globalTab = typeof saved.globalTab === 'string' ? saved.globalTab : null;
        }
      } catch (e) {}
    }
    function saveState() {
      if (!options.persist) return;
      try {
        localStorage.setItem(options.storageKey, JSON.stringify(state));
      } catch (e) {}
    }

    // ---- Layers panel root ---------------------------------------------------

    function getLayersRoot() {
      var cfg = editor.Layers.getConfig();
      return resolveEl(cfg.appendTo);
    }

    // ---- Split layout: layers (top) / tabs (bottom) ---------------------------

    function buildSplitLayout() {
      var root = getLayersRoot();
      if (!root) {
        // eslint-disable-next-line no-console
        console.warn(
          '[grapesjs-layers-sidebar] Could not resolve layerManager.appendTo, split layout skipped.'
        );
        return null;
      }
      if (root.classList.contains('gjs-lsb-split')) return split; // already built

      var topPane = document.createElement('div');
      topPane.className = 'gjs-lsb-top';
      while (root.firstChild) topPane.appendChild(root.firstChild);

      var bottomPane = document.createElement('div');
      bottomPane.className = 'gjs-lsb-bottom';
      bottomPane.innerHTML =
        '<div class="gjs-lsb-tabs">' +
        '<button type="button" class="gjs-lsb-tab gjs-lsb-tab--active" data-tab="style">' +
        options.labels.styleManagerTab +
        '</button>' +
        '<button type="button" class="gjs-lsb-tab" data-tab="settings">' +
        options.labels.settingsTab +
        '</button>' +
        '</div>' +
        '<div class="gjs-lsb-tab-content">' +
        '<div class="gjs-lsb-panel gjs-lsb-panel--style"></div>' +
        '<div class="gjs-lsb-panel gjs-lsb-panel--settings" style="display:none"></div>' +
        '</div>';

      var resizer = document.createElement('div');
      resizer.className = 'gjs-lsb-resizer';
      resizer.title = options.labels.resizerTitle;

      root.appendChild(topPane);
      root.appendChild(resizer);
      root.appendChild(bottomPane);
      root.classList.add('gjs-lsb-split');

      function setRatio(r) {
        r = Math.min(0.85, Math.max(0.15, r));
        state.ratio = r;
        root.style.setProperty('--lsb-top', r * 100 + '%');
      }
      setRatio(state.ratio);

      resizer.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var pid = e.pointerId;
        try {
          resizer.setPointerCapture(pid);
        } catch (err) {}
        root.classList.add('gjs-lsb-resizing');
        function move(ev) {
          var rect = root.getBoundingClientRect();
          if (rect.height) setRatio((ev.clientY - rect.top) / rect.height);
        }
        function up() {
          resizer.removeEventListener('pointermove', move);
          resizer.removeEventListener('pointerup', up);
          resizer.removeEventListener('pointercancel', up);
          try {
            resizer.releasePointerCapture(pid);
          } catch (err) {}
          root.classList.remove('gjs-lsb-resizing');
          saveState();
        }
        resizer.addEventListener('pointermove', move);
        resizer.addEventListener('pointerup', up);
        resizer.addEventListener('pointercancel', up);
      });
      resizer.addEventListener('dblclick', function () {
        setRatio(0.5);
        saveState();
      });

      var smContainer = bottomPane.querySelector('.gjs-lsb-panel--style');
      var tmContainer = bottomPane.querySelector('.gjs-lsb-panel--settings');

      var tabs = Array.prototype.slice.call(bottomPane.querySelectorAll('.gjs-lsb-tab'));
      function showTab(name) {
        tabs.forEach(function (btn) {
          btn.classList.toggle('gjs-lsb-tab--active', btn.getAttribute('data-tab') === name);
        });
        smContainer.style.display = name === 'style' ? '' : 'none';
        tmContainer.style.display = name === 'settings' ? '' : 'none';
        state.tab = name;
        saveState();
      }
      tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          showTab(btn.getAttribute('data-tab'));
        });
      });

      split = { root: root, bottomPane: bottomPane, smContainer: smContainer, tmContainer: tmContainer, showTab: showTab };
      showTab(state.tab); // restore the remembered tab right away
      return split;
    }

    // ---- Style Manager / Traits: move (not re-render) --------------------------
    // The real Style Manager / Trait Manager DOM lives in their own top tabs.
    // A DOM node can only be in one place, so while the Layers tab is open and
    // something is selected we MOVE those nodes into the bottom half of the
    // layers panel, and put them back as soon as that condition stops being
    // true. We never call render(), which would recreate the views.

    var managers = { sm: null, tm: null };

    function locateManager(mod, cls) {
      var container = null;
      try {
        container = resolveEl(mod && mod.getConfig && mod.getConfig().appendTo);
      } catch (e) {}
      var el =
        (container && (container.querySelector('.' + cls) || container.firstElementChild)) ||
        document.querySelector('.' + cls);
      return el ? { el: el, parent: el.parentNode, next: el.nextSibling } : null;
    }

    function getManager(key) {
      var item = managers[key];
      if (!item || !item.el.isConnected) {
        item =
          key === 'sm'
            ? locateManager(editor.Styles || editor.StyleManager, 'gjs-sm-sectors')
            : locateManager(editor.Traits || editor.TraitManager, 'gjs-trt-traits');
        managers[key] = item;
      }
      return item;
    }

    function moveIn(item, container) {
      if (item && item.el.parentNode !== container) container.appendChild(item.el);
    }

    function moveBack(item) {
      if (!item || !item.parent || item.el.parentNode === item.parent) return;
      var next = item.next && item.next.parentNode === item.parent ? item.next : null;
      item.parent.insertBefore(item.el, next);
    }

    // ---- Style Manager sectors: remember which ones are open ------------------

    var applyingSectors = false;

    function getSectorList() {
      var sm = editor.Styles || editor.StyleManager;
      var c;
      try {
        c = sm && sm.getSectors();
      } catch (e) {}
      if (!c) return [];
      if (c.models) return c.models;
      if (Array.isArray(c)) return c;
      return c.toArray ? c.toArray() : [];
    }

    function sectorId(sec) {
      return sec.getId ? sec.getId() : sec.get('id');
    }

    function syncSectors() {
      var list = getSectorList();
      list.forEach(function (sec) {
        if (!sec.__lsbBound) {
          sec.__lsbBound = true;
          sec.on('change:open', function () {
            if (applyingSectors) return;
            state.sectors[sectorId(sec)] = !!sec.get('open');
            saveState();
          });
        }
      });
      applyingSectors = true;
      list.forEach(function (sec) {
        var id = sectorId(sec);
        if (Object.prototype.hasOwnProperty.call(state.sectors, id)) {
          var want = !!state.sectors[id];
          if (!!sec.get('open') !== want) sec.set('open', want);
        }
      });
      applyingSectors = false;
    }

    var syncTimer = null;
    function scheduleSync() {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(sync, 0);
    }

    function sync() {
      syncSectors();
      if (!split) return;
      var layersVisible = split.root.getClientRects().length > 0;
      var open = layersVisible && !!editor.getSelected();
      split.root.classList.toggle('gjs-lsb-split--open', open);
      if (open) {
        moveIn(getManager('sm'), split.smContainer);
        moveIn(getManager('tm'), split.tmContainer);
        split.showTab(state.tab);
      } else {
        moveBack(managers.sm);
        moveBack(managers.tm);
      }
    }

    // ---- Global (top) tab: remember + restore -----------------------------------

    var recordGlobalTab = false; // stays off until the saved tab was restored

    // A "view" button is a panel button whose command is a string equal to
    // `cmdId`. GrapesJS default panels do not set togglable:false on them,
    // they group them with `context`, so we must not require togglable:false.
    function findViewButton(cmdId) {
      var found = null;
      try {
        editor.Panels.getPanels().forEach(function (panel) {
          var btns = panel.get('buttons');
          btns &&
            btns.forEach(function (b) {
              if (!found && b.get('command') === cmdId) found = b;
            });
        });
      } catch (e) {}
      return found;
    }

    function isGlobalTab(id) {
      return typeof id === 'string' && options.globalTabCommands.indexOf(id) !== -1;
    }

    function onRunCommand(id) {
      if (!recordGlobalTab || !isGlobalTab(id)) return;
      state.globalTab = id;
      saveState();
    }

    function restoreGlobalTab() {
      var id = state.globalTab;
      if (options.restoreGlobalTab && isGlobalTab(id)) {
        var btn = findViewButton(id);
        // Only ever go through the real panel button: it deactivates the
        // other tabs of the group and runs the command with the right
        // `sender`. Running the bare command instead can leave the top
        // panel in a broken state, so if there is no button we do nothing.
        if (btn && !btn.get('active')) btn.set('active', true);
      }
      // start recording only after the restore, so the editor's own
      // initial "open-sm" run can't overwrite the remembered tab
      setTimeout(function () {
        recordGlobalTab = true;
      }, 100);
    }

    // ---- Commands (public API for other plugins) ---------------------------------

    editor.Commands.add('layers-sidebar:show-styles', {
      run: function () {
        var s = split || buildSplitLayout();
        if (s) {
          s.showTab('style');
          sync();
        }
      },
    });
    editor.Commands.add('layers-sidebar:show-settings', {
      run: function () {
        var s = split || buildSplitLayout();
        if (s) {
          s.showTab('settings');
          sync();
        }
      },
    });

    // ---- Wiring -------------------------------------------------------------

    editor.on('load', function () {
      buildSplitLayout();
      // selection changes + top-tab switching (commands) ...
      editor.on('component:toggled run stop style:sector:add', scheduleSync);
      // ... and a command-independent fallback: the layers root going
      // to/from display:none (any custom tab switcher) changes its size.
      if (split && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(scheduleSync).observe(split.root);
      }
      scheduleSync();
      setTimeout(restoreGlobalTab, 0);
    });
    editor.on('run', onRunCommand);
  }

  return plugin;
});
