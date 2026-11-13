import type { Editor } from 'grapesjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deviceKind,
  findDeviceForKind,
  fitZoom,
  mediaForWidth,
  px,
  RESPONSIVE_ID,
  sanitizeDeviceState,
  stepZoom,
  type DeviceLike,
} from '../src/devices';
import { createEditor, destroyEditor, flush, root } from './helpers/editor';

const dev = (id: string, attrs: Record<string, unknown> = {}): DeviceLike => ({ id, get: (k: string) => attrs[k] });

describe('device helpers', () => {
  it('px', () => {
    expect(px('768px')).toBe(768);
    expect(px(' 375 ')).toBe(375);
    expect(px(10)).toBe(10);
    expect(px('')).toBeNull();
    expect(px('50%')).toBeNull();
    expect(px(undefined)).toBeNull();
  });

  it('deviceKind reads id and name', () => {
    expect(deviceKind(dev('mobilePortrait'))).toBe('mobile');
    expect(deviceKind(dev('x', { name: 'iPad' }))).toBe('tablet');
    expect(deviceKind(dev('desktop'))).toBe('desktop');
    expect(deviceKind(dev('wide', { name: 'Wide' }))).toBeNull();
  });

  it('findDeviceForKind: by name first, then by width', () => {
    const named = [dev('desktop', { name: 'Desktop' }), dev('tablet', { width: '768px' }), dev('mobile', { name: 'Mobile', width: '375px' })];
    expect(findDeviceForKind(named, 'mobile')!.id).toBe('mobile');
    const anon = [dev('a', { width: '' }), dev('b', { width: '1024px' }), dev('c', { width: '700px' }), dev('d', { width: '320px' })];
    expect(findDeviceForKind(anon, 'desktop')!.id).toBe('a');
    expect(findDeviceForKind(anon, 'mobile')!.id).toBe('d');
    expect(findDeviceForKind(anon, 'tablet')!.id).toBe('c');
    expect(findDeviceForKind([], 'tablet')).toBeNull();
    expect(findDeviceForKind([dev(RESPONSIVE_ID, { name: 'Responsive mobile' })], 'mobile')).toBeNull();
  });

  it('mediaForWidth picks the narrowest max-width media that still applies', () => {
    const list = [dev('d'), dev('t', { widthMedia: '992px' }), dev('m', { widthMedia: '767px' })];
    expect(mediaForWidth(list, 600)).toBe('767px');
    expect(mediaForWidth(list, 800)).toBe('992px');
    expect(mediaForWidth(list, 1200)).toBe('');
  });

  it('fitZoom', () => {
    expect(fitZoom(960, 700, 1920, null)).toBe(0.5);
    expect(fitZoom(960, 700, null, null)).toBe(1);
    expect(fitZoom(960, 700, 375, null)).toBe(1);
    expect(fitZoom(960, 700, 400, 1400)).toBe(0.5);
    expect(fitZoom(0, 0, 1920, null)).toBe(1);
    expect(fitZoom(100, 100, 100000, null)).toBe(0.1);
  });

  it('stepZoom', () => {
    const levels = [25, 50, 100, 200];
    expect(stepZoom(levels, 100, 1)).toBe(200);
    expect(stepZoom(levels, 100, -1)).toBe(50);
    expect(stepZoom(levels, 61, 1)).toBe(100);
    expect(stepZoom(levels, 61, -1)).toBe(50);
    expect(stepZoom(levels, 200, 1)).toBe(200);
    expect(stepZoom(levels, 25, -1)).toBe(25);
  });

  it('sanitizeDeviceState', () => {
    expect(sanitizeDeviceState(null)).toEqual({ device: null, responsive: { width: 1280, height: null }, zoom: 'fit' });
    expect(sanitizeDeviceState({ device: 'tablet', responsive: { width: 1920, height: 1080 }, zoom: 50 })).toEqual({
      device: 'tablet',
      responsive: { width: 1920, height: 1080 },
      zoom: 50,
    });
    expect(sanitizeDeviceState({ responsive: { width: 5, height: 'x' }, zoom: 9999 })).toEqual(sanitizeDeviceState(null));
  });
});

