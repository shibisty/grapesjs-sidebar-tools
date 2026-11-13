import { describe, expect, it, vi } from 'vitest';
import { createStateStore, defaultState, sanitizeState } from '../src/state';

const KEY = 'test-state';

describe('sanitizeState', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeState(null)).toEqual(defaultState());
    expect(sanitizeState('x')).toEqual(defaultState());
    expect(sanitizeState([])).toEqual(defaultState());
  });

  it('keeps an object layout (validated later) and boolean sectors', () => {
    const layout = { right: { groups: [] } };
    expect(sanitizeState({ layout, sectors: { general: 1, layout: 0 } })).toEqual({
      layout,
      sectors: { general: true, layout: false },
    });
    expect(sanitizeState({ layout: [1], sectors: [1] })).toEqual(defaultState());
  });

  it('ignores the 1.x state shape', () => {
    expect(sanitizeState({ tab: 'settings', ratio: 0.3, globalTab: 'open-sm' })).toEqual(defaultState());
  });
});

describe('createStateStore', () => {
  it('loads and saves through localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ sectors: { a: true } }));
    const store = createStateStore({ persist: true, storageKey: KEY });
    expect(store.state.sectors).toEqual({ a: true });
    store.state.sectors.b = false;
    store.save();
    expect(JSON.parse(localStorage.getItem(KEY)!).sectors).toEqual({ a: true, b: false });
  });

  it('survives corrupted JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createStateStore({ persist: true, storageKey: KEY }).state).toEqual(defaultState());
  });

  it('does not touch localStorage with persist: false', () => {
    localStorage.setItem(KEY, JSON.stringify({ sectors: { a: true } }));
    const store = createStateStore({ persist: false, storageKey: KEY });
    expect(store.state.sectors).toEqual({});
    store.save();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ sectors: { a: true } });
  });

  it('ignores storage write errors', () => {
    const store = createStateStore({ persist: true, storageKey: KEY });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => store.save()).not.toThrow();
  });

  it('keeps object devices and workspace states', () => {
    const s = sanitizeState({ devices: { zoom: 50 }, workspace: { grid: '2h' }, layout: [] });
    expect(s.devices).toEqual({ zoom: 50 });
    expect(s.workspace).toEqual({ grid: '2h' });
    expect(s.layout).toBeNull();
    expect(sanitizeState({ workspace: [1] }).workspace).toBeUndefined();
  });
});
