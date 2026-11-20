import { describe, expect, it } from 'vitest';
import { contains, hitTest, insertIndex, type GroupBoxes } from '../src/dnd';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

/** Right zone at x=1000..1200 with one group: tab bar 0..40, body 40..800. */
function rightGroup(groupCount = 1, group = 0, top = 0, height = 800): GroupBoxes {
  return {
    zone: 'right',
    group,
    groupCount,
    tabBar: box(1000, top, 200, 40),
    tabs: [box(1100, top + 5, 30, 30), box(1135, top + 5, 30, 30), box(1170, top + 5, 30, 30)],
    body: box(1000, top + 40, 200, height - 40),
  };
}

describe('geometry helpers', () => {
  it('contains', () => {
    expect(contains(box(0, 0, 10, 10), 5, 5)).toBe(true);
    expect(contains(box(0, 0, 10, 10), 11, 5)).toBe(false);
  });

  it('insertIndex compares with tab middles', () => {
    const tabs = rightGroup().tabs;
    expect(insertIndex(tabs, 1090)).toBe(0);
    expect(insertIndex(tabs, 1120)).toBe(1);
    expect(insertIndex(tabs, 1199)).toBe(3);
    expect(insertIndex(tabs, 1190, true)).toBe(0);
  });
});

describe('hitTest', () => {
  it('tab bar -> insert at index, with a line indicator', () => {
    const hit = hitTest(1140, 20, [rightGroup()], []);
    expect(hit!.target).toEqual({ kind: 'tabs', zone: 'right', group: 0, index: 1 });
    expect(hit!.indicator.width).toBeLessThanOrEqual(4);
    expect(hit!.indicator.left).toBe(1134);
  });

  it('top / bottom third of a single group body splits the side zone', () => {
    expect(hitTest(1100, 100, [rightGroup()], [])!.target).toEqual({ kind: 'split', zone: 'right', position: 'before' });
    const after = hitTest(1100, 700, [rightGroup()], [])!;
    expect(after.target).toEqual({ kind: 'split', zone: 'right', position: 'after' });
    expect(after.indicator.top).toBe(420); // lower half of the body
  });

  it('middle of the body joins the group', () => {
    expect(hitTest(1100, 420, [rightGroup()], [])!.target).toEqual({ kind: 'tabs', zone: 'right', group: 0, index: 3 });
  });

  it('a zone that is already split only accepts joins', () => {
    const groups = [rightGroup(2, 0, 0, 400), rightGroup(2, 1, 400, 400)];
    expect(hitTest(1100, 50, groups, [])!.target).toEqual({ kind: 'tabs', zone: 'right', group: 0, index: 3 });
    expect(hitTest(1100, 790, groups, [])!.target).toEqual({ kind: 'tabs', zone: 'right', group: 1, index: 3 });
  });

  /** A bottom group at x=0..1200 (tab bar 600..640, body 640..900). */
  function bottomGroup(groupCount = 1, group = 0, left = 0, width = 1200, zoneWidth = 1200): GroupBoxes {
    return {
      zone: 'bottom',
      group,
      groupCount,
      zoneWidth,
      tabBar: box(left, 600, width, 40),
      tabs: [box(left + 5, 605, 30, 30)],
      body: box(left, 640, width, 260),
    };
  }

  it('bottom: the left / right third of a group puts a new group beside it', () => {
    expect(hitTest(100, 700, [bottomGroup()], [])!.target).toEqual({ kind: 'split', zone: 'bottom', position: 'before', group: 0 });
    const right = hitTest(1100, 700, [bottomGroup()], [])!;
    expect(right.target).toEqual({ kind: 'split', zone: 'bottom', position: 'after', group: 0 });
    expect(right.indicator).toEqual({ left: 600, top: 600, width: 600, height: 300 });
    expect(hitTest(600, 700, [bottomGroup()], [])!.target).toEqual({ kind: 'tabs', zone: 'bottom', group: 0, index: 1 });
    // RTL: the right third is "before"
    expect(hitTest(1100, 700, [bottomGroup()], [], true)!.target).toMatchObject({ position: 'before' });
  });

  it('bottom: no split when the zone is too narrow for one more group, or already has three', () => {
    expect(hitTest(1100, 700, [bottomGroup(2, 1, 600, 600, 1000)], [])!.target.kind).toBe('tabs');
    expect(hitTest(3700, 700, [bottomGroup(2, 1, 1920, 1920, 3840)], [])!.target.kind).toBe('split');
    expect(hitTest(3700, 700, [bottomGroup(3, 2, 2560, 1280, 3840)], [])!.target.kind).toBe('tabs');
  });

  it('empty zone strips', () => {
    const hit = hitTest(20, 300, [rightGroup()], [{ zone: 'left', box: box(0, 40, 56, 760) }]);
    expect(hit!.target).toEqual({ kind: 'zone', zone: 'left' });
    expect(hit!.indicator).toEqual(box(0, 40, 56, 760));
  });

  it('a collapsed zone (rail) joins its group instead of creating one', () => {
    const hit = hitTest(1380, 300, [], [{ zone: 'right', box: box(1360, 0, 40, 800), join: { group: 0, index: 4 } }]);
    expect(hit!.target).toEqual({ kind: 'tabs', zone: 'right', group: 0, index: 4 });
  });

  it('nothing under the pointer', () => {
    expect(hitTest(500, 300, [rightGroup()], [{ zone: 'left', box: box(0, 40, 56, 760) }])).toBeNull();
  });

  it('empty tab bar puts the line at its start', () => {
    const g = { ...rightGroup(), tabs: [] };
    expect(hitTest(1050, 20, [g], [])!.indicator.left).toBe(1003);
  });
});
