import { describe, expect, it, vi } from 'vitest';
import plugin from '../src/index';
import type { SidebarToolsOptions } from '../src/types';
import { createFakeEditor, FakeModel, FakeSector, flush, type FakeEditorOptions } from './helpers/fakeEditor';

const KEY = 'gjs-lsb-state';

/**
 * Page similar to a custom GrapesJS layout: separate containers for
 * layers / styles / traits, each manager already rendered inside.
 */
function buildPage() {
  const layers = document.createElement('div');
  layers.id = 'layers';
  const tree = document.createElement('div');
  tree.className = 'gjs-layer-manager';
  layers.appendChild(tree);

  const styles = document.createElement('div');
  styles.id = 'styles';
  const sm = document.createElement('div');
  sm.className = 'gjs-sm-sectors';
  styles.appendChild(sm);

  const traits = document.createElement('div');
  traits.id = 'traits';
  const tm = document.createElement('div');
  tm.className = 'gjs-trt-traits';
  traits.appendChild(tm);

  document.body.append(layers, styles, traits);
  return { layers, tree, styles, sm, traits, tm };
}

async function setup(pluginOpts: SidebarToolsOptions = {}, editorOpts: FakeEditorOptions = {}) {
  const page = buildPage();
  const fake = createFakeEditor({
    layersAppendTo: '#layers',
    smAppendTo: '#styles',
    tmAppendTo: '#traits',
    ...editorOpts,
  });
  plugin(fake.editor, pluginOpts);
  fake.emit('load');
  await flush();
  return { ...page, ...fake };
}

const splitOf = (layers: HTMLElement) => layers.querySelector<HTMLElement>('.gjs-lsb-split')!;

