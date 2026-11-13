/**
 * The "views" of the GrapesJS UI — the buttons of the views panel (Style
 * Manager, Settings, Layers, Blocks, and any plugin that adds its own
 * button there) and the content their commands put into the views
 * container.
 *
 * How a view becomes a dockable tab:
 *  1. its button gets a context of its own, so activating one view never
 *     deactivates (= stops) another one;
 *  2. its command is run directly (`command.run(editor, sender)`, no
 *     `run:*` event, the Commands module does not mark it active) with a
 *     sender that always reports `active: true` — the core commands only
 *     update their content while their sender is active;
 *  3. whatever the command added to (or un-hid in) the views container is
 *     moved into the tab's pane;
 *  4. when anything stops the command later (another plugin, a preset
 *     re-activating its button, ...), it is run again right away, so the
 *     content never disappears from its pane;
 *  5. when anything runs it (a click on a hidden button, `runCommand`,
 *     preset-webpage opening the Style Manager on select), the tab is
 *     shown in its group instead.
 */
import type { Editor } from 'grapesjs';

/** Commands of the usual view switcher buttons, to find the panel without knowing its id. */
const VIEW_CMD_RE = /^(core:)?(open|show)-(sm|styles?|layers?|blocks?|tm|traits?)$/i;
const VIEWS_CONTAINER_ID = 'views-container';
const CONTEXT_PREFIX = 'gjs-st-view:';

export interface ViewInfo {
  /** Tab id: the button's command id (falls back to the button id). */
  id: string;
  buttonId: string;
  command: string;
  /** Icon classes of the button (e.g. `fa fa-paint-brush`). */
  className: string;
  /** Label HTML of the button (some plugins put an SVG icon here). */
  label: string;
  title: string;
}

export function getButtons(panel: any): any[] {
  const buttons = panel?.get?.('buttons');
  if (!buttons) return [];
  if (Array.isArray(buttons.models)) return buttons.models.slice();
  return typeof buttons.toArray === 'function' ? buttons.toArray() : [];
}

export function buttonCommand(btn: any): string | null {
  const cmd = btn?.get?.('command');
  return typeof cmd === 'string' && cmd ? cmd : null;
}

/** The panel with the view buttons: by id when given, else by the commands of its buttons, else `views`. */
export function findViewsPanel(editor: Editor, panelId: string | null): any {
  const Panels: any = (editor as any).Panels;
  if (!Panels) return null;
  if (panelId) return Panels.getPanel(panelId) || null;
  const panels: any[] = (() => {
    const all = Panels.getPanels?.();
    if (!all) return [];
    return Array.isArray(all.models) ? all.models : typeof all.toArray === 'function' ? all.toArray() : [];
  })();
  const byCommand = panels.find((p) =>
    getButtons(p).some((b) => VIEW_CMD_RE.test(buttonCommand(b) || '') || VIEW_CMD_RE.test(b.id || '')),
  );
  return byCommand || Panels.getPanel('views') || null;
}

/** `.gjs-pn-views-container` (where the default view commands render). */
export function getViewsContainer(editor: Editor): HTMLElement | null {
  const Panels: any = (editor as any).Panels;
  const panel = Panels?.getPanel?.(VIEWS_CONTAINER_ID);
  const el = panel?.view?.el as HTMLElement | undefined;
  if (el && el.nodeType === 1) return el;
  const root = getEditorEl(editor);
  return root?.querySelector<HTMLElement>('.gjs-pn-views-container') || null;
}

/** The editor root (`.gjs-editor`): panels and canvas live inside. */
export function getEditorEl(editor: Editor): HTMLElement | null {
  const ed: any = editor;
  try {
    const el = ed.getEl?.();
    if (el && el.nodeType === 1) return el;
  } catch {
    // ignore
  }
  const container = ed.getContainer?.() as HTMLElement | undefined;
  if (!container) return null;
  return container.classList?.contains('gjs-editor')
    ? container
    : container.querySelector<HTMLElement>('.gjs-editor') || container;
}

function translate(editor: Editor, key: string): string | null {
  try {
    const res = (editor as any).I18n?.t?.(key);
    return typeof res === 'string' && res ? res : null;
  } catch {
    return null;
  }
}

