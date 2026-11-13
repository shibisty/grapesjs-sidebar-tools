import type { SidebarState } from './types';

export interface StateStore {
  readonly state: SidebarState;
  save(): void;
}

export function defaultState(): SidebarState {
  return { layout: null, sectors: {} };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // access throws when site data is blocked
  }
}

/**
 * Validates the top level of what was found in storage. The layout itself
 * is validated against the real tabs later (`normalizeLayout`).
 */
export function sanitizeState(raw: unknown): SidebarState {
  const state = defaultState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
  const saved = raw as Record<string, unknown>;
  if (saved.layout && typeof saved.layout === 'object' && !Array.isArray(saved.layout)) {
    state.layout = saved.layout as SidebarState['layout'];
  }
  if (saved.sectors && typeof saved.sectors === 'object' && !Array.isArray(saved.sectors)) {
    Object.keys(saved.sectors).forEach((id) => {
      state.sectors[id] = !!(saved.sectors as Record<string, unknown>)[id];
    });
  }
  return state;
}

/**
 * Loads the persisted state (when `persist` is on) and returns a store
 * whose `save()` writes it back. With `persist: false` everything lives in
 * memory only.
 */
export function createStateStore(options: { persist: boolean; storageKey: string }): StateStore {
  const storage = options.persist ? getStorage() : null;
  let state = defaultState();
  if (storage) {
    try {
      state = sanitizeState(JSON.parse(storage.getItem(options.storageKey) || 'null'));
    } catch {
      state = defaultState();
    }
  }
  return {
    state,
    save() {
      if (!storage) return;
      try {
        storage.setItem(options.storageKey, JSON.stringify(state));
      } catch {
        // quota exceeded / storage blocked: not critical
      }
    },
  };
}
