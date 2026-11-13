/**
 * Device toolbar above the canvas (like "Toggle device toolbar" in the
 * browser dev tools): device presets from the Device Manager, a free-size
 * "Responsive" device with width × height inputs, rotate, and zoom (fit or
 * a fixed level, Ctrl + wheel over the canvas).
 *
 * Zoom uses GrapesJS' own canvas zoom (`Canvas.setZoom`), so the
 * highlighter, toolbar and drag & drop keep working; the plugin only makes
 * the zoomed frames area fill the canvas (transform-origin at the top-left
 * corner and a size of 100% / zoom), so e.g. "Desktop at 50%" shows a page
 * twice as wide as the canvas.
 */
import type { Editor } from 'grapesjs';
import type { SidebarToolsLabels } from './types';

export const RESPONSIVE_ID = 'gjs-st-responsive';
export type DeviceKind = 'desktop' | 'tablet' | 'mobile';
export type ZoomMode = 'fit' | number;

export const DEFAULT_ZOOM_LEVELS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
export const DEVBAR_HEIGHT = 34;
const MIN_ZOOM = 0.1;

export interface DeviceState {
  /** Selected device id (null = whatever the editor has). */
  device: string | null;
  responsive: { width: number; height: number | null };
  zoom: ZoomMode;
}

export function defaultDeviceState(): DeviceState {
  return { device: null, responsive: { width: 1280, height: null }, zoom: 'fit' };
}

export function sanitizeDeviceState(raw: unknown): DeviceState {
  const state = defaultDeviceState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
  const r = raw as Record<string, any>;
  if (typeof r.device === 'string' && r.device) state.device = r.device;
  const w = Number(r.responsive?.width);
  const h = r.responsive?.height == null ? null : Number(r.responsive.height);
  if (isFinite(w) && w >= 50 && w <= 10000) state.responsive.width = Math.round(w);
  if (h === null || (isFinite(h) && h >= 50 && h <= 10000)) state.responsive.height = h === null ? null : Math.round(h);
  if (r.zoom === 'fit') state.zoom = 'fit';
  else if (typeof r.zoom === 'number' && isFinite(r.zoom) && r.zoom >= 10 && r.zoom <= 400) state.zoom = r.zoom;
  return state;
}

// ---- Device helpers (pure) -------------------------------------------------------

export interface DeviceLike {
  id: string;
  get(key: string): any;
}

export function px(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(value);
  return m ? parseFloat(m[1]) : null;
}

export function deviceName(d: DeviceLike): string {
  return String(d.get('name') || d.id);
}

/** desktop / tablet / mobile from the id or the name. */
export function deviceKind(d: DeviceLike): DeviceKind | null {
  const text = `${d.id} ${d.get('name') || ''}`.toLowerCase();
  if (/mobile|phone|smartphone/.test(text)) return 'mobile';
  if (/tablet|ipad/.test(text)) return 'tablet';
  if (/desktop|pc\b|laptop/.test(text)) return 'desktop';
  return null;
}

/**
 * The device a "desktop / tablet / mobile" button means: by id/name first
 * (`Mobile portrait` from preset-webpage matches a device called `mobile`),
 * then by width (desktop = no width or the widest, mobile = the narrowest).
 */
export function findDeviceForKind(devices: DeviceLike[], kind: DeviceKind): DeviceLike | null {
  const own = devices.filter((d) => d.id !== RESPONSIVE_ID);
  const byName = own.find((d) => deviceKind(d) === kind);
  if (byName) return byName;
  if (!own.length) return null;
  const w = (d: DeviceLike) => px(d.get('width')) ?? Infinity;
  const sorted = own.slice().sort((a, b) => w(b) - w(a));
  if (kind === 'desktop') return sorted[0];
  if (kind === 'mobile') return sorted[sorted.length - 1];
  const fixed = sorted.filter((d) => isFinite(w(d)));
  return fixed.sort((a, b) => Math.abs(w(a) - 768) - Math.abs(w(b) - 768))[0] || sorted[0];
}

/**
 * The `widthMedia` that applies at `width`: the smallest max-width media of
 * the devices that is >= width ('' = no media query, desktop styles). Used
 * for the responsive device, so styles edited at e.g. 600px go to the same
 * media query as the 375px mobile device (when that one is max-width 767px).
 */