// ---- With a real editor ---------------------------------------------------------

let editor: Editor | undefined;
afterEach(async () => {
  // zoom changes leave a 300ms GrapesJS timer behind
  await flush(350);
  await destroyEditor(editor);
  editor = undefined;
});

const DEVICES = {
  deviceManager: {
    devices: [
      { id: 'desktop', name: 'Desktop', width: '' },
      { id: 'tablet', name: 'Tablet', width: '768px', widthMedia: '992px' },
      { id: 'mobile', name: 'Mobile', width: '375px', widthMedia: '767px' },
    ],
  },
};

/** Like grapesjs-preset-webpage: commands that select devices by names that may not exist. */
function presetLikeDeviceCommands(ed: Editor) {
  ed.Commands.add('set-device-desktop', { run: (e: Editor) => e.setDevice('Desktop'), stop() {} });
  ed.Commands.add('set-device-tablet', { run: (e: Editor) => e.setDevice('Tablet'), stop() {} });
  ed.Commands.add('set-device-mobile', { run: (e: Editor) => e.setDevice('Mobile portrait'), stop() {} });
}

const bar = (ed: Editor) => root(ed).querySelector<HTMLElement>('.gjs-st-devbar')!;
const devBtn = (ed: Editor, id: string) => bar(ed).querySelector<HTMLButtonElement>(`[data-device="${id}"]`)!;

