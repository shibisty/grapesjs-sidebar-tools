import type { Editor } from 'grapesjs';
import en from './locales/en';
import type { SidebarToolsMessages } from './types';

/** Namespace the plugin's catalog lives under in `editor.I18n`. */
export const NAMESPACE = 'sidebarTools';

/**
 * `editor.I18n.t()` with the plugin namespace baked in. GrapesJS resolves
 * dotted paths and falls back to `localeFallback` ('en' by default) on
 * its own; if the key is still missing (editor without the I18n module,
 * a site that replaced the messages entirely) the built-in English text
 * is used, never `undefined` or the raw key.
 */
export function t(
  editor: Editor,
  key: keyof SidebarToolsMessages,
  params?: Record<string, unknown>,
  /** Explicit locale (e.g. the new value inside an `i18n:locale` handler). */
  locale?: string,
): string {
  let result: unknown;
  const opts: Record<string, unknown> = {};
  if (params) opts.params = params;
  // GrapesJS reads the explicit locale from `opts.l`
  if (locale) opts.l = locale;
  try {
    result = (editor as any).I18n?.t(`${NAMESPACE}.${key}`, Object.keys(opts).length ? opts : undefined);
  } catch {
    result = undefined;
  }
  return typeof result === 'string' && result ? result : en[key];
}

/** Current editor locale ('en' when the I18n module is not available). */
export function getLocale(editor: Editor): string {
  try {
    return (editor as any).I18n?.getLocale?.() || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Languages from the GrapesJS locale set that are written right to left.
 * Only used for `dir="rtl"` on the bottom tabs.
 */
const RTL_LOCALES = new Set(['ar', 'he', 'fa']);

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(String(locale).split('-')[0]);
}
