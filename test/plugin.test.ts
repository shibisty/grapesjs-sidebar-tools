import type { Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickTab, createEditor, destroyEditor, flush, pane, root, tab, tabsOf } from './helpers/editor';

let editor: Editor | undefined;
afterEach(async () => {
  await destroyEditor(editor);
  editor = undefined;
});

const CORE = ['open-sm', 'open-tm', 'open-layers', 'open-blocks'];
const viewsContainer = (ed: Editor) => root(ed).querySelector<HTMLElement>('.gjs-pn-views-container')!;
const stored = () => JSON.parse(localStorage.getItem('gjs-sidebar-tools') || 'null');

describe('docking the default GrapesJS views', () => {
  it('turns every views panel button into a tab of the right zone', async () => {
    editor = await createEditor();
    const tabs = tabsOf(editor);
    expect(tabs.left).toEqual([]);
    expect(tabs.bottom).toEqual([]);
    expect(tabs.right).toHaveLength(1);
    expect(tabs.right[0].map((t) => t.replace('*', ''))).toEqual(CORE);
    expect(tabs.right[0].filter((t) => t.endsWith('*'))).toHaveLength(1);
    expect(root(editor).classList.contains('gjs-st-docked')).toBe(true);
  });

  it('moves the real manager DOM into the panes and empties the views container', async () => {
    editor = await createEditor();
    expect(pane(editor, 'open-sm').querySelector('.gjs-sm-sectors')).not.toBeNull();
    expect(pane(editor, 'open-tm').querySelector('.gjs-traits-cs, .gjs-trt-traits')).not.toBeNull();
    expect(pane(editor, 'open-layers').querySelector('.gjs-layer-item, .gjs-layers, [data-toggle-select]')).not.toBeNull();
    expect(pane(editor, 'open-blocks').querySelector('.gjs-blocks-cs, .gjs-blocks-c')).not.toBeNull();
    expect(viewsContainer(editor).children).toHaveLength(0);
  });

  it('gives every view button a context of its own and leaves them idle', async () => {
    editor = await createEditor();
    const buttons = (editor.Panels.getPanel('views') as any).get('buttons').models;
    const contexts = buttons.map((b: any) => b.get('context'));
    expect(new Set(contexts).size).toBe(buttons.length);
    expect(buttons.every((b: any) => !b.get('active'))).toBe(true);
  });

  it('keeps several views visible at once and their content alive', async () => {
    editor = await createEditor({ defaultLayout: { left: [['open-layers']], bottom: [['open-tm']] } });
    expect(tabsOf(editor)).toEqual({ left: [['open-layers*']], right: [expect.any(Array)], bottom: [['open-tm*']] });
    editor.select(editor.getWrapper()!.find('#title')[0]);
    await flush(20);
    ['open-layers', 'open-tm'].forEach((id) => expect(pane(editor!, id).hidden).toBe(false));
    // the Trait Manager shows the traits of the selection, not its "select a component" header
    const traits = pane(editor, 'open-tm').querySelector<HTMLElement>('.gjs-traits-cs, .gjs-trt-traits')!;
    expect(traits.closest('[style*="display: none"]')).toBeNull();
  });

  it('a click on a tab shows it and is remembered', async () => {
    editor = await createEditor();
    clickTab(editor, 'open-layers');
    expect(tab(editor, 'open-layers').classList.contains('gjs-st-tab--active')).toBe(true);
    expect(pane(editor, 'open-layers').hidden).toBe(false);
    expect(pane(editor, 'open-sm').hidden).toBe(true);
    expect(stored().layout.right.groups[0].active).toBe('open-layers');
  });

  it('restores a stored layout', async () => {
    localStorage.setItem(
      'gjs-sidebar-tools',
      JSON.stringify({
        layout: {
          left: { size: 300, ratio: 0.4, groups: [{ tabs: ['open-layers'], active: 'open-layers' }, { tabs: ['open-blocks'], active: 'open-blocks' }] },
          right: { size: null, ratio: 0.5, groups: [{ tabs: ['open-sm', 'open-tm'], active: 'open-tm' }] },
          bottom: { size: null, ratio: 0.5, groups: [] },
        },
      }),
    );
    editor = await createEditor();
    expect(tabsOf(editor)).toEqual({
      left: [['open-layers*'], ['open-blocks*']],
      right: [['open-sm', 'open-tm*']],
      bottom: [],
    });
    expect(root(editor).style.getPropertyValue('--gjs-st-left')).toBe('300px');
    expect(root(editor).querySelector('.gjs-st-zone--left')!.classList.contains('gjs-st-zone--split')).toBe(true);
    expect(root(editor).querySelector('.gjs-st-zone--bottom')!.classList.contains('gjs-st-zone--empty')).toBe(true);
    expect(root(editor).style.getPropertyValue('--gjs-st-bottom')).toBe('0px');
  });

  it('views option limits the docked views', async () => {
    editor = await createEditor({ views: ['open-sm', 'open-layers'] });
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).toEqual(['open-sm', 'open-layers']);
  });
});

