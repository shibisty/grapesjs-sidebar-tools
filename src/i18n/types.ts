/**
 * Full catalog of the plugin's translatable strings — one object of this
 * shape per language (see `src/i18n/locales/*.ts`). Keys match the path
 * passed to `editor.I18n.t('sidebarTools.<key>')`.
 *
 * The same keys can be overridden per editor through the `labels` plugin
 * option (see `SidebarToolsLabels`), which always wins over the catalog.
 */
export interface SidebarToolsMessages {
  /** Bottom tab that hosts the Style Manager. */
  styleManagerTab: string;
  /**
   * Bottom tab that hosts the Trait Manager. Uses the same wording as
   * GrapesJS core's own `traitManager.label` in each language.
   */
  settingsTab: string;
  /** Tooltip of the drag handle between the layer tree and the tabs. */
  resizerTitle: string;
}
