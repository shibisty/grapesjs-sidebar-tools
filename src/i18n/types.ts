/**
 * Full catalog of the plugin's translatable strings — one object of this
 * shape per language (see `src/i18n/locales/*.ts`). Keys match the path
 * passed to `editor.I18n.t('sidebarTools.<key>')`.
 *
 * The same keys can be overridden per editor through the `labels` plugin
 * option, which always wins over the catalog. Tab titles are not here:
 * tabs show the icon and the title of the original GrapesJS view button.
 */
export interface SidebarToolsMessages {
  /** Tooltip of the resizer between the two tab groups of a side zone. */
  resizerTitle: string;
  /** Tooltip of the inner edge of a zone (changes its width / height). */
  zoneResizerTitle: string;
  /** Shown in an empty zone while a tab is dragged. */
  dropHere: string;
}
