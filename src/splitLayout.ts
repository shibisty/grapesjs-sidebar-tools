import type { BottomTab, SidebarToolsLabels } from './types';

export interface SplitLayoutOptions {
  labels: SidebarToolsLabels;
  /** Right-to-left tabs (ar / he / fa). */
  rtl?: boolean;
  minRatio: number;
  maxRatio: number;
  initialTab: BottomTab;
  initialRatio: number;
  /** Called when the user switches the tab. */
  onTabChange?(tab: BottomTab): void;
  /** Called once a drag / double-click on the resizer is finished. */
  onRatioCommit?(ratio: number): void;
}

export interface SplitLayout {
  /** The layers container the split was built in. */
  readonly host: HTMLElement;
  /** `.gjs-lsb-split` element (flex column). */
  readonly el: HTMLElement;
  readonly topPane: HTMLElement;
  readonly resizer: HTMLElement;
  readonly bottomPane: HTMLElement;
  /** Where the Style Manager is moved to. */
  readonly smContainer: HTMLElement;
  /** Where the Trait Manager is moved to. */
  readonly tmContainer: HTMLElement;
  readonly tab: BottomTab;
  readonly ratio: number;
  showTab(tab: BottomTab): void;
  setRatio(ratio: number): number;
  setOpen(open: boolean): void;
  /** Updates the texts (e.g. after the editor locale changed). */
  setLabels(labels: SidebarToolsLabels, rtl?: boolean): void;
  isOpen(): boolean;
  /** true when the layers container is actually rendered (not display:none). */
  isVisible(): boolean;
  /** Puts the original children back into the host and removes everything added. */
  destroy(): void;
}

export const SPLIT_CLASS = 'gjs-lsb-split';
export const HOST_CLASS = 'gjs-lsb-host';
export const OPEN_CLASS = 'gjs-lsb-split--open';
export const RESIZING_CLASS = 'gjs-lsb-resizing';
export const TAB_ACTIVE_CLASS = 'gjs-lsb-tab--active';

function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** Returns the split already built inside `host`, if any. */
export function findSplitElement(host: HTMLElement): HTMLElement | null {
  for (let i = 0; i < host.children.length; i++) {
    const child = host.children[i] as HTMLElement;
    if (child.classList.contains(SPLIT_CLASS)) return child;
  }
  return null;
}

/**
 * Wraps the current content of `host` (the layer tree) into the top pane
 * and adds a resizer plus a tabbed bottom pane below it.
 */
