/**
 * Pure model of the workspace: the area between the zones, split into 1–4
 * groups of document tabs (pages, blueprint editors...). One of them holds
 * the GrapesJS canvas (all canvas documents live in the same group, there
 * is only one canvas). No DOM; functions never mutate their input.
 */

export type WsGrid = '1' | '2h' | '2v' | '3h' | '4';
export const WS_GRIDS: readonly WsGrid[] = ['1', '2h', '2v', '3h', '4'];

/** Columns × rows of every grid (groups are numbered row by row). */
export const GRID_SHAPE: Record<WsGrid, { cols: number; rows: number }> = {
  '1': { cols: 1, rows: 1 },
  '2h': { cols: 2, rows: 1 },
  '2v': { cols: 1, rows: 2 },
  '3h': { cols: 3, rows: 1 },
  '4': { cols: 2, rows: 2 },
};

export const groupCount = (grid: WsGrid) => GRID_SHAPE[grid].cols * GRID_SHAPE[grid].rows;

export interface WsGroup {
  /** Document ids, in tab order. Ids of documents not (yet) opened again are kept to restore their place. */
  tabs: string[];
  active: string | null;
}

export interface WsLayout {
  grid: WsGrid;
  /** Column widths as fractions (sum 1). */
  cols: number[];
  /** Height of the first row as a fraction (2 rows only). */
  row: number;
  groups: WsGroup[];
  /** The group documents open into by default (the last one used). */
  focus: number;
}

const MIN_FRACTION = 0.1;

