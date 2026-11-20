import type { PluginMeta } from './contract';
import { DEFAULT_ZOOM_LEVELS } from './devices';
import type { ResolvedOptions, SidebarToolsOptions, ZoneId } from './types';

export const DEFAULT_OPTIONS: ResolvedOptions = {
  injectCss: true,
  persist: true,
  storageKey: 'gjs-sidebar-tools',
  panelId: null,
  views: null,
  defaultLayout: {},
  sizes: { left: 260, right: null, bottom: 240 },
  minSize: { side: 180, bottom: 120 },
  minRatio: 0.15,
  maxRatio: 0.85,
  stylesTab: 'open-sm',
  settingsTab: 'open-tm',
  deviceBar: true,
  zoomLevels: DEFAULT_ZOOM_LEVELS.slice(),
  hideDevicePanel: true,
  fixDeviceCommands: true,
  workspace: true,
  // Empty: texts come from editor.I18n (see src/i18n), `labels` only overrides.
  labels: {},
};

export function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(typeof Node !== 'undefined' && value instanceof Node)
  );
}

/**
 * Deep-merges plain objects; arrays, functions and DOM nodes are taken
 * from `extra` as is. `undefined` values in `extra` are ignored.
 */
export function mergeDeep<T extends Record<string, any>>(base: T, extra?: Record<string, any> | null): T {
  const out: Record<string, any> = { ...base };
  if (!extra) return out as T;
  Object.keys(extra).forEach((key) => {
    const value = extra[key];
    if (value === undefined) return;
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDeep(base[key], value) : value;
  });
  return out as T;
}

const positive = (value: unknown, fallback: number) =>
  typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;

function clampRatioBounds(minRaw: unknown, maxRaw: unknown): [number, number] {
  let min = Number(minRaw);
  let max = Number(maxRaw);
  if (!isFinite(min)) min = DEFAULT_OPTIONS.minRatio;
  if (!isFinite(max)) max = DEFAULT_OPTIONS.maxRatio;
  min = Math.min(Math.max(min, 0), 1);
  max = Math.min(Math.max(max, 0), 1);
  return min > max ? [max, min] : [min, max];
}

export function resolveOptions(opts?: SidebarToolsOptions | null): ResolvedOptions {
  const o = mergeDeep(DEFAULT_OPTIONS, opts as Record<string, any>);
  const [minRatio, maxRatio] = clampRatioBounds(o.minRatio, o.maxRatio);

  const sizes = {} as Record<ZoneId, number | null>;
  (['left', 'right', 'bottom'] as ZoneId[]).forEach((zone) => {
    const value = (o.sizes as Record<string, unknown>)?.[zone];
    sizes[zone] = typeof value === 'number' && isFinite(value) && value > 0 ? value : DEFAULT_OPTIONS.sizes[zone];
  });

  const labels: Record<string, string> = {};
  if (isPlainObject(o.labels)) {
    Object.keys(o.labels).forEach((key) => {
      const value = (o.labels as Record<string, unknown>)[key];
      // only non-empty strings override the translations
      if (typeof value === 'string' && value) labels[key] = value;
    });
  }

  const defaultLayout: Record<string, string[][]> = {};
  if (isPlainObject(o.defaultLayout)) {
    Object.keys(o.defaultLayout).forEach((zone) => {
      const groups = (o.defaultLayout as Record<string, unknown>)[zone];
      if (!Array.isArray(groups)) return;
      defaultLayout[zone] = groups
        .filter(Array.isArray)
        .map((g: unknown[]) => g.filter((id): id is string => typeof id === 'string' && !!id));
    });
  }

  return {
    injectCss: o.injectCss !== false,
    persist: o.persist !== false,
    storageKey: typeof o.storageKey === 'string' && o.storageKey ? o.storageKey : DEFAULT_OPTIONS.storageKey,
    panelId: typeof o.panelId === 'string' && o.panelId ? o.panelId : null,
    views: Array.isArray(o.views) ? o.views.filter((v) => typeof v === 'string' && v) : null,
    defaultLayout,
    sizes,
    minSize: {
      side: positive(o.minSize?.side, DEFAULT_OPTIONS.minSize.side),
      bottom: positive(o.minSize?.bottom, DEFAULT_OPTIONS.minSize.bottom),
    },
    minRatio,
    maxRatio,
    stylesTab: typeof o.stylesTab === 'string' && o.stylesTab ? o.stylesTab : DEFAULT_OPTIONS.stylesTab,
    settingsTab: typeof o.settingsTab === 'string' && o.settingsTab ? o.settingsTab : DEFAULT_OPTIONS.settingsTab,
    deviceBar: o.deviceBar !== false,
    zoomLevels: (() => {
      const levels = Array.isArray(o.zoomLevels)
        ? o.zoomLevels.filter((l) => typeof l === 'number' && isFinite(l) && l >= 10 && l <= 400)
        : [];
      return levels.length ? Array.from(new Set(levels)).sort((a, b) => a - b) : DEFAULT_ZOOM_LEVELS.slice();
    })(),
    hideDevicePanel: o.hideDevicePanel !== false,
    fixDeviceCommands: o.fixDeviceCommands !== false,
    workspace: o.workspace !== false,
    labels,
  };
}