export function createSplitLayout(host: HTMLElement, opts: SplitLayoutOptions): SplitLayout {
  const el = createEl('div', SPLIT_CLASS);
  const topPane = createEl('div', 'gjs-lsb-top');
  const originalChildren: Node[] = Array.prototype.slice.call(host.childNodes);
  originalChildren.forEach((node) => topPane.appendChild(node));

  const resizer = createEl('div', 'gjs-lsb-resizer');
  resizer.setAttribute('role', 'separator');
  resizer.setAttribute('aria-orientation', 'horizontal');

  const bottomPane = createEl('div', 'gjs-lsb-bottom');
  const tabsEl = createEl('div', 'gjs-lsb-tabs');
  tabsEl.setAttribute('role', 'tablist');
  const tabButtons: Record<BottomTab, HTMLButtonElement> = {
    style: createEl('button', 'gjs-lsb-tab'),
    settings: createEl('button', 'gjs-lsb-tab'),
  };
  (Object.keys(tabButtons) as BottomTab[]).forEach((tab) => {
    const btn = tabButtons[tab];
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-tab', tab);
    tabsEl.appendChild(btn);
  });

  function setLabels(labels: SidebarToolsLabels, rtl = false) {
    resizer.title = labels.resizerTitle;
    // textContent, not innerHTML: labels may come from user config.
    // title too, for long translations in a narrow sidebar.
    tabButtons.style.textContent = tabButtons.style.title = labels.styleManagerTab;
    tabButtons.settings.textContent = tabButtons.settings.title = labels.settingsTab;
    tabsEl.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  }
  setLabels(opts.labels, opts.rtl);

  const content = createEl('div', 'gjs-lsb-tab-content');
  const smContainer = createEl('div', 'gjs-lsb-panel gjs-lsb-panel--style');
  const tmContainer = createEl('div', 'gjs-lsb-panel gjs-lsb-panel--settings');
  smContainer.setAttribute('role', 'tabpanel');
  tmContainer.setAttribute('role', 'tabpanel');
  content.appendChild(smContainer);
  content.appendChild(tmContainer);
  bottomPane.appendChild(tabsEl);
  bottomPane.appendChild(content);

  el.appendChild(topPane);
  el.appendChild(resizer);
  el.appendChild(bottomPane);
  host.appendChild(el);
  host.classList.add(HOST_CLASS);

  let currentTab: BottomTab = opts.initialTab === 'settings' ? 'settings' : 'style';
  let currentRatio = 0.5;

  function setRatio(ratio: number): number {
    const r = isFinite(ratio) ? ratio : 0.5;
    currentRatio = Math.min(opts.maxRatio, Math.max(opts.minRatio, r));
    el.style.setProperty('--lsb-top', `${currentRatio * 100}%`);
    return currentRatio;
  }

  function applyTab(tab: BottomTab) {
    currentTab = tab;
    (Object.keys(tabButtons) as BottomTab[]).forEach((name) => {
      const active = name === tab;
      tabButtons[name].classList.toggle(TAB_ACTIVE_CLASS, active);
      tabButtons[name].setAttribute('aria-selected', String(active));
    });
    smContainer.hidden = tab !== 'style';
    tmContainer.hidden = tab !== 'settings';
  }

  function showTab(tab: BottomTab) {
    const next: BottomTab = tab === 'settings' ? 'settings' : 'style';
    const changed = next !== currentTab;
    applyTab(next);
    if (changed) opts.onTabChange?.(next);
  }

  const onTabClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest?.('.gjs-lsb-tab');
    if (btn) showTab(btn.getAttribute('data-tab') as BottomTab);
  };
  tabsEl.addEventListener('click', onTabClick);

  let stopDrag: (() => void) | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const pid = e.pointerId;
    try {
      resizer.setPointerCapture(pid);
    } catch {
      // not supported / pointer already gone
    }
    el.classList.add(RESIZING_CLASS);
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.height) setRatio((ev.clientY - rect.top) / rect.height);
    };
    const up = () => {
      resizer.removeEventListener('pointermove', move);
      resizer.removeEventListener('pointerup', up);
      resizer.removeEventListener('pointercancel', up);
      try {
        resizer.releasePointerCapture(pid);
      } catch {
        // ignore
      }
      el.classList.remove(RESIZING_CLASS);
      stopDrag = null;
      opts.onRatioCommit?.(currentRatio);
    };
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', up);
    resizer.addEventListener('pointercancel', up);
    stopDrag = up;
  };
  const onDblClick = () => {
    setRatio(0.5);
    opts.onRatioCommit?.(currentRatio);
  };
  resizer.addEventListener('pointerdown', onPointerDown);
  resizer.addEventListener('dblclick', onDblClick);

  setRatio(opts.initialRatio);
  applyTab(currentTab);

  return {
    host,
    el,
    topPane,
    resizer,
    bottomPane,
    smContainer,
    tmContainer,
    get tab() {
      return currentTab;
    },
    get ratio() {
      return currentRatio;
    },
    showTab,
    setRatio,
    setLabels,
    setOpen(open: boolean) {
      el.classList.toggle(OPEN_CLASS, open);
    },
    isOpen() {
      return el.classList.contains(OPEN_CLASS);
    },
    isVisible() {
      return el.isConnected && el.getClientRects().length > 0;
    },
    destroy() {
      stopDrag?.();
      tabsEl.removeEventListener('click', onTabClick);
      resizer.removeEventListener('pointerdown', onPointerDown);
      resizer.removeEventListener('dblclick', onDblClick);
      // Put the layer tree (and anything else that was added to the top
      // pane meanwhile) back where it was.
      while (topPane.firstChild) host.insertBefore(topPane.firstChild, el);
      el.remove();
      host.classList.remove(HOST_CLASS);
    },
  };
}
