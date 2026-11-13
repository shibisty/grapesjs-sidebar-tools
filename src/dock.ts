/**
 * The dock UI: three zones around the canvas (left, right, bottom), each
 * with tab groups. Left/right hold up to two groups one above the other
 * (with a resizer between them), bottom holds one. Tabs are dragged
 * between groups and zones with the pointer; zones are resized by their
 * inner edge.
 *
 * The dock only renders a `DockLayout` (see layout.ts) and reports
 * changes; the pane of every tab (with the real Style Manager, Layer
 * Manager, ... inside) is created once by the view controller and only
 * moved between groups, never re-rendered.
 */
import { hitTest, type EmptyZoneBox, type GroupBoxes, type Hit } from './dnd';
import {
  activateTab,
  findTab,
  isValidTarget,
  moveTab,
  setZoneCollapsed,
  setZoneRatio,
  setZoneSize,
  type DropTarget,
} from './layout';
import type { DockLayout, SidebarToolsLabels, ZoneId } from './types';
import { ZONES } from './types';
import type { ViewInfo } from './views';

export const CLS = {
  root: 'gjs-st-docked',
  dragging: 'gjs-st-dragging',
  resizing: 'gjs-st-resizing',
  zone: 'gjs-st-zone',
  zoneEmpty: 'gjs-st-zone--empty',
  zoneSplit: 'gjs-st-zone--split',
  zoneCollapsed: 'gjs-st-zone--collapsed',
  rail: 'gjs-st-rail',
  stash: 'gjs-st-stash',
  collapse: 'gjs-st-collapse',
  group: 'gjs-st-group',
  tabs: 'gjs-st-tabs',
  tab: 'gjs-st-tab',
  tabActive: 'gjs-st-tab--active',
  body: 'gjs-st-body',
  pane: 'gjs-st-pane',
  split: 'gjs-st-split',
  edge: 'gjs-st-edge',
  drop: 'gjs-st-drop',
  ghost: 'gjs-st-ghost',
  indicator: 'gjs-st-indicator',
} as const;

/** CSS variables set on the editor root with the zone sizes (px). */
export const VARS: Record<ZoneId, string> = {
  left: '--gjs-st-left',
  right: '--gjs-st-right',
  bottom: '--gjs-st-bottom',
};

/** Size of a collapsed zone (the rail with the tab icons), px. */
export const RAIL_SIZE = { side: 40, bottom: 36 };

/** Chevron used by the collapse / expand buttons (rotated by CSS per zone). */
const CHEVRON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/></svg>';

/** The canvas never gets smaller than this because of the zones (px, includes the top bar). */
export const MIN_CANVAS = { width: 320, height: 240 };

/** Pointer travel (px) before a press on a tab becomes a drag. */
export const DRAG_THRESHOLD = 5;

export interface DockOptions {
  /** The editor root (`.gjs-editor`). */
  root: HTMLElement;
  layout: DockLayout;
  getPane(id: string): HTMLElement | null;
  getInfo(id: string): ViewInfo | undefined;
  getLabels(): SidebarToolsLabels;
  isRtl?(): boolean;
  defaultSizes: Record<ZoneId, number | null>;
  minSize: { side: number; bottom: number };
  minRatio: number;
  maxRatio: number;
  /**
   * Called after every change made by the user (or through the API).
   * `live` is true while a resizer is being dragged (don't persist yet).
   */
  onChange(layout: DockLayout, info: { reason: 'move' | 'activate' | 'size' | 'ratio' | 'set' | 'collapse'; live?: boolean }): void;
}