describe('plugin', () => {
  it('registers the public commands', () => {
    const fake = createFakeEditor();
    plugin(fake.editor, {});
    expect(fake.commands.has('layers-sidebar:show-styles')).toBe(true);
    expect(fake.commands.has('layers-sidebar:show-settings')).toBe(true);
  });

  it('injects the CSS unless disabled', () => {
    plugin(createFakeEditor().editor, { injectCss: false });
    expect(document.getElementById('gjs-lsb-styles')).toBeNull();
    plugin(createFakeEditor().editor);
    expect(document.getElementById('gjs-lsb-styles')).not.toBeNull();
  });

  it('builds the split on load, closed while nothing is selected', async () => {
    const { layers, tree, sm, styles } = await setup();
    const split = splitOf(layers);
    expect(split).not.toBeNull();
    expect(split.querySelector('.gjs-lsb-top')!.firstChild).toBe(tree);
    expect(split.classList.contains('gjs-lsb-split--open')).toBe(false);
    expect(sm.parentNode).toBe(styles);
  });

  it('moves the managers in on selection and back on deselection', async () => {
    const { layers, sm, tm, styles, traits, select } = await setup();
    select({ id: 'cmp' });
    await flush();
    const split = splitOf(layers);
    expect(split.classList.contains('gjs-lsb-split--open')).toBe(true);
    expect(sm.parentElement!.classList.contains('gjs-lsb-panel--style')).toBe(true);
    expect(tm.parentElement!.classList.contains('gjs-lsb-panel--settings')).toBe(true);

    select(null);
    await flush();
    expect(split.classList.contains('gjs-lsb-split--open')).toBe(false);
    expect(sm.parentNode).toBe(styles);
    expect(tm.parentNode).toBe(traits);
  });

  it('stays closed while the layers container is hidden', async () => {
    const { layers, sm, styles, select, emit } = await setup();
    select({ id: 'cmp' });
    await flush();
    layers.style.display = 'none';
    emit('run', 'open-sm');
    await flush();
    expect(splitOf(layers).classList.contains('gjs-lsb-split--open')).toBe(false);
    expect(sm.parentNode).toBe(styles);
  });

  it('show-settings command switches the bottom tab and persists it', async () => {
    const { layers, select, editor } = await setup();
    select({ id: 'cmp' });
    editor.Commands.run('layers-sidebar:show-settings');
    await flush();
    const split = splitOf(layers);
    expect(split.querySelector<HTMLElement>('.gjs-lsb-panel--settings')!.hidden).toBe(false);
    expect(split.querySelector<HTMLElement>('.gjs-lsb-panel--style')!.hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!).tab).toBe('settings');

    editor.Commands.run('layers-sidebar:show-styles');
    expect(JSON.parse(localStorage.getItem(KEY)!).tab).toBe('style');
  });

  it('restores the tab and height split from localStorage', async () => {
    localStorage.setItem(KEY, JSON.stringify({ tab: 'settings', ratio: 0.3 }));
    const { layers } = await setup();
    const split = splitOf(layers);
    expect(split.style.getPropertyValue('--lsb-top')).toBe('30%');
    expect(split.querySelector('[data-tab="settings"]')!.classList.contains('gjs-lsb-tab--active')).toBe(true);
  });

  it('uses a custom storage key and label texts', async () => {
    const { layers, select } = await setup({ storageKey: 'custom', labels: { settingsTab: 'Настройки' } });
    select({ id: 'cmp' });
    await flush();
    layers.querySelector<HTMLElement>('[data-tab="settings"]')!.click();
    expect(layers.querySelector('[data-tab="settings"]')!.textContent).toBe('Настройки');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem('custom')!).tab).toBe('settings');
  });

  it('shows the texts in the editor locale', async () => {
    const { layers } = await setup({}, { locale: 'ru' });
    expect(layers.querySelector('[data-tab="style"]')!.textContent).toBe('Диспетчер стилей');
    expect(layers.querySelector('[data-tab="settings"]')!.textContent).toBe('Настройки компонента');
    expect(layers.querySelector<HTMLElement>('.gjs-lsb-resizer')!.title).toContain('Потяните');
  });

  it('follows locale changes at runtime, including RTL', async () => {
    const { layers, editor } = await setup();
    const tab = () => layers.querySelector('[data-tab="settings"]')!;
    expect(tab().textContent).toBe('Component Settings');
    editor.I18n.setLocale('he');
    expect(tab().textContent).toBe('הגדרות רכיב');
    expect(layers.querySelector('.gjs-lsb-tabs')!.getAttribute('dir')).toBe('rtl');
    editor.I18n.setLocale('pl');
    expect(tab().textContent).toBe('Ustawienia elementu');
    expect(layers.querySelector('.gjs-lsb-tabs')!.getAttribute('dir')).toBe('ltr');
  });

  it('picks up strings overridden through editor.I18n.addMessages()', async () => {
    const { layers, editor } = await setup();
    editor.I18n.addMessages({ en: { sidebarTools: { styleManagerTab: 'Styles' } } });
    expect(layers.querySelector('[data-tab="style"]')!.textContent).toBe('Styles');
  });

  it('the labels option wins over the translations in every locale', async () => {
    const { layers, editor } = await setup({ labels: { settingsTab: 'Props' } }, { locale: 'ru' });
    const tab = (name: string) => layers.querySelector(`[data-tab="${name}"]`)!.textContent;
    expect(tab('settings')).toBe('Props');
    expect(tab('style')).toBe('Диспетчер стилей');
    editor.I18n.setLocale('fr');
    expect(tab('settings')).toBe('Props');
    expect(tab('style')).toBe('Gestionnaire de style');
  });

  it('does not write anything with persist: false', async () => {
    const { layers, select } = await setup({ persist: false });
    select({ id: 'cmp' });
    await flush();
    layers.querySelector<HTMLElement>('[data-tab="settings"]')!.click();
    expect(localStorage.length).toBe(0);
  });

  it('remembers and re-applies Style Manager sectors', async () => {
    localStorage.setItem(KEY, JSON.stringify({ sectors: { general: true } }));
    const general = new FakeSector('general', false);
    const layout = new FakeSector('layout', false);
    await setup({}, { sectors: [general, layout] });
    expect(general.get('open')).toBe(true);
    layout.set('open', true);
    expect(JSON.parse(localStorage.getItem(KEY)!).sectors).toEqual({ general: true, layout: true });
  });

  it('restores the global tab and records later switches', async () => {
    localStorage.setItem(KEY, JSON.stringify({ globalTab: 'open-layers' }));
    const layersBtn = new FakeModel({ command: 'open-layers', active: false });
    const { emit } = await setup({}, { panels: [layersBtn] });
    await flush();
    expect(layersBtn.get('active')).toBe(true);
    await flush(120);
    emit('run', 'open-blocks');
    expect(JSON.parse(localStorage.getItem(KEY)!).globalTab).toBe('open-blocks');
  });

  it('works with the default GrapesJS panels (no appendTo), once open-layers ran', async () => {
    const sm = document.createElement('div');
    sm.className = 'gjs-sm-sectors';
    const smHome = document.createElement('div');
    smHome.appendChild(sm);
    document.body.appendChild(smHome);

    const fake = createFakeEditor();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    plugin(fake.editor, {});
    fake.emit('load');
    await flush();
    expect(document.querySelector('.gjs-lsb-split')).toBeNull();
    expect(warn).not.toHaveBeenCalled(); // not configured -> not an error

    // what GrapesJS' OpenLayers command does on its first run
    const layersWrap = document.createElement('div');
    layersWrap.appendChild(document.createElement('div'));
    document.body.appendChild(layersWrap);
    fake.commands.set('open-layers', {
      layers: layersWrap,
      run() {
        layersWrap.style.display = 'block';
      },
    });
    fake.select({ id: 'cmp' });
    fake.editor.Commands.run('open-layers');
    await flush();

    const split = layersWrap.querySelector('.gjs-lsb-split')!;
    expect(split).not.toBeNull();
    expect(split.classList.contains('gjs-lsb-split--open')).toBe(true);
    expect(sm.parentElement!.classList.contains('gjs-lsb-panel--style')).toBe(true);
  });

  it.each([true, false])('prerenders a Trait Manager that was never opened (prerenderManagers: %s)', async (prerender) => {
    const layers = document.createElement('div');
    layers.id = 'layers';
    const home = document.createElement('div');
    document.body.append(layers, home);
    const fake = createFakeEditor({ layersAppendTo: '#layers' });
    const run = vi.fn(function (this: any) {
      this.$cn = true;
      const tm = document.createElement('div');
      tm.className = 'gjs-traits-cs';
      home.appendChild(tm);
    });
    fake.commands.set('open-tm', { run, stop: vi.fn() });
    plugin(fake.editor, { prerenderManagers: prerender });
    fake.emit('load');
    fake.select({ id: 'cmp' });
    await flush();
    const inSplit = !!layers.querySelector('.gjs-lsb-panel--settings .gjs-traits-cs');
    expect(inSplit).toBe(prerender);
    expect(run).toHaveBeenCalledTimes(prerender ? 1 : 0);
  });

  it('warns once when a configured container is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = createFakeEditor({ layersAppendTo: '#missing' });
    plugin(fake.editor, {});
    fake.emit('load');
    await flush();
    fake.emit('component:toggled');
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not build a second split in the same container', async () => {
    const { layers, editor, emit } = await setup();
    plugin(editor, {});
    emit('load');
    await flush();
    expect(layers.querySelectorAll('.gjs-lsb-split')).toHaveLength(1);
  });

  it('cleans up on editor destroy', async () => {
    const { layers, tree, sm, styles, select, emit, handlerCount } = await setup();
    select({ id: 'cmp' });
    await flush();
    emit('destroy');
    expect(layers.querySelector('.gjs-lsb-split')).toBeNull();
    expect(tree.parentNode).toBe(layers);
    expect(sm.parentNode).toBe(styles);
    expect(handlerCount('component:toggled')).toBe(0);
    expect(handlerCount('run')).toBe(0);
    expect(handlerCount('i18n:locale')).toBe(0);
    expect(handlerCount('i18n:update')).toBe(0);
    // late events are harmless
    emit('component:toggled');
    await flush();
    expect(layers.querySelector('.gjs-lsb-split')).toBeNull();
  });
});
