import { describe, expect, it } from 'vitest';
import { findLayersRoot } from '../src/layersRoot';
import { createFakeEditor } from './helpers/fakeEditor';

function el(id: string) {
  const div = document.createElement('div');
  div.id = id;
  document.body.appendChild(div);
  return div;
}

describe('findLayersRoot', () => {
  it('uses the layersContainer option first', () => {
    const own = el('own');
    el('cfg');
    const { editor } = createFakeEditor({ layersAppendTo: '#cfg' });
    expect(findLayersRoot(editor, '#own')).toEqual({ el: own, explicit: true });
  });

  it('then layerManager.appendTo', () => {
    const cfg = el('cfg');
    const { editor } = createFakeEditor({ layersAppendTo: '#cfg' });
    expect(findLayersRoot(editor, null)).toEqual({ el: cfg, explicit: true });
  });

  it('reports a configured but missing container as explicit', () => {
    const { editor } = createFakeEditor({ layersAppendTo: '#nope' });
    expect(findLayersRoot(editor, null)).toEqual({ el: null, explicit: true });
  });

  it('then the container of the default open-layers command', () => {
    const { editor, commands } = createFakeEditor();
    expect(findLayersRoot(editor, null)).toEqual({ el: null, explicit: false });
    const layers = el('default-layers');
    commands.set('core:open-layers', { layers });
    expect(findLayersRoot(editor, null).el).toBe(layers);
  });

  it('finally the parent of the rendered layer tree', () => {
    const parent = el('parent');
    const tree = document.createElement('div');
    parent.appendChild(tree);
    const { editor } = createFakeEditor();
    (editor as any).LayerManager.view = { el: tree };
    expect(findLayersRoot(editor, null).el).toBe(parent);
  });
});