export function describeButton(editor: Editor, btn: any): ViewInfo | null {
  const command = buttonCommand(btn);
  if (!command) return null;
  const attrs = btn.get('attributes') || {};
  const title =
    (typeof attrs.title === 'string' && attrs.title) ||
    translate(editor, `panels.buttons.titles.${btn.id}`) ||
    translate(editor, `panels.buttons.titles.${command}`) ||
    btn.id ||
    command;
  return {
    id: command,
    buttonId: String(btn.id ?? command),
    command,
    className: String(btn.get('className') || ''),
    label: String(btn.get('label') || ''),
    title,
  };
}

/** True when the element is not hidden by itself (display:none / [hidden]). */
export function isShown(el: Element): boolean {
  const html = el as HTMLElement;
  if (html.hidden) return false;
  if (html.style && html.style.display === 'none') return false;
  try {
    return getComputedStyle(html).display !== 'none';
  } catch {
    return true;
  }
}

export interface ContainerSnapshot {
  children: Element[];
  shown: Map<Element, boolean>;
}

export function snapshot(container: HTMLElement): ContainerSnapshot {
  const children = Array.from(container.children);
  const shown = new Map<Element, boolean>();
  children.forEach((c) => shown.set(c, isShown(c)));
  return { children, shown };
}

/** Children that were added or became visible since `before`. */
export function diffSnapshot(container: HTMLElement, before: ContainerSnapshot): HTMLElement[] {
  return Array.from(container.children).filter((c) => {
    if (!before.shown.has(c)) return true;
    return !before.shown.get(c) && isShown(c);
  }) as HTMLElement[];
}

/**
 * Elements the core view commands keep a reference to, so their content
 * is found even when it was rendered before the plugin started (the view
 * that was open at load time).
 */
export function knownContent(cmd: any): HTMLElement[] {
  if (!cmd) return [];
  const out: HTMLElement[] = [];
  const add = (v: any) => {
    const el = v && (v.nodeType === 1 ? v : typeof v.get === 'function' ? v.get(0) : null);
    if (el && el.nodeType === 1 && !out.includes(el)) out.push(el);
  };
  add(cmd.$cnt); // OpenStyleManager
  add(cmd.$cn); // OpenTraitManager
  add(cmd.layers); // OpenLayers
  add(cmd.container); // OpenBlocks
  return out;
}

export interface ManagedView extends ViewInfo {
  button: any;
  /** Context the button had before. */
  originalContext: unknown;
  /** Where the content lives (moved between groups by the dock). */
  pane: HTMLElement;
  /** Content elements moved out of the views container. */
  nodes: HTMLElement[];
}

export interface ViewControllerOptions {
  /** Called when something asks to show a view (button activated, command run). */
  onFocus(id: string): void;
  /** Wraps the pane element creation, so the dock can style it. */
  createPane(info: ViewInfo): HTMLElement;
}

export interface ViewController {
  readonly views: ManagedView[];
  get(id: string): ManagedView | undefined;
  /** Adopts a view button; returns null when its command shows nothing in the views container. */
  adopt(btn: any): ManagedView | null;
  /** Releases one view: content and button go back to GrapesJS. */
  release(id: string): void;
  /** Runs a view's command again (keeps its content alive / up to date). */
  refresh(id: string): void;
  destroy(): void;
}

