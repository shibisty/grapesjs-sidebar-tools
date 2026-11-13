import type { Editor } from 'grapesjs';
import { createDock, type Dock } from './dock';
import { getLocale, isRtlLocale, registerI18n, t } from './i18n';
import { addTabs, findTab, layoutFromDefault, normalizeLayout, removeTabs } from './layout';
import { resolveOptions } from './options';
import { createSectorMemory } from './sectors';
import { createStateStore } from './state';
import { injectCss } from './styles';
import type { DockLayout, SidebarToolsLabels, SidebarToolsOptions } from './types';
import { buttonCommand, createViewController, findViewsPanel, getButtons, getEditorEl, type ViewController } from './views';

/** Kept from 1.x: used by grapesjs-context-menu ("View styles"). */
export const COMMAND_SHOW_STYLES = 'layers-sidebar:show-styles';
export const COMMAND_SHOW_SETTINGS = 'layers-sidebar:show-settings';
/** `editor.runCommand('sidebar-tools:show', { id: 'open-layers' })` */
export const COMMAND_SHOW = 'sidebar-tools:show';
/** Puts every tab back to the default layout. */
export const COMMAND_RESET = 'sidebar-tools:reset-layout';
/** Fired with `{ layout }` after every change of the dock. */
export const EVENT_LAYOUT = 'sidebar-tools:layout';

const LOG_PREFIX = '[grapesjs-sidebar-tools]';
const LABEL_KEYS: (keyof SidebarToolsLabels)[] = ['resizerTitle', 'zoneResizerTitle', 'dropHere'];

/*
 * GrapesJS fires `i18n:locale` BEFORE the locale is stored (the new one is
 * in the payload); `i18n:update` comes after messages were merged.
 */
const I18N_LOCALE_EVENT = 'i18n:locale';
const I18N_UPDATE_EVENT = 'i18n:update';

function isAlive(editor: Editor): boolean {
  try {
    const em: any = (editor as any).getModel?.();
    return !em || !em.destroyed;
  } catch {
    return false;
  }
}

