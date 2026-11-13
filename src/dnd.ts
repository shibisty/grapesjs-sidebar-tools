/**
 * Drop target hit-testing for dragged tabs. Pure geometry: the dock
 * measures its elements when a drag starts and asks `hitTest` on every
 * pointer move.
 */
import type { DropTarget } from './layout';
import { MAX_GROUPS } from './layout';
import type { ZoneId } from './types';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GroupBoxes {
  zone: ZoneId;
  group: number;
  /** Number of groups currently in the zone. */
  groupCount: number;
  tabBar: Box;
  /** Boxes of the tabs in the bar, in order. */
  tabs: Box[];
  body: Box;
}

export interface EmptyZoneBox {
  zone: ZoneId;
  box: Box;
  /** A collapsed zone (its rail): dropping joins this group at this index instead of creating one. */
  join?: { group: number; index: number };
}

export interface Hit {
  target: DropTarget;
  /** Where to draw the drop indicator (viewport coordinates). */
  indicator: Box;
}

/** Part of a group body (top/bottom) that splits a side zone instead of joining the group. */
export const SPLIT_EDGE = 1 / 3;

export function contains(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

/** Insertion index in a tab bar for pointer x (before the first tab whose middle is right of x). */
export function insertIndex(tabs: Box[], x: number, rtl = false): number {
  let index = 0;
  tabs.forEach((t, i) => {
    const mid = t.left + t.width / 2;
    if (rtl ? x < mid : x > mid) index = i + 1;
  });
  return index;
}

export function hitTest(
  x: number,
  y: number,
  groups: GroupBoxes[],
  emptyZones: EmptyZoneBox[],
  rtl = false,
): Hit | null {
  for (const g of groups) {
    if (contains(g.tabBar, x, y)) {
      const index = insertIndex(g.tabs, x, rtl);
      let lineX: number;
      if (!g.tabs.length) lineX = g.tabBar.left + 4;
      else if (index < g.tabs.length) lineX = g.tabs[index].left;
      else {
        const last = g.tabs[g.tabs.length - 1];
        lineX = last.left + last.width;
      }
      return {
        target: { kind: 'tabs', zone: g.zone, group: g.group, index },
        indicator: { left: lineX - 1, top: g.tabBar.top + 2, width: 3, height: Math.max(g.tabBar.height - 4, 8) },
      };
    }
  }
  for (const g of groups) {
    if (!contains(g.body, x, y)) continue;
    const canSplit = MAX_GROUPS[g.zone] > 1 && g.groupCount < MAX_GROUPS[g.zone];
    if (canSplit && g.body.height > 0) {
      const rel = (y - g.body.top) / g.body.height;
      const half = g.body.height / 2;
      if (rel < SPLIT_EDGE) {
        return {
          target: { kind: 'split', zone: g.zone, position: 'before' },
          indicator: { left: g.tabBar.left, top: g.tabBar.top, width: g.body.width, height: g.tabBar.height + half },
        };
      }
      if (rel > 1 - SPLIT_EDGE) {
        return {
          target: { kind: 'split', zone: g.zone, position: 'after' },
          indicator: { left: g.body.left, top: g.body.top + half, width: g.body.width, height: half },
        };
      }
    }
    return {
      target: { kind: 'tabs', zone: g.zone, group: g.group, index: g.tabs.length },
      indicator: { ...g.body },
    };
  }
  for (const z of emptyZones) {
    if (contains(z.box, x, y)) {
      const target: DropTarget = z.join
        ? { kind: 'tabs', zone: z.zone, group: z.join.group, index: z.join.index }
        : { kind: 'zone', zone: z.zone };
      return { target, indicator: { ...z.box } };
    }
  }
  return null;
}