describe('external runs and stops', () => {
  it('activating a hidden view button shows its tab and resets the button', async () => {
    editor = await createEditor();
    const btn = editor.Panels.getButton('views', 'open-blocks')!;
    btn.set('active', true);
    expect(tab(editor, 'open-blocks').classList.contains('gjs-st-tab--active')).toBe(true);
    await flush();
    expect(btn.get('active')).toBe(false);
    // the content survived the stop that came with the reset
    expect(pane(editor, 'open-blocks').firstElementChild!.getAttribute('style') || '').not.toContain('display: none');
  });

  it('runCommand of a view shows its tab; stopCommand does not hide its content', async () => {
    editor = await createEditor();
    editor.runCommand('open-layers');
    expect(tab(editor, 'open-layers').classList.contains('gjs-st-tab--active')).toBe(true);
    await flush();
    editor.runCommand('open-layers');
    editor.stopCommand('open-layers', { force: true });
    await flush();
    const content = pane(editor, 'open-layers').firstElementChild as HTMLElement;
    expect(content.style.display).not.toBe('none');
  });

  it('context-menu commands and sidebar-tools:show', async () => {
    editor = await createEditor();
    editor.runCommand('layers-sidebar:show-settings');
    expect(tab(editor, 'open-tm').classList.contains('gjs-st-tab--active')).toBe(true);
    editor.runCommand('layers-sidebar:show-styles');
    expect(tab(editor, 'open-sm').classList.contains('gjs-st-tab--active')).toBe(true);
    editor.runCommand('sidebar-tools:show', { id: 'open-blocks' });
    expect(tab(editor, 'open-blocks').classList.contains('gjs-st-tab--active')).toBe(true);
    expect(() => editor!.runCommand('sidebar-tools:show', { id: 'nope' })).not.toThrow();
  });

  it('reset-layout puts everything back into the right zone', async () => {
    editor = await createEditor({ defaultLayout: {} });
    localStorage.clear();
    editor.runCommand('sidebar-tools:show', { id: 'open-layers' });
    editor.runCommand('sidebar-tools:reset-layout');
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).toEqual(CORE);
    expect(stored().layout.left.groups).toEqual([]);
  });
});

describe('views added by other plugins', () => {
  /** A plugin with its own view: a button in the views panel whose command shows a box in the views container. */
  function pagesLikePlugin(ed: Editor) {
    let box: HTMLElement | null = null;
    ed.Commands.add('my-view', {
      run(editor: Editor) {
        if (!box) {
          box = document.createElement('div');
          box.className = 'my-view';
          box.textContent = 'My view';
          (editor.Panels.getPanel('views-container') as any).set('appendContent', box).trigger('change:appendContent');
        }
        box.hidden = false;
      },
      stop() {
        if (box) box.hidden = true;
      },
    });
    ed.Panels.addButton('views', { id: 'my-view-btn', command: 'my-view', className: 'fa fa-star', attributes: { title: 'Mine' } });
  }

  it('docks a third-party view like the core ones', async () => {
    editor = await createEditor({}, [pagesLikePlugin]);
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).toEqual([...CORE, 'my-view']);
    expect(pane(editor, 'my-view').querySelector('.my-view')).not.toBeNull();
    expect(tab(editor, 'my-view').title).toBe('Mine');
    expect(tab(editor, 'my-view').classList.contains('fa-star')).toBe(true);
    // someone stops it (hides the box): it comes back
    editor.runCommand('my-view');
    await flush();
    editor.stopCommand('my-view', { force: true });
    await flush();
    expect(pane(editor, 'my-view').querySelector<HTMLElement>('.my-view')!.hidden).toBe(false);
  });

  it('docks a view button added after the dock was built', async () => {
    editor = await createEditor();
    pagesLikePlugin(editor);
    await flush(5);
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).toContain('my-view');
    editor.Panels.removeButton('views', 'my-view-btn');
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).not.toContain('my-view');
  });

  it('leaves buttons that render nothing in the views container alone', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor = await createEditor({}, [
      (ed) => {
        ed.Commands.add('noop-view', { run() {}, stop() {} });
        ed.Panels.addButton('views', { id: 'noop', command: 'noop-view' });
      },
    ]);
    expect(tabsOf(editor).right[0].map((t) => t.replace('*', ''))).toEqual(CORE);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('texts and cleanup', () => {
  it('translates the resizer tooltips and follows locale changes', async () => {
    editor = await createEditor({ defaultLayout: { left: [['open-layers'], ['open-blocks']] } });
    const split = () => root(editor!).querySelector<HTMLElement>('.gjs-st-zone--left .gjs-st-split')!;
    expect(split.call(null).title).toBe('Drag to resize (double-click to reset to 50/50)');
    editor.I18n.addMessages({ ru: {} });
    editor.I18n.setLocale('ru');
    expect(split().title).toBe('Потяните, чтобы изменить высоту (двойной клик — 50/50)');
    expect(root(editor).querySelector<HTMLElement>('.gjs-st-edge--left')!.title).toContain('размер панели');
  });

  it('the labels option wins', async () => {
    editor = await createEditor({ labels: { dropHere: 'Сюда' } });
    expect(root(editor).querySelector('.gjs-st-drop--left')!.textContent).toBe('Сюда');
  });

  it('gives everything back on destroy', async () => {
    editor = await createEditor();
    const ed = editor;
    ed.trigger('destroy');
    expect(root(ed).classList.contains('gjs-st-docked')).toBe(false);
    expect(root(ed).querySelector('.gjs-st-zone')).toBeNull();
    expect(viewsContainer(ed).querySelector('.gjs-sm-sectors')).not.toBeNull();
    const buttons = (ed.Panels.getPanel('views') as any).get('buttons').models;
    expect(buttons.every((b: any) => !String(b.get('context') || '').startsWith('gjs-st-view:'))).toBe(true);
  });

  it('remembers open Style Manager sectors', async () => {
    editor = await createEditor();
    const sector = (editor.StyleManager.getSectors() as any).models[0];
    sector.set('open', !sector.get('open'));
    expect(stored().sectors[sector.getId()]).toBe(sector.get('open'));
  });
});
