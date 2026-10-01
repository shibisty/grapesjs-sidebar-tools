import type { ResolvedOptions, SidebarToolsOptions } from './types';

export const DEFAULT_OPTIONS: ResolvedOptions = {
  injectCss: true,
  persist: true,
  storageKey: 'gjs-lsb-state',
  globalTabCommands: ['open-sm', 'open-tm', 'open-layers', 'open-blocks'],
  restoreGlobalTab: true,
  layersContainer: null,
  prerenderManagers: true,
  minRatio: 0.15,
  maxRatio: 0.85,
  // Empty: texts come from editor.I18n (see src/i18n), `labels` only overrides.
  labels: {},
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Node);
}

/**
 * Deep-merges plain objects; arrays, functions and DOM nodes are taken
 * from `extra` as is. `undefined` values in `extra` are ignored, so
 * `{ storageKey: undefined }` keeps the default.
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

export function resolveOptions(opts?: SidebarToolsOptions | null): ResolvedOptions {
  const options = mergeDeep(DEFAULT_OPTIONS, opts as Record<string, any>);
  let min = Number(options.minRatio);
  let max = Number(options.maxRatio);
  if (!isFinite(min)) min = DEFAULT_OPTIONS.minRatio;
  if (!isFinite(max)) max = DEFAULT_OPTIONS.maxRatio;
  min = Math.min(Math.max(min, 0), 1);
  max = Math.min(Math.max(max, 0), 1);
  if (min > max) [min, max] = [max, min];
  options.minRatio = min;
  options.maxRatio = max;
  // Never share nested defaults between editor instances.
  const labels: Record<string, unknown> = isPlainObject(options.labels) ? options.labels : {};
  options.labels = {};
  Object.keys(labels).forEach((key) => {
    // only non-empty strings override the translations
    if (typeof labels[key] === 'string' && labels[key]) (options.labels as Record<string, unknown>)[key] = labels[key];
  });
  options.globalTabCommands = Array.isArray(options.globalTabCommands) ? options.globalTabCommands.slice() : [];
  return options;
}
