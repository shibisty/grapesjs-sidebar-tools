/**
 * Anything that can point at a DOM element: a CSS selector, the element
 * itself, or a function returning one (resolved lazily, every time the
 * plugin needs it).
 */
export type ElementTarget =
  | string
  | HTMLElement
  | null
  | undefined
  | (() => HTMLElement | null | undefined);

import type { SidebarToolsMessages } from './i18n/types';

/**
 * Texts rendered by the plugin. By default they come from the plugin's
 * translation catalog in `editor.I18n` (22 languages, see `src/i18n`);
 * values passed in the `labels` option override the catalog.
 */
export type SidebarToolsLabels = SidebarToolsMessages;

export interface SidebarToolsOptions {
  /** Inject the plugin's CSS into the page. Default: `true`. */
  injectCss?: boolean;
  /**
   * Remember open Style Manager sectors, the active bottom tab, the
   * layers/managers height split and the active global tab in
   * localStorage. Default: `true`.
   */
  persist?: boolean;
  /** localStorage key used when `persist` is on. Default: `'gjs-lsb-state'`. */
  storageKey?: string;
  /**
   * Commands that switch the GLOBAL (top panel) tab. The last one run is
   * remembered and re-activated after a reload through its panel button.
   * Default: `['open-sm', 'open-tm', 'open-layers', 'open-blocks']`.
   */
  globalTabCommands?: string[];
  /** `false` = never re-open the remembered global tab. Default: `true`. */
  restoreGlobalTab?: boolean;
  /**
   * Element that contains the layer tree. When omitted the plugin uses
   * `layerManager.appendTo` from the editor config, and if that is not
   * set either, the container GrapesJS' default `open-layers` command
   * creates inside the `views-container` panel.
   */
  layersContainer?: ElementTarget;
  /**
   * With the default GrapesJS panels the Style/Trait Manager are rendered
   * only when their tab is opened for the first time. When the split needs
   * one that is not rendered yet, render it through its `open-sm` /
   * `open-tm` command (silently, the top tabs don't change).
   * Default: `true`.
   */
  prerenderManagers?: boolean;
  /** Lower/upper bound of the layers pane height, as a fraction (0..1). Default: `0.15` / `0.85`. */
  minRatio?: number;
  maxRatio?: number;
  /**
   * Fixed texts that override the translations (any subset). Without it
   * the texts follow the editor locale (`editor.I18n`).
   */
  labels?: Partial<SidebarToolsLabels>;
}

export interface ResolvedOptions
  extends Required<Omit<SidebarToolsOptions, 'labels' | 'layersContainer'>> {
  layersContainer: ElementTarget;
  labels: Partial<SidebarToolsLabels>;
}

export type BottomTab = 'style' | 'settings';

/** What is persisted in localStorage. */
export interface SidebarState {
  tab: BottomTab;
  /** Height of the layers pane as a fraction of the whole sidebar. */
  ratio: number;
  /** Style Manager sector id -> open. */
  sectors: Record<string, boolean>;
  /** Last global tab command, e.g. `'open-layers'`. */
  globalTab: string | null;
}
