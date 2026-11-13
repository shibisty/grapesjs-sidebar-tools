/**
 * Pure model of the dock: which tab lives in which group of which zone.
 * No DOM here — everything is plain data, so it is easy to test and to
 * persist. All functions return new objects and never mutate their input.
 */
import type { DefaultLayout, DockLayout, GroupState, ZoneId, ZoneState } from './types';
import { ZONES } from './types';

/** Left/right can be split in two by height, bottom holds one group. */
export const MAX_GROUPS: Record<ZoneId, number> = { left: 2, right: 2, bottom: 1 };

/** Where a dragged tab can be dropped. */
export type DropTarget =
  /** Into the tab bar of an existing group, before the tab at `index`. */
  | { kind: 'tabs'; zone: ZoneId; group: number; index: number }
  /** A new group in a side zone, above (`before`) or below (`after`) the existing one. */
  | { kind: 'split'; zone: ZoneId; position: 'before' | 'after' }
  /** An empty zone: a new group. */
  | { kind: 'zone'; zone: ZoneId };

export function emptyZone(): ZoneState {
  return { size: null, ratio: 0.5, groups: [], collapsed: false };
}

export function emptyLayout(): DockLayout {
  return { left: emptyZone(), right: emptyZone(), bottom: emptyZone() };
}

export function cloneLayout(layout: DockLayout): DockLayout {
  const out = {} as DockLayout;
  ZONES.forEach((zone) => {
    const z = layout[zone];
    out[zone] = {
      size: z.size,
      ratio: z.ratio,
      groups: z.groups.map((g) => ({ tabs: g.tabs.slice(), active: g.active })),
      collapsed: !!z.collapsed,
    };
  });
  return out;
}

export interface TabLocation {
  zone: ZoneId;
  group: number;
  index: number;
}

export function findTab(layout: DockLayout, tabId: string): TabLocation | null {
  for (const zone of ZONES) {
    const groups = layout[zone].groups;
    for (let g = 0; g < groups.length; g++) {
      const index = groups[g].tabs.indexOf(tabId);
      if (index !== -1) return { zone, group: g, index };
    }
  }
  return null;
}

export function allTabs(layout: DockLayout): string[] {
  const out: string[] = [];
  ZONES.forEach((zone) => layout[zone].groups.forEach((g) => out.push(...g.tabs)));
  return out;
}

