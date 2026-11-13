import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, mergeDeep, resolveOptions } from '../src/options';

describe('mergeDeep', () => {
  it('merges nested plain objects without mutating the base', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const out = mergeDeep(base, { nested: { y: 3 } });
    expect(out).toEqual({ a: 1, nested: { x: 1, y: 3 } });
    expect(base.nested.y).toBe(2);
  });

  it('replaces arrays instead of merging them', () => {
    expect(mergeDeep({ list: [1, 2, 3] }, { list: [9] }).list).toEqual([9]);
  });

  it('ignores undefined values', () => {
    expect(mergeDeep({ key: 'a' }, { key: undefined }).key).toBe('a');
  });

  it('keeps DOM nodes as references', () => {
    const el = document.createElement('div');
    const out = mergeDeep({ target: { a: 1 } as any }, { target: el });
    expect(out.target).toBe(el);
  });

  it('accepts null/undefined extra', () => {
    expect(mergeDeep({ a: 1 }, null)).toEqual({ a: 1 });
    expect(mergeDeep({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('resolveOptions', () => {
  it('returns defaults when called without options', () => {
    const o = resolveOptions();
    expect(o.persist).toBe(true);
    expect(o.storageKey).toBe('gjs-sidebar-tools');
    expect(o.labels).toEqual({}); // texts come from editor.I18n
    expect(DEFAULT_OPTIONS.labels).toEqual({});
    expect(o.views).toBeNull();
    expect(o.panelId).toBeNull();
    expect(o.defaultLayout).toEqual({});
    expect(o.sizes).toEqual({ left: 260, right: null, bottom: 240 });
    expect(o.minSize).toEqual({ side: 180, bottom: 120 });
    expect(o.stylesTab).toBe('open-sm');
    expect(o.settingsTab).toBe('open-tm');
  });

  it('keeps only non-empty string label overrides', () => {
    const o = resolveOptions({ labels: { dropHere: 'Сюда', resizerTitle: '', zoneResizerTitle: 5 as any } });
    expect(o.labels).toEqual({ dropHere: 'Сюда' });
    expect(resolveOptions({ labels: 'x' as any }).labels).toEqual({});
  });

  it('does not share the defaults object between instances', () => {
    const a = resolveOptions();
    a.labels.dropHere = 'changed';
    a.sizes.left = 1;
    a.minSize.side = 1;
    expect(resolveOptions().labels.dropHere).toBeUndefined();
    expect(resolveOptions().sizes.left).toBe(260);
    expect(resolveOptions().minSize.side).toBe(180);
  });

  it('normalizes ratio bounds', () => {
    expect(resolveOptions({ minRatio: 0.9, maxRatio: 0.2 })).toMatchObject({ minRatio: 0.2, maxRatio: 0.9 });
    expect(resolveOptions({ minRatio: -1, maxRatio: 5 })).toMatchObject({ minRatio: 0, maxRatio: 1 });
    expect(resolveOptions({ minRatio: NaN })).toMatchObject({ minRatio: 0.15 });
  });

  it('validates sizes, minSize, views and defaultLayout', () => {
    const o = resolveOptions({
      sizes: { left: -5, right: 300, bottom: NaN },
      minSize: { side: 0, bottom: 90 },
      views: ['open-sm', '', 5 as any],
      defaultLayout: { left: [['open-layers', 3 as any], 'x' as any], right: 'nope' as any },
      storageKey: '',
      panelId: '',
    });
    expect(o.sizes).toEqual({ left: 260, right: 300, bottom: 240 });
    expect(o.minSize).toEqual({ side: 180, bottom: 90 });
    expect(o.views).toEqual(['open-sm']);
    expect(o.defaultLayout).toEqual({ left: [['open-layers']] });
    expect(o.storageKey).toBe('gjs-sidebar-tools');
    expect(o.panelId).toBeNull();
  });
});
