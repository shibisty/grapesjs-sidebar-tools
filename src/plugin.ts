import type { Editor } from 'grapesjs';
import { createGlobalTabMemory } from './globalTab';
import { getLocale, isRtlLocale, registerI18n, t } from './i18n';
import { findLayersRoot } from './layersRoot';
import { createManagerMover, prerenderManager, type ManagerKey } from './managers';
import { resolveOptions } from './options';
import { createSectorMemory } from './sectors';
import { createSplitLayout, findSplitElement, type SplitLayout } from './splitLayout';
import { createStateStore } from './state';
import { injectCss } from './styles';
import type { BottomTab, SidebarToolsLabels, SidebarToolsOptions } from './types';

export const COMMAND_SHOW_STYLES = 'layers-sidebar:show-styles';
export const COMMAND_SHOW_SETTINGS = 'layers-sidebar:show-settings';
const LOG_PREFIX = '[grapesjs-sidebar-tools]';

/**
 * Sync triggers: selection changes, any command run/stop (top tab
 * switching), new Style Manager sectors.
 */
const SYNC_EVENTS = 'component:toggled run stop style:sector:add';

/*
 * GrapesJS fires `i18n:locale` BEFORE the locale is stored (the new one
 * is in the payload) and `i18n:add` before the messages are merged;
 * `i18n:update` comes after the merge (addMessages -> setMessages).
 */
const I18N_LOCALE_EVENT = 'i18n:locale';
const I18N_UPDATE_EVENT = 'i18n:update';

const LABEL_KEYS: (keyof SidebarToolsLabels)[] = ['styleManagerTab', 'settingsTab', 'resizerTitle'];

export default function grapesjsSidebarTools(editor: Editor, opts: SidebarToolsOptions = {}): void {
  const options = resolveOptions(opts);
  registerI18n(editor);
  if (options.injectCss && typeof document !== 'undefined') injectCss(document);

  const store = createStateStore(options);
  const { state } = store;
  const ed = editor as any;

  let split: SplitLayout | null = null;
  let warned = false;
  let destroyed = false;
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const getManagerModule = (key: ManagerKey) =>
    key === 'sm' ? ed.StyleManager || ed.Styles : ed.TraitManager || ed.Traits;
  const managers = createManagerMover(getManagerModule, (key) =>
    options.prerenderManagers ? prerenderManager(editor, key, getManagerModule(key)) : false,
  );
  const sectors = createSectorMemory(() => ed.StyleManager || ed.Styles, state.sectors, store.save);
  const globalTab = createGlobalTabMemory(editor, {
    commands: options.globalTabCommands,
    restore: options.restoreGlobalTab,
    get: () => state.globalTab,
    set: (id) => {
      state.globalTab = id;
      store.save();
    },
  });

  // ---- Texts ------------------------------------------------------------------

  /** `labels` option first, then the translation for the locale. */
  function getLabels(locale = getLocale(editor)): SidebarToolsLabels {
    const labels = {} as SidebarToolsLabels;
    LABEL_KEYS.forEach((key) => {
      labels[key] = options.labels[key] || t(editor, key, undefined, locale);
    });
    return labels;
  }

  function applyLabels(locale = getLocale(editor)) {
    if (split && !destroyed) split.setLabels(getLabels(locale), isRtlLocale(locale));
  }

  const onLocaleChange = (data?: { value?: unknown }) =>
    applyLabels(typeof data?.value === 'string' && data.value ? data.value : undefined);
  const onMessagesUpdate = () => applyLabels();

  // ---- Split layout ----------------------------------------------------------

  function observe(el: HTMLElement) {
    resizeObserver?.disconnect();
    resizeObserver = null;
    // Command-independent fallback: the layers container going to/from
    // display:none (any custom tab switcher) changes its size.
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleSync());
      resizeObserver.observe(el);
    }
  }

  /** Builds the split (once the layers container exists) and returns it. */
  function ensureSplit(): SplitLayout | null {
    if (destroyed) return null;
    if (split && split.el.isConnected) return split;
    if (split && !split.el.isConnected) {
      // The editor UI was re-rendered: start over.
      managers.moveAllBack();
      split = null;
    }
    const { el: host, explicit } = findLayersRoot(editor, options.layersContainer);
    if (!host) {
      if (explicit && !warned) {
        warned = true;
        // eslint-disable-next-line no-console
        console.warn(`${LOG_PREFIX} Could not resolve the layers container, split layout skipped.`);
      }
      return null;
    }
    if (findSplitElement(host)) {
      // Another instance of the plugin already owns this container.
      return null;
    }
    split = createSplitLayout(host, {
      labels: getLabels(),
      rtl: isRtlLocale(getLocale(editor)),
      minRatio: options.minRatio,
      maxRatio: options.maxRatio,
      initialTab: state.tab,
      initialRatio: state.ratio,
      onTabChange(tab: BottomTab) {
        state.tab = tab;
        store.save();
      },
      onRatioCommit(ratio: number) {
        state.ratio = ratio;
        store.save();
      },
    });
    state.ratio = split.ratio; // clamped
    observe(split.el);
    return split;
  }

  // ---- Sync -----------------------------------------------------------------

  function sync() {
    syncTimer = null;
    if (destroyed) return;
    sectors.sync();
    const s = ensureSplit();
    if (!s) return;
    const open = s.isVisible() && !!editor.getSelected();
    s.setOpen(open);
    if (open) {
      managers.moveIn('sm', s.smContainer);
      managers.moveIn('tm', s.tmContainer);
      s.showTab(state.tab);
    } else {
      managers.moveAllBack();
    }
  }

  function scheduleSync() {
    if (destroyed) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 0);
  }

  // ---- Commands (public API, used by grapesjs-layers-context-menu) ----------

  function showBottomTab(tab: BottomTab) {
    const s = ensureSplit();
    if (!s) return;
    s.showTab(tab);
    sync();
  }

  editor.Commands.add(COMMAND_SHOW_STYLES, { run: () => showBottomTab('style') });
  editor.Commands.add(COMMAND_SHOW_SETTINGS, { run: () => showBottomTab('settings') });

  // ---- Wiring ---------------------------------------------------------------

  const onRun = (id: unknown) => globalTab.onRun(id);

  const onLoad = () => {
    ensureSplit();
    editor.on(SYNC_EVENTS, scheduleSync);
    editor.on(I18N_LOCALE_EVENT, onLocaleChange);
    editor.on(I18N_UPDATE_EVENT, onMessagesUpdate);
    scheduleSync();
    setTimeout(() => {
      if (!destroyed) globalTab.restore();
    }, 0);
  };

  const onDestroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    editor.off(SYNC_EVENTS, scheduleSync);
    editor.off(I18N_LOCALE_EVENT, onLocaleChange);
    editor.off(I18N_UPDATE_EVENT, onMessagesUpdate);
    editor.off('run', onRun);
    editor.off('load', onLoad);
    globalTab.destroy();
    sectors.destroy();
    managers.moveAllBack();
    split?.destroy();
    split = null;
  };

  editor.on('load', onLoad);
  editor.on('run', onRun);
  editor.on('destroy', onDestroy);
}
