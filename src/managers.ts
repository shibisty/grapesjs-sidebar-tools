import { resolveEl } from './dom';

/**
 * The real Style Manager / Trait Manager DOM lives in their own top tabs.
 * A DOM node can only be in one place, so while the Layers tab is open and
 * something is selected we MOVE those nodes into the bottom half of the
 * layers panel, and put them back as soon as that condition stops being
 * true. We never call render(), which would recreate the views (and break
 * the managers' own tabs).
 */

export type ManagerKey = 'sm' | 'tm';

export interface ManagerSlot {
  el: HTMLElement;
  /** Original place, to move the element back. */
  parent: Node | null;
  next: Node | null;
}

interface ModuleLike {
  getConfig?: () => { appendTo?: unknown; custom?: unknown } | undefined;
  /** TraitManager keeps its root view here. */
  view?: { el?: HTMLElement };
  /** StyleManager keeps its root view here. */
  SectView?: { el?: HTMLElement };
}

/**
 * CSS classes of the root element each manager renders (default `gjs-`
 * prefix). The Trait Manager root is `gjs-traits-cs` in GrapesJS 0.21+,
 * `gjs-trt-traits` in older versions.
 */
export const MANAGER_CLASSES: Record<ManagerKey, string[]> = {
  sm: ['gjs-sm-sectors'],
  tm: ['gjs-traits-cs', 'gjs-trt-traits'],
};

function moduleViewEl(mod: ModuleLike | null | undefined): HTMLElement | null {
  const el = mod?.SectView?.el || mod?.view?.el;
  return el && el.nodeType === 1 && el.isConnected ? el : null;
}

/**
 * Finds the rendered root element of a manager:
 *  1. inside its `appendTo` container (by class, else the first child)
 *  2. the module's own view element
 *  3. anywhere in the document, by class
 * Elements inside `exclude` (our own pane) are skipped in 2 and 3.
 */
export function locateManager(
  mod: ModuleLike | undefined | null,
  classes: string | string[],
  exclude?: Node | null,
): ManagerSlot | null {
  const list = Array.isArray(classes) ? classes : [classes];
  const selector = list.map((c) => `.${c}`).join(',');
  const allowed = (node: HTMLElement | null) => !!node && (!exclude || !exclude.contains(node));

  let container: HTMLElement | null = null;
  try {
    container = resolveEl(mod?.getConfig?.()?.appendTo);
  } catch {
    container = null;
  }
  let el: HTMLElement | null = null;
  if (container) {
    el = container.querySelector<HTMLElement>(selector) || (container.firstElementChild as HTMLElement | null);
  }
  if (!el) {
    const own = moduleViewEl(mod);
    if (allowed(own)) el = own;
  }
  if (!el) {
    const all = document.querySelectorAll<HTMLElement>(selector);
    for (let i = 0; i < all.length && !el; i++) {
      if (allowed(all[i])) el = all[i];
    }
  }
  return el ? { el, parent: el.parentNode, next: el.nextSibling } : null;
}

/** Default commands that render each manager into the views panel. */
export const MANAGER_COMMANDS: Record<ManagerKey, string> = {
  sm: 'open-sm',
  tm: 'open-tm',
};

/**
 * With the default GrapesJS panels a manager is rendered only when its
 * tab is opened for the first time, so e.g. the Trait Manager does not
 * exist until the "settings" tab was clicked once. Render it through its
 * own command without touching the panel buttons: the command object is
 * called directly (no `run:*` event) with an inactive sender, then
 * stopped, so nothing becomes visible in the views panel.
 *
 * Returns true when the command was run.
 */
export function prerenderManager(editor: any, key: ManagerKey, module: ModuleLike | null | undefined): boolean {
  try {
    const commands = editor?.Commands;
    const config: any = module?.getConfig?.() || {};
    if (config.appendTo || config.custom) return false;
    const id = MANAGER_COMMANDS[key];
    if (!commands || (commands.has && !commands.has(id))) return false;
    const cmd = commands.get(id);
    if (!cmd || typeof cmd.run !== 'function') return false;
    // Already rendered once (OpenTraitManager keeps $cn, OpenStyleManager $cnt).
    if (cmd.$cn || cmd.$cnt) return false;
    const inactiveSender = { get: () => false };
    cmd.run(editor, inactiveSender);
    cmd.stop?.(editor, inactiveSender);
    return true;
  } catch {
    return false;
  }
}

export interface ManagerMover {
  /** Moves the manager into `container` (remembers where it came from). */
  moveIn(key: ManagerKey, container: HTMLElement): void;
  /** Moves the manager back to where it was found. */
  moveBack(key: ManagerKey): void;
  moveAllBack(): void;
  get(key: ManagerKey): ManagerSlot | null;
}

export function createManagerMover(
  getModule: (key: ManagerKey) => ModuleLike | undefined | null,
  /** Called once per manager when it is not rendered yet; return true if it may be now. */
  prerender?: (key: ManagerKey) => boolean,
): ManagerMover {
  const prerendered: Record<ManagerKey, boolean> = { sm: false, tm: false };
  const slots: Record<ManagerKey, ManagerSlot | null> = { sm: null, tm: null };

  function get(key: ManagerKey, exclude?: Node | null): ManagerSlot | null {
    const slot = slots[key];
    if (slot && slot.el.isConnected) return slot;
    const found = locateManager(getModule(key), MANAGER_CLASSES[key], exclude);
    slots[key] = found;
    return found;
  }

  function moveBack(key: ManagerKey) {
    const slot = slots[key];
    if (!slot || !slot.parent || slot.el.parentNode === slot.parent) return;
    const next = slot.next && slot.next.parentNode === slot.parent ? slot.next : null;
    slot.parent.insertBefore(slot.el, next);
  }

  return {
    get: (key) => get(key),
    moveIn(key, container) {
      const slot = slots[key];
      // Our own pane never counts as the "home" of a manager.
      let current = slot && slot.el.isConnected ? slot : get(key, container);
      if (!current && prerender && !prerendered[key]) {
        prerendered[key] = true;
        if (prerender(key)) current = get(key, container);
      }
      if (current && current.el.parentNode !== container) {
        if (current.el.parentNode) {
          current.parent = current.el.parentNode;
          current.next = current.el.nextSibling;
        }
        container.appendChild(current.el);
      }
    },
    moveBack,
    moveAllBack() {
      moveBack('sm');
      moveBack('tm');
    },
  };
}
