import { describe, expect, it, vi } from 'vitest';
import { createManagerMover, locateManager, prerenderManager } from '../src/managers';

function makeHome(cls: string) {
  const home = document.createElement('div');
  const before = document.createElement('span');
  const el = document.createElement('div');
  el.className = cls;
  const after = document.createElement('span');
  home.append(before, el, after);
  document.body.appendChild(home);
  return { home, before, el, after };
}

describe('locateManager', () => {
  it('prefers the appendTo container of the module', () => {
    const { home, el } = makeHome('gjs-sm-sectors');
    makeHome('gjs-sm-sectors'); // another one elsewhere
    const found = locateManager({ getConfig: () => ({ appendTo: home }) }, 'gjs-sm-sectors');
    expect(found?.el).toBe(el);
    expect(found?.parent).toBe(home);
  });

  it('falls back to the first child of appendTo when the class is custom', () => {
    const home = document.createElement('div');
    const custom = document.createElement('section');
    home.appendChild(custom);
    document.body.appendChild(home);
    expect(locateManager({ getConfig: () => ({ appendTo: home }) }, 'gjs-sm-sectors')?.el).toBe(custom);
  });

  it('uses the module view element before searching the document', () => {
    makeHome('gjs-traits-cs');
    const { el } = makeHome('custom-traits');
    expect(locateManager({ view: { el } }, ['gjs-traits-cs'])?.el).toBe(el);
    const sm = makeHome('custom-sm');
    expect(locateManager({ SectView: { el: sm.el } }, 'gjs-sm-sectors')?.el).toBe(sm.el);
  });

  it('ignores a detached module view element', () => {
    const { el } = makeHome('gjs-traits-cs');
    const detached = document.createElement('div');
    expect(locateManager({ view: { el: detached } }, ['gjs-traits-cs', 'gjs-trt-traits'])?.el).toBe(el);
  });

  it('searches the whole document without appendTo, skipping excluded nodes', () => {
    const pane = document.createElement('div');
    const moved = document.createElement('div');
    moved.className = 'gjs-trt-traits';
    pane.appendChild(moved);
    document.body.appendChild(pane);
    const { el } = makeHome('gjs-trt-traits');
    expect(locateManager(null, 'gjs-trt-traits')?.el).toBe(moved);
    expect(locateManager(null, 'gjs-trt-traits', pane)?.el).toBe(el);
    expect(locateManager(null, 'gjs-missing')).toBeNull();
  });
});

describe('createManagerMover', () => {
  it('moves managers in and back to their exact position', () => {
    const sm = makeHome('gjs-sm-sectors');
    const tm = makeHome('gjs-trt-traits');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const mover = createManagerMover(() => null);

    mover.moveIn('sm', target);
    mover.moveIn('tm', target);
    expect(sm.el.parentNode).toBe(target);
    expect(tm.el.parentNode).toBe(target);

    mover.moveIn('sm', target); // idempotent
    expect(target.children).toHaveLength(2);

    mover.moveAllBack();
    expect(Array.from(sm.home.children)).toEqual([sm.before, sm.el, sm.after]);
    expect(Array.from(tm.home.children)).toEqual([tm.before, tm.el, tm.after]);
  });

  it('appends at the end when the original next sibling is gone', () => {
    const sm = makeHome('gjs-sm-sectors');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const mover = createManagerMover(() => null);
    mover.moveIn('sm', target);
    sm.after.remove();
    mover.moveBack('sm');
    expect(sm.home.lastElementChild).toBe(sm.el);
  });

  it('prerenders a missing manager once and retries', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    let calls = 0;
    const mover = createManagerMover(
      () => null,
      () => {
        calls++;
        makeHome('gjs-traits-cs');
        return true;
      },
    );
    mover.moveIn('tm', target);
    expect(calls).toBe(1);
    expect(target.querySelector('.gjs-traits-cs')).not.toBeNull();
  });

  it('does not retry prerendering after a failure', () => {
    const target = document.createElement('div');
    let calls = 0;
    const mover = createManagerMover(
      () => null,
      () => {
        calls++;
        return false;
      },
    );
    mover.moveIn('tm', target);
    mover.moveIn('tm', target);
    expect(calls).toBe(1);
  });

  it('does nothing when the manager is not rendered yet', () => {
    const target = document.createElement('div');
    const mover = createManagerMover(() => null);
    expect(() => mover.moveIn('tm', target)).not.toThrow();
    expect(target.children).toHaveLength(0);
    expect(() => mover.moveAllBack()).not.toThrow();
  });
});

describe('prerenderManager', () => {
  function editorWith(cmd: any, has = true) {
    return { Commands: { has: () => has, get: () => cmd } };
  }

  it('runs and stops the command with an inactive sender', () => {
    const cmd = {
      run: vi.fn(function (this: any) {
        this.$cn = {};
      }),
      stop: vi.fn(),
    };
    const editor = editorWith(cmd);
    expect(prerenderManager(editor, 'tm', { getConfig: () => ({}) })).toBe(true);
    const [ed, sender] = cmd.run.mock.calls[0] as any[];
    expect(ed).toBe(editor);
    expect(sender.get('active')).toBe(false);
    expect(cmd.stop).toHaveBeenCalledTimes(1);
    // already rendered
    expect(prerenderManager(editor, 'tm', { getConfig: () => ({}) })).toBe(false);
    expect(cmd.run).toHaveBeenCalledTimes(1);
  });

  it('skips managers with appendTo / custom UI or without the command', () => {
    const cmd = { run: vi.fn() };
    expect(prerenderManager(editorWith(cmd), 'sm', { getConfig: () => ({ appendTo: '#x' }) })).toBe(false);
    expect(prerenderManager(editorWith(cmd), 'sm', { getConfig: () => ({ custom: true }) })).toBe(false);
    expect(prerenderManager(editorWith(cmd, false), 'sm', null)).toBe(false);
    expect(prerenderManager({}, 'sm', null)).toBe(false);
    expect(cmd.run).not.toHaveBeenCalled();
  });

  it('swallows errors from the command', () => {
    const cmd = {
      run: () => {
        throw new Error('boom');
      },
    };
    expect(prerenderManager(editorWith(cmd), 'tm', null)).toBe(false);
  });
});
