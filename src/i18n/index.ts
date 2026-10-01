import type { Editor } from 'grapesjs';
import { NAMESPACE } from './t';
import type { SidebarToolsMessages } from './types';

import ar from './locales/ar';
import bs from './locales/bs';
import ca from './locales/ca';
import de from './locales/de';
import el from './locales/el';
import en from './locales/en';
import es from './locales/es';
import fa from './locales/fa';
import fr from './locales/fr';
import he from './locales/he';
import id from './locales/id';
import it from './locales/it';
import ko from './locales/ko';
import nb from './locales/nb';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import ru from './locales/ru';
import se from './locales/se';
import tr from './locales/tr';
import vi from './locales/vi';
import zh from './locales/zh';

/**
 * Exactly the locale codes GrapesJS core ships in `grapesjs/locale` (ar,
 * bs, ca, de, el, en, es, fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se,
 * tr, vi, zh), so wherever a site configures or detects the core locale,
 * the plugin has a translation under the same code. `se` is Swedish (a
 * historically wrong code in GrapesJS itself, see `locales/se.ts`), kept
 * as is for compatibility with the core.
 */
export const LOCALE_MESSAGES: Record<string, SidebarToolsMessages> = {
  ar,
  bs,
  ca,
  de,
  el,
  en,
  es,
  fa,
  fr,
  he,
  id,
  it,
  ko,
  nb,
  nl,
  pl,
  pt,
  ru,
  se,
  tr,
  vi,
  zh,
};

export const SUPPORTED_LOCALES: readonly string[] = Object.keys(LOCALE_MESSAGES);

/**
 * Registers the plugin's translations in `editor.I18n` under the
 * `sidebarTools` key, for every supported language at once.
 *
 * Nothing else needs to be configured: GrapesJS detects the locale from
 * the browser language by default (`i18n.detectLocale`) or uses the
 * explicit `i18n.locale`, and falls back to `localeFallback` ('en') for
 * languages that aren't in the list.
 *
 * Uses `addMessages()` (merge), not `setMessages()`, so messages the site
 * configured itself or other plugins' catalogs are kept. To override a
 * single string, call `editor.I18n.addMessages(...)` after init (or use
 * the `labels` plugin option) — the later `addMessages()` call wins.
 */
export function registerI18n(editor: Editor): void {
  const i18n = (editor as any).I18n;
  if (!i18n || typeof i18n.addMessages !== 'function') return;
  const messages: Record<string, { [NAMESPACE]: SidebarToolsMessages }> = {};
  for (const locale of SUPPORTED_LOCALES) {
    messages[locale] = { [NAMESPACE]: { ...LOCALE_MESSAGES[locale] } };
  }
  i18n.addMessages(messages);
}

export { getLocale, isRtlLocale, NAMESPACE, t } from './t';
export type { SidebarToolsMessages } from './types';
