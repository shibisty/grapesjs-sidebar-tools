import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGlobalTabMemory, findViewButton } from '../src/globalTab';
import { createFakeEditor, FakeModel } from './helpers/fakeEditor';

describe('findViewButton', () => {
  it('finds the panel button bound to the command', () => {
    const btn = new FakeModel({ command: 'open-layers' });
    const { editor } = createFakeEditor({ panels: [new FakeModel({ command: 'open-sm' }), btn] });
    expect(findViewButton(editor, 'open-layers')).toBe(btn);
    expect(findViewButton(editor, 'open-blocks')).toBeNull();
  });

  it('survives an editor without panels', () => {
    const { editor } = createFakeEditor();
    (editor as any).Panels = undefined;
    expect(findViewButton(editor, 'open-sm')).toBeNull();
  });
});

describe('createGlobalTabMemory', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(saved: string | null, restore = true) {
    const layersBtn = new FakeModel({ command: 'open-layers', active: false });
    const { editor } = createFakeEditor({ panels: [layersBtn] });
    let value = saved;
    const set = vi.fn((id: string) => {
      value = id;
    });
    const mem = createGlobalTabMemory(editor, {
      commands: ['open-sm', 'open-layers'],
      restore,
      get: () => value,
      set,
    });
    return { mem, layersBtn, set, get: () => value };
  }

  it('activates the remembered tab through its panel button', () => {
    const { mem, layersBtn } = setup('open-layers');
    mem.restore();
    expect(layersBtn.get('active')).toBe(true);
  });

  it('does nothing with restore: false or unknown commands', () => {
    const a = setup('open-layers', false);
    a.mem.restore();
    expect(a.layersBtn.get('active')).toBe(false);
    const b = setup('something-else');
    b.mem.restore();
    expect(b.layersBtn.get('active')).toBe(false);
  });

  it('records runs only after the restore delay, and only global tab commands', () => {
    const { mem, set, get } = setup(null);
    mem.onRun('open-sm'); // editor's own initial run
    expect(set).not.toHaveBeenCalled();
    mem.restore();
    mem.onRun('open-sm');
    expect(set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    mem.onRun('core:undo');
    mem.onRun({});
    expect(set).not.toHaveBeenCalled();
    mem.onRun('open-layers');
    expect(get()).toBe('open-layers');
  });

  it('destroy() stops recording', () => {
    const { mem, set } = setup(null);
    mem.restore();
    mem.destroy();
    vi.advanceTimersByTime(200);
    mem.onRun('open-sm');
    expect(set).not.toHaveBeenCalled();
  });
});
