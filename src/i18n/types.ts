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
  /** Collapse / expand buttons of the zones. */
  collapse: string;
  expand: string;
  /** Device toolbar above the canvas. */
  device: string;
  /** The free-size device of the toolbar (width / height inputs). */
  responsive: string;
  width: string;
  height: string;
  /** Swaps width and height of the responsive device. */
  rotate: string;
  zoom: string;
  /** Zoom level that fits the device into the canvas. */
  zoomFit: string;
  zoomIn: string;
  zoomOut: string;
  /** Placeholder of an empty height (= as high as the canvas). */
  auto: string;
  /** Workspace: the canvas tab when no plugin brings its own (vanilla GrapesJS). */
  canvas: string;
  /** Close button of a document tab. */
  closeTab: string;
  /** The workspace layout menu and its entries. */
  splitLayout: string;
  layoutSingle: string;
  layoutColumns2: string;
  layoutRows2: string;
  layoutColumns3: string;
  layoutGrid4: string;
}
