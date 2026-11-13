import { describe, expect, it } from 'vitest';
import {
  activateTab,
  addTabs,
  allTabs,
  emptyLayout,
  findTab,
  isValidTarget,
  layoutFromDefault,
  moveTab,
  normalizeLayout,
  removeTabs,
  setZoneRatio,
  setZoneSize,
} from '../src/layout';
import type { DockLayout } from '../src/types';

const ALL = ['open-sm', 'open-tm', 'open-layers', 'open-blocks'];

function base(): DockLayout {
  return normalizeLayout(null, ALL, { preferredActive: ['open-blocks'] });
}

const tabsOf = (l: DockLayout) => ({
  left: l.left.groups.map((g) => g.tabs.join(',') + ':' + g.active),
  right: l.right.groups.map((g) => g.tabs.join(',') + ':' + g.active),
  bottom: l.bottom.groups.map((g) => g.tabs.join(',') + ':' + g.active),
});

describe('normalizeLayout', () => {
  it('puts every tab into the right zone by default, with the preferred active tab', () => {
    expect(tabsOf(base())).toEqual({ left: [], right: ['open-sm,open-tm,open-layers,open-blocks:open-blocks'], bottom: [] });
  });

  it('keeps a valid stored layout as is', () => {
    const raw = {
      left: { size: 300, ratio: 0.3, groups: [{ tabs: ['open-layers'], active: 'open-layers' }, { tabs: ['open-blocks'], active: null }] },
      right: { size: null, ratio: 0.5, groups: [{ tabs: ['open-sm', 'open-tm'], active: 'open-tm' }] },
      bottom: { groups: [] },
    };
    const l = normalizeLayout(raw, ALL);
    expect(tabsOf(l)).toEqual({
      left: ['open-layers:open-layers', 'open-blocks:open-blocks'],
      right: ['open-sm,open-tm:open-tm'],
      bottom: [],
    });
    expect(l.left.size).toBe(300);
    expect(l.left.ratio).toBe(0.3);
  });

  it('drops unknown and duplicate tabs, empty groups and invalid values', () => {
    const raw = {
      left: { size: -3, ratio: 'x', groups: [{ tabs: ['gone', 'open-sm'], active: 'gone' }, { tabs: ['open-sm'] }, 'junk'] },
      right: { groups: [{ tabs: [] }] },
      bottom: null,
    };
    const l = normalizeLayout(raw, ALL);
    expect(tabsOf(l)).toEqual({ left: ['open-sm:open-sm'], right: ['open-tm,open-layers,open-blocks:open-tm'], bottom: [] });
    expect(l.left.size).toBeNull();
    expect(l.left.ratio).toBe(0.5);
  });

  it('merges groups beyond the zone limit (2 for sides, 1 for bottom)', () => {
    const raw = {
      bottom: { groups: [{ tabs: ['open-sm'] }, { tabs: ['open-tm'] }] },
      left: { groups: [{ tabs: ['open-layers'] }, { tabs: ['open-blocks'] }, { tabs: ['x'] }] },
    };
    const l = normalizeLayout(raw, [...ALL, 'x']);
    expect(tabsOf(l).bottom).toEqual(['open-sm,open-tm:open-sm']);
    expect(tabsOf(l).left).toEqual(['open-layers:open-layers', 'open-blocks,x:open-blocks']);
  });

  it('clamps the ratio and accepts garbage input', () => {
    expect(normalizeLayout({ left: { ratio: 0.99, groups: [] } }, ALL, { ratioBounds: [0.2, 0.8] }).left.ratio).toBe(0.8);
    expect(allTabs(normalizeLayout('nope', ALL))).toEqual(ALL);
    expect(allTabs(normalizeLayout([1, 2], ALL))).toEqual(ALL);
  });

  it('builds from the defaultLayout option', () => {
    const l = normalizeLayout(layoutFromDefault({ left: [['open-layers'], ['open-blocks']], bottom: [['open-tm']] }), ALL);
    expect(tabsOf(l)).toEqual({
      left: ['open-layers:open-layers', 'open-blocks:open-blocks'],
      right: ['open-sm:open-sm'],
      bottom: ['open-tm:open-tm'],
    });
  });
});