export function createViewController(editor: Editor, opts: ViewControllerOptions): ViewController {
  const ed: any = editor;
  const views: ManagedView[] = [];
  const offs: Array<() => void> = [];
  let destroyed = false;
  let rerunDepth = 0;

  const getCommand = (id: string) => {
    try {
      const commands = ed.Commands;
      if (commands.has && !commands.has(id)) return null;
      return commands.get(id) || null;
    } catch {
      return null;
    }
  };

  const sender = (view: { buttonId: string; button: any }) => ({
    id: view.buttonId,
    // The core commands (OpenStyleManager, OpenTraitManager) only refresh
    // their content while `sender.get('active')` is true.
    get: (key: string) => (key === 'active' ? true : view.button?.get?.(key)),
    set: () => undefined,
  });

  /** Runs the command without the Commands module (no events, not marked active). */
  function runDirect(view: ManagedView): void {
    const cmd = getCommand(view.command);
    if (!cmd || typeof cmd.run !== 'function') return;
    const container = getViewsContainer(editor);
    const before = container ? snapshot(container) : null;
    try {
      cmd.run(editor, sender(view), {});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[grapesjs-sidebar-tools] view "${view.id}" failed to render`, err);
    }
    // A command that renders again on every run: keep its new content in the pane too.
    if (container && before) collect(view, diffSnapshot(container, before));
  }

  function collect(view: ManagedView, nodes: HTMLElement[]) {
    nodes.forEach((node) => {
      if (node === view.pane || node.contains(view.pane)) return;
      if (!view.nodes.includes(node)) view.nodes.push(node);
      view.pane.appendChild(node);
    });
  }

  function isActiveInModule(id: string): boolean {
    try {
      return !!ed.Commands?.isActive?.(id);
    } catch {
      return false;
    }
  }

  /** Someone ran / activated the view: show its tab, then put the button and command back to "idle". */
  function handleExternalRun(view: ManagedView) {
    if (destroyed) return;
    opts.onFocus(view.id);
    queueMicrotask(() => {
      if (destroyed || !views.includes(view)) return;
      if (view.button?.get?.('active')) view.button.set('active', false);
      else if (isActiveInModule(view.command)) ed.stopCommand?.(view.command);
    });
  }

  /** Someone stopped the view (which hid its content): render it again. */
  function handleExternalStop(view: ManagedView) {
    if (destroyed || rerunDepth > 3) return;
    queueMicrotask(() => {
      if (destroyed || !views.includes(view)) return;
      rerunDepth++;
      try {
        runDirect(view);
      } finally {
        rerunDepth--;
      }
    });
  }

  function adopt(btn: any): ManagedView | null {
    if (destroyed) return null;
    const info = describeButton(editor, btn);
    if (!info) return null;
    if (views.some((v) => v.id === info.id)) return null;
    const cmd = getCommand(info.command);
    if (!cmd || typeof cmd.run !== 'function') return null;

    const container = getViewsContainer(editor);
    const view: ManagedView = {
      ...info,
      button: btn,
      originalContext: btn.get('context'),
      pane: opts.createPane(info),
      nodes: [],
    };

    // 1. A context of its own: activating another view no longer stops this one.
    btn.set('context', CONTEXT_PREFIX + info.id);
    // 2. Idle button / command (stopping hides the content, it is re-rendered below).
    if (btn.get('active')) btn.set('active', false);
    else if (isActiveInModule(info.command)) ed.stopCommand?.(info.command);

    // 3. Render and capture.
    const before = container ? snapshot(container) : null;
    try {
      cmd.run(editor, sender(view), {});
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[grapesjs-sidebar-tools] view "${info.id}" failed to render`, err);
    }
    let nodes = container && before ? diffSnapshot(container, before) : [];
    if (container) {
      knownContent(cmd).forEach((el) => {
        if (el.parentNode === container && !nodes.includes(el)) nodes.push(el);
      });
    }
    if (!nodes.length) {
      // Nothing to dock (the command renders somewhere else, or is an action).
      btn.set('context', view.originalContext);
      return null;
    }
    collect(view, nodes);
    views.push(view);

    // 4/5. Keep it alive, follow external runs.
    const onRun = () => handleExternalRun(view);
    const onStop = () => handleExternalStop(view);
    const onButton = (_m: any, active: boolean) => {
      if (active) handleExternalRun(view);
    };
    ed.on(`run:${info.command}`, onRun);
    ed.on(`stop:${info.command}`, onStop);
    btn.on?.('change:active', onButton);
    (view as any).__off = () => {
      ed.off(`run:${info.command}`, onRun);
      ed.off(`stop:${info.command}`, onStop);
      btn.off?.('change:active', onButton);
    };
    return view;
  }

  function release(id: string) {
    const index = views.findIndex((v) => v.id === id);
    if (index === -1) return;
    const view = views[index];
    views.splice(index, 1);
    (view as any).__off?.();
    const container = getViewsContainer(editor);
    view.nodes.forEach((node) => {
      if (container) container.appendChild(node);
      else node.remove();
    });
    view.nodes = [];
    view.pane.remove();
    try {
      view.button.set('context', view.originalContext);
    } catch {
      // ignore
    }
  }

  return {
    views,
    get: (id) => views.find((v) => v.id === id),
    adopt,
    release,
    refresh(id) {
      const view = views.find((v) => v.id === id);
      if (view && !destroyed) runDirect(view);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      views.slice().forEach((v) => release(v.id));
      offs.splice(0).forEach((off) => off());
    },
  };
}
