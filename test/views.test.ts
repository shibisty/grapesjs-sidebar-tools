import { describe, expect, it } from 'vitest';
import { describeButton, diffSnapshot, findViewsPanel, isShown, knownContent, snapshot } from '../src/views';
import { FakeModel } from './helpers/fakeEditor';

function fakePanels(panels: Record<string, FakeModel[]>) {
  const models = Object.keys(panels).map((id) => {
    const p = new FakeModel({ buttons: { models: panels[id] } });
    (p as any).id = id;
    return p;
  });
  return {
    Panels: {
      getPanels: () => ({ models }),
      getPanel: (id: string) => models.find((m: any) => m.id === id) || null,
    },
  };
}

function btn(id: string, attrs: Record<string, unknown> = {}) {
  const b = new FakeModel(attrs);
  (b as any).id = id;
  return b;
}

describe('findViewsPanel', () => {
  it('finds the panel by the commands of its buttons, whatever its id', () => {
    const ed = fakePanels({ options: [btn('x', { command: 'fullscreen' })], 'panel-switcher': [btn('l', { command: 'show-layers' })] });
    expect((findViewsPanel(ed as any, null) as any).id).toBe('panel-switcher');
  });

  it('uses panelId when given, and falls back to "views"', () => {
    const ed = fakePanels({ views: [btn('a', { command: 'custom' })], other: [] });
    expect((findViewsPanel(ed as any, 'other') as any).id).toBe('other');
    expect((findViewsPanel(ed as any, null) as any).id).toBe('views');
    expect(findViewsPanel(ed as any, 'missing')).toBeNull();
    expect(findViewsPanel({} as any, null)).toBeNull();
  });
});

describe('describeButton', () => {
  const editor = { I18n: { t: (k: string) => (k === 'panels.buttons.titles.open-sm' ? 'Open Style Manager' : undefined) } } as any;

  it('takes icon, label and title from the button', () => {
    const info = describeButton(editor, btn('pages', { command: 'pages:open', className: 'fa fa-file', label: '<svg></svg>', attributes: { title: 'Pages' } }));
    expect(info).toEqual({ id: 'pages:open', buttonId: 'pages', command: 'pages:open', className: 'fa fa-file', label: '<svg></svg>', title: 'Pages' });
  });

  it('falls back to the GrapesJS button titles, then to the id', () => {
    expect(describeButton(editor, btn('open-sm', { command: 'open-sm' }))!.title).toBe('Open Style Manager');
    expect(describeButton(editor, btn('zz', { command: 'zz-cmd' }))!.title).toBe('zz');
  });

  it('ignores buttons without a command id (functions / objects)', () => {
    expect(describeButton(editor, btn('f', { command: () => 1 }))).toBeNull();
  });
});

describe('content capture helpers', () => {
  it('snapshot/diff finds added and newly shown children only', () => {
    const c = document.createElement('div');
    const shown = document.createElement('div');
    const hidden = document.createElement('div');
    hidden.hidden = true;
    const stays = document.createElement('div');
    stays.style.display = 'none';
    c.append(shown, hidden, stays);
    document.body.appendChild(c);
    const snap = snapshot(c);
    const added = document.createElement('div');
    c.appendChild(added);
    hidden.hidden = false;
    expect(diffSnapshot(c, snap)).toEqual([hidden, added]);
    expect(isShown(stays)).toBe(false);
  });

  it('knownContent reads the elements the core commands keep', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    expect(knownContent({ $cnt: { get: () => a }, layers: b })).toEqual([a, b]);
    expect(knownContent(null)).toEqual([]);
    expect(knownContent({ container: 'nope' })).toEqual([]);
  });
});
