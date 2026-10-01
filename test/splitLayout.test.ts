import { describe, expect, it, vi } from 'vitest';
import { createSplitLayout, findSplitElement, type SplitLayoutOptions } from '../src/splitLayout';

const labels = { styleManagerTab: 'Styles', settingsTab: 'Settings', resizerTitle: 'Drag me' };

function setup(overrides: Partial<SplitLayoutOptions> = {}) {
  const host = document.createElement('div');
  const tree = document.createElement('div');
  tree.className = 'layer-tree';
  host.appendChild(tree);
  document.body.appendChild(host);
  const opts: SplitLayoutOptions = {
    labels,
    minRatio: 0.15,
    maxRatio: 0.85,
    initialTab: 'style',
    initialRatio: 0.5,
    onTabChange: vi.fn(),
    onRatioCommit: vi.fn(),
    ...overrides,
  };
  const split = createSplitLayout(host, opts);
  return { host, tree, split, opts };
}

function pointer(type: string, init: { clientY?: number; button?: number } = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: init.clientY ?? 0, button: init.button ?? 0 });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  return ev;
}

describe('createSplitLayout', () => {
  it('moves the existing layer tree into the top pane', () => {
    const { host, tree, split } = setup();
    expect(host.classList.contains('gjs-lsb-host')).toBe(true);
    expect(host.children).toHaveLength(1);
    expect(findSplitElement(host)).toBe(split.el);
    expect(split.topPane.firstChild).toBe(tree);
    expect(Array.from(split.el.children)).toEqual([split.topPane, split.resizer, split.bottomPane]);
    expect(split.resizer.title).toBe('Drag me');
  });

  it('renders labels as text, not HTML', () => {
    const { split } = setup({
      labels: { ...labels, settingsTab: '<img src=x onerror="window.__xss=1">' },
    });
    const tab = split.bottomPane.querySelector('[data-tab="settings"]')!;
    expect(tab.textContent).toBe('<img src=x onerror="window.__xss=1">');
    expect(tab.querySelector('img')).toBeNull();
  });

  it('updates texts, tooltips and direction with setLabels()', () => {
    const { split } = setup();
    const tab = (name: string) => split.bottomPane.querySelector<HTMLElement>(`[data-tab="${name}"]`)!;
    expect(tab('style').textContent).toBe('Styles');
    expect(tab('style').title).toBe('Styles');
    expect(split.bottomPane.querySelector('.gjs-lsb-tabs')!.getAttribute('dir')).toBe('ltr');

    split.setLabels({ styleManagerTab: 'إعدادات النمط', settingsTab: 'إعدادات السمات', resizerTitle: 'اسحب' }, true);
    expect(tab('style').textContent).toBe('إعدادات النمط');
    expect(tab('settings').title).toBe('إعدادات السمات');
    expect(split.resizer.title).toBe('اسحب');
    expect(split.bottomPane.querySelector('.gjs-lsb-tabs')!.getAttribute('dir')).toBe('rtl');
  });

  it('starts on the initial tab and switches on click', () => {
    const { split, opts } = setup({ initialTab: 'settings' });
    expect(split.tab).toBe('settings');
    expect(split.smContainer.hidden).toBe(true);
    expect(split.tmContainer.hidden).toBe(false);

    const styleBtn = split.bottomPane.querySelector<HTMLElement>('[data-tab="style"]')!;
    styleBtn.click();
    expect(split.tab).toBe('style');
    expect(styleBtn.classList.contains('gjs-lsb-tab--active')).toBe(true);
    expect(styleBtn.getAttribute('aria-selected')).toBe('true');
    expect(split.smContainer.hidden).toBe(false);
    expect(split.tmContainer.hidden).toBe(true);
    expect(opts.onTabChange).toHaveBeenCalledTimes(1);
    expect(opts.onTabChange).toHaveBeenCalledWith('style');

    styleBtn.click(); // same tab: no change event
    expect(opts.onTabChange).toHaveBeenCalledTimes(1);
  });

  it('clamps the ratio and writes the CSS variable', () => {
    const { split } = setup({ initialRatio: 0.99 });
    expect(split.ratio).toBe(0.85);
    expect(split.el.style.getPropertyValue('--lsb-top')).toBe('85%');
    expect(split.setRatio(0.01)).toBe(0.15);
    expect(split.setRatio(NaN)).toBe(0.5);
  });

  it('resets to 50/50 on double-click', () => {
    const { split, opts } = setup({ initialRatio: 0.3 });
    split.resizer.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(split.ratio).toBe(0.5);
    expect(opts.onRatioCommit).toHaveBeenCalledWith(0.5);
  });

  it('resizes by dragging the handle', () => {
    const { split, opts } = setup();
    vi.spyOn(split.el, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 400 } as DOMRect);
    split.resizer.dispatchEvent(pointer('pointerdown', { clientY: 300 }));
    expect(split.el.classList.contains('gjs-lsb-resizing')).toBe(true);
    split.resizer.dispatchEvent(pointer('pointermove', { clientY: 200 }));
    expect(split.ratio).toBe(0.25);
    expect(opts.onRatioCommit).not.toHaveBeenCalled();
    split.resizer.dispatchEvent(pointer('pointerup'));
    expect(split.el.classList.contains('gjs-lsb-resizing')).toBe(false);
    expect(opts.onRatioCommit).toHaveBeenCalledWith(0.25);
    // listeners are gone after pointerup
    split.resizer.dispatchEvent(pointer('pointermove', { clientY: 400 }));
    expect(split.ratio).toBe(0.25);
  });

  it('ignores non-primary buttons', () => {
    const { split } = setup();
    split.resizer.dispatchEvent(pointer('pointerdown', { button: 2 }));
    expect(split.el.classList.contains('gjs-lsb-resizing')).toBe(false);
  });

  it('toggles the open state and reports visibility', () => {
    const { host, split } = setup();
    expect(split.isOpen()).toBe(false);
    split.setOpen(true);
    expect(split.el.classList.contains('gjs-lsb-split--open')).toBe(true);
    expect(split.isVisible()).toBe(true);
    host.style.display = 'none';
    expect(split.isVisible()).toBe(false);
  });

  it('destroy() restores the original DOM', () => {
    const { host, tree, split } = setup();
    split.destroy();
    expect(Array.from(host.children)).toEqual([tree]);
    expect(host.classList.contains('gjs-lsb-host')).toBe(false);
    expect(findSplitElement(host)).toBeNull();
  });
});
