/**
 * The workspace: the area between the dock zones, under the top bar. It
 * holds document tabs (a page on the canvas, a blueprint editor, ...)
 * in 1–4 groups side by side / one above the other.
 *
 * There is a single GrapesJS canvas: all "canvas" documents (e.g. the
 * pages of grapesjs-pages) live in one group, and switching between them
 * asks their owner to load them (`onActivate`). The canvas element itself
 * is never moved (moving an iframe reloads it): it is positioned over its
 * group through CSS variables (`--gjs-st-cv-x/y/w/h`). "Element" documents
 * bring their own DOM (`mount(container)`).
 *
 * Other plugins use it through `editor.SidebarTools.workspace` (see
 * `WorkspaceApi`), so they keep working without this plugin.
 */
import type { Editor } from 'grapesjs';
import type { SidebarToolsLabels } from './types';
import {
  activateDoc,
  addDoc,
  findDoc,
  GRID_SHAPE,
  moveDoc,
  pruneWs,
  removeDoc,
  setCols,
  setGrid,
  setRow,
  WS_GRIDS,
  type WsGrid,
  type WsLayout,
} from './wsLayout';

export const DEFAULT_CANVAS_ID = 'gjs-st-canvas';
export const WS_TABS_HEIGHT = 32;
const DRAG_THRESHOLD = 5;
/** Ids of documents not open again within this time after start are dropped from the stored layout. */
const PRUNE_GRACE_MS = 8000;

export interface WorkspaceDocInput {
  /** Unique id, e.g. `page:<id>` or `blueprint:<id>`. */
  id: string;
  title: string;
  /** Icon HTML (trusted: same as GrapesJS button labels). */
  icon?: string;
  /** Tooltip (default: the title). */
  tooltip?: string;
  /** `canvas`: shown in the GrapesJS canvas; `element` (default): its own content. */
  kind?: 'canvas' | 'element';
  /** Element documents: called once, the first time the tab is shown, with its container. */
  mount?(container: HTMLElement): void;
  /** Canvas documents: load this document into the canvas (e.g. open the page). */
  onActivate?(): void;
  /** After the tab became visible (element documents: re-measure, focus...). */
  onShow?(): void;
  /** Before the tab closes; return `false` to keep it open. */
  onClose?(): boolean | void;
  /** After the tab closed (also on `close(id, { force: true })`). */
  onClosed?(): void;
  /** Show the close button. Default `true`. */
  closable?: boolean;
  /** Unsaved changes marker. */
  dirty?: boolean;
}

export interface OpenOptions {
  /** Show it (default `true`). */
  activate?: boolean;
  /** Call `onActivate` of a canvas document (default `true`; `false` when the owner already loaded it). */
  notify?: boolean;
  /** Group to open into (default: the group used last; canvas documents: the canvas group). */
  group?: number;
}

export interface WorkspaceDocInfo {
  id: string;
  kind: 'canvas' | 'element';
  title: string;
  group: number;
  /** Visible in its group. */
  active: boolean;
}

/** `editor.SidebarTools.workspace` */
export interface WorkspaceApi {
  open(doc: WorkspaceDocInput, opts?: OpenOptions): void;
  update(id: string, patch: Partial<Pick<WorkspaceDocInput, 'title' | 'icon' | 'tooltip' | 'dirty' | 'closable'>>): void;
  activate(id: string, opts?: { notify?: boolean }): void;
  /**
   * Closes a tab (asks `onClose` unless `force`); returns whether it closed.
   * When the canvas then shows another canvas document, it is loaded
   * (`onActivate`) unless `notify: false` (the owner loads something itself).
   */
  close(id: string, opts?: { force?: boolean; notify?: boolean }): boolean;
  has(id: string): boolean;
  list(): WorkspaceDocInfo[];
  /** Ids from the stored layout starting with `prefix` that are not open yet (to restore tabs after a reload). */
  remembered(prefix: string): string[];
  /** The canvas document currently loaded in the canvas. */
  canvasDoc(): string | null;
  getGrid(): WsGrid;
  setGrid(grid: WsGrid): void;
}

