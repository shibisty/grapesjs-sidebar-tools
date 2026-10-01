import { describe, expect, it, vi } from 'vitest';
import { LOCALE_MESSAGES, registerI18n, SUPPORTED_LOCALES } from '../../src/i18n';
import en from '../../src/i18n/locales/en';
import type { SidebarToolsMessages } from '../../src/i18n/types';

/** The locale codes GrapesJS core ships in grapesjs/locale (checked by the last test). */
const GRAPESJS_LOCALES = [
  'ar', 'bs', 'ca', 'de', 'el', 'en', 'es', 'fa', 'fr', 'he', 'id',
  'it', 'ko', 'nb', 'nl', 'pl', 'pt', 'ru', 'se', 'tr', 'vi', 'zh',
];

function leafKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    paths.push(...leafKeyPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return paths;
}

const EN_KEYS = leafKeyPaths(en).sort();
const valueAt = (obj: unknown, path: string) =>
  path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);

describe('locale catalogs', () => {
  it('covers exactly the 22 locale codes GrapesJS core ships', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(GRAPESJS_LOCALES);
    expect(SUPPORTED_LOCALES).toHaveLength(22);
  });

  it.each(Object.entries(LOCALE_MESSAGES))('%s has exactly the same keys as en.ts', (_code, messages) => {
    expect(leafKeyPaths(messages).sort()).toEqual(EN_KEYS);
  });

  it.each(Object.entries(LOCALE_MESSAGES))('%s has a non-empty string for every key', (_code, messages) => {
    for (const path of EN_KEYS) {
      const value = valueAt(messages, path);
      expect(typeof value, `${path} should be a string`).toBe('string');
      expect((value as string).trim().length, `${path} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('every {param} placeholder in en.ts appears in every locale', () => {
    const placeholdersOf = (str: string) => [...str.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const path of EN_KEYS) {
      const enParams = placeholdersOf(valueAt(en, path) as string);
      for (const [code, messages] of Object.entries(LOCALE_MESSAGES)) {
        expect(placeholdersOf(valueAt(messages, path) as string), `${code}: ${path}`).toEqual(enParams);
      }
    }
  });

  it('non-English locales are actually translated (not copies of en.ts)', () => {
    for (const [code, messages] of Object.entries(LOCALE_MESSAGES)) {
      if (code === 'en') continue;
      // tab names may legitimately stay "Style Manager" (de/it/ko do so in GrapesJS core too),
      // but the sentence-long tooltip must always be translated
      expect(messages.resizerTitle, code).not.toBe(en.resizerTitle);
    }
  });

  it('the settings tab uses the same wording as GrapesJS core traitManager.label', async () => {
    for (const code of GRAPESJS_LOCALES) {
      const mod: any = await import(`../../node_modules/grapesjs/locale/${code}.js`);
      // the core locales are CommonJS builds: module.default.default
      const core = mod.default?.default ?? mod.default;
      // fa.js in GrapesJS core nests traitManager inside styleManager
      const label = core.traitManager?.label ?? core.styleManager?.traitManager?.label;
      expect(typeof label, `${code}: core traitManager.label`).toBe('string');
      if (code === 'en') continue; // ours is Title Case: "Component Settings"
      expect(LOCALE_MESSAGES[code].settingsTab, code).toBe(label);
    }
  });
});

describe('registerI18n', () => {
  it('adds every catalog under the sidebarTools namespace via addMessages (merge)', () => {
    const addMessages = vi.fn();
    registerI18n({ I18n: { addMessages } } as any);
    expect(addMessages).toHaveBeenCalledTimes(1);
    const [payload] = addMessages.mock.calls[0] as [Record<string, { sidebarTools: SidebarToolsMessages }>];
    expect(Object.keys(payload).sort()).toEqual([...SUPPORTED_LOCALES].sort());
    expect(payload.en.sidebarTools.settingsTab).toBe('Component Settings');
    expect(payload.ru.sidebarTools.settingsTab).toBe('Настройки компонента');
  });

  it('passes copies, so a site editing the messages cannot change the built-in catalog', () => {
    const addMessages = vi.fn();
    registerI18n({ I18n: { addMessages } } as any);
    addMessages.mock.calls[0][0].en.sidebarTools.settingsTab = 'changed';
    expect(LOCALE_MESSAGES.en.settingsTab).toBe('Component Settings');
  });

  it('does nothing on an editor without the I18n module', () => {
    expect(() => registerI18n({} as any)).not.toThrow();
  });
});
