import { describe, expect, it, vi } from 'vitest';
import { createSectorMemory, getSectorList, sectorId } from '../src/sectors';
import { FakeSector } from './helpers/fakeEditor';

describe('getSectorList', () => {
  it('supports collections, arrays and toArray()', () => {
    const s = new FakeSector('a');
    expect(getSectorList({ getSectors: () => ({ models: [s] }) })).toEqual([s]);
    expect(getSectorList({ getSectors: () => [s] })).toEqual([s]);
    expect(getSectorList({ getSectors: () => ({ toArray: () => [s] }) })).toEqual([s]);
    expect(getSectorList({ getSectors: () => null })).toEqual([]);
    expect(getSectorList(null)).toEqual([]);
    expect(
      getSectorList({
        getSectors: () => {
          throw new Error('x');
        },
      }),
    ).toEqual([]);
  });

  it('reads the id via getId() or get("id")', () => {
    expect(sectorId(new FakeSector('typography'))).toBe('typography');
    const plain = new FakeSector('layout');
    (plain as any).getId = undefined;
    expect(sectorId(plain)).toBe('layout');
  });
});

describe('createSectorMemory', () => {
  it('applies stored open states and records user changes', () => {
    const general = new FakeSector('general', false);
    const layout = new FakeSector('layout', true);
    const other = new FakeSector('other', true);
    const stored: Record<string, boolean> = { general: true, layout: false };
    const save = vi.fn();
    const mem = createSectorMemory(() => ({ getSectors: () => [general, layout, other] }), stored, save);

    mem.sync();
    expect(general.get('open')).toBe(true);
    expect(layout.get('open')).toBe(false);
    expect(other.get('open')).toBe(true); // unknown sectors keep their state
    expect(save).not.toHaveBeenCalled(); // applying is not a user change

    other.set('open', false);
    expect(stored.other).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('binds every sector only once and unbinds on destroy', () => {
    const s = new FakeSector('a');
    const mem = createSectorMemory(() => ({ getSectors: () => [s] }), {}, vi.fn());
    mem.sync();
    mem.sync();
    expect(s.listenerCount('change:open')).toBe(1);
    mem.destroy();
    expect(s.listenerCount('change:open')).toBe(0);
  });

  it('picks up sectors added later', () => {
    const list = [new FakeSector('a')];
    const stored = { b: true };
    const mem = createSectorMemory(() => ({ getSectors: () => list }), stored, vi.fn());
    mem.sync();
    const b = new FakeSector('b', false);
    list.push(b);
    mem.sync();
    expect(b.get('open')).toBe(true);
  });
});