export interface Dock {
  readonly layout: DockLayout;
  setLayout(layout: DockLayout): void;
  /** Shows `id` in its group. */
  activate(id: string): void;
  /** Re-reads the labels (locale change). */
  updateLabels(): void;
  /** Zone sizes in px as currently applied (0 = empty zone). */
  appliedSizes(): Record<ZoneId, number>;
  /** Collapses / expands a zone (`collapsed` undefined = toggle). */
  setCollapsed(zone: ZoneId, collapsed?: boolean): void;
  /** Re-applies the sizes (e.g. after the editor was resized). */
  applySizes(): void;
  /** Applies a drop as if the user dropped `id` on `target`. */
  drop(id: string, target: DropTarget): boolean;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function box(node: Element) {
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function createDock(opts: DockOptions): Dock {
  const { root } = opts;
  let layout = opts.layout;
  let destroyed = false;
  const zoneEls = {} as Record<ZoneId, HTMLElement>;
  const dropEls = {} as Record<ZoneId, HTMLElement>;
  const applied: Record<ZoneId, number> = { left: 0, right: 0, bottom: 0 };
  const cleanups: Array<() => void> = [];

  root.classList.add(CLS.root);

  ZONES.forEach((zone) => {
    const z = el('div', `${CLS.zone} ${CLS.zone}--${zone} gjs-one-bg gjs-two-color`);
    z.setAttribute('data-zone', zone);
    root.appendChild(z);
    zoneEls[zone] = z;

    // Shown only while a tab is dragged and the zone is empty.
    const drop = el('div', `${CLS.drop} ${CLS.drop}--${zone}`);
    drop.setAttribute('data-zone', zone);
    root.appendChild(drop);
    dropEls[zone] = drop;
  });

  // ---- Sizes -------------------------------------------------------------------

  function rootSize() {
    const r = root.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }

  /** Wanted size of a zone, before fitting it next to the others (0 when it has no groups). */
  function wantedSize(zone: ZoneId, width: number): number {
    if (!layout[zone].groups.length) return 0;
    const side = zone !== 'bottom';
    if (layout[zone].collapsed) return side ? RAIL_SIZE.side : RAIL_SIZE.bottom;
    const min = side ? opts.minSize.side : opts.minSize.bottom;
    let size = layout[zone].size ?? opts.defaultSizes[zone] ?? null;
    if (size == null) size = side && width ? Math.round(width * 0.15) : min;
    return Math.max(Math.round(size), min);
  }

  /**
   * Zone sizes that leave the canvas at least MIN_CANVAS px; the side
   * zones shrink proportionally (not below their minimum). Without a
   * layout (width/height 0, e.g. jsdom) the wanted sizes are used as is.
   */
  function computeSizes(): Record<ZoneId, number> {
    const { width, height } = rootSize();
    const out = {} as Record<ZoneId, number>;
    ZONES.forEach((zone) => (out[zone] = wantedSize(zone, width)));
    if (width) {
      const room = width - MIN_CANVAS.width;
      const total = out.left + out.right;
      if (total > room) {
        const minOf = (zone: ZoneId) => (layout[zone].collapsed ? RAIL_SIZE.side : opts.minSize.side);
        const shrink = (zone: ZoneId) =>
          out[zone] && !layout[zone].collapsed
            ? Math.max(minOf(zone), Math.floor((out[zone] * Math.max(room, 0)) / total))
            : out[zone];
        out.left = shrink('left');
        out.right = shrink('right');
        // A zone stuck at its minimum: the other one gives up the rest.
        const excess = out.left + out.right - room;
        if (excess > 0) {
          const big: ZoneId = out.left >= out.right ? 'left' : 'right';
          out[big] = Math.max(minOf(big), out[big] - excess);
        }
      }
    }
    if (height && out.bottom) {
      const room = height - MIN_CANVAS.height;
      if (out.bottom > room) out.bottom = Math.max(opts.minSize.bottom, room);
    }
    return out;
  }

  function applySizes() {
    const sizes = computeSizes();
    ZONES.forEach((zone) => {
      applied[zone] = sizes[zone];
      root.style.setProperty(VARS[zone], `${applied[zone]}px`);
      zoneEls[zone].classList.toggle(CLS.zoneEmpty, !layout[zone].groups.length);
      zoneEls[zone].classList.toggle(CLS.zoneCollapsed, !!layout[zone].collapsed && !!layout[zone].groups.length);
      const ratio = clamp(layout[zone].ratio, opts.minRatio, opts.maxRatio);
      zoneEls[zone].style.setProperty('--gjs-st-ratio', `${ratio * 100}%`);
    });
  }

  // ---- Rendering ---------------------------------------------------------------

  function renderTab(id: string, active: boolean): HTMLElement {
    const info = opts.getInfo(id);
    // Same classes as the original GrapesJS panel button, so icons look the same.
    const tab = el('span', `gjs-pn-btn ${CLS.tab} ${info?.className || ''}`.trim());
    if (info?.label) tab.innerHTML = info.label; // trusted: the button config of the editor/plugins
    tab.setAttribute('data-tab', id);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('tabindex', active ? '0' : '-1');
    tab.setAttribute('aria-selected', String(active));
    tab.title = info?.title || id;
    if (active) tab.classList.add(CLS.tabActive, 'gjs-pn-active', 'gjs-four-color');
    return tab;
  }

  function collapseButton(zone: ZoneId, collapsed: boolean, labels: SidebarToolsLabels): HTMLElement {
    const btn = el('span', `gjs-pn-btn ${CLS.collapse} ${CLS.collapse}--${zone}${collapsed ? ` ${CLS.collapse}--expand` : ''}`);
    btn.innerHTML = CHEVRON;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('data-collapse', zone);
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.title = collapsed ? labels.expand : labels.collapse;
    return btn;
  }

  /** A collapsed zone: the expand button and the icons of all its tabs. */
  function renderRail(zone: ZoneId, z: HTMLElement, labels: SidebarToolsLabels) {
    const rail = el('div', `${CLS.rail} gjs-pn-buttons`);
    rail.setAttribute('role', 'tablist');
    rail.appendChild(collapseButton(zone, true, labels));
    const stash = el('div', CLS.stash);
    stash.hidden = true;
    layout[zone].groups.forEach((g) =>
      g.tabs.forEach((id) => {
        rail.appendChild(renderTab(id, false));
        const pane = opts.getPane(id);
        if (pane) stash.appendChild(pane); // keep the content in the document
      }),
    );
    z.appendChild(rail);
    z.appendChild(stash);
  }

  function render() {
    if (destroyed) return;
    const labels = opts.getLabels();
    ZONES.forEach((zone) => {
      const z = zoneEls[zone];
      // Keep the panes: move them out before clearing the zone.
      z.querySelectorAll<HTMLElement>(`.${CLS.pane}`).forEach((p) => p.remove());
      z.textContent = '';
      const groups = layout[zone].groups;
      const collapsed = !!layout[zone].collapsed && groups.length > 0;
      z.classList.toggle(CLS.zoneSplit, groups.length > 1 && !collapsed);

      dropEls[zone].textContent = '';
      const hint = el('span', `${CLS.drop}__label`);
      hint.textContent = labels.dropHere;
      dropEls[zone].appendChild(hint);

      if (collapsed) {
        renderRail(zone, z, labels);
        return;
      }

      groups.forEach((g, gi) => {
        if (gi > 0) {
          const split = el('div', CLS.split);
          split.setAttribute('role', 'separator');
          split.setAttribute('aria-orientation', 'horizontal');
          split.title = labels.resizerTitle;
          split.addEventListener('pointerdown', (e) => startSplitResize(e, zone, split));
          split.addEventListener('dblclick', () => commit(setZoneRatio(layout, zone, 0.5), 'ratio'));
          z.appendChild(split);
        }
        const group = el('div', `${CLS.group} ${CLS.group}--${gi === 0 ? 'first' : 'second'}`);
        group.setAttribute('data-group', String(gi));
        const bar = el('div', `${CLS.tabs} gjs-pn-buttons`);
        bar.setAttribute('role', 'tablist');
        const body = el('div', CLS.body);
        g.tabs.forEach((id) => {
          const active = g.active === id;
          bar.appendChild(renderTab(id, active));
          const pane = opts.getPane(id);
          if (pane) {
            pane.hidden = !active;
            body.appendChild(pane);
          }
        });
        if (gi === 0) {
          // The collapse button: outer end of the first tab bar.
          const btn = collapseButton(zone, false, labels);
          if (zone === 'right') bar.insertBefore(btn, bar.firstChild);
          else bar.appendChild(btn);
        }
        group.appendChild(bar);
        group.appendChild(body);
        z.appendChild(group);
      });

      const edge = el('div', `${CLS.edge} ${CLS.edge}--${zone}`);
      edge.setAttribute('role', 'separator');
      edge.setAttribute('aria-orientation', zone === 'bottom' ? 'horizontal' : 'vertical');
      edge.title = labels.zoneResizerTitle;
      edge.addEventListener('pointerdown', (e) => startZoneResize(e, zone, edge));
      edge.addEventListener('dblclick', () => commit(setZoneSize(layout, zone, null), 'size'));
      z.appendChild(edge);
    });
    applySizes();
  }

  function commit(next: DockLayout, reason: 'move' | 'activate' | 'size' | 'ratio' | 'set' | 'collapse', live = false) {
    if (destroyed) return;
    if (next === layout && !live) return;
    layout = next;
    if (reason === 'size' || reason === 'ratio') applySizes();
    else render();
    opts.onChange(layout, { reason, live });
  }

  /** Shows `id` in its group, expanding its zone when it is collapsed. */
  function activate(id: string) {
    let next = activateTab(layout, id);
    const loc = findTab(next, id);
    if (loc && next[loc.zone].collapsed) next = setZoneCollapsed(next, loc.zone, false);
    commit(next, 'activate');
  }

  function setCollapsed(zone: ZoneId, collapsed?: boolean) {
    commit(setZoneCollapsed(layout, zone, collapsed), 'collapse');
  }

  // ---- Tabs: click / keyboard / drag ----------------------------------------------

  let drag: {
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    source: HTMLElement;
    started: boolean;
    ghost?: HTMLElement;
    indicator?: HTMLElement;
    groups?: GroupBoxes[];
    empty?: EmptyZoneBox[];
    hit?: Hit | null;
  } | null = null;

  function measure() {
    const groups: GroupBoxes[] = [];
    const empty: EmptyZoneBox[] = [];
    ZONES.forEach((zone) => {
      const z = zoneEls[zone];
      const groupEls = Array.from(z.querySelectorAll<HTMLElement>(`:scope > .${CLS.group}`));
      groupEls.forEach((g, gi) => {
        const bar = g.querySelector<HTMLElement>(`.${CLS.tabs}`)!;
        const body = g.querySelector<HTMLElement>(`.${CLS.body}`)!;
        groups.push({
          zone,
          group: gi,
          groupCount: groupEls.length,
          tabBar: box(bar),
          tabs: Array.from(bar.querySelectorAll(`.${CLS.tab}`)).map(box),
          body: box(body),
        });
      });
      const rail = z.querySelector<HTMLElement>(`:scope > .${CLS.rail}`);
      if (rail && layout[zone].groups.length) {
        empty.push({ zone, box: box(rail), join: { group: 0, index: layout[zone].groups[0].tabs.length } });
      } else if (!groupEls.length) empty.push({ zone, box: box(dropEls[zone]) });
    });
    return { groups, empty };
  }

  function startDrag() {
    if (!drag) return;
    drag.started = true;
    root.classList.add(CLS.dragging);
    const ghost = drag.source.cloneNode(true) as HTMLElement;
    ghost.className = `${drag.source.className} ${CLS.ghost}`;
    ghost.removeAttribute('tabindex');
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    const indicator = el('div', CLS.indicator);
    indicator.hidden = true;
    document.body.appendChild(indicator);
    drag.indicator = indicator;
    const { groups, empty } = measure();
    drag.groups = groups;
    drag.empty = empty;
  }

  function moveDrag(x: number, y: number) {
    if (!drag || !drag.started) return;
    if (drag.ghost) {
      drag.ghost.style.left = `${x + 8}px`;
      drag.ghost.style.top = `${y + 8}px`;
    }
    let hit = hitTest(x, y, drag.groups || [], drag.empty || [], opts.isRtl?.() ?? false);
    if (hit && !isValidTarget(layout, hit.target)) hit = null;
    drag.hit = hit;
    const ind = drag.indicator!;
    ind.hidden = !hit;
    if (hit) {
      ind.style.left = `${hit.indicator.left}px`;
      ind.style.top = `${hit.indicator.top}px`;
      ind.style.width = `${hit.indicator.width}px`;
      ind.style.height = `${hit.indicator.height}px`;
      ind.classList.toggle(`${CLS.indicator}--line`, hit.target.kind === 'tabs' && hit.indicator.width <= 4);
    }
  }

  function endDrag(apply: boolean) {
    const current = drag;
    drag = null;
    document.removeEventListener('pointermove', onDocMove, true);
    document.removeEventListener('pointerup', onDocUp, true);
    document.removeEventListener('pointercancel', onDocCancel, true);
    document.removeEventListener('keydown', onDocKey, true);
    if (!current) return;
    current.ghost?.remove();
    current.indicator?.remove();
    root.classList.remove(CLS.dragging);
    if (!current.started) {
      if (apply) activate(current.id);
      return;
    }
    if (apply && current.hit) dropTab(current.id, current.hit.target);
  }

  function onDocMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      startDrag();
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }
  function onDocUp(e: PointerEvent) {
    if (drag && e.pointerId === drag.pointerId) endDrag(true);
  }
  function onDocCancel(e: PointerEvent) {
    if (drag && e.pointerId === drag.pointerId) endDrag(false);
  }
  function onDocKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && drag) {
      e.preventDefault();
      e.stopPropagation();
      endDrag(false);
    }
  }

  function onPointerDown(e: PointerEvent) {
    const tab = (e.target as HTMLElement).closest?.(`.${CLS.tab}`) as HTMLElement | null;
    if (!tab || !root.contains(tab) || drag) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    drag = {
      id: tab.getAttribute('data-tab')!,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      source: tab,
      started: false,
    };
    document.addEventListener('pointermove', onDocMove, true);
    document.addEventListener('pointerup', onDocUp, true);
    document.addEventListener('pointercancel', onDocCancel, true);
    document.addEventListener('keydown', onDocKey, true);
  }

  function onClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest?.('[data-collapse]') as HTMLElement | null;
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    setCollapsed(btn.getAttribute('data-collapse') as ZoneId);
  }

  function onKeyDown(e: KeyboardEvent) {
    const collapseBtn = (e.target as HTMLElement).closest?.('[data-collapse]') as HTMLElement | null;
    if (collapseBtn && root.contains(collapseBtn) && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setCollapsed(collapseBtn.getAttribute('data-collapse') as ZoneId);
      return;
    }
    const tab = (e.target as HTMLElement).closest?.(`.${CLS.tab}`) as HTMLElement | null;
    if (!tab || !root.contains(tab)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(tab.getAttribute('data-tab')!);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const tabs = Array.from(tab.parentElement!.querySelectorAll<HTMLElement>(`.${CLS.tab}`));
      const i = tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = tabs[(i + tabs.length) % tabs.length];
      if (next) {
        e.preventDefault();
        activate(next.getAttribute('data-tab')!);
        const id = next.getAttribute('data-tab');
        Array.from(root.querySelectorAll<HTMLElement>(`.${CLS.tab}`))
          .find((t) => t.getAttribute('data-tab') === id)
          ?.focus();
      }
    }
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('click', onClick);
  cleanups.push(() => {
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('click', onClick);
  });

  function dropTab(id: string, target: DropTarget): boolean {
    if (!isValidTarget(layout, target)) return false;
    let next = moveTab(layout, id, target);
    if (next === layout) return false;
    // Dropped on a collapsed zone (its rail): show it.
    if (next[target.zone].collapsed) next = setZoneCollapsed(next, target.zone, false);
    commit(next, 'move');
    return true;
  }

  // ---- Resizers ---------------------------------------------------------------

  function trackPointer(
    e: PointerEvent,
    handle: HTMLElement,
    onMove: (ev: PointerEvent) => void,
    onEnd: () => void,
  ) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const pid = e.pointerId;
    try {
      handle.setPointerCapture(pid);
    } catch {
      // ignore
    }
    root.classList.add(CLS.resizing);
    const move = (ev: PointerEvent) => onMove(ev);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      try {
        handle.releasePointerCapture(pid);
      } catch {
        // ignore
      }
      root.classList.remove(CLS.resizing);
      onEnd();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function startZoneResize(e: PointerEvent, zone: ZoneId, handle: HTMLElement) {
    const r = root.getBoundingClientRect();
    trackPointer(
      e,
      handle,
      (ev) => {
        let size: number;
        if (zone === 'left') size = ev.clientX - r.left;
        else if (zone === 'right') size = r.right - ev.clientX;
        else size = r.bottom - ev.clientY;
        layout = setZoneSize(layout, zone, Math.round(size));
        applySizes();
        // clamped value, so the stored size is what is shown
        layout = setZoneSize(layout, zone, applied[zone]);
        opts.onChange(layout, { reason: 'size', live: true });
      },
      () => opts.onChange(layout, { reason: 'size' }),
    );
  }

  function startSplitResize(e: PointerEvent, zone: ZoneId, handle: HTMLElement) {
    const z = zoneEls[zone];
    trackPointer(
      e,
      handle,
      (ev) => {
        const r = z.getBoundingClientRect();
        if (!r.height) return;
        const ratio = clamp((ev.clientY - r.top) / r.height, opts.minRatio, opts.maxRatio);
        layout = setZoneRatio(layout, zone, ratio);
        applySizes();
        opts.onChange(layout, { reason: 'ratio', live: true });
      },
      () => opts.onChange(layout, { reason: 'ratio' }),
    );
  }

  render();

  return {
    get layout() {
      return layout;
    },
    setLayout(next) {
      layout = next;
      render();
    },
    activate,
    setCollapsed,
    updateLabels: render,
    appliedSizes: () => ({ ...applied }),
    applySizes,
    drop: dropTab,
    destroy() {
      if (destroyed) return;
      endDrag(false);
      destroyed = true;
      cleanups.splice(0).forEach((fn) => fn());
      ZONES.forEach((zone) => {
        zoneEls[zone].querySelectorAll<HTMLElement>(`.${CLS.pane}`).forEach((p) => p.remove());
        zoneEls[zone].remove();
        dropEls[zone].remove();
        root.style.removeProperty(VARS[zone]);
      });
      root.classList.remove(CLS.root, CLS.dragging, CLS.resizing);
    },
  };
}
