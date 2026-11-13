import type { Editor } from 'grapesjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SidebarToolsApi, WorkspaceApi, WorkspaceDocInput } from '../src/index';
import { createEditor, destroyEditor, flush, root } from './helpers/editor';

let editor: Editor | undefined;
beforeEach(() => localStorage.clear());
afterEach(async () => {
  await destroyEditor(editor);
  editor = undefined;
});

const api = (ed: Editor) => (ed as any).SidebarTools as SidebarToolsApi;
const ws = (ed: Editor) => api(ed).workspace!;
const stored = () => JSON.parse(localStorage.getItem('gjs-sidebar-tools') || 'null');

/** Tabs per workspace group as 'id*' (shown) strings. */
function wsTabs(ed: Editor): string[][] {
  return Array.from(root(ed).querySelectorAll<HTMLElement>('.gjs-st-wsg')).map((g) =>
    Array.from(g.querySelectorAll<HTMLElement>('.gjs-st-wtab')).map(
      (t) => t.dataset.doc! + (t.classList.contains('gjs-st-wtab--active') ? '*' : ''),
    ),
  );
}
const wtab = (ed: Editor, id: string) => root(ed).querySelector<HTMLElement>(`.gjs-st-wtab[data-doc="${id}"]`)!;
const ptr = (type: string, init: MouseEventInit) =>
  Object.assign(new MouseEvent(type, { bubbles: true, ...init }), { pointerId: 1 });
const canvasOff = (ed: Editor) => root(ed).classList.contains('gjs-st-canvas-off');

function canvasDoc(id: string, extra: Partial<WorkspaceDocInput> = {}): WorkspaceDocInput {
  return { id, title: id, kind: 'canvas', ...extra };
}

