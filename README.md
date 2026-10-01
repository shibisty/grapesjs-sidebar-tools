# grapesjs-sidebar-tools

GrapesJS plugin that turns the **Layers** panel into a split sidebar:

- **top** — the layer tree (unchanged)
- **bottom** — tabs **Style Manager** / **Component Settings**, shown only while the Layers tab is open **and** a component is selected
- a **drag handle** between the two halves (double-click resets it to 50/50)

The real Style Manager / Trait Manager DOM is **moved** into the bottom half while the Layers tab is open and moved back when you leave it — it is never re-rendered, so the managers' own top tabs keep working as before.

The plugin also remembers in `localStorage`:

- which Style Manager sectors are open,
- the active bottom tab and the height split,
- the active **global** tab (Styles / Settings / Layers / Blocks), re-opened after a reload.

Works with the default GrapesJS panels (e.g. `grapesjs-preset-webpage`) and with custom layouts that use `layerManager.appendTo`.

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
      labels: { settingsTab: 'Settings' },
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
| `injectCss` | `true` | Inject the plugin stylesheet. Turn off to ship your own CSS (see `.gjs-lsb-*` classes). |
| `persist` | `true` | Remember sectors / bottom tab / height split / global tab in `localStorage`. |
| `storageKey` | `'gjs-lsb-state'` | `localStorage` key. |
| `globalTabCommands` | `['open-sm', 'open-tm', 'open-layers', 'open-blocks']` | Commands that switch the global (top panel) tab. The last one run is remembered. |
| `restoreGlobalTab` | `true` | Re-open the remembered global tab after a reload (through its panel button). |
| `layersContainer` | — | Element / selector / function returning the element that contains the layer tree. Defaults to `layerManager.appendTo`, then to the container of the default `open-layers` command. |
| `prerenderManagers` | `true` | With the default panels the Style/Trait Manager are rendered only when their tab is opened for the first time. If the split needs one that was never rendered, render it silently through its `open-sm` / `open-tm` command. |
| `minRatio` / `maxRatio` | `0.15` / `0.85` | Bounds of the layers pane height (fraction of the sidebar). |
| `labels` | `{}` | Fixed texts that override the translations: any of `styleManagerTab`, `settingsTab`, `resizerTitle`. See [Localization](#localization). |

## Localization

All texts are translated into the **22 languages GrapesJS itself ships** (`grapesjs/locale`: ar, bs, ca, de, el, en, es, fa, fr, he, id, it, ko, nb, nl, pl, pt, ru, se, tr, vi, zh) — see `src/i18n/locales/`. The "Component Settings" tab uses the same wording as GrapesJS core's own Trait Manager label in every language.

Nothing needs to be configured. The plugin registers its catalog with `editor.I18n` under the `sidebarTools` key and follows the editor locale: the browser language by default (`i18n.detectLocale`) or an explicit `i18n.locale`, falling back to English (`localeFallback`) for other languages. Locale changes at runtime (`editor.I18n.setLocale('de')`) are applied immediately; ar / he / fa get right-to-left tabs.

Override single strings for a language through GrapesJS:

```js
editor.I18n.addMessages({
  en: { sidebarTools: { settingsTab: 'Properties' } },
});
```

or fix them for every language with the `labels` option (it always wins over the translations):

```js
pluginsOpts: {
  [sidebarTools]: { labels: { styleManagerTab: 'Styles' } },
}
```

| Key | English |
| --- | --- |
| `sidebarTools.styleManagerTab` | Style Manager |
| `sidebarTools.settingsTab` | Component Settings |
| `sidebarTools.resizerTitle` | Drag to resize (double-click to reset to 50/50) |

## Commands

| Command | Description |
| --- | --- |
| `layers-sidebar:show-styles` | Show the bottom half on the Style Manager tab. |
| `layers-sidebar:show-settings` | Show the bottom half on the Component Settings tab. |

```js
editor.runCommand('layers-sidebar:show-settings');
```

These are used by the companion `grapesjs-layers-context-menu` plugin ("View styles" in the layer context menu).

## Development

```sh
npm install
npm run dev        # vite dev server
npm test           # vitest (jsdom)
npm run typecheck  # tsc for src and tests
npm run build      # dist/: ES module, UMD, .d.ts
```

`npm publish` runs typecheck, tests and build first (`prepublishOnly`).

## License

MIT