export function mediaForWidth(devices: DeviceLike[], width: number): string {
  let best: number | null = null;
  devices.forEach((d) => {
    if (d.id === RESPONSIVE_ID) return;
    const m = px(d.get('widthMedia'));
    if (m != null && m >= width && (best == null || m < best)) best = m;
  });
  return best == null ? '' : `${best}px`;
}

/** Zoom (decimal) that fits a device of deviceW × deviceH into the canvas; 1 when it already fits. */
export function fitZoom(canvasW: number, canvasH: number, deviceW: number | null, deviceH: number | null): number {
  if (!canvasW || !canvasH) return 1;
  let z = 1;
  if (deviceW) z = Math.min(z, canvasW / deviceW);
  if (deviceH) z = Math.min(z, canvasH / deviceH);
  return Math.max(MIN_ZOOM, Math.floor(z * 100) / 100);
}

/** The next zoom level up/down from `current` (percent). */
export function stepZoom(levels: number[], current: number, dir: 1 | -1): number {
  const sorted = levels.slice().sort((a, b) => a - b);
  if (dir > 0) return sorted.find((l) => l > current + 0.5) ?? sorted[sorted.length - 1];
  return sorted.slice().reverse().find((l) => l < current - 0.5) ?? sorted[0];
}

// ---- Toolbar ------------------------------------------------------------------

export interface DeviceBarOptions {
  root: HTMLElement;
  editor: Editor;
  state: DeviceState;
  zoomLevels: number[];
  getLabels(): SidebarToolsLabels;
  /** State changed by the user (persist it). */
  onChange(): void;
}

export interface DeviceBar {
  readonly el: HTMLElement;
  /** Re-applies the zoom (call after the canvas changed size). */
  refit(): void;
  /** Re-reads the devices / labels. */
  update(): void;
  selectDevice(id: string): void;
  selectKind(kind: DeviceKind): void;
  setZoom(mode: ZoomMode): void;
  /** Current zoom as a decimal. */
  zoom(): number;
  destroy(): void;
}

