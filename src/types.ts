import type { SidebarToolsMessages } from './i18n/types';

/** The three dock zones around the canvas. */
export type ZoneId = 'left' | 'right' | 'bottom';

export const ZONES: readonly ZoneId[] = ['left', 'right', 'bottom'];

/**
 * Texts rendered by the plugin. By default they come from the plugin's
 * translation catalog in `editor.I18n` (22 languages, see `src/i18n`);
 * values passed in the `labels` option override the catalog.
 */
export type SidebarToolsLabels = SidebarToolsMessages;

/** One group of tabs: a tab bar plus the content of its active tab. */
export interface GroupState {
  /** Tab ids (= command ids of the view buttons, e.g. `open-sm`). */
  tabs: string[];
  /** The visible tab of the group. */
  active: string | null;
}

export interface ZoneState {
  /**
   * Width (left/right) or height (bottom) in px. `null` = default size
   * (see the `sizes` option).
   */
  size: number | null;
  /** Height of the first group as a fraction of the zone, when the zone is split in two. */
  ratio: number;
  /** 0–2 groups for left/right (top and bottom half), 0–1 for bottom. */
  groups: GroupState[];
}

/** The whole dock: what is persisted in localStorage. */
export interface DockLayout {
  left: ZoneState;
  right: ZoneState;
  bottom: ZoneState;
}

/**
 * Initial placement of the tabs, by tab id, as groups per zone, e.g.
 * `{ left: [['open-layers'], ['open-blocks']], right: [['open-sm', 'open-tm']] }`.
 * Tabs that are not listed go to the first group of the right zone.
 */
export type DefaultLayout = Partial<Record<ZoneId, string[][]>>;

export interface SidebarToolsOptions {
  /** Inject the plugin's CSS into the page. Default: `true`. */
  injectCss?: boolean;
  /**
   * Remember the dock layout (tabs, groups, sizes) and the open Style
   * Manager sectors in localStorage. Default: `true`.
   */
  persist?: boolean;
  /** localStorage key used when `persist` is on. Default: `'gjs-sidebar-tools'`. */
  storageKey?: string;
  /**
   * Id of the panel with the view buttons (Styles / Settings / Layers /
   * Blocks...). Default: auto-detected (`views` in the GrapesJS default UI).
   */
  panelId?: string | null;
  /**
   * Which view buttons become dockable tabs: their ids or command ids.
   * Default: every button of the views panel whose command shows content
   * in the views container (including other plugins' buttons).
   */
  views?: string[] | null;
  /** Initial layout, used until the user moves something. Default: everything in the right zone. */
  defaultLayout?: DefaultLayout;
  /**
   * Default zone sizes in px. `right` defaults to the width GrapesJS gives
   * its own sidebar (15% of the editor, at least `minSize.side`).
   */
  sizes?: Partial<Record<ZoneId, number | null>>;
  /** Minimum width of the side zones / height of the bottom zone, px. Default: 180 / 120. */
  minSize?: { side?: number; bottom?: number };
  /** Bounds of the first group height when a side zone is split. Default: `0.15` / `0.85`. */
  minRatio?: number;
  maxRatio?: number;
  /**
   * Tabs that the context-menu commands open (`layers-sidebar:show-styles`
   * / `layers-sidebar:show-settings`). Default: `open-sm` / `open-tm`.
   */
  stylesTab?: string;
  settingsTab?: string;
  /** Fixed texts that override the translations (any subset). */
  labels?: Partial<SidebarToolsLabels>;
}

export interface ResolvedOptions {
  injectCss: boolean;
  persist: boolean;
  storageKey: string;
  panelId: string | null;
  views: string[] | null;
  defaultLayout: DefaultLayout;
  sizes: Record<ZoneId, number | null>;
  minSize: { side: number; bottom: number };
  minRatio: number;
  maxRatio: number;
  stylesTab: string;
  settingsTab: string;
  labels: Partial<SidebarToolsLabels>;
}

/** What is persisted in localStorage. */
export interface SidebarState {
  layout: DockLayout | null;
  /** Style Manager sector id -> open. */
  sectors: Record<string, boolean>;
}
