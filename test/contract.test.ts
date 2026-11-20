import { afterEach, describe, expect, it } from 'vitest';
import grapesjs, { type Editor } from 'grapesjs';
import plugin from '../src/index';
import { META, VERSION } from '../src/options';
import { CONTROLS, definePlugin, type PluginControl } from '../src/contract';
import { createEditor, destroyEditor } from './helpers/editor';
import pkg from '../package.json';

const control = (ed: object): PluginControl => (ed as Record<symbol, Map<string, PluginControl>>)[CONTROLS].get(META.id)!;
let editor: Editor | undefined;
afterEach(async () => {
  await destroyEditor(editor);
  editor = undefined;
  document.body.innerHTML = '';
});

describe('plugin contract', () => {
  it('meta: id = npm name, version = package.json, registered by id; .default is the function', () => {
    expect(META.id).toBe(pkg.name);
    expect(VERSION).toBe(pkg.version);
    expect((plugin as unknown as { meta: unknown }).meta).toBe(META);
    expect((plugin as unknown as { default: unknown }).default).toBe(plugin);
    (globalThis as { grapesjs?: unknown }).grapesjs = grapesjs;
    definePlugin(plugin, META);
    expect(grapesjs.plugins.get(META.id)).toBe(plugin);
  });

  it('reports its options (changes need a reload)', async () => {
    editor = await createEditor({ deviceBar: false });
    const c = control(editor);
    expect(c.getOptions()).toMatchObject({ workspace: true, deviceBar: false, storageKey: 'gjs-sidebar-tools', panelId: '' });
    expect(c.setOptions({ deviceBar: true })).toEqual({ applied: [], reload: ['deviceBar'] });
  });
});
