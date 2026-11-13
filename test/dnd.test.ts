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

  it('the bottom zone never splits', () => {
    const g: GroupBoxes = { ...rightGroup(), zone: 'bottom' };
    expect(hitTest(1100, 700, [g], [])!.target).toEqual({ kind: 'tabs', zone: 'bottom', group: 0, index: 3 });
  });

  it('empty zone strips', () => {
    const hit = hitTest(20, 300, [rightGroup()], [{ zone: 'left', box: box(0, 40, 56, 760) }]);
    expect(hit!.target).toEqual({ kind: 'zone', zone: 'left' });
    expect(hit!.indicator).toEqual(box(0, 40, 56, 760));
  });

  it('nothing under the pointer', () => {
    expect(hitTest(500, 300, [rightGroup()], [{ zone: 'left', box: box(0, 40, 56, 760) }])).toBeNull();
  });

  it('empty tab bar puts the line at its start', () => {
    const g = { ...rightGroup(), tabs: [] };
    expect(hitTest(1050, 20, [g], [])!.indicator.left).toBe(1003);
  });
});