export default function grapesjsSidebarTools(editor: Editor, opts: SidebarToolsOptions = {}): void {
  const ed = editor as any;
  const options = resolveOptions(opts);
  registerI18n(editor);
  if (options.injectCss && typeof document !== 'undefined') injectCss(document);

  const store = createStateStore(options);
  const { state } = store;
  const sectors = createSectorMemory(() => ed.StyleManager || ed.Styles, state.sectors, store.save);

  let dock: Dock | null = null;
  let views: ViewController | null = null;
  let destroyed = false;
  let pendingFocus: string | null = null;
  let refreshFrame = 0;
  let locale = getLocale(editor);
  const offs: Array<() => void> = [];

  const on = (event: string, cb: (...args: any[]) => void) => {
    editor.on(event, cb);
    offs.push(() => editor.off(event, cb));
  };

  // ---- Texts ------------------------------------------------------------------

  function getLabels(): SidebarToolsLabels {
    const labels = {} as SidebarToolsLabels;
    LABEL_KEYS.forEach((key) => {
      labels[key] = options.labels[key] || t(editor, key, undefined, locale);
    });
    return labels;
  }

  // ---- Canvas refresh ---------------------------------------------------------

  /** The canvas changed size: GrapesJS has to re-measure its offsets (highlighter, toolbar...). */
  function scheduleRefresh() {
    if (refreshFrame || destroyed) return;
    const run = () => {
      refreshFrame = 0;
      if (destroyed || !isAlive(editor)) return;
      try {
        ed.refresh?.({ tools: true });
      } catch {
        // ignore
      }
    };
    refreshFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : (setTimeout(run, 16) as any);
  }

  // ---- Layout -----------------------------------------------------------------

  function onDockChange(layout: DockLayout, info: { reason: string; live?: boolean }) {
    state.layout = layout;
    if (!info.live) store.save();
    scheduleRefresh();
    if (!info.live) editor.trigger(EVENT_LAYOUT, { layout, reason: info.reason });
  }

  function focus(id: string) {
    if (!dock) {
      pendingFocus = id;
      return;
    }
    dock.activate(id);
  }

  function initialLayout(tabIds: string[], preferredActive: string[]): DockLayout {
    const raw = state.layout || layoutFromDefault(options.defaultLayout);
    return normalizeLayout(raw, tabIds, {
      preferredActive,
      ratioBounds: [options.minRatio, options.maxRatio],
    });
  }

  function wantsView(btn: any): boolean {
    if (!options.views) return true;
    const cmd = buttonCommand(btn);
    return options.views.includes(String(btn.id)) || (!!cmd && options.views.includes(cmd));
  }

  function start() {
    if (destroyed || !isAlive(editor) || dock) return;
    const root = getEditorEl(editor);
    const panel = findViewsPanel(editor, options.panelId);
    if (!root || !panel) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX} No views panel found: the dock needs the default GrapesJS panels (or the panelId option).`);
      return;
    }

    views = createViewController(editor, {
      onFocus: focus,
      createPane(info) {
        const pane = document.createElement('div');
        pane.className = 'gjs-st-pane';
        pane.setAttribute('data-tab', info.id);
        pane.setAttribute('role', 'tabpanel');
        return pane;
      },
    });

    const buttons = getButtons(panel).filter(wantsView);
    const preferredActive = buttons.filter((b) => b.get('active')).map((b) => buttonCommand(b) || '');
    buttons.forEach((btn) => views!.adopt(btn));
    if (!views.views.length) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX} None of the views panel buttons renders into the views container, nothing to dock.`);
      views.destroy();
      views = null;
      return;
    }

    const layout = initialLayout(
      views.views.map((v) => v.id),
      preferredActive,
    );
    state.layout = layout;

    dock = createDock({
      root,
      layout,
      getPane: (id) => views?.get(id)?.pane || null,
      getInfo: (id) => views?.get(id),
      getLabels,
      isRtl: () => isRtlLocale(locale),
      defaultSizes: options.sizes,
      minSize: options.minSize,
      minRatio: options.minRatio,
      maxRatio: options.maxRatio,
      onChange: onDockChange,
    });
    if (pendingFocus) dock.activate(pendingFocus);
    pendingFocus = null;
    sectors.sync();
    scheduleRefresh();

    // Buttons added / removed later (plugins that register their view late).
    const buttonsColl = panel.get('buttons');
    const onAdd = (btn: any) =>
      setTimeout(() => {
        if (destroyed || !views || !dock || !wantsView(btn)) return;
        const view = views.adopt(btn);
        if (view) dock.setLayout(addTabs(dock.layout, [view.id]));
      }, 0);
    const onRemove = (btn: any) => {
      const cmd = buttonCommand(btn);
      if (!cmd || !views?.get(cmd) || !dock) return;
      views.release(cmd);
      dock.setLayout(removeTabs(dock.layout, [cmd]));
    };
    buttonsColl?.on?.('add', onAdd);
    buttonsColl?.on?.('remove', onRemove);
    offs.push(() => {
      buttonsColl?.off?.('add', onAdd);
      buttonsColl?.off?.('remove', onRemove);
    });

    const onResize = () => {
      if (!isAlive(editor)) return cleanup();
      dock?.applySizes();
      scheduleRefresh();
    };
    window.addEventListener('resize', onResize);
    offs.push(() => window.removeEventListener('resize', onResize));
  }

  // ---- Commands ---------------------------------------------------------------

  const showTab = (id: string | undefined | null) => {
    if (!id) return;
    if (dock && !findTab(dock.layout, id)) return;
    focus(id);
  };
  editor.Commands.add(COMMAND_SHOW_STYLES, { run: () => showTab(options.stylesTab) });
  editor.Commands.add(COMMAND_SHOW_SETTINGS, { run: () => showTab(options.settingsTab) });
  editor.Commands.add(COMMAND_SHOW, { run: (_ed: Editor, _s: unknown, o: { id?: string } = {}) => showTab(o?.id) });
  editor.Commands.add(COMMAND_RESET, {
    run: () => {
      if (!dock || !views) return;
      state.layout = null;
      const layout = initialLayout(
        views.views.map((v) => v.id),
        [],
      );
      dock.setLayout(layout);
      onDockChange(layout, { reason: 'set' });
    },
  });

  // ---- Wiring -----------------------------------------------------------------

  const onLocale = (data?: { value?: unknown }) => {
    locale = typeof data?.value === 'string' && data.value ? data.value : getLocale(editor);
    dock?.updateLabels();
  };
  const onMessages = () => {
    locale = getLocale(editor);
    dock?.updateLabels();
  };
  on(I18N_LOCALE_EVENT, onLocale);
  on(I18N_UPDATE_EVENT, onMessages);
  on('style:sector:add', () => sectors.sync());

  function cleanup() {
    if (destroyed) return;
    destroyed = true;
    if (refreshFrame) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(refreshFrame);
      clearTimeout(refreshFrame);
    }
    offs.splice(0).forEach((off) => off());
    sectors.destroy();
    dock?.destroy();
    dock = null;
    views?.destroy();
    views = null;
  }

  // Plugins that mount their view in their own onReady/load handler must be
  // done before the views are captured: start one tick after load.
  const onLoad = () => setTimeout(start, 0);
  if (typeof ed.onReady === 'function') ed.onReady(onLoad);
  else on('load', onLoad);
  on('destroy', cleanup);
}
