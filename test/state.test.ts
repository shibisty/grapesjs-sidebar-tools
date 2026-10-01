import { describe, expect, it, vi } from 'vitest';
import { createStateStore, defaultState, sanitizeState } from '../src/state';

const KEY = 'test-state';

describe('sanitizeState', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeState(null)).toEqual(defaultState());
    expect(sanitizeState('x')).toEqual(defaultState());
    expect(sanitizeState([])).toMatchObject({ tab: 'style', ratio: 0.5 });
  });

  it('keeps valid fields and drops invalid ones', () => {
    expect(
      sanitizeState({ tab: 'settings', ratio: 0.3, sectors: { general: 1, layout: 0 }, globalTab: 'open-layers' }),
    ).toEqual({ tab: 'settings', ratio: 0.3, sectors: { general: true, layout: false }, globalTab: 'open-layers' });
    expect(sanitizeState({ tab: 'bogus', ratio: 'x', sectors: [1], globalTab: 5 })).toEqual(defaultState());
    expect(sanitizeState({ ratio: Infinity }).ratio).toBe(0.5);
  });
});

describe('createStateStore', () => {
  it('loads and saves through localStorage', () => {
    localStorage.setItem(KEY, JSON.stringify({ tab: 'settings', ratio: 0.7 }));
    const store = createStateStore({ persist: true, storageKey: KEY });
    expect(store.state.tab).toBe('settings');
    expect(store.state.ratio).toBe(0.7);
    store.state.globalTab = 'open-blocks';
    store.save();
    expect(JSON.parse(localStorage.getItem(KEY)!).globalTab).toBe('open-blocks');
  });

  it('survives corrupted JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createStateStore({ persist: true, storageKey: KEY }).state).toEqual(defaultState());
  });

  it('does not touch localStorage with persist: false', () => {
    localStorage.setItem(KEY, JSON.stringify({ tab: 'settings' }));
    const store = createStateStore({ persist: false, storageKey: KEY });
    expect(store.state.tab).toBe('style');
    store.state.tab = 'settings';
    store.state.ratio = 0.2;
    store.save();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ tab: 'settings' });
  });

  it('ignores storage write errors', () => {
    const store = createStateStore({ persist: true, storageKey: KEY });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => store.save()).not.toThrow();
  });
});