function fixActive(group: GroupState, preferIndex = 0): void {
  if (group.active && group.tabs.includes(group.active)) return;
  group.active = group.tabs.length ? group.tabs[Math.min(Math.max(preferIndex, 0), group.tabs.length - 1)] : null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Turns whatever was found in storage / given in options into a valid
 * layout that contains exactly `tabIds`, each once:
 *  - unknown ids and duplicates are dropped, empty groups removed,
 *  - extra groups beyond MAX_GROUPS are merged into the last allowed one,
 *  - tabs missing from the layout go to `fallbackFor(tab)` or to the first
 *    group of the right zone (created when needed).
 */
export function normalizeLayout(
  raw: unknown,
  tabIds: readonly string[],
  opts: {
    /** Active tab for groups that have none (e.g. the button that was active at startup). */
    preferredActive?: readonly string[];
    ratioBounds?: [number, number];
  } = {},
): DockLayout {
  const known = new Set(tabIds);
  const seen = new Set<string>();
  const layout = emptyLayout();
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const [minRatio, maxRatio] = opts.ratioBounds || [0.15, 0.85];

  ZONES.forEach((zone) => {
    const z = src[zone] && typeof src[zone] === 'object' ? src[zone] : {};
    const target = layout[zone];
    if (typeof z.size === 'number' && isFinite(z.size) && z.size > 0) target.size = z.size;
    target.ratio = typeof z.ratio === 'number' && isFinite(z.ratio) ? clamp(z.ratio, minRatio, maxRatio) : 0.5;
    target.collapsed = z.collapsed === true;
    const groups: unknown[] = Array.isArray(z.groups) ? z.groups : [];
    groups.forEach((g) => {
      const tabsRaw: unknown[] = g && typeof g === 'object' && Array.isArray((g as any).tabs) ? (g as any).tabs : [];
      const tabs = tabsRaw.filter((id): id is string => typeof id === 'string' && known.has(id) && !seen.has(id));
      tabs.forEach((id) => seen.add(id));
      if (!tabs.length) return;
      const active = typeof (g as any).active === 'string' ? (g as any).active : null;
      if (target.groups.length >= MAX_GROUPS[zone]) {
        const last = target.groups[target.groups.length - 1];
        last.tabs.push(...tabs);
      } else {
        target.groups.push({ tabs, active });
      }
    });
  });

  const missing = tabIds.filter((id) => !seen.has(id));
  if (missing.length) {
    let home = layout.right.groups[0];
    if (!home) {
      home = { tabs: [], active: null };
      layout.right.groups.push(home);
    }
    home.tabs.push(...missing);
  }

  const preferred = opts.preferredActive || [];
  ZONES.forEach((zone) =>
    layout[zone].groups.forEach((g) => {
      if (!g.active || !g.tabs.includes(g.active)) g.active = g.tabs.find((id) => preferred.includes(id)) || null;
      fixActive(g);
    }),
  );
  return layout;
}

/** A layout from the `defaultLayout` option (zone -> groups of tab ids). */
export function layoutFromDefault(spec: DefaultLayout | undefined): Record<ZoneId, { groups: GroupState[] }> {
  const out = {} as Record<ZoneId, { groups: GroupState[] }>;
  ZONES.forEach((zone) => {
    out[zone] = { groups: (spec?.[zone] || []).map((tabs) => ({ tabs: tabs.slice(), active: null })) };
  });
  return out;
}

/** Can `target` be applied to `layout` at all? */
export function isValidTarget(layout: DockLayout, target: DropTarget): boolean {
  const zone = layout[target.zone];
  if (!zone) return false;
  if (target.kind === 'tabs') return target.group >= 0 && target.group < zone.groups.length;
  if (target.kind === 'split') return MAX_GROUPS[target.zone] > 1 && zone.groups.length < MAX_GROUPS[target.zone];
  return zone.groups.length === 0;
}

/**
 * Moves `tabId` to `target` and makes it the active tab there. Returns
 * the new layout, or the same object when nothing changed / the move is
 * not possible.
 */
export function moveTab(layout: DockLayout, tabId: string, target: DropTarget): DockLayout {
  const from = findTab(layout, tabId);
  if (!from) return layout;
  const next = cloneLayout(layout);

  // Reference to the destination group, taken before the removal shifts indices.
  const destGroup: GroupState | null = target.kind === 'tabs' ? next[target.zone].groups[target.group] || null : null;
  if (target.kind === 'tabs' && !destGroup) return layout;
  if (target.kind === 'split' && MAX_GROUPS[target.zone] < 2) return layout;

  let insertIndex = target.kind === 'tabs' ? target.index : 0;
  const srcZone = next[from.zone];
  const srcGroup = srcZone.groups[from.group];

  if (destGroup === srcGroup) {
    // Reorder within the same group.
    const tabs = srcGroup.tabs;
    insertIndex = clamp(insertIndex, 0, tabs.length);
    if (insertIndex === from.index || insertIndex === from.index + 1) {
      if (srcGroup.active === tabId) return layout;
      srcGroup.active = tabId;
      return next;
    }
    tabs.splice(from.index, 1);
    if (insertIndex > from.index) insertIndex--;
    tabs.splice(insertIndex, 0, tabId);
    srcGroup.active = tabId;
    return next;
  }

  // Take the tab out of its group.
  srcGroup.tabs.splice(from.index, 1);
  if (srcGroup.active === tabId) {
    srcGroup.active = null;
    fixActive(srcGroup, from.index);
  }
  if (!srcGroup.tabs.length) srcZone.groups.splice(from.group, 1);

  const zone = next[target.zone];
  if (target.kind === 'tabs') {
    const tabs = destGroup!.tabs;
    tabs.splice(clamp(insertIndex, 0, tabs.length), 0, tabId);
    destGroup!.active = tabId;
  } else {
    const group: GroupState = { tabs: [tabId], active: tabId };
    if (zone.groups.length >= MAX_GROUPS[target.zone]) {
      // The source group vanished from a full zone and the target was
      // computed before: fall back to joining the remaining group.
      const last = zone.groups[zone.groups.length - 1];
      last.tabs.push(tabId);
      last.active = tabId;
    } else if (target.kind === 'split' && target.position === 'before') {
      zone.groups.unshift(group);
    } else {
      zone.groups.push(group);
    }
  }
  return next;
}

/** Makes `tabId` the visible tab of its group. */
export function activateTab(layout: DockLayout, tabId: string): DockLayout {
  const loc = findTab(layout, tabId);
  if (!loc) return layout;
  const group = layout[loc.zone].groups[loc.group];
  if (group.active === tabId) return layout;
  const next = cloneLayout(layout);
  next[loc.zone].groups[loc.group].active = tabId;
  return next;
}

export function setZoneSize(layout: DockLayout, zone: ZoneId, size: number | null): DockLayout {
  if (layout[zone].size === size) return layout;
  const next = cloneLayout(layout);
  next[zone].size = size;
  return next;
}

/** Collapses / expands a zone (`collapsed` undefined = toggle). */
export function setZoneCollapsed(layout: DockLayout, zone: ZoneId, collapsed?: boolean): DockLayout {
  const value = collapsed === undefined ? !layout[zone].collapsed : collapsed;
  if (!!layout[zone].collapsed === value) return layout;
  const next = cloneLayout(layout);
  next[zone].collapsed = value;
  return next;
}

export function setZoneRatio(layout: DockLayout, zone: ZoneId, ratio: number): DockLayout {
  if (layout[zone].ratio === ratio) return layout;
  const next = cloneLayout(layout);
  next[zone].ratio = ratio;
  return next;
}

/** Appends tabs that appeared later (e.g. a plugin added a view button). */
export function addTabs(layout: DockLayout, tabIds: readonly string[]): DockLayout {
  const missing = tabIds.filter((id) => !findTab(layout, id));
  if (!missing.length) return layout;
  const next = cloneLayout(layout);
  let home = next.right.groups[0] || next.left.groups[0] || next.bottom.groups[0];
  if (!home) {
    home = { tabs: [], active: null };
    next.right.groups.push(home);
  }
  home.tabs.push(...missing);
  fixActive(home);
  return next;
}

/** Removes tabs that disappeared (their button was removed). */
export function removeTabs(layout: DockLayout, tabIds: readonly string[]): DockLayout {
  if (!tabIds.some((id) => findTab(layout, id))) return layout;
  const next = cloneLayout(layout);
  ZONES.forEach((zone) => {
    next[zone].groups = next[zone].groups
      .map((g) => {
        const index = g.tabs.findIndex((id) => tabIds.includes(id));
        g.tabs = g.tabs.filter((id) => !tabIds.includes(id));
        if (g.active && tabIds.includes(g.active)) {
          g.active = null;
          fixActive(g, index);
        }
        return g;
      })
      .filter((g) => g.tabs.length);
  });
  return next;
}