describe('device toolbar', () => {
  it('renders one button per device plus Responsive, sizes and zoom', async () => {
    editor = await createEditor({}, [], DEVICES);
    expect(root(editor).classList.contains('gjs-st-devbar-on')).toBe(true);
    expect(root(editor).style.getPropertyValue('--gjs-st-devbar')).toBe('34px');
    const ids = Array.from(bar(editor).querySelectorAll('[data-device]')).map((b) => b.getAttribute('data-device'));
    expect(ids).toEqual(['desktop', 'tablet', 'mobile', RESPONSIVE_ID]);
    expect(devBtn(editor, 'tablet').title).toBe('Tablet (768px)');
    expect(devBtn(editor, 'desktop').getAttribute('aria-checked')).toBe('true');
    expect(bar(editor).querySelector<HTMLSelectElement>('.gjs-st-devbar__zoom')!.value).toBe('fit');
  });

  it('a click selects the device', async () => {
    editor = await createEditor({}, [], DEVICES);
    devBtn(editor, 'mobile').click();
    expect(editor.getDevice()).toBe('mobile');
    expect(devBtn(editor, 'mobile').getAttribute('aria-checked')).toBe('true');
    expect(bar(editor).querySelector<HTMLInputElement>('.gjs-st-devbar__w')!.value).toBe('375');
  });

  it('fixes preset device commands that use names which do not exist', async () => {
    editor = await createEditor({}, [presetLikeDeviceCommands], DEVICES);
    editor.runCommand('set-device-mobile');
    expect(editor.getDevice()).toBe('mobile');
    editor.runCommand('set-device-tablet');
    expect(editor.getDevice()).toBe('tablet');
  });

  it('typing a width switches to the responsive device with the matching media', async () => {
    editor = await createEditor({}, [], DEVICES);
    const w = bar(editor).querySelector<HTMLInputElement>('.gjs-st-devbar__w')!;
    w.value = '600';
    w.dispatchEvent(new Event('change'));
    expect(editor.getDevice()).toBe(RESPONSIVE_ID);
    const d: any = (editor as any).Devices.get(RESPONSIVE_ID);
    expect(d.get('width')).toBe('600px');
    expect(d.get('height')).toBe('');
    expect(d.get('widthMedia')).toBe('767px');
    const h = bar(editor).querySelector<HTMLInputElement>('.gjs-st-devbar__h')!;
    h.value = '900';
    h.dispatchEvent(new Event('change'));
    expect(d.get('height')).toBe('900px');
    bar(editor).querySelector<HTMLButtonElement>('.gjs-st-devbar__rotate')!.click();
    expect(d.get('width')).toBe('900px');
    expect(d.get('height')).toBe('600px');
  });

  it('zoom select / buttons / command drive the GrapesJS canvas zoom', async () => {
    editor = await createEditor({}, [], DEVICES);
    const sel = bar(editor).querySelector<HTMLSelectElement>('.gjs-st-devbar__zoom')!;
    sel.value = '50';
    sel.dispatchEvent(new Event('change'));
    expect(editor.Canvas.getZoom()).toBe(50);
    expect(root(editor).classList.contains('gjs-st-zoomed')).toBe(true);
    expect(root(editor).style.getPropertyValue('--gjs-st-zoom')).toBe('0.5');
    bar(editor).querySelector<HTMLButtonElement>('.gjs-st-devbar__in')!.click();
    expect(editor.Canvas.getZoom()).toBe(67);
    editor.runCommand('sidebar-tools:zoom', { value: 'out' });
    expect(editor.Canvas.getZoom()).toBe(50);
    editor.runCommand('sidebar-tools:zoom', { value: 'fit' });
    expect(editor.Canvas.getZoom()).toBe(100); // no layout in jsdom: everything fits
    expect(root(editor).classList.contains('gjs-st-zoomed')).toBe(false);
  });

  it('remembers device, responsive size and zoom', async () => {
    editor = await createEditor({}, [], DEVICES);
    devBtn(editor, 'tablet').click();
    editor.runCommand('sidebar-tools:zoom', { value: 75 });
    const saved = JSON.parse(localStorage.getItem('gjs-sidebar-tools')!).devices;
    expect(saved).toMatchObject({ device: 'tablet', zoom: 75 });
    await flush(350);
    await destroyEditor(editor);
    editor = await createEditor({}, [], DEVICES);
    expect(editor.getDevice()).toBe('tablet');
    expect(editor.Canvas.getZoom()).toBe(75);
  });

  it('sidebar-tools:set-device by id and by kind', async () => {
    editor = await createEditor({}, [], DEVICES);
    editor.runCommand('sidebar-tools:set-device', { kind: 'mobile' });
    expect(editor.getDevice()).toBe('mobile');
    editor.runCommand('sidebar-tools:set-device', { id: 'desktop' });
    expect(editor.getDevice()).toBe('desktop');
  });

  it('hides the GrapesJS devices panel unless told otherwise; deviceBar: false keeps everything as it was', async () => {
    editor = await createEditor({}, [], DEVICES);
    expect(root(editor).classList.contains('gjs-st-hide-devices')).toBe(true);
    await destroyEditor(editor);
    editor = await createEditor({ deviceBar: false }, [presetLikeDeviceCommands], DEVICES);
    expect(root(editor).querySelector('.gjs-st-devbar')).toBeNull();
    expect(root(editor).classList.contains('gjs-st-hide-devices')).toBe(false);
    editor.runCommand('set-device-mobile'); // still fixed
    expect(editor.getDevice()).toBe('mobile');
  });

  it('follows the locale and is removed on destroy', async () => {
    editor = await createEditor({}, [], DEVICES);
    editor.I18n.setLocale('ru');
    expect(devBtn(editor, RESPONSIVE_ID).title).toBe('Адаптивный');
    expect(bar(editor).querySelector<HTMLInputElement>('.gjs-st-devbar__h')!.placeholder).toBe('авто');
    editor.runCommand('sidebar-tools:zoom', { value: 50 });
    editor.trigger('destroy');
    await flush();
    expect(root(editor).querySelector('.gjs-st-devbar')).toBeNull();
    expect(root(editor).classList.contains('gjs-st-zoomed')).toBe(false);
  });
});

describe('zone collapse command', () => {
  it('sidebar-tools:toggle-zone', async () => {
    editor = await createEditor();
    editor.runCommand('sidebar-tools:toggle-zone', { zone: 'right' });
    expect(root(editor).querySelector('.gjs-st-zone--right')!.classList.contains('gjs-st-zone--collapsed')).toBe(true);
    editor.runCommand('sidebar-tools:toggle-zone', { zone: 'right', collapsed: false });
    expect(root(editor).querySelector('.gjs-st-zone--right')!.classList.contains('gjs-st-zone--collapsed')).toBe(false);
    expect(() => editor!.runCommand('sidebar-tools:toggle-zone', { zone: 'nope' })).not.toThrow();
  });
});
