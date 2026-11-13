import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDock, type Dock, type DockOptions } from '../src/dock';
import { normalizeLayout, layoutFromDefault } from '../src/layout';
import type { DockLayout, ZoneId } from '../src/types';

const TABS = ['a', 'b', 'c', 'd'];
const labels = { resizerTitle: 'split', zoneResizerTitle: 'edge', dropHere: 'drop' };

/*
 * Fake geometry (jsdom has no layout): editor 1400x800, zones left 0-260,
 * right 1190-1400, bottom strip 560-800; a split side zone has its second
 * group at y=400. Tabs are 30px wide, 5px apart, starting 5px into the bar.
 */
function rectFor(el: Element): DOMRect {
  const r = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
  const html = el as HTMLElement;
  if (html.id === 'root') return r(0, 0, 1400, 800);
  if (html.classList.contains('gjs-st-drop')) {
    const zone = html.dataset.zone;
    if (zone === 'left') return r(0, 40, 56, 760);
    if (zone === 'right') return r(1134, 40, 56, 760);
    return r(0, 744, 1190, 56);
  }
  const zoneEl = html.closest<HTMLElement>('.gjs-st-zone');
  const zone = zoneEl?.dataset.zone as ZoneId | undefined;
  const zx = zone === 'left' ? [0, 260] : zone === 'right' ? [1190, 210] : [260, 930];
  const zy = zone === 'bottom' ? [560, 240] : [0, 800];
  if (html.classList.contains('gjs-st-zone')) return r(zx[0], zy[0], zx[1], zy[1]);
  const group = html.closest<HTMLElement>('.gjs-st-group');
  if (!group) return r(0, 0, 0, 0);
  const split = zoneEl!.classList.contains('gjs-st-zone--split');
  const gi = Number(group.dataset.group);
  const gh = split ? zy[1] / 2 : zy[1];
  const gTop = zy[0] + gi * gh;
  if (html.classList.contains('gjs-st-tabs')) return r(zx[0], gTop, zx[1], 40);
  if (html.classList.contains('gjs-st-body')) return r(zx[0], gTop + 40, zx[1], gh - 40);
  if (html.classList.contains('gjs-st-tab')) {
    const i = Array.from(html.parentElement!.children).indexOf(html);
    return r(zx[0] + 5 + i * 35, gTop + 5, 30, 30);
  }
  return r(0, 0, 0, 0);
}

let rootEl: HTMLElement;
let dock: Dock | undefined;
let changes: Array<{ reason: string; live?: boolean }>;

function setup(layoutSpec: Parameters<typeof layoutFromDefault>[0] = {}, extra: Partial<DockOptions> = {}) {
  rootEl = document.createElement('div');
  rootEl.id = 'root';
  document.body.appendChild(rootEl);
  const panes: Record<string, HTMLElement> = {};
  TABS.forEach((id) => {
    panes[id] = document.createElement('div');
    panes[id].className = 'gjs-st-pane';
    panes[id].setAttribute('data-tab', id);
    panes[id].textContent = `content ${id}`;
  });
  changes = [];
  dock = createDock({
    root: rootEl,
    layout: normalizeLayout(layoutFromDefault(layoutSpec), TABS),
    getPane: (id) => panes[id],
    getInfo: (id) => ({ id, buttonId: id, command: id, className: `fa fa-${id}`, label: '', title: `Title ${id}` }),
    getLabels: () => labels,
    defaultSizes: { left: 260, right: null, bottom: 240 },
    minSize: { side: 180, bottom: 120 },
    minRatio: 0.15,
    maxRatio: 0.85,
    onChange: (_l, info) => changes.push(info),
    ...extra,
  });
  return { panes };
}

const tabEl = (id: string) => rootEl.querySelector<HTMLElement>(`.gjs-st-tab[data-tab="${id}"]`)!;
const zoneTabs = (l: DockLayout) => ({
  left: l.left.groups.map((g) => g.tabs.join(',')),
  right: l.right.groups.map((g) => g.tabs.join(',')),
  bottom: l.bottom.groups.map((g) => g.tabs.join(',')),
});

function pointer(type: string, target: EventTarget, x: number, y: number, extra: Record<string, unknown> = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...extra });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  target.dispatchEvent(ev);
  return ev;
}

/** Drag a tab from its centre to (x, y) and drop it. */
function dragTab(id: string, x: number, y: number, { drop = true } = {}) {
  const r = tabEl(id).getBoundingClientRect();
  pointer('pointerdown', tabEl(id), r.left + 10, r.top + 10);
  pointer('pointermove', document, r.left + 30, r.top + 30);
  pointer('pointermove', document, x, y);
  if (drop) pointer('pointerup', document, x, y);
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectFor(this);
  });
});
afterEach(() => {
  dock?.destroy();
  dock = undefined;
});