const ICONS = {
  rotate:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16.89,15.5L18.31,16.89C19.21,15.73 19.76,14.39 19.93,13H17.91C17.77,13.87 17.43,14.72 16.89,15.5M13,17.9V19.92C14.39,19.75 15.74,19.21 16.9,18.31L15.46,16.87C14.71,17.41 13.87,17.76 13,17.9M19.93,11C19.76,9.61 19.21,8.27 18.31,7.11L16.89,8.53C17.43,9.28 17.77,10.13 17.91,11M15.55,5.55L11,1V4.07C7.06,4.56 4,7.92 4,12C4,16.08 7.05,19.44 11,19.93V17.91C8.16,17.43 6,14.97 6,12C6,9.03 8.16,6.57 11,6.09V10L15.55,5.55Z"/></svg>',
  desktop:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z"/></svg>',
  tablet:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19,18H5V6H19M21,4H3C1.89,4 1,4.89 1,6V18A2,2 0 0,0 3,20H21A2,2 0 0,0 23,18V6C23,4.89 22.1,4 21,4Z"/></svg>',
  mobile:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"/></svg>',
  responsive:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20M9,8L6,11L9,14V12H15V14L18,11L15,8V10H9V8Z"/></svg>',
  minus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19,13H5V11H19V13Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createDeviceBar(opts: DeviceBarOptions): DeviceBar {
  const { root, editor, state } = opts;
  const ed: any = editor;
  const dm: any = ed.Devices || ed.DeviceManager;
  let destroyed = false;
  let current = 1;
  const offs: Array<() => void> = [];

  const bar = el('div', 'gjs-st-devbar gjs-one-bg gjs-two-color');
  bar.setAttribute('role', 'toolbar');
  /** One button per device (icon by kind), plus "Responsive". */
  const deviceBox = el('span', 'gjs-st-devbar__devices');
  deviceBox.setAttribute('role', 'radiogroup');
  const sizeBox = el('span', 'gjs-st-devbar__size');
  const wInput = el('input', 'gjs-st-devbar__w gjs-field');
  const hInput = el('input', 'gjs-st-devbar__h gjs-field');
  [wInput, hInput].forEach((i) => {
    i.type = 'number';
    i.min = '50';
    i.max = '10000';
    i.step = '1';
  });
  const times = el('span', 'gjs-st-devbar__x');
  times.textContent = '×';
  sizeBox.append(wInput, times, hInput);
  const rotateBtn = el('button', 'gjs-st-devbar__btn gjs-st-devbar__rotate');
  rotateBtn.type = 'button';
  rotateBtn.innerHTML = ICONS.rotate;
  const sep = el('span', 'gjs-st-devbar__sep');
  const outBtn = el('button', 'gjs-st-devbar__btn gjs-st-devbar__out');
  outBtn.type = 'button';
  outBtn.innerHTML = ICONS.minus;
  const zoomSel = el('select', 'gjs-st-devbar__zoom gjs-field');
  const inBtn = el('button', 'gjs-st-devbar__btn gjs-st-devbar__in');
  inBtn.type = 'button';
  inBtn.innerHTML = ICONS.plus;
  bar.append(deviceBox, sizeBox, rotateBtn, sep, outBtn, zoomSel, inBtn);
  root.appendChild(bar);
  root.classList.add('gjs-st-devbar-on');
  root.style.setProperty('--gjs-st-devbar', `${DEVBAR_HEIGHT}px`);

  const devices = (): DeviceLike[] => {
    try {
      const list = dm?.getDevices?.() || dm?.getAll?.()?.models || [];
      return Array.isArray(list) ? list : list.models || [];
    } catch {
      return [];
    }
  };
  const getDevice = (id: string): DeviceLike | null => devices().find((d) => d.id === id) || null;
  const currentDeviceId = (): string | null => {
    try {
      const sel = dm?.getSelected?.();
      if (sel?.id) return sel.id;
      const name = ed.getDevice?.();
      const found = devices().find((d) => d.id === name || deviceName(d) === name);
      return found?.id || null;
    } catch {
      return null;
    }
  };

  function canvasBox() {
    const c: HTMLElement | null = ed.Canvas?.getElement?.() || root.querySelector('.gjs-cv-canvas');
    const r = c?.getBoundingClientRect();
    return { width: r?.width || 0, height: r?.height || 0 };
  }

  // ---- Responsive device ---------------------------------------------------

  function ensureResponsive(): DeviceLike | null {
    if (!dm) return null;
    let d = getDevice(RESPONSIVE_ID);
    const { width, height } = state.responsive;
    const attrs = {
      name: opts.getLabels().responsive,
      width: `${width}px`,
      height: height ? `${height}px` : '',
      widthMedia: mediaForWidth(devices(), width),
    };
    if (!d) d = dm.add({ id: RESPONSIVE_ID, ...attrs });
    else (d as any).set(attrs);
    return d;
  }

  // ---- Zoom -----------------------------------------------------------------

  function deviceSize(): { w: number | null; h: number | null } {
    const id = currentDeviceId();
    const d = id ? getDevice(id) : null;
    return { w: d ? px(d.get('width')) : null, h: d ? px(d.get('height')) : null };
  }

  function applyZoom() {
    if (destroyed) return;
    const { width, height } = canvasBox();
    const { w, h } = deviceSize();
    const z = state.zoom === 'fit' ? fitZoom(width, height, w, h) : Math.max(MIN_ZOOM, state.zoom / 100);
    current = z;
    root.style.setProperty('--gjs-st-zoom', String(z));
    root.classList.toggle('gjs-st-zoomed', z !== 1);
    try {
      const now = ed.Canvas?.getZoom?.();
      if (now == null || Math.abs(now - z * 100) > 0.01) ed.Canvas?.setZoom?.(z * 100);
    } catch {
      // ignore
    }
    syncUi();
  }

  function setZoom(mode: ZoomMode) {
    state.zoom = mode;
    applyZoom();
    opts.onChange();
  }

  // ---- UI -------------------------------------------------------------------

  function deviceButton(id: string, title: string, kind: DeviceKind | 'responsive' | null): HTMLButtonElement {
    const b = el('button', 'gjs-st-devbar__btn gjs-st-devbar__dev');
    b.type = 'button';
    b.setAttribute('data-device', id);
    b.setAttribute('role', 'radio');
    b.title = title;
    b.setAttribute('aria-label', title);
    if (kind) b.innerHTML = ICONS[kind];
    else b.textContent = title;
    return b;
  }

  function fillDevices() {
    const labels = opts.getLabels();
    deviceBox.textContent = '';
    deviceBox.title = labels.device;
    devices()
      .filter((d) => d.id !== RESPONSIVE_ID)
      .forEach((d) => {
        const w = px(d.get('width'));
        const title = w ? `${deviceName(d)} (${w}px)` : deviceName(d);
        deviceBox.appendChild(deviceButton(d.id, title, deviceKind(d)));
      });
    deviceBox.appendChild(deviceButton(RESPONSIVE_ID, labels.responsive, 'responsive'));
    markDevice();
  }

  function markDevice() {
    const id = currentDeviceId();
    deviceBox.querySelectorAll<HTMLElement>('[data-device]').forEach((b) => {
      const on = b.getAttribute('data-device') === id;
      b.classList.toggle('gjs-st-devbar__btn--active', on);
      b.classList.toggle('gjs-four-color', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  function fillZoom() {
    const labels = opts.getLabels();
    zoomSel.textContent = '';
    const fit = document.createElement('option');
    fit.value = 'fit';
    fit.textContent = labels.zoomFit;
    zoomSel.appendChild(fit);
    const levels = opts.zoomLevels.slice();
    if (typeof state.zoom === 'number' && !levels.includes(state.zoom)) levels.push(state.zoom);
    levels
      .sort((a, b) => a - b)
      .forEach((l) => {
        const o = document.createElement('option');
        o.value = String(l);
        o.textContent = `${l}%`;
        zoomSel.appendChild(o);
      });
  }

  function syncUi() {
    const labels = opts.getLabels();
    const id = currentDeviceId();
    if (id && !deviceBox.querySelector(`[data-device="${id.replace(/"/g, '')}"]`)) fillDevices();
    markDevice();
    const isResp = id === RESPONSIVE_ID;
    const { width, height } = canvasBox();
    const { w, h } = deviceSize();
    if (document.activeElement !== wInput) wInput.value = String(Math.round(w ?? width / (current || 1)));
    if (document.activeElement !== hInput) hInput.value = h ? String(Math.round(h)) : isResp ? '' : String(Math.round(height / (current || 1)));
    hInput.placeholder = labels.auto;
    rotateBtn.disabled = !isResp;
    const zoomValue = state.zoom === 'fit' ? 'fit' : String(state.zoom);
    if (!Array.from(zoomSel.options).some((o) => o.value === zoomValue)) fillZoom();
    zoomSel.value = zoomValue;
    const pct = Math.round(current * 100);
    const fitOption = zoomSel.querySelector<HTMLOptionElement>('option[value="fit"]');
    if (fitOption) fitOption.textContent = state.zoom === 'fit' ? `${labels.zoomFit} (${pct}%)` : labels.zoomFit;
  }

  function applyLabels() {
    const labels = opts.getLabels();
    wInput.title = labels.width;
    wInput.setAttribute('aria-label', labels.width);
    hInput.title = labels.height;
    hInput.setAttribute('aria-label', labels.height);
    rotateBtn.title = labels.rotate;
    zoomSel.title = labels.zoom;
    zoomSel.setAttribute('aria-label', labels.zoom);
    outBtn.title = labels.zoomOut;
    inBtn.title = labels.zoomIn;
    const resp = getDevice(RESPONSIVE_ID);
    if (resp) (resp as any).set('name', labels.responsive);
    fillDevices();
    fillZoom();
    syncUi();
  }

  function selectDevice(id: string) {
    if (id === RESPONSIVE_ID) ensureResponsive();
    if (!getDevice(id)) return;
    try {
      ed.setDevice(id);
    } catch {
      return;
    }
    state.device = id;
    opts.onChange();
    applyZoom();
  }

  function selectKind(kind: DeviceKind) {
    const d = findDeviceForKind(devices(), kind);
    if (d) selectDevice(d.id);
  }

  /**
   * Width / height typed in: switch to the responsive device with that size
   * (like the dev tools). Only the field that was edited changes; the other
   * one keeps the responsive device's own value (an empty height = as high
   * as the canvas).
   */
  function onSizeInput(field: 'width' | 'height') {
    const next = { ...state.responsive };
    if (field === 'width') {
      const w = Math.round(Number(wInput.value));
      if (!isFinite(w) || w < 50) return syncUi();
      next.width = Math.min(w, 10000);
    } else {
      const raw = hInput.value.trim();
      const h = raw ? Math.round(Number(raw)) : null;
      if (h !== null && (!isFinite(h) || h < 50)) return syncUi();
      next.height = h === null ? null : Math.min(h, 10000);
    }
    state.responsive = next;
    ensureResponsive();
    if (currentDeviceId() !== RESPONSIVE_ID) selectDevice(RESPONSIVE_ID);
    else {
      opts.onChange();
      applyZoom();
    }
  }

  const onDeviceClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest?.('[data-device]');
    if (b) selectDevice(b.getAttribute('data-device')!);
  };
  const onZoomChange = () => setZoom(zoomSel.value === 'fit' ? 'fit' : Number(zoomSel.value));
  const onRotate = () => {
    const { width, height } = state.responsive;
    const h = height ?? Math.round(canvasBox().height / (current || 1));
    state.responsive = { width: h, height: width };
    ensureResponsive();
    opts.onChange();
    applyZoom();
  };
  const step = (dir: 1 | -1) => setZoom(stepZoom(opts.zoomLevels, current * 100, dir));
  const onSizeKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  deviceBox.addEventListener('click', onDeviceClick);
  zoomSel.addEventListener('change', onZoomChange);
  const onWidth = () => onSizeInput('width');
  const onHeight = () => onSizeInput('height');
  wInput.addEventListener('change', onWidth);
  hInput.addEventListener('change', onHeight);
  wInput.addEventListener('keydown', onSizeKey);
  hInput.addEventListener('keydown', onSizeKey);
  rotateBtn.addEventListener('click', onRotate);
  outBtn.addEventListener('click', () => step(-1));
  inBtn.addEventListener('click', () => step(1));

  // Ctrl / Cmd + wheel over the canvas (and inside the frames) zooms.
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey) || !e.deltaY) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1);
  };
  const wheelTargets = new Set<EventTarget>();
  const listenWheel = (target: EventTarget | null | undefined) => {
    if (!target || wheelTargets.has(target)) return;
    wheelTargets.add(target);
    target.addEventListener('wheel', onWheel as EventListener, { passive: false });
  };
  listenWheel(ed.Canvas?.getElement?.());
  try {
    (ed.Canvas?.getFrames?.() || []).forEach((f: any) => listenWheel(f?.view?.getWindow?.()));
    listenWheel(ed.Canvas?.getWindow?.());
  } catch {
    // ignore
  }
  const onFrameLoad = (ev: any) => listenWheel(ev?.window);
  const onDevice = () => {
    state.device = currentDeviceId();
    applyZoom();
  };
  ed.on('canvas:frame:load', onFrameLoad);
  ed.on('change:device device:select', onDevice);
  const onDevicesChanged = () => fillDevices();
  ed.on('device:add device:remove', onDevicesChanged);
  offs.push(() => {
    ed.off('canvas:frame:load', onFrameLoad);
    ed.off('change:device device:select', onDevice);
    ed.off('device:add device:remove', onDevicesChanged);
    wheelTargets.forEach((t) => t.removeEventListener('wheel', onWheel as EventListener));
    wheelTargets.clear();
  });

  // Restore the stored device.
  if (state.device && state.device === RESPONSIVE_ID) ensureResponsive();
  if (state.device && getDevice(state.device) && currentDeviceId() !== state.device) {
    try {
      ed.setDevice(state.device);
    } catch {
      // ignore
    }
  }
  applyLabels();
  applyZoom();

  return {
    el: bar,
    refit: applyZoom,
    update: applyLabels,
    selectDevice,
    selectKind,
    setZoom,
    zoom: () => current,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      offs.splice(0).forEach((off) => off());
      bar.remove();
      root.classList.remove('gjs-st-devbar-on', 'gjs-st-zoomed');
      root.style.removeProperty('--gjs-st-devbar');
      root.style.removeProperty('--gjs-st-zoom');
      // The canvas zoom is left as is: this runs when the editor is being
      // destroyed, and a zoom change schedules a GrapesJS timer that would
      // fire on the destroyed editor.
    },
  };
}
