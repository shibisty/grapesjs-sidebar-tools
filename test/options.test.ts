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
    expect(o.storageKey).toBe('gjs-lsb-state');
    expect(o.labels).toEqual({}); // texts come from editor.I18n
    expect(DEFAULT_OPTIONS.labels).toEqual({});
    expect(o.globalTabCommands).toEqual(['open-sm', 'open-tm', 'open-layers', 'open-blocks']);
  });

  it('keeps only non-empty string label overrides', () => {
    const o = resolveOptions({ labels: { settingsTab: 'Настройки', styleManagerTab: '', resizerTitle: 5 as any } });
    expect(o.labels).toEqual({ settingsTab: 'Настройки' });
    expect(resolveOptions({ labels: 'x' as any }).labels).toEqual({});
  });

  it('does not share the defaults object between instances', () => {
    const a = resolveOptions();
    a.labels.settingsTab = 'changed';
    a.globalTabCommands.push('x');
    expect(resolveOptions().labels.settingsTab).toBeUndefined();
    expect(resolveOptions().globalTabCommands).toHaveLength(4);
  });

  it('normalizes ratio bounds', () => {
    expect(resolveOptions({ minRatio: 0.9, maxRatio: 0.2 })).toMatchObject({ minRatio: 0.2, maxRatio: 0.9 });
    expect(resolveOptions({ minRatio: -1, maxRatio: 5 })).toMatchObject({ minRatio: 0, maxRatio: 1 });
    expect(resolveOptions({ minRatio: NaN })).toMatchObject({ minRatio: 0.15 });
  });

  it('falls back to an empty command list for invalid globalTabCommands', () => {
    expect(resolveOptions({ globalTabCommands: 'open-sm' as any }).globalTabCommands).toEqual([]);
  });
});
