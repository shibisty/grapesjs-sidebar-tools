import { describe, expect, it } from 'vitest';
import {
  activateDoc,
  addDoc,
  emptyWsLayout,
  findDoc,
  groupCount,
  moveDoc,
  normalizeWs,
  pruneWs,
  removeDoc,
  setCols,
  setGrid,
  setRow,
  type WsLayout,
} from '../src/wsLayout';

const tabs = (l: WsLayout) => l.groups.map((g) => g.tabs.map((t) => (t === g.active ? `${t}*` : t)).join(','));

function make(groups: string[][], grid: WsLayout['grid'] = groups.length === 1 ? '1' : groups.length === 2 ? '2h' : groups.length === 3 ? '3h' : '4'): WsLayout {
  return normalizeWs({ grid, groups: groups.map((t) => ({ tabs: t, active: t[0] })) });
}

describe('normalizeWs', () => {
  it('returns an empty single group for garbage', () => {
    expect(normalizeWs(null)).toEqual(emptyWsLayout());
    expect(normalizeWs([1, 2])).toEqual(emptyWsLayout());
    expect(normalizeWs({ grid: 'nope' }).grid).toBe('1');
  });

  it('keeps unknown ids, drops duplicates and non-strings, fixes active', () => {
    const l = normalizeWs({ grid: '2h', groups: [{ tabs: ['a', 'b', 'a', 5], active: 'zzz' }, { tabs: ['b', 'c'], active: 'c' }] });
    expect(tabs(l)).toEqual(['a*,b', 'c*']);
  });

  it('fills missing groups and merges extra ones into the last', () => {
    expect(normalizeWs({ grid: '4', groups: [{ tabs: ['a'] }] }).groups).toHaveLength(4);
    const l = normalizeWs({ grid: '2h', groups: [{ tabs: ['a'] }, { tabs: ['b'] }, { tabs: ['c'] }] });
    expect(l.groups).toHaveLength(2);
    expect(l.groups[1].tabs).toEqual(['b', 'c']);
  });

  it('validates sizes and focus', () => {
    const l = normalizeWs({ grid: '3h', cols: [1, 1, 2], row: 5, focus: 9 });
    expect(l.cols.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(l.cols[2]).toBeCloseTo(0.5);
    expect(l.row).toBe(0.85);
    expect(l.focus).toBe(0);
    expect(normalizeWs({ grid: '2h', cols: [1] }).cols).toEqual([0.5, 0.5]);
    expect(normalizeWs({ grid: '2h', cols: [1, -1] }).cols).toEqual([0.5, 0.5]);
  });
});

describe('grid', () => {
  it('counts groups', () => {
    expect(['1', '2h', '2v', '3h', '4'].map((g) => groupCount(g as any))).toEqual([1, 2, 2, 3, 4]);
  });

  it('grows with empty groups and shrinks into the last group', () => {
    const one = make([['a', 'b']]);
    const four = setGrid(one, '4');
    expect(four.groups).toHaveLength(4);
    expect(four.cols).toEqual([0.5, 0.5]);
    const moved = moveDoc(four, 'b', 3, 0);
    expect(moved.focus).toBe(3);
    const back = setGrid(moved, '2h');
    expect(tabs(back)).toEqual(['a*', 'b*']);
    expect(back.focus).toBe(1);
    expect(setGrid(back, '2h')).toBe(back);
  });
});

describe('add / remove / activate', () => {
  it('adds into the focus group or a given one, once', () => {
    let l = setGrid(emptyWsLayout(), '2h');
    l = addDoc(l, 'a');
    l = addDoc(l, 'b', 1);
    expect(addDoc(l, 'a', 1)).toBe(l);
    expect(tabs(l)).toEqual(['a*', 'b*']);
    expect(addDoc(l, 'c', 7).groups[0].tabs).toEqual(['a', 'c']);
  });

  it('activates the next open tab after removing the active one', () => {
    let l = make([['a', 'b', 'c', 'd']]);
    l = activateDoc(l, 'b');
    expect(tabs(removeDoc(l, 'b'))).toEqual(['a,c*,d']);
    // 'c' is only remembered (not open): skip it
    expect(tabs(removeDoc(l, 'b', (id) => id !== 'c'))).toEqual(['a,c,d*']);
    const last = activateDoc(l, 'd');
    expect(tabs(removeDoc(last, 'd'))).toEqual(['a,b,c*']);
    expect(removeDoc(l, 'zzz')).toBe(l);
  });

  it('activate moves the focus', () => {
    const l = make([['a'], ['b']]);
    const next = activateDoc(l, 'b');
    expect(next.focus).toBe(1);
    expect(activateDoc(next, 'b')).toBe(next);
  });
});

describe('moveDoc', () => {
  it('reorders inside a group', () => {
    const l = make([['a', 'b', 'c']]);
    expect(moveDoc(l, 'a', 0, 3).groups[0].tabs).toEqual(['b', 'c', 'a']);
    expect(moveDoc(l, 'c', 0, 0).groups[0].tabs).toEqual(['c', 'a', 'b']);
    // dropping right next to itself only activates
    expect(moveDoc(l, 'b', 0, 2).groups[0].tabs).toEqual(['a', 'b', 'c']);
    expect(moveDoc(l, 'b', 0, 2).groups[0].active).toBe('b');
  });

  it('moves to another group and activates there', () => {
    const l = make([['a', 'b'], ['c']]);
    const next = moveDoc(l, 'a', 1, 0);
    expect(tabs(next)).toEqual(['b*', 'a*,c']);
    expect(next.focus).toBe(1);
    expect(moveDoc(l, 'a', 5, 0)).toBe(l);
  });

  it('moves canvas documents together, keeping their order', () => {
    const l = make([['p1', 'x', 'p2'], ['y']]);
    const next = moveDoc(l, 'p2', 1, 1, ['p1', 'p2']);
    expect(next.groups[0].tabs).toEqual(['x']);
    expect(next.groups[1].tabs).toEqual(['y', 'p1', 'p2']);
    expect(next.groups[1].active).toBe('p2');
  });
});

describe('sizes and prune', () => {
  it('clamps columns and rows', () => {
    const l = setGrid(emptyWsLayout(), '2h');
    expect(setCols(l, [0.01, 0.99]).cols[0]).toBe(0.1);
    expect(setRow(l, 0).row).toBe(0.15);
  });

  it('drops ids that are not open', () => {
    const l = make([['a', 'gone', 'b']]);
    const pruned = pruneWs(activateDoc(l, 'gone'), (id) => id !== 'gone');
    expect(tabs(pruned)).toEqual(['a*,b']);
    expect(pruneWs(l, () => true)).toBe(l);
    expect(findDoc(pruned, 'gone')).toBeNull();
  });
});