describe('rendering', () => {
  it('renders the zones, groups, tabs and sizes', () => {
    const { panes } = setup({ left: [['a'], ['b']] });
    expect(rootEl.classList.contains('gjs-st-docked')).toBe(true);
    expect(rootEl.querySelectorAll('.gjs-st-zone--left > .gjs-st-group')).toHaveLength(2);
    expect(rootEl.querySelector('.gjs-st-zone--left')!.classList.contains('gjs-st-zone--split')).toBe(true);
    expect(rootEl.querySelector('.gjs-st-zone--bottom')!.classList.contains('gjs-st-zone--empty')).toBe(true);
    expect(rootEl.style.getPropertyValue('--gjs-st-left')).toBe('260px');
    expect(rootEl.style.getPropertyValue('--gjs-st-right')).toBe('210px'); // 15% of 1400
    expect(rootEl.style.getPropertyValue('--gjs-st-bottom')).toBe('0px');
    expect(tabEl('c').title).toBe('Title c');
    expect(tabEl('c').classList.contains('fa-c')).toBe(true);
    expect(panes.c.parentElement!.classList.contains('gjs-st-body')).toBe(true);
    expect(panes.c.hidden).toBe(false);
    expect(panes.d.hidden).toBe(true);
    expect(rootEl.querySelector('.gjs-st-split')!.getAttribute('title')).toBe('split');
    expect(rootEl.querySelector('.gjs-st-edge--left')!.getAttribute('title')).toBe('edge');
    expect(rootEl.querySelector('.gjs-st-drop--bottom')!.textContent).toBe('drop');
  });

  it('keeps the pane elements across re-renders', () => {
    const { panes } = setup();
    const before = panes.a;
    dock!.drop('a', { kind: 'zone', zone: 'left' });
    expect(rootEl.querySelector('.gjs-st-pane[data-tab="a"]')).toBe(before);
    expect(before.closest('.gjs-st-zone')!.getAttribute('data-zone')).toBe('left');
  });

  it('never squeezes the canvas below its minimum', () => {
    setup({ left: [['a']] });
    dock!.setLayout({ ...dock!.layout, left: { ...dock!.layout.left, size: 1200 } });
    const left = parseInt(rootEl.style.getPropertyValue('--gjs-st-left'));
    const right = parseInt(rootEl.style.getPropertyValue('--gjs-st-right'));
    expect(1400 - left - right).toBeGreaterThanOrEqual(320);
    expect(right).toBeGreaterThanOrEqual(180);
  });

  it('destroy() removes everything', () => {
    setup();
    dock!.destroy();
    expect(rootEl.children).toHaveLength(0);
    expect(rootEl.classList.contains('gjs-st-docked')).toBe(false);
    expect(rootEl.style.getPropertyValue('--gjs-st-left')).toBe('');
  });
});