interface Doc extends WorkspaceDocInput {
  kind: 'canvas' | 'element';
  pane: HTMLElement | null;
  mounted: boolean;
}

export interface WorkspaceOptions {
  root: HTMLElement;
  editor: Editor;
  layout: WsLayout;
  getLabels(): SidebarToolsLabels;
  /** Layout changed (persist; `live` while dragging a splitter). */
  onChange(layout: WsLayout, info: { live?: boolean }): void;
  /** The canvas moved / was resized (refresh GrapesJS offsets, re-fit the zoom). */
  onCanvasRect(): void;
  /** Something happened (open / close / activate / layout) — for the editor event. */
  onEvent(type: 'open' | 'close' | 'activate' | 'layout', id?: string): void;
}

export interface Workspace {
  readonly api: WorkspaceApi;
  readonly layout: WsLayout;
  /** Re-measures the canvas group (call after the dock zones changed). */
  relayout(): void;
  updateLabels(): void;
  destroy(): void;
}

const ICONS = {
  close:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>',
  canvas:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V7H19V19Z"/></svg>',
  layout:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3,3H11V11H3V3M13,3H21V11H13V3M3,13H11V21H3V13M13,13H21V21H13V13M5,5V9H9V5H5M15,5V9H19V5H15M5,15V19H9V15H5M15,15V19H19V15H15Z"/></svg>',
};

/** Small pictures of the grids for the layout menu. */
const GRID_ICONS: Record<WsGrid, string> = {
  '1': '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  '2h': '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="1" x2="12" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>',
  '2v': '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="8" x2="23" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>',
  '3h': '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="8.3" y1="1" x2="8.3" y2="15" stroke="currentColor" stroke-width="1.5"/><line x1="15.7" y1="1" x2="15.7" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>',
  '4': '<svg viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><rect x="1" y="1" width="22" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="1" x2="12" y2="15" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="8" x2="23" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>',
};