export const PLUGIN_ID = 'grapesjs-sidebar-tools';
/** Version of this package (a test checks it against package.json). */
export const VERSION = '2.4.0';

/** Options for forms (plugin contract). Changes apply after a reload. */
export const META: PluginMeta = {
  id: PLUGIN_ID,
  version: VERSION,
  title: 'Sidebar Tools',
  description: 'Dockable panels (Styles, Settings, Layers, Blocks…), device bar and zoom, document workspace.',
  options: [
    { key: 'workspace', type: 'boolean', default: true, title: 'Document workspace', description: 'Tabs of pages and editors under the top bar.' },
    { key: 'deviceBar', type: 'boolean', default: true, title: 'Device bar', description: 'Device buttons, size and zoom over the canvas.' },
    { key: 'hideDevicePanel', type: 'boolean', default: true, title: 'Hide the GrapesJS device select' },
    { key: 'persist', type: 'boolean', default: true, title: 'Remember the layout' },
    { key: 'zoomLevels', type: 'json', default: DEFAULT_ZOOM_LEVELS.slice(), title: 'Zoom levels, %' },
    { key: 'sizes', type: 'json', default: { left: 260, right: null, bottom: 240 }, title: 'Zone sizes, px', description: 'null — the GrapesJS default.' },
    { key: 'defaultLayout', type: 'json', default: {}, title: 'Initial layout', advanced: true },
    { key: 'views', type: 'json', default: null, title: 'Dockable views', description: 'Button or command ids; null — all views.', advanced: true },
    { key: 'panelId', type: 'string', default: '', title: 'Views panel', description: 'Empty — auto.', advanced: true },
    { key: 'stylesTab', type: 'string', default: 'open-sm', title: 'Styles view', advanced: true },
    { key: 'settingsTab', type: 'string', default: 'open-tm', title: 'Settings view', advanced: true },
    { key: 'minSize', type: 'json', default: { side: 180, bottom: 120 }, title: 'Minimal sizes, px', advanced: true },
    { key: 'minRatio', type: 'number', default: 0.15, title: 'Minimal split ratio', advanced: true },
    { key: 'maxRatio', type: 'number', default: 0.85, title: 'Maximal split ratio', advanced: true },
    { key: 'fixDeviceCommands', type: 'boolean', default: true, title: 'Fix preset device commands', advanced: true },
    { key: 'storageKey', type: 'string', default: 'gjs-sidebar-tools', title: 'localStorage key', advanced: true },
    { key: 'labels', type: 'json', default: {}, title: 'Texts', advanced: true },
    { key: 'injectCss', type: 'boolean', default: true, title: 'Inject CSS', advanced: true },
  ],
};

/** The options a form can show. */
export function publicOptions(o: ResolvedOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (META.options || []).forEach((f) => {
    const v = (o as unknown as Record<string, unknown>)[f.key];
    out[f.key] = v === null && f.key === 'panelId' ? '' : JSON.parse(JSON.stringify(v ?? null));
  });
  return out;
}
