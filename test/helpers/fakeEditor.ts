import type { Editor } from 'grapesjs';

type Handler = (...args: any[]) => void;

/** Tiny Backbone-like model: get/set/on/off with change:<key> events. */
export class FakeModel {
  attrs: Record<string, any>;
  private handlers = new Map<string, Set<Handler>>();
  constructor(attrs: Record<string, any> = {}) {
    this.attrs = { ...attrs };
  }
  get(key: string) {
    return this.attrs[key];
  }
  set(key: string, value: any) {
    const prev = this.attrs[key];
    this.attrs[key] = value;
    if (prev !== value) this.handlers.get(`change:${key}`)?.forEach((h) => h(this, value));
    return this;
  }
  on(event: string, cb: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(cb);
    return this;
  }
  off(event: string, cb?: Handler) {
    if (cb) this.handlers.get(event)?.delete(cb);
    else this.handlers.delete(event);
    return this;
  }
  listenerCount(event: string) {
    return this.handlers.get(event)?.size ?? 0;
  }
}

export class FakeSector extends FakeModel {
  constructor(id: string, open = false) {
    super({ id, open });
  }
  getId() {
    return this.get('id');
  }
}

/**
 * Minimal stand-in for GrapesJS' I18n module: nested messages per locale,
 * dotted keys, `{param}` interpolation, `opts.l` (locale), fallback to 'en'.
 * Events are fired in the same (awkward) order as GrapesJS 0.21:
 * `i18n:locale` BEFORE the locale is stored, `i18n:add` before the merge,
 * `i18n:update` after it.
 */
export function createFakeI18n(emit: (event: string, ...args: any[]) => void, locale = 'en') {
  let current = locale;
  const messages: Record<string, Record<string, any>> = {};
  const merge = (target: Record<string, any>, src: Record<string, any>) => {
    Object.keys(src).forEach((k) => {
      const v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        target[k] = merge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
      } else target[k] = v;
    });
    return target;
  };
  const lookup = (loc: string, key: string) =>
    key.split('.').reduce<any>((acc, part) => (acc == null ? undefined : acc[part]), messages[loc]);
  return {
    messages,
    addMessages(msgs: Record<string, any>) {
      emit('i18n:add', msgs);
      merge(messages, msgs);
      emit('i18n:update', messages);
    },
    getLocale: () => current,
    setLocale(value: string) {
      emit('i18n:locale', { value, valuePrev: current });
      current = value;
    },
    t(key: string, opts: { params?: Record<string, unknown>; l?: string } = {}) {
      // like GrapesJS: the explicit locale option is `l`
      let res = lookup(opts.l || current, key);
      if (res === undefined) res = lookup('en', key);
      if (typeof res === 'string' && opts.params) {
        Object.keys(opts.params).forEach((p) => {
          res = res.replace(new RegExp(`\\{${p}\\}`, 'g'), String(opts.params![p]));
        });
      }
      return res;
    },
  };
}

export interface FakeEditorOptions {
  locale?: string;
  layersAppendTo?: unknown;
  smAppendTo?: unknown;
  tmAppendTo?: unknown;
  sectors?: FakeSector[];
  panels?: FakeModel[];
}

export interface FakeEditor {
  editor: Editor;
  emit(event: string, ...args: any[]): void;
  select(component: unknown): void;
  commands: Map<string, any>;
  sectors: FakeSector[];
  handlerCount(event: string): number;
}

const liveEditors = new Set<FakeEditor>();

/** Emits `destroy` on every fake editor created so far (called after each test). */
export function destroyFakeEditors() {
  liveEditors.forEach((fake) => fake.emit('destroy'));
  liveEditors.clear();
}

export function createFakeEditor(opts: FakeEditorOptions = {}): FakeEditor {
  const handlers = new Map<string, Set<Handler>>();
  const commands = new Map<string, any>();
  const sectors = opts.sectors ?? [];
  let selected: unknown = null;

  const split = (events: string) => events.split(/\s+/).filter(Boolean);

  const emit = (event: string, ...args: any[]) => {
    handlers.get(event)?.forEach((h) => h(...args));
  };

  const editor: any = {
    on(events: string, cb: Handler) {
      split(events).forEach((ev) => {
        if (!handlers.has(ev)) handlers.set(ev, new Set());
        handlers.get(ev)!.add(cb);
      });
      return editor;
    },
    off(events: string, cb: Handler) {
      split(events).forEach((ev) => handlers.get(ev)?.delete(cb));
      return editor;
    },
    trigger: emit,
    getSelected: () => selected,
    Commands: {
      add(id: string, cmd: any) {
        commands.set(id, typeof cmd === 'function' ? { run: cmd } : cmd);
      },
      has: (id: string) => commands.has(id),
      get: (id: string) => commands.get(id),
      run(id: string, options?: any) {
        const cmd = commands.get(id);
        const res = cmd?.run?.(editor, null, options);
        emit(`run:${id}`);
        emit('run', id, res, options);
        return res;
      },
    },
    LayerManager: { getConfig: () => ({ appendTo: opts.layersAppendTo }) },
    StyleManager: {
      getConfig: () => ({ appendTo: opts.smAppendTo }),
      getSectors: () => ({ models: sectors }),
    },
    TraitManager: { getConfig: () => ({ appendTo: opts.tmAppendTo }) },
    I18n: createFakeI18n(emit, opts.locale),
    Panels: {
      getPanels: () => [new FakeModel({ buttons: opts.panels ?? [] })],
    },
  };

  const fake: FakeEditor = {
    editor: editor as Editor,
    emit,
    select(component) {
      selected = component;
      emit('component:toggled');
    },
    commands,
    sectors,
    handlerCount: (event) => handlers.get(event)?.size ?? 0,
  };
  liveEditors.add(fake);
  return fake;
}

/** Lets the plugin's setTimeout(0)-based sync run. */
export const flush = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
