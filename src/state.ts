import type { ResolvedOptions, SidebarState } from './types';

export interface StateStore {
  readonly state: SidebarState;
  save(): void;
}

export function defaultState(): SidebarState {
  return { tab: 'style', ratio: 0.5, sectors: {}, globalTab: null };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Accessing localStorage throws when site data is blocked.
    return null;
  }
}

/** Validates whatever was found in storage; unknown/broken fields fall back to defaults. */
export function sanitizeState(raw: unknown): SidebarState {
  const state = defaultState();
  if (!raw || typeof raw !== 'object') return state;
  const saved = raw as Record<string, unknown>;
  state.tab = saved.tab === 'settings' ? 'settings' : 'style';
  if (typeof saved.ratio === 'number' && isFinite(saved.ratio)) state.ratio = saved.ratio;
  if (saved.sectors && typeof saved.sectors === 'object' && !Array.isArray(saved.sectors)) {
    Object.keys(saved.sectors).forEach((id) => {
      state.sectors[id] = !!(saved.sectors as Record<string, unknown>)[id];
    });
  }
  state.globalTab = typeof saved.globalTab === 'string' ? saved.globalTab : null;
  return state;
}

/**
 * Loads the persisted state (when `persist` is on) and returns a store
 * whose `save()` writes it back. With `persist: false` everything lives
 * in memory only.
 */
export function createStateStore(options: Pick<ResolvedOptions, 'persist' | 'storageKey'>): StateStore {
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