describe('workspace', () => {
  it('exists after load with a single "Canvas" tab', async () => {
    const ready = vi.fn();
    editor = await createEditor({}, [(ed) => ed.on('sidebar-tools:ready', ready)]);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(api(editor).workspace).toBeTruthy();
    expect(root(editor).classList.contains('gjs-st-ws-on')).toBe(true);
    expect(wsTabs(editor)).toEqual([['gjs-st-canvas*']]);
    // the default canvas tab can't be closed
    expect(wtab(editor, 'gjs-st-canvas').querySelector('[data-close]')).toBeNull();
    expect(ws(editor).close('gjs-st-canvas')).toBe(false);
    expect(ws(editor).canvasDoc()).toBe('gjs-st-canvas');
    expect(canvasOff(editor)).toBe(false);
  });

  it('onReady calls back right away once it exists', async () => {
    editor = await createEditor();
    const cb = vi.fn();
    api(editor).onReady(cb);
    expect(cb).toHaveBeenCalledWith(ws(editor));
  });

  it('can be turned off', async () => {
    editor = await createEditor({ workspace: false });
    expect(api(editor).workspace).toBeNull();
    expect(root(editor).querySelector('.gjs-st-ws')).toBeNull();
  });

  it('canvas documents replace the default tab and load on activation', async () => {
    editor = await createEditor();
    const a = vi.fn();
    const b = vi.fn();
    ws(editor).open(canvasDoc('page:a', { onActivate: a }), { notify: false });
    expect(wsTabs(editor)).toEqual([['page:a*']]);
    expect(a).not.toHaveBeenCalled();
    // a single canvas doc can't be closed
    expect(wtab(editor, 'page:a').querySelector('[data-close]')).toBeNull();

    ws(editor).open(canvasDoc('page:b', { onActivate: b }));
    expect(b).toHaveBeenCalledTimes(1);
    expect(wsTabs(editor)).toEqual([['page:a', 'page:b*']]);
    expect(ws(editor).canvasDoc()).toBe('page:b');

    wtab(editor, 'page:a').dispatchEvent(ptr('pointerdown', { button: 0 }));
    document.dispatchEvent(ptr('pointerup', {}));
    expect(a).toHaveBeenCalledTimes(1);
    expect(wsTabs(editor)).toEqual([['page:a*', 'page:b']]);

    // closing the shown canvas doc loads the neighbour
    (wtab(editor, 'page:a').querySelector('[data-close]') as HTMLElement).click();
    expect(wsTabs(editor)).toEqual([['page:b*']]);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('element documents mount once, hide the canvas and keep their DOM', async () => {
    editor = await createEditor();
    const mount = vi.fn((el: HTMLElement) => {
      el.innerHTML = '<input class="probe">';
    });
    const onShow = vi.fn();
    const onClosed = vi.fn();
    ws(editor).open({ id: 'bp:1', title: 'Script', mount, onShow, onClosed });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(onShow).toHaveBeenCalled();
    expect(canvasOff(editor)).toBe(true);
    const input = root(editor).querySelector<HTMLInputElement>('.gjs-st-doc[data-doc="bp:1"] .probe')!;
    input.value = 'kept';

    ws(editor).activate('gjs-st-canvas');
    expect(canvasOff(editor)).toBe(false);
    const pane = root(editor).querySelector<HTMLElement>('.gjs-st-doc[data-doc="bp:1"]')!;
    expect(pane.hidden).toBe(true);

    ws(editor).activate('bp:1');
    expect(mount).toHaveBeenCalledTimes(1);
    expect(root(editor).querySelector<HTMLInputElement>('.probe')!.value).toBe('kept');

    expect(ws(editor).close('bp:1')).toBe(true);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(root(editor).querySelector('.gjs-st-doc[data-doc="bp:1"]')).toBeNull();
    expect(canvasOff(editor)).toBe(false);
  });

  it('onClose can keep a tab open, force closes anyway', async () => {
    editor = await createEditor();
    ws(editor).open({ id: 'x', title: 'X', onClose: () => false });
    expect(ws(editor).close('x')).toBe(false);
    expect(ws(editor).has('x')).toBe(true);
    expect(ws(editor).close('x', { force: true })).toBe(true);
    expect(ws(editor).has('x')).toBe(false);
  });

  it('update changes the title and the dirty marker', async () => {
    editor = await createEditor();
    ws(editor).open({ id: 'x', title: 'X' });
    ws(editor).update('x', { title: 'Renamed', dirty: true });
    const t = wtab(editor, 'x');
    expect(t.textContent).toContain('Renamed');
    expect(t.classList.contains('gjs-st-wtab--dirty')).toBe(true);
    expect(ws(editor).list().find((d) => d.id === 'x')).toMatchObject({ title: 'Renamed', kind: 'element', active: true });
  });

  it('splits into 2–4 groups; the canvas stays in its group', async () => {
    editor = await createEditor();
    const w: WorkspaceApi = ws(editor);
    w.open({ id: 'x', title: 'X' });
    w.setGrid('2h');
    expect(wsTabs(editor)).toHaveLength(2);
    w.open({ id: 'y', title: 'Y' }, { group: 1 });
    expect(wsTabs(editor)).toEqual([['gjs-st-canvas', 'x*'], ['y*']]);
    w.activate('gjs-st-canvas');
    expect(canvasOff(editor)).toBe(false);
    expect(root(editor).querySelector('.gjs-st-wsg[data-group="0"] .gjs-st-wsg__body--canvas')).toBeTruthy();

    editor.runCommand('sidebar-tools:workspace-grid', { grid: '4' });
    expect(w.getGrid()).toBe('4');
    expect(root(editor).querySelectorAll('.gjs-st-wsg')).toHaveLength(4);
    expect(root(editor).querySelectorAll('.gjs-st-wsg-rowsplit')).toHaveLength(1);
    expect(root(editor).querySelectorAll('.gjs-st-wsg-colsplit')).toHaveLength(2);

    w.setGrid('1');
    expect(wsTabs(editor)).toEqual([['gjs-st-canvas*', 'x', 'y']]);
    w.setGrid('bogus' as any);
    expect(w.getGrid()).toBe('1');
  });

  it('the layout menu switches the grid', async () => {
    editor = await createEditor();
    (root(editor).querySelector('[data-layout-menu]') as HTMLElement).click();
    const items = root(editor).querySelectorAll<HTMLElement>('.gjs-st-wsmenu [data-grid]');
    expect(items).toHaveLength(5);
    (root(editor).querySelector('.gjs-st-wsmenu [data-grid="3h"]') as HTMLElement).click();
    expect(ws(editor).getGrid()).toBe('3h');
    expect(root(editor).querySelector('.gjs-st-wsmenu')).toBeNull();
  });

  it('middle click and Delete close tabs', async () => {
    editor = await createEditor();
    ws(editor).open({ id: 'x', title: 'X' });
    ws(editor).open({ id: 'y', title: 'Y' });
    wtab(editor, 'x').dispatchEvent(ptr('pointerdown', { button: 1 }));
    expect(ws(editor).has('x')).toBe(false);
    wtab(editor, 'y').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
    expect(ws(editor).has('y')).toBe(false);
  });

  it('fires workspace events', async () => {
    editor = await createEditor();
    const events: string[] = [];
    editor.on('sidebar-tools:workspace', (e: { type: string; id?: string }) => events.push(`${e.type}:${e.id ?? ''}`));
    ws(editor).open({ id: 'x', title: 'X' });
    ws(editor).close('x');
    ws(editor).setGrid('2v');
    expect(events).toEqual(['open:x', 'activate:x', 'close:x', 'layout:']);
  });

  it('remembers the layout and the tabs of documents to open again', async () => {
    editor = await createEditor();
    ws(editor).setGrid('2h');
    ws(editor).open({ id: 'bp:1', title: 'One' }, { group: 1 });
    ws(editor).open(canvasDoc('page:a'), { notify: false });
    await flush(5);
    expect(stored().workspace.grid).toBe('2h');
    await destroyEditor(editor);

    editor = await createEditor();
    const w = ws(editor);
    expect(w.getGrid()).toBe('2h');
    expect(w.remembered('bp:')).toEqual(['bp:1']);
    expect(w.remembered('page:')).toEqual(['page:a']);
    // opened again: back in its group
    w.open({ id: 'bp:1', title: 'One' });
    expect(w.list().find((d) => d.id === 'bp:1')!.group).toBe(1);
    expect(w.remembered('bp:')).toEqual([]);
  });

  it('destroy removes the workspace and closes documents', async () => {
    editor = await createEditor();
    const onClosed = vi.fn();
    ws(editor).open({ id: 'x', title: 'X', onClosed });
    const el = root(editor);
    await destroyEditor(editor);
    editor = undefined;
    expect(onClosed).toHaveBeenCalled();
    expect(el.querySelector('.gjs-st-ws')).toBeNull();
    expect(el.classList.contains('gjs-st-ws-on')).toBe(false);
  });
});