export function equalCols(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

export function emptyWsLayout(): WsLayout {
  return { grid: '1', cols: [1], row: 0.5, groups: [{ tabs: [], active: null }], focus: 0 };
}

export function cloneWs(l: WsLayout): WsLayout {
  return {
    grid: l.grid,
    cols: l.cols.slice(),
    row: l.row,
    groups: l.groups.map((g) => ({ tabs: g.tabs.slice(), active: g.active })),
    focus: l.focus,
  };
}

function validCols(raw: unknown, n: number): number[] {
  if (!Array.isArray(raw) || raw.length !== n) return equalCols(n);
  const nums = raw.map(Number);
  if (nums.some((v) => !isFinite(v) || v <= 0)) return equalCols(n);
  const sum = nums.reduce((a, b) => a + b, 0);
  return nums.map((v) => Math.max(MIN_FRACTION, v / sum));
}

/** Validates what was stored. Unknown document ids are kept (their owner may open them later). */
export function normalizeWs(raw: unknown): WsLayout {
  const l = emptyWsLayout();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return l;
  const r = raw as Record<string, any>;
  l.grid = WS_GRIDS.includes(r.grid) ? r.grid : '1';
  const n = groupCount(l.grid);
  l.cols = validCols(r.cols, GRID_SHAPE[l.grid].cols);
  l.row = typeof r.row === 'number' && isFinite(r.row) ? Math.min(0.85, Math.max(0.15, r.row)) : 0.5;
  const seen = new Set<string>();
  const groups: WsGroup[] = (Array.isArray(r.groups) ? r.groups : []).map((g: any) => {
    const tabs = (Array.isArray(g?.tabs) ? g.tabs : []).filter((id: unknown): id is string => {
      if (typeof id !== 'string' || !id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { tabs, active: typeof g?.active === 'string' && tabs.includes(g.active) ? g.active : tabs[0] ?? null };
  });
  l.groups = Array.from({ length: n }, (_, i) => groups[i] || { tabs: [], active: null });
  // Extra stored groups (grid shrank by hand-editing): their tabs go to the last group.
  groups.slice(n).forEach((g) => l.groups[n - 1].tabs.push(...g.tabs));
  l.focus = typeof r.focus === 'number' && r.focus >= 0 && r.focus < n ? Math.floor(r.focus) : 0;
  return l;
}

export function findDoc(l: WsLayout, id: string): { group: number; index: number } | null {
  for (let g = 0; g < l.groups.length; g++) {
    const index = l.groups[g].tabs.indexOf(id);
    if (index !== -1) return { group: g, index };
  }
  return null;
}

/** Changes the grid; groups that no longer exist give their tabs to the last remaining one. */
export function setGrid(l: WsLayout, grid: WsGrid): WsLayout {
  if (l.grid === grid) return l;
  const next = cloneWs(l);
  const n = groupCount(grid);
  next.grid = grid;
  next.cols = equalCols(GRID_SHAPE[grid].cols);
  next.row = 0.5;
  if (next.groups.length > n) {
    const extra = next.groups.splice(n);
    const last = next.groups[n - 1];
    extra.forEach((g) => last.tabs.push(...g.tabs));
    if (!last.active) last.active = last.tabs[0] ?? null;
  }
  while (next.groups.length < n) next.groups.push({ tabs: [], active: null });
  if (next.focus >= n) next.focus = n - 1;
  return next;
}

/**
 * Adds a document (when it is not there yet) to `group` (default: the
 * focus group), at the end. Returns the same layout when it is already in.
 */
export function addDoc(l: WsLayout, id: string, group?: number): WsLayout {
  if (findDoc(l, id)) return l;
  const next = cloneWs(l);
  const g = group != null && group >= 0 && group < next.groups.length ? group : next.focus;
  next.groups[g].tabs.push(id);
  if (!next.groups[g].active) next.groups[g].active = id;
  return next;
}

/** Removes a document; its group shows the neighbour tab when it was the active one. */
export function removeDoc(l: WsLayout, id: string, isOpen: (id: string) => boolean = () => true): WsLayout {
  const loc = findDoc(l, id);
  if (!loc) return l;
  const next = cloneWs(l);
  const g = next.groups[loc.group];
  g.tabs.splice(loc.index, 1);
  if (g.active === id) {
    const open = g.tabs.filter(isOpen);
    // the tab after the closed one, else the one before
    const after = g.tabs.slice(loc.index).find(isOpen);
    g.active = after ?? open[open.length - 1] ?? null;
  }
  return next;
}

export function activateDoc(l: WsLayout, id: string): WsLayout {
  const loc = findDoc(l, id);
  if (!loc) return l;
  if (l.groups[loc.group].active === id && l.focus === loc.group) return l;
  const next = cloneWs(l);
  next.groups[loc.group].active = id;
  next.focus = loc.group;
  return next;
}

/**
 * Moves `id` to `group` before `index` and activates it there. Canvas
 * documents move together: there is one canvas, so all of them stay in
 * the same group (`together` lists them).
 */
export function moveDoc(l: WsLayout, id: string, group: number, index: number, together: readonly string[] = []): WsLayout {
  const from = findDoc(l, id);
  if (!from || group < 0 || group >= l.groups.length) return l;
  const moving = together.includes(id) ? together.filter((t) => findDoc(l, t)) : [id];
  if (moving.length === 1 && from.group === group) {
    // reorder inside a group
    const next = cloneWs(l);
    const tabs = next.groups[group].tabs;
    let at = Math.min(Math.max(index, 0), tabs.length);
    if (at === from.index || at === from.index + 1) {
      return activateDoc(l, id);
    }
    tabs.splice(from.index, 1);
    if (at > from.index) at--;
    tabs.splice(at, 0, id);
    next.groups[group].active = id;
    next.focus = group;
    return next;
  }
  const next = cloneWs(l);
  // Where to insert: count the tabs before `index` that stay in the target group.
  const target = next.groups[group];
  const before = target.tabs.slice(0, Math.max(0, index)).filter((t) => !moving.includes(t)).length;
  next.groups.forEach((g) => {
    const hadActive = g.active && moving.includes(g.active);
    const firstIndex = g.tabs.findIndex((t) => moving.includes(t));
    g.tabs = g.tabs.filter((t) => !moving.includes(t));
    if (hadActive && g !== target) g.active = g.tabs[Math.min(Math.max(firstIndex, 0), g.tabs.length - 1)] ?? null;
  });
  const ordered = moving.slice().sort((a, b) => {
    const la = findDoc(l, a)!;
    const lb = findDoc(l, b)!;
    return la.group - lb.group || la.index - lb.index;
  });
  target.tabs.splice(before, 0, ...ordered);
  target.active = id;
  next.focus = group;
  return next;
}

export function setCols(l: WsLayout, cols: number[]): WsLayout {
  const next = cloneWs(l);
  next.cols = validCols(cols, GRID_SHAPE[l.grid].cols);
  return next;
}

export function setRow(l: WsLayout, row: number): WsLayout {
  const next = cloneWs(l);
  next.row = Math.min(0.85, Math.max(0.15, row));
  return next;
}

/** Drops ids that are not open (used to keep the stored layout from growing forever). */
export function pruneWs(l: WsLayout, isOpen: (id: string) => boolean): WsLayout {
  if (l.groups.every((g) => g.tabs.every(isOpen))) return l;
  const next = cloneWs(l);
  next.groups.forEach((g) => {
    g.tabs = g.tabs.filter(isOpen);
    if (g.active && !g.tabs.includes(g.active)) g.active = g.tabs[0] ?? null;
  });
  return next;
}