describe('moveTab', () => {
  it('moves a tab into an empty zone', () => {
    const l = moveTab(base(), 'open-layers', { kind: 'zone', zone: 'left' });
    expect(tabsOf(l)).toEqual({ left: ['open-layers:open-layers'], right: ['open-sm,open-tm,open-blocks:open-blocks'], bottom: [] });
  });

  it('splits a side zone above or below its group', () => {
    let l = moveTab(base(), 'open-sm', { kind: 'split', zone: 'right', position: 'after' });
    expect(tabsOf(l).right).toEqual(['open-tm,open-layers,open-blocks:open-blocks', 'open-sm:open-sm']);
    l = moveTab(base(), 'open-sm', { kind: 'split', zone: 'right', position: 'before' });
    expect(tabsOf(l).right).toEqual(['open-sm:open-sm', 'open-tm,open-layers,open-blocks:open-blocks']);
  });

  it('never splits the bottom zone', () => {
    const l = moveTab(base(), 'open-tm', { kind: 'zone', zone: 'bottom' });
    expect(moveTab(l, 'open-sm', { kind: 'split', zone: 'bottom', position: 'after' })).toBe(l);
    expect(isValidTarget(l, { kind: 'split', zone: 'bottom', position: 'after' })).toBe(false);
  });

  it('inserts into a tab bar at an index and activates the tab', () => {
    let l = moveTab(base(), 'open-layers', { kind: 'zone', zone: 'left' });
    l = moveTab(l, 'open-sm', { kind: 'tabs', zone: 'left', group: 0, index: 0 });
    expect(tabsOf(l).left).toEqual(['open-sm,open-layers:open-sm']);
    expect(tabsOf(l).right).toEqual(['open-tm,open-blocks:open-blocks']);
  });

  it('reorders tabs inside a group', () => {
    const b = base();
    expect(tabsOf(moveTab(b, 'open-sm', { kind: 'tabs', zone: 'right', group: 0, index: 4 })).right).toEqual([
      'open-tm,open-layers,open-blocks,open-sm:open-sm',
    ]);
    expect(tabsOf(moveTab(b, 'open-blocks', { kind: 'tabs', zone: 'right', group: 0, index: 1 })).right).toEqual([
      'open-sm,open-blocks,open-tm,open-layers:open-blocks',
    ]);
    // dropped on its own place: only activates
    const same = moveTab(b, 'open-tm', { kind: 'tabs', zone: 'right', group: 0, index: 1 });
    expect(tabsOf(same).right).toEqual(['open-sm,open-tm,open-layers,open-blocks:open-tm']);
    expect(moveTab(b, 'open-blocks', { kind: 'tabs', zone: 'right', group: 0, index: 3 })).toBe(b);
  });

  it('removes a group that became empty and un-splits the zone', () => {
    let l = moveTab(base(), 'open-sm', { kind: 'split', zone: 'right', position: 'after' });
    l = moveTab(l, 'open-sm', { kind: 'tabs', zone: 'right', group: 0, index: 0 });
    expect(l.right.groups).toHaveLength(1);
    expect(tabsOf(l).right).toEqual(['open-sm,open-tm,open-layers,open-blocks:open-sm']);
  });

  it('activates a neighbour when the active tab leaves its group', () => {
    const l = moveTab(base(), 'open-blocks', { kind: 'zone', zone: 'left' });
    expect(tabsOf(l).right).toEqual(['open-sm,open-tm,open-layers:open-layers']);
  });

  it('fixes indices when the source group before the target disappears', () => {
    let l = moveTab(base(), 'open-sm', { kind: 'split', zone: 'right', position: 'before' });
    // group 0 = [open-sm], group 1 = the rest; move open-sm into group 1
    l = moveTab(l, 'open-sm', { kind: 'tabs', zone: 'right', group: 1, index: 0 });
    expect(tabsOf(l).right).toEqual(['open-sm,open-tm,open-layers,open-blocks:open-sm']);
  });

  it('ignores unknown tabs and invalid targets', () => {
    const b = base();
    expect(moveTab(b, 'nope', { kind: 'zone', zone: 'left' })).toBe(b);
    expect(moveTab(b, 'open-sm', { kind: 'tabs', zone: 'left', group: 3, index: 0 })).toBe(b);
  });

  it('does not mutate its input', () => {
    const b = base();
    const json = JSON.stringify(b);
    moveTab(b, 'open-sm', { kind: 'split', zone: 'right', position: 'after' });
    expect(JSON.stringify(b)).toBe(json);
  });
});

describe('isValidTarget', () => {
  it('knows which zones accept which drops', () => {
    const b = base();
    expect(isValidTarget(b, { kind: 'zone', zone: 'left' })).toBe(true);
    expect(isValidTarget(b, { kind: 'zone', zone: 'right' })).toBe(false);
    expect(isValidTarget(b, { kind: 'split', zone: 'right', position: 'after' })).toBe(true);
    expect(isValidTarget(b, { kind: 'split', zone: 'left', position: 'after' })).toBe(true);
    expect(isValidTarget(b, { kind: 'tabs', zone: 'right', group: 0, index: 0 })).toBe(true);
    expect(isValidTarget(b, { kind: 'tabs', zone: 'right', group: 1, index: 0 })).toBe(false);
    const split = moveTab(b, 'open-sm', { kind: 'split', zone: 'right', position: 'after' });
    expect(isValidTarget(split, { kind: 'split', zone: 'right', position: 'after' })).toBe(false);
  });
});

describe('helpers', () => {
  it('findTab / activateTab / sizes / ratio', () => {
    const b = base();
    expect(findTab(b, 'open-layers')).toEqual({ zone: 'right', group: 0, index: 2 });
    expect(findTab(b, 'nope')).toBeNull();
    expect(activateTab(b, 'open-sm').right.groups[0].active).toBe('open-sm');
    expect(activateTab(b, 'open-blocks')).toBe(b);
    expect(setZoneSize(b, 'left', 320).left.size).toBe(320);
    expect(setZoneSize(b, 'left', null)).toBe(b);
    expect(setZoneRatio(b, 'left', 0.3).left.ratio).toBe(0.3);
  });

  it('addTabs / removeTabs', () => {
    const b = base();
    const added = addTabs(b, ['pages', 'open-sm']);
    expect(added.right.groups[0].tabs).toEqual([...ALL, 'pages']);
    expect(addTabs(b, ['open-sm'])).toBe(b);
    expect(allTabs(addTabs(emptyLayout(), ['x']))).toEqual(['x']);
    const removed = removeTabs(b, ['open-blocks']);
    expect(removed.right.groups[0]).toEqual({ tabs: ['open-sm', 'open-tm', 'open-layers'], active: 'open-layers' });
    let l = moveTab(b, 'open-layers', { kind: 'zone', zone: 'left' });
    l = removeTabs(l, ['open-layers']);
    expect(l.left.groups).toHaveLength(0);
    expect(removeTabs(b, ['nope'])).toBe(b);
  });
});