describe('tabs', () => {
  it('a click activates the tab', () => {
    setup();
    const r = tabEl('c').getBoundingClientRect();
    pointer('pointerdown', tabEl('c'), r.left + 5, r.top + 5);
    pointer('pointerup', document, r.left + 6, r.top + 6);
    expect(dock!.layout.right.groups[0].active).toBe('c');
    expect(tabEl('c').classList.contains('gjs-st-tab--active')).toBe(true);
    expect(changes[changes.length - 1]).toEqual({ reason: 'activate', live: false });
  });

  it('keyboard: Enter / arrows', () => {
    setup();
    tabEl('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(dock!.layout.right.groups[0].active).toBe('b');
    tabEl('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(dock!.layout.right.groups[0].active).toBe('c');
    tabEl('c').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(dock!.layout.right.groups[0].active).toBe('b');
  });

  it('ignores the right mouse button', () => {
    setup();
    const r = tabEl('c').getBoundingClientRect();
    pointer('pointerdown', tabEl('c'), r.left + 5, r.top + 5, { button: 2 });
    pointer('pointerup', document, r.left + 5, r.top + 5);
    expect(dock!.layout.right.groups[0].active).toBe('a');
  });
});

describe('drag and drop', () => {
  it('to an empty side zone', () => {
    setup();
    dragTab('c', 20, 300);
    expect(zoneTabs(dock!.layout)).toEqual({ left: ['c'], right: ['a,b,d'], bottom: [] });
    expect(changes[changes.length - 1]!.reason).toBe('move');
    expect(document.querySelector('.gjs-st-ghost, .gjs-st-indicator')).toBeNull();
    expect(rootEl.classList.contains('gjs-st-dragging')).toBe(false);
  });

  it('to the empty bottom zone', () => {
    setup();
    dragTab('b', 600, 770);
    expect(zoneTabs(dock!.layout)).toEqual({ left: [], right: ['a,c,d'], bottom: ['b'] });
  });

  it('to the lower third of a group: splits the zone', () => {
    setup();
    dragTab('a', 1300, 700);
    expect(zoneTabs(dock!.layout).right).toEqual(['b,c,d', 'a']);
    expect(rootEl.querySelector('.gjs-st-zone--right')!.classList.contains('gjs-st-zone--split')).toBe(true);
  });

  it('to the upper third of a group: new group above', () => {
    setup();
    dragTab('d', 1300, 100);
    expect(zoneTabs(dock!.layout).right).toEqual(['d', 'a,b,c']);
  });

  it('into another tab bar at a position', () => {
    setup({ left: [['a', 'b']] });
    // left tab bar: tabs a (5..35), b (40..70); drop between them
    dragTab('c', 37, 20);
    expect(zoneTabs(dock!.layout).left).toEqual(['a,c,b']);
    expect(dock!.layout.left.groups[0].active).toBe('c');
  });

  it('shows a drop indicator and the empty-zone strips while dragging', () => {
    setup();
    dragTab('c', 20, 300, { drop: false });
    expect(rootEl.classList.contains('gjs-st-dragging')).toBe(true);
    const ind = document.querySelector<HTMLElement>('.gjs-st-indicator')!;
    expect(ind.hidden).toBe(false);
    expect(ind.style.width).toBe('56px');
    expect(document.querySelector('.gjs-st-ghost')).not.toBeNull();
    pointer('pointerup', document, 20, 300);
  });

  it('Escape cancels the drag', () => {
    setup();
    dragTab('c', 20, 300, { drop: false });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer('pointerup', document, 20, 300);
    expect(zoneTabs(dock!.layout)).toEqual({ left: [], right: ['a,b,c,d'], bottom: [] });
    expect(document.querySelector('.gjs-st-ghost')).toBeNull();
  });

  it('dropping on nothing changes nothing', () => {
    setup();
    dragTab('c', 600, 300);
    expect(zoneTabs(dock!.layout)).toEqual({ left: [], right: ['a,b,c,d'], bottom: [] });
    expect(changes).toHaveLength(0);
  });

  it('a small wobble is still a click, not a drag', () => {
    setup();
    const r = tabEl('d').getBoundingClientRect();
    pointer('pointerdown', tabEl('d'), r.left + 5, r.top + 5);
    pointer('pointermove', document, r.left + 7, r.top + 6);
    pointer('pointerup', document, r.left + 7, r.top + 6);
    expect(dock!.layout.right.groups[0].active).toBe('d');
    expect(zoneTabs(dock!.layout).right).toEqual(['a,b,c,d']);
  });
});

describe('resizers', () => {
  it('the zone edge resizes the zone live and commits on release', () => {
    setup({ left: [['a']] });
    const edge = rootEl.querySelector<HTMLElement>('.gjs-st-edge--left')!;
    edge.setPointerCapture = vi.fn();
    edge.releasePointerCapture = vi.fn();
    pointer('pointerdown', edge, 260, 300);
    pointer('pointermove', edge, 400, 300);
    expect(rootEl.style.getPropertyValue('--gjs-st-left')).toBe('400px');
    expect(changes[changes.length - 1]).toEqual({ reason: 'size', live: true });
    pointer('pointerup', edge, 400, 300);
    expect(changes[changes.length - 1]).toEqual({ reason: 'size' });
    expect(dock!.layout.left.size).toBe(400);
  });

  it('respects the minimum size and resets on double-click', () => {
    setup({ left: [['a']] });
    const edge = rootEl.querySelector<HTMLElement>('.gjs-st-edge--left')!;
    pointer('pointerdown', edge, 260, 300);
    pointer('pointermove', edge, 20, 300);
    pointer('pointerup', edge, 20, 300);
    expect(rootEl.style.getPropertyValue('--gjs-st-left')).toBe('180px');
    rootEl.querySelector<HTMLElement>('.gjs-st-edge--left')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(dock!.layout.left.size).toBeNull();
    expect(rootEl.style.getPropertyValue('--gjs-st-left')).toBe('260px');
  });

  it('the bottom edge and the right edge', () => {
    setup({ bottom: [['a']] });
    const bottom = rootEl.querySelector<HTMLElement>('.gjs-st-edge--bottom')!;
    pointer('pointerdown', bottom, 600, 560);
    pointer('pointermove', bottom, 600, 500);
    pointer('pointerup', bottom, 600, 500);
    expect(dock!.layout.bottom.size).toBe(300);
    const right = rootEl.querySelector<HTMLElement>('.gjs-st-edge--right')!;
    pointer('pointerdown', right, 1190, 300);
    pointer('pointermove', right, 1100, 300);
    pointer('pointerup', right, 1100, 300);
    expect(dock!.layout.right.size).toBe(300);
  });

  it('the split resizer changes the ratio; double-click resets it', () => {
    setup({ left: [['a'], ['b']] });
    const split = rootEl.querySelector<HTMLElement>('.gjs-st-zone--left .gjs-st-split')!;
    pointer('pointerdown', split, 100, 400);
    pointer('pointermove', split, 100, 200);
    pointer('pointerup', split, 100, 200);
    expect(dock!.layout.left.ratio).toBe(0.25);
    expect(rootEl.querySelector<HTMLElement>('.gjs-st-zone--left')!.style.getPropertyValue('--gjs-st-ratio')).toBe('25%');
    pointer('pointerdown', split, 100, 200);
    pointer('pointermove', split, 100, 5);
    pointer('pointerup', split, 100, 5);
    expect(dock!.layout.left.ratio).toBe(0.15);
    rootEl.querySelector<HTMLElement>('.gjs-st-zone--left .gjs-st-split')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(dock!.layout.left.ratio).toBe(0.5);
  });
});