const GRID_LABEL: Record<WsGrid, keyof SidebarToolsLabels> = {
  '1': 'layoutSingle',
  '2h': 'layoutColumns2',
  '2v': 'layoutRows2',
  '3h': 'layoutColumns3',
  '4': 'layoutGrid4',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createWorkspace(opts: WorkspaceOptions): Workspace {
  const { root, editor } = opts;
  const ed: any = editor;
  let layout = opts.layout;
  let destroyed = false;
  const startedAt = Date.now();
  const docs = new Map<string, Doc>();
  /** The canvas document loaded in the canvas. */
  let currentCanvas: string | null = null;
  let menu: HTMLElement | null = null;
  const offs: Array<() => void> = [];

  const ws = el('div', 'gjs-st-ws');
  root.appendChild(ws);
  root.classList.add('gjs-st-ws-on');

  const isOpen = (id: string) => docs.has(id);
  const canvasIds = () => Array.from(docs.values()).filter((d) => d.kind === 'canvas').map((d) => d.id);

  /** The group of the canvas: where canvas documents are (or the first group). */
  function canvasGroup(): number {
    for (const id of canvasIds()) {
      const loc = findDoc(layout, id);
      if (loc) return loc.group;
    }
    return 0;
  }

  /** The tab a group shows: its active one if open, else its first open one. */
  function shown(g: number): string | null {
    const group = layout.groups[g];
    if (!group) return null;
    if (group.active && isOpen(group.active)) return group.active;
    return group.tabs.find(isOpen) ?? null;
  }

  // ---- The default canvas document ----------------------------------------------

  function pageName(): string {
    try {
      const page = ed.Pages?.getSelected?.();
      const name = page?.getName?.() || page?.get?.('name');
      return typeof name === 'string' && name ? name : '';
    } catch {
      return '';
    }
  }

  /** "Canvas" tab when no plugin brought canvas documents (vanilla GrapesJS). */
  function syncDefaultCanvas() {
    const others = canvasIds().filter((id) => id !== DEFAULT_CANVAS_ID);
    if (others.length && docs.has(DEFAULT_CANVAS_ID)) {
      const loc = findDoc(layout, DEFAULT_CANVAS_ID);
      docs.delete(DEFAULT_CANVAS_ID);
      layout = removeDoc(layout, DEFAULT_CANVAS_ID, isOpen);
      if (loc && currentCanvas === DEFAULT_CANVAS_ID) currentCanvas = null;
    } else if (!others.length && !docs.has(DEFAULT_CANVAS_ID)) {
      docs.set(DEFAULT_CANVAS_ID, {
        id: DEFAULT_CANVAS_ID,
        kind: 'canvas',
        title: pageName() || opts.getLabels().canvas,
        icon: ICONS.canvas,
        closable: false,
        pane: null,
        mounted: false,
      });
      layout = addDoc(layout, DEFAULT_CANVAS_ID, canvasGroup());
      if (!currentCanvas) currentCanvas = DEFAULT_CANVAS_ID;
    }
  }

  // ---- Rendering ---------------------------------------------------------------------

  function renderTab(doc: Doc, active: boolean): HTMLElement {
    const tab = el('div', `gjs-st-wtab${active ? ' gjs-st-wtab--active gjs-four-color' : ''}${doc.dirty ? ' gjs-st-wtab--dirty' : ''}`);
    tab.setAttribute('data-doc', doc.id);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
    tab.title = doc.tooltip || doc.title;
    if (doc.icon) {
      const icon = el('span', 'gjs-st-wtab__icon');
      icon.innerHTML = doc.icon; // trusted: from the owner plugin, like GrapesJS button labels
      tab.appendChild(icon);
    }
    const title = el('span', 'gjs-st-wtab__title');
    title.textContent = doc.title;
    tab.appendChild(title);
    if (doc.closable !== false && !(doc.kind === 'canvas' && canvasIds().length <= 1)) {
      const close = el('span', 'gjs-st-wtab__close');
      close.innerHTML = ICONS.close;
      close.setAttribute('role', 'button');
      close.setAttribute('data-close', doc.id);
      close.title = opts.getLabels().closeTab;
      tab.appendChild(close);
    }
    return tab;
  }

  function paneOf(doc: Doc): HTMLElement {
    if (!doc.pane) {
      doc.pane = el('div', 'gjs-st-doc gjs-one-bg gjs-two-color');
      doc.pane.setAttribute('data-doc', doc.id);
      doc.pane.setAttribute('role', 'tabpanel');
    }
    return doc.pane;
  }

  function render() {
    if (destroyed) return;
    syncDefaultCanvas();
    const labels = opts.getLabels();
    // keep the panes (their content is the documents' state)
    docs.forEach((d) => d.pane?.remove());
    ws.textContent = '';
    const { cols, rows } = GRID_SHAPE[layout.grid];
    const cg = canvasGroup();
    const toShow: Doc[] = [];

    for (let r = 0; r < rows; r++) {
      if (r > 0) {
        const split = el('div', 'gjs-st-wsg-rowsplit');
        split.setAttribute('role', 'separator');
        split.setAttribute('aria-orientation', 'horizontal');
        split.title = labels.resizerTitle;
        split.addEventListener('pointerdown', (e) => startRowResize(e, split));
        split.addEventListener('dblclick', () => commitLayout(setRow(layout, 0.5)));
        ws.appendChild(split);
      }
      const row = el('div', 'gjs-st-wsg-row');
      if (rows > 1) row.style.flex = r === 0 ? `0 0 ${layout.row * 100}%` : '1 1 0';
      for (let c = 0; c < cols; c++) {
        const g = r * cols + c;
        if (c > 0) {
          const split = el('div', 'gjs-st-wsg-colsplit');
          split.setAttribute('role', 'separator');
          split.setAttribute('aria-orientation', 'vertical');
          split.title = labels.resizerTitle;
          split.addEventListener('pointerdown', (e) => startColResize(e, c - 1, split));
          split.addEventListener('dblclick', () => commitLayout(setCols(layout, layout.cols.map(() => 1 / cols))));
          row.appendChild(split);
        }
        const group = el('div', `gjs-st-wsg${g === layout.focus ? ' gjs-st-wsg--focus' : ''}`);
        group.setAttribute('data-group', String(g));
        group.style.flex = `${layout.cols[c]} 1 0`;
        const strip = el('div', 'gjs-st-wsg__tabs gjs-one-bg gjs-two-color');
        strip.setAttribute('role', 'tablist');
        const body = el('div', 'gjs-st-wsg__body');
        const active = shown(g);
        layout.groups[g].tabs.forEach((id) => {
          const doc = docs.get(id);
          if (!doc) return;
          strip.appendChild(renderTab(doc, id === active));
        });
        // The layout menu: right end of the top-right group's strip.
        if (r === 0 && c === cols - 1) {
          const btn = el('span', 'gjs-st-wsg__layout');
          btn.innerHTML = ICONS.layout;
          btn.setAttribute('role', 'button');
          btn.setAttribute('tabindex', '0');
          btn.setAttribute('data-layout-menu', '');
          btn.title = labels.splitLayout;
          strip.appendChild(btn);
        }
        if (g === cg && active && docs.get(active)?.kind === 'canvas') {
          body.classList.add('gjs-st-wsg__body--canvas');
        }
        const activeDoc = active ? docs.get(active) : null;
        if (activeDoc && activeDoc.kind === 'element') {
          const pane = paneOf(activeDoc);
          body.appendChild(pane);
          toShow.push(activeDoc);
        }
        if (!active) {
          const hint = el('div', 'gjs-st-wsg__empty');
          hint.textContent = labels.dropHere;
          body.appendChild(hint);
        }
        group.append(strip, body);
        row.appendChild(group);
      }
      ws.appendChild(row);
    }
    // Element documents that are not shown stay in the document (hidden), so their state lives on.
    docs.forEach((d) => {
      if (d.kind === 'element' && d.pane && !d.pane.isConnected) {
        d.pane.hidden = true;
        stash.appendChild(d.pane);
      }
    });
    ws.appendChild(stash);
    toShow.forEach((d) => {
      d.pane!.hidden = false;
      if (!d.mounted) {
        d.mounted = true;
        try {
          d.mount?.(d.pane!);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[grapesjs-sidebar-tools] document "${d.id}" failed to mount`, err);
        }
      }
    });
    updateCanvas();
    toShow.forEach((d) => {
      try {
        d.onShow?.();
      } catch {
        // ignore
      }
    });
  }

  const stash = el('div', 'gjs-st-ws-stash');
  stash.hidden = true;

  /** Positions the canvas over its group (or hides it while that group shows another document). */
  function updateCanvas() {
    const cg = canvasGroup();
    const active = shown(cg);
    const visible = !!active && docs.get(active)?.kind === 'canvas';
    root.classList.toggle('gjs-st-canvas-off', !visible);
    const body = ws.querySelector<HTMLElement>(`.gjs-st-wsg[data-group="${cg}"] .gjs-st-wsg__body`);
    if (body) {
      const rr = root.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      if (br.width && br.height) {
        root.style.setProperty('--gjs-st-cv-x', `${Math.round(br.left - rr.left)}px`);
        root.style.setProperty('--gjs-st-cv-y', `${Math.round(br.top - rr.top)}px`);
        root.style.setProperty('--gjs-st-cv-w', `${Math.round(br.width)}px`);
        root.style.setProperty('--gjs-st-cv-h', `${Math.round(br.height)}px`);
      }
    }
    opts.onCanvasRect();
  }

  // ---- Changes -------------------------------------------------------------------------

  function save(live = false) {
    if (!live && Date.now() - startedAt > PRUNE_GRACE_MS) layout = pruneWs(layout, isOpen);
    opts.onChange(layout, { live });
  }

  function commitLayout(next: WsLayout, live = false) {
    if (destroyed) return;
    if (next === layout && !live) return;
    layout = next;
    if (live) applySizes();
    else render();
    save(live);
    if (!live) opts.onEvent('layout');
  }

  /** Grid ratios without re-rendering (while a splitter is dragged). */
  function applySizes() {
    const { cols, rows } = GRID_SHAPE[layout.grid];
    ws.querySelectorAll<HTMLElement>('.gjs-st-wsg-row').forEach((row, r) => {
      if (rows > 1) row.style.flex = r === 0 ? `0 0 ${layout.row * 100}%` : '1 1 0';
      row.querySelectorAll<HTMLElement>(':scope > .gjs-st-wsg').forEach((g, c) => {
        if (c < cols) g.style.flex = `${layout.cols[c]} 1 0`;
      });
    });
    updateCanvas();
  }

  /** Shows `id`; a canvas document that is not loaded yet is loaded (unless notify is false). */
  function activate(id: string, notify = true) {
    const doc = docs.get(id);
    if (!doc) return;
    const before = layout;
    layout = activateDoc(layout, id);
    const loadCanvas = doc.kind === 'canvas' && currentCanvas !== id;
    if (doc.kind === 'canvas') currentCanvas = id;
    if (layout !== before || loadCanvas) {
      render();
      save();
    }
    if (loadCanvas && notify) {
      try {
        doc.onActivate?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[grapesjs-sidebar-tools] document "${id}" failed to open`, err);
      }
    }
    opts.onEvent('activate', id);
  }

  /** After a close / move: if the canvas group now shows another canvas document, load it. */
  function followCanvas(notify = true) {
    const active = shown(canvasGroup());
    if (active && docs.get(active)?.kind === 'canvas' && active !== currentCanvas) {
      currentCanvas = active;
      if (notify) {
        try {
          docs.get(active)!.onActivate?.();
        } catch {
          // ignore
        }
      }
    }
  }

  function open(input: WorkspaceDocInput, o: OpenOptions = {}) {
    if (destroyed || !input || !input.id) return;
    const existing = docs.get(input.id);
    if (existing) {
      Object.assign(existing, { title: input.title ?? existing.title, icon: input.icon ?? existing.icon, tooltip: input.tooltip ?? existing.tooltip });
      if (o.activate !== false) activate(input.id, o.notify !== false);
      else render();
      return;
    }
    const doc: Doc = { ...input, kind: input.kind === 'canvas' ? 'canvas' : 'element', pane: null, mounted: false };
    docs.set(doc.id, doc);
    if (!findDoc(layout, doc.id)) {
      const group = doc.kind === 'canvas' ? canvasGroup() : o.group ?? layout.focus;
      layout = addDoc(layout, doc.id, group);
    } else if (doc.kind === 'canvas') {
      // A remembered canvas document in another group than the canvas: bring it to the canvas.
      const loc = findDoc(layout, doc.id)!;
      const cg = canvasGroupExcept(doc.id);
      if (cg != null && cg !== loc.group) layout = moveDoc(layout, doc.id, cg, layout.groups[cg].tabs.length);
    }
    opts.onEvent('open', doc.id);
    if (o.activate !== false) activate(doc.id, o.notify !== false);
    else {
      render();
      save();
    }
  }

  /** The group of the other canvas documents (null when there are none). */
  function canvasGroupExcept(id: string): number | null {
    for (const other of canvasIds()) {
      if (other === id) continue;
      const loc = findDoc(layout, other);
      if (loc) return loc.group;
    }
    return null;
  }

  function close(id: string, o: { force?: boolean; notify?: boolean } = {}): boolean {
    const doc = docs.get(id);
    if (!doc) return false;
    if (!o.force) {
      if (doc.closable === false) return false;
      if (doc.kind === 'canvas' && canvasIds().length <= 1) return false;
      try {
        if (doc.onClose?.() === false) return false;
      } catch {
        // ignore
      }
    }
    docs.delete(id);
    layout = removeDoc(layout, id, isOpen);
    doc.pane?.remove();
    if (currentCanvas === id) currentCanvas = null;
    render();
    followCanvas(o.notify !== false);
    save();
    try {
      doc.onClosed?.();
    } catch {
      // ignore
    }
    opts.onEvent('close', id);
    return true;
  }

  function moveTo(id: string, group: number, index: number) {
    const next = moveDoc(layout, id, group, index, canvasIds());
    if (next === layout) return;
    layout = next;
    const doc = docs.get(id);
    if (doc?.kind === 'canvas' && currentCanvas !== id) {
      currentCanvas = id;
      render();
      save();
      try {
        doc.onActivate?.();
      } catch {
        // ignore
      }
    } else {
      render();
      followCanvas();
      save();
    }
    opts.onEvent('layout');
  }

  // ---- Interaction ---------------------------------------------------------------------

  let drag: {
    id: string;
    pointerId: number;
    x: number;
    y: number;
    source: HTMLElement;
    started: boolean;
    ghost?: HTMLElement;
    indicator?: HTMLElement;
    target?: { group: number; index: number } | null;
  } | null = null;

  function hit(x: number, y: number): { group: number; index: number; box: DOMRect; line: boolean } | null {
    const groups = Array.from(ws.querySelectorAll<HTMLElement>('.gjs-st-wsg'));
    for (const g of groups) {
      const r = g.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const group = Number(g.getAttribute('data-group'));
      const strip = g.querySelector<HTMLElement>('.gjs-st-wsg__tabs')!;
      const sr = strip.getBoundingClientRect();
      const tabs = Array.from(strip.querySelectorAll<HTMLElement>('.gjs-st-wtab'));
      if (y <= sr.bottom) {
        let index = 0;
        let lineX = sr.left + 2;
        tabs.forEach((t, i) => {
          const tr = t.getBoundingClientRect();
          if (x > tr.left + tr.width / 2) {
            index = i + 1;
            lineX = tr.right;
          } else if (i === index) lineX = tr.left;
        });
        // the index counts tabs of open documents only; translate to the layout's index
        const ids = tabs.map((t) => t.getAttribute('data-doc')!);
        const layoutIndex = index < ids.length ? layout.groups[group].tabs.indexOf(ids[index]) : layout.groups[group].tabs.length;
        return { group, index: layoutIndex, box: new DOMRect(lineX - 1, sr.top + 3, 3, Math.max(sr.height - 6, 8)), line: true };
      }
      return { group, index: layout.groups[group].tabs.length, box: r, line: false };
    }
    return null;
  }

  function endDrag(apply: boolean) {
    const d = drag;
    drag = null;
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onCancel, true);
    document.removeEventListener('keydown', onKey, true);
    if (!d) return;
    d.ghost?.remove();
    d.indicator?.remove();
    root.classList.remove('gjs-st-ws-dragging');
    if (!d.started) {
      if (apply) activate(d.id);
      return;
    }
    if (apply && d.target) moveTo(d.id, d.target.group, d.target.index);
  }

  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD) return;
      drag.started = true;
      root.classList.add('gjs-st-ws-dragging');
      drag.ghost = drag.source.cloneNode(true) as HTMLElement;
      drag.ghost.classList.add('gjs-st-ghost');
      document.body.appendChild(drag.ghost);
      drag.indicator = el('div', 'gjs-st-indicator');
      document.body.appendChild(drag.indicator);
    }
    e.preventDefault();
    drag.ghost!.style.left = `${e.clientX + 8}px`;
    drag.ghost!.style.top = `${e.clientY + 8}px`;
    const h = hit(e.clientX, e.clientY);
    drag.target = h ? { group: h.group, index: h.index } : null;
    const ind = drag.indicator!;
    ind.hidden = !h;
    if (h) {
      ind.classList.toggle('gjs-st-indicator--line', h.line);
      ind.style.left = `${h.box.left}px`;
      ind.style.top = `${h.box.top}px`;
      ind.style.width = `${h.box.width}px`;
      ind.style.height = `${h.box.height}px`;
    }
  }
  const onUp = (e: PointerEvent) => drag && e.pointerId === drag.pointerId && endDrag(true);
  const onCancel = (e: PointerEvent) => drag && e.pointerId === drag.pointerId && endDrag(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drag) {
      e.preventDefault();
      e.stopPropagation();
      endDrag(false);
    }
  };

  function onPointerDown(e: PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.closest?.('[data-close]') || target.closest?.('[data-layout-menu]')) return;
    const tab = target.closest?.('.gjs-st-wtab') as HTMLElement | null;
    if (!tab || !ws.contains(tab) || drag) return;
    if (e.button === 1) {
      // middle click closes, like in browsers
      e.preventDefault();
      close(tab.getAttribute('data-doc')!);
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    drag = { id: tab.getAttribute('data-doc')!, pointerId: e.pointerId, x: e.clientX, y: e.clientY, source: tab, started: false };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('keydown', onKey, true);
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const closeBtn = target.closest?.('[data-close]');
    if (closeBtn && ws.contains(closeBtn)) {
      e.preventDefault();
      close(closeBtn.getAttribute('data-close')!);
      return;
    }
    const layoutBtn = target.closest?.('[data-layout-menu]') as HTMLElement | null;
    if (layoutBtn && ws.contains(layoutBtn)) {
      e.preventDefault();
      toggleMenu(layoutBtn);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const layoutBtn = target.closest?.('[data-layout-menu]') as HTMLElement | null;
    if (layoutBtn && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggleMenu(layoutBtn);
      return;
    }
    const tab = target.closest?.('.gjs-st-wtab') as HTMLElement | null;
    if (!tab || !ws.contains(tab)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(tab.getAttribute('data-doc')!);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      close(tab.getAttribute('data-doc')!);
    }
  }

  ws.addEventListener('pointerdown', onPointerDown);
  ws.addEventListener('click', onClick);
  ws.addEventListener('keydown', onKeyDown);

  // ---- Layout menu ------------------------------------------------------------------------

  function closeMenu() {
    menu?.remove();
    menu = null;
    document.removeEventListener('pointerdown', onOutside, true);
  }
  const onOutside = (e: Event) => {
    if (menu && !menu.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('[data-layout-menu]')) closeMenu();
  };

  function toggleMenu(anchor: HTMLElement) {
    if (menu) return closeMenu();
    const labels = opts.getLabels();
    menu = el('div', 'gjs-st-wsmenu gjs-one-bg gjs-two-color');
    menu.setAttribute('role', 'menu');
    WS_GRIDS.forEach((grid) => {
      const item = el('button', `gjs-st-wsmenu__item${grid === layout.grid ? ' gjs-st-wsmenu__item--active gjs-four-color' : ''}`);
      item.type = 'button';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(grid === layout.grid));
      item.setAttribute('data-grid', grid);
      item.innerHTML = GRID_ICONS[grid];
      const text = el('span', '');
      text.textContent = labels[GRID_LABEL[grid]];
      item.appendChild(text);
      item.addEventListener('click', () => {
        closeMenu();
        commitLayout(setGrid(layout, grid));
        followCanvas();
      });
      menu!.appendChild(item);
    });
    root.appendChild(menu);
    const rr = root.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(ar.bottom - rr.top + 2)}px`;
    menu.style.right = `${Math.max(0, Math.round(rr.right - ar.right))}px`;
    (menu.querySelector('button') as HTMLElement | null)?.focus();
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenu();
        anchor.focus();
      }
    });
    document.addEventListener('pointerdown', onOutside, true);
  }

  // ---- Splitters -------------------------------------------------------------------------

  function track(e: PointerEvent, handle: HTMLElement, move: (ev: PointerEvent) => void) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    root.classList.add('gjs-st-resizing');
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      root.classList.remove('gjs-st-resizing');
      save();
      opts.onEvent('layout');
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function startColResize(e: PointerEvent, i: number, handle: HTMLElement) {
    const row = handle.parentElement!;
    track(e, handle, (ev) => {
      const r = row.getBoundingClientRect();
      if (!r.width) return;
      const cols = layout.cols.slice();
      const before = cols.slice(0, i).reduce((a, b) => a + b, 0);
      const pair = cols[i] + cols[i + 1];
      const x = (ev.clientX - r.left) / r.width - before;
      const a = Math.min(pair - 0.1, Math.max(0.1, x));
      cols[i] = a;
      cols[i + 1] = pair - a;
      layout = setCols(layout, cols);
      applySizes();
      opts.onChange(layout, { live: true });
    });
  }

  function startRowResize(e: PointerEvent, handle: HTMLElement) {
    track(e, handle, (ev) => {
      const r = ws.getBoundingClientRect();
      if (!r.height) return;
      layout = setRow(layout, (ev.clientY - r.top) / r.height);
      applySizes();
      opts.onChange(layout, { live: true });
    });
  }

  // Keep the default canvas tab's title in step with the GrapesJS page.
  const onPage = () => {
    const d = docs.get(DEFAULT_CANVAS_ID);
    const name = pageName();
    if (d && name && d.title !== name) {
      d.title = name;
      render();
    }
  };
  ed.on?.('page:select page:update', onPage);
  offs.push(() => ed.off?.('page:select page:update', onPage));

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => updateCanvas());
    ro.observe(ws);
  }

  render();

  const api: WorkspaceApi = {
    open,
    update(id, patch) {
      const doc = docs.get(id);
      if (!doc) return;
      Object.assign(doc, patch);
      render();
    },
    activate: (id, o = {}) => activate(id, o.notify !== false),
    close,
    has: isOpen,
    list: () =>
      Array.from(docs.values()).map((d) => {
        const loc = findDoc(layout, d.id);
        return { id: d.id, kind: d.kind, title: d.title, group: loc?.group ?? 0, active: !!loc && shown(loc.group) === d.id };
      }),
    remembered: (prefix) => layout.groups.flatMap((g) => g.tabs).filter((id) => id.startsWith(prefix) && !docs.has(id)),
    canvasDoc: () => currentCanvas,
    getGrid: () => layout.grid,
    setGrid: (grid) => {
      if (!WS_GRIDS.includes(grid)) return;
      commitLayout(setGrid(layout, grid));
      followCanvas();
    },
  };

  return {
    api,
    get layout() {
      return layout;
    },
    relayout: updateCanvas,
    updateLabels() {
      const d = docs.get(DEFAULT_CANVAS_ID);
      if (d && !pageName()) d.title = opts.getLabels().canvas;
      render();
    },
    destroy() {
      if (destroyed) return;
      endDrag(false);
      closeMenu();
      destroyed = true;
      ro?.disconnect();
      offs.splice(0).forEach((f) => f());
      ws.removeEventListener('pointerdown', onPointerDown);
      ws.removeEventListener('click', onClick);
      ws.removeEventListener('keydown', onKeyDown);
      docs.forEach((d) => {
        try {
          d.onClosed?.();
        } catch {
          // ignore
        }
      });
      docs.clear();
      ws.remove();
      root.classList.remove('gjs-st-ws-on', 'gjs-st-canvas-off', 'gjs-st-ws-dragging');
      ['--gjs-st-cv-x', '--gjs-st-cv-y', '--gjs-st-cv-w', '--gjs-st-cv-h'].forEach((v) => root.style.removeProperty(v));
    },
  };
}
