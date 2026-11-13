# grapesjs-sidebar-tools

[![Patreon](https://c5.patreon.com/external/logo/become_a_patron_button.png)](https://www.patreon.com/cw/shibisty)

GrapesJS plugin: **dockable tool panels**.

Every button of the GrapesJS views panel — **Style Manager**, **Settings**, **Layers**, **Blocks**, and the views other plugins add there — becomes a tab you can drag into one of three zones around the canvas:

- **left** and **right** — can be split in two by height (two tab groups one above the other, with a resizer between them);
- **bottom** — one tab group under the canvas.

So you can keep, say, Layers on the left, Styles on the right and the component Settings at the bottom — all visible at once.

- Drag a tab by its icon. While dragging, empty zones show a "Drop here" strip, and a blue indicator shows where the tab will land:
  - on a **tab bar** — the tab joins that group at that position;
  - on the **upper / lower third** of a side group — the zone is split and the tab gets a group of its own above / below;
  - anywhere else in a group — the tab joins that group.
- A group that loses its last tab disappears; a zone without groups collapses and gives its room back to the canvas.
- Drag the inner edge of a zone to resize it (double-click: default size); drag the bar between two groups to change their heights (double-click: 50/50). The canvas never gets narrower than 320 px.
- `Esc` cancels a drag. Tabs work with the keyboard too (`Enter`, `←` / `→`).
- The layout (tabs, groups, sizes) and the open Style Manager sectors are remembered in `localStorage`.

The real GrapesJS views are **moved** into the tabs, not re-created, and their commands keep running — that is what lets several of them be visible at the same time. Code that opens a view the usual way (a click on its button, `editor.runCommand('open-layers')`, `grapesjs-preset-webpage` opening the Style Manager on select) simply brings its tab to the front.

Works with the default GrapesJS UI (the `views` panel and the `views-container`), e.g. `grapesjs-preset-webpage`.

## Install

```sh
npm i grapesjs-sidebar-tools
```

```js
import grapesjs from 'grapesjs';
import sidebarTools from 'grapesjs-sidebar-tools';

grapesjs.init({
  container: '#gjs',
  plugins: [sidebarTools],
  pluginsOpts: {
    [sidebarTools]: {
      // optional: where the tabs are until the user moves them
      defaultLayout: {
        left: [['open-layers'], ['open-blocks']],
        right: [['open-sm', 'open-tm']],
      },
    },
  },
});
```

### Without a bundler

```html
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-sidebar-tools"></script>
<script>
  grapesjs.init({
    container: '#gjs',
    // the UMD build exposes the plugin function as window.grapesjsSidebarTools
    plugins: [grapesjsSidebarTools],
    pluginsOpts: {
      [grapesjsSidebarTools]: { /* options */ },
    },
  });
</script>
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `defaultLayout` | `{}` | Initial placement: groups of tab ids per zone, e.g. `{ left: [['open-layers'], ['open-blocks']], bottom: [['open-tm']] }`. A tab id is the command of its button (`open-sm`, `open-tm`, `open-layers`, `open-blocks`, ...). Tabs not listed go to the right zone. Used until the user changes the layout (or after `sidebar-tools:reset-layout`). |
| `sizes` | `{ left: 260, right: null, bottom: 240 }` | Default zone sizes in px. `right: null` = 15% of the editor width, like the GrapesJS sidebar. |
| `minSize` | `{ side: 180, bottom: 120 }` | Minimum width of the side zones / height of the bottom zone. |
| `minRatio` / `maxRatio` | `0.15` / `0.85` | Bounds of the upper group height in a split zone. |
| `views` | `null` | Only dock these buttons (ids or command ids). Default: every button of the views panel whose command shows something in the views container. |
| `panelId` | `null` | Id of the views panel. Default: auto-detected by its buttons (`views` in the default UI). |
| `persist` | `true` | Remember the layout and the open Style Manager sectors in `localStorage`. |
| `storageKey` | `'gjs-sidebar-tools'` | `localStorage` key. |
| `injectCss` | `true` | Inject the plugin stylesheet. Turn off to ship your own CSS (see the `.gjs-st-*` classes). |
| `stylesTab` / `settingsTab` | `'open-sm'` / `'open-tm'` | Tabs opened by the `layers-sidebar:show-styles` / `layers-sidebar:show-settings` commands. |
| `labels` | `{}` | Fixed texts that override the translations: any of `resizerTitle`, `zoneResizerTitle`, `dropHere`. See [Localization](#localization). |

## Commands and events

| Command | Description |
| --- | --- |
| `sidebar-tools:show` | `editor.runCommand('sidebar-tools:show', { id: 'open-layers' })` — bring a tab to the front of its group. |
| `sidebar-tools:reset-layout` | Put every tab back to `defaultLayout`. |
| `layers-sidebar:show-styles` | Show the Style Manager tab (kept from 1.x, used by `grapesjs-context-menu`). |
| `layers-sidebar:show-settings` | Show the Settings tab. |

The `sidebar-tools:layout` event fires with `{ layout, reason }` after every change made by the user (`reason`: `move`, `activate`, `size`, `ratio`, `set`).

## Views from other plugins

A plugin's view is docked automatically when its button is in the views panel and its command shows content in the views container (`panel.set('appendContent', el)`, or an element it un-hides there) — `grapesjs-pages` works this way. Buttons added later (after the editor loaded) are docked as they appear. Buttons whose command renders somewhere else are left alone.

What the plugin does with a view:

1. gives its button a `context` of its own, so activating one view no longer deactivates (stops) the others;
2. runs its command once with a sender that reports `active: true` and moves what appeared in the views container into the tab;
3. when anything stops the command later, runs it again right away, so the content never disappears from its tab;
4. when anything runs it (button, `runCommand`), shows its tab and puts the button back to idle.

## Localization

The plugin's own texts (resizer tooltips, "Drop here") are translated into the **22 languages GrapesJS itself ships** (`grapesjs/locale`: ar, bs, ca, de, el, en, es, fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, vi, zh) — see `src/i18n/locales/`. Tabs show the icon and the title of the original GrapesJS buttons.

Nothing needs to be configured. The plugin registers its catalog with `editor.I18n` under the `sidebarTools` key and follows the editor locale: the browser language by default (`i18n.detectLocale`) or an explicit `i18n.locale`, falling back to English (`localeFallback`). Locale changes at runtime (`editor.I18n.setLocale('de')`) are applied immediately.

Override single strings for a language through GrapesJS:

```js
editor.I18n.addMessages({
  en: { sidebarTools: { dropHere: 'Put it here' } },
});
```

or fix them for every language with the `labels` option (it always wins over the translations).

| Key | English |
| --- | --- |
| `sidebarTools.resizerTitle` | Drag to resize (double-click to reset to 50/50) |
| `sidebarTools.zoneResizerTitle` | Drag to resize the panel (double-click to reset) |
| `sidebarTools.dropHere` | Drop here |

## Upgrading from 1.x

- The split Layers panel (Style Manager / Settings under the layer tree) is gone: put the Styles tab under Layers with a drag instead (drop it on the lower third of the Layers group).
- The `layers-sidebar:show-styles` / `layers-sidebar:show-settings` commands still work and bring the tab to the front wherever it is.
- Removed options: `layersContainer`, `prerenderManagers`, `globalTabCommands`, `restoreGlobalTab`; removed labels: `styleManagerTab`, `settingsTab`. The state is stored under a new key (`gjs-sidebar-tools`).

## Development

```sh
npm install
npm run dev        # vite dev server
npm test           # vitest (jsdom, with a real GrapesJS editor)
npm run typecheck  # tsc for src and tests
npm run build      # dist/: ES module, UMD, .d.ts
```

`npm publish` runs a package.json check, typecheck, tests and build first (`prepublishOnly`).

## License

MIT
