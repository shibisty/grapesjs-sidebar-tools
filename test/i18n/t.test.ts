import { describe, expect, it } from 'vitest';
import { registerI18n } from '../../src/i18n';
import { getLocale, isRtlLocale, t } from '../../src/i18n/t';
import { createFakeEditor } from '../helpers/fakeEditor';

describe('t()', () => {
  it('reads the namespaced key in the current locale', () => {
    const { editor } = createFakeEditor({ locale: 'ru' });
    registerI18n(editor);
    expect(t(editor, 'settingsTab')).toBe('Настройки компонента');
    editor.I18n.setLocale('de');
    expect(t(editor, 'styleManagerTab')).toBe('Style Manager');
  });

  it('accepts an explicit locale', () => {
    const { editor } = createFakeEditor({ locale: 'en' });
    registerI18n(editor);
    expect(t(editor, 'settingsTab', undefined, 'es')).toBe('Ajustes de componentes');
  });

  it('falls back to English for unsupported locales', () => {
    const { editor } = createFakeEditor({ locale: 'uk' });
    registerI18n(editor);
    expect(t(editor, 'settingsTab')).toBe('Component Settings');
  });

  it('uses the built-in English text when the catalog is missing or I18n is broken', () => {
    const { editor } = createFakeEditor();
    expect(t(editor, 'resizerTitle')).toBe('Drag to resize (double-click to reset to 50/50)');
    (editor as any).I18n = {
      t() {
        throw new Error('boom');
      },
    };
    expect(t(editor, 'settingsTab')).toBe('Component Settings');
    (editor as any).I18n = undefined;
    expect(t(editor, 'settingsTab')).toBe('Component Settings');
  });

  it('lets later addMessages() calls override single strings', () => {
    const { editor } = createFakeEditor();
    registerI18n(editor);
    editor.I18n.addMessages({ en: { sidebarTools: { settingsTab: 'Props' } } });
    expect(t(editor, 'settingsTab')).toBe('Props');
    expect(t(editor, 'styleManagerTab')).toBe('Style Manager');
  });
});

describe('getLocale / isRtlLocale', () => {
  it('reads the editor locale with an "en" fallback', () => {
    expect(getLocale(createFakeEditor({ locale: 'fr' }).editor)).toBe('fr');
    expect(getLocale({} as any)).toBe('en');
  });

  it('flags ar / he / fa (and their regional variants) as RTL', () => {
    ['ar', 'he', 'fa', 'ar-EG'].forEach((l) => expect(isRtlLocale(l), l).toBe(true));
    ['en', 'ru', 'zh', 'se'].forEach((l) => expect(isRtlLocale(l), l).toBe(false));
  });
});
