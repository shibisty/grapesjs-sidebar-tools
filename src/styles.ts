export const STYLE_ELEMENT_ID = 'gjs-lsb-styles';

/*
 * .gjs-lsb-host  - the layers container (ours or GrapesJS')
 * .gjs-lsb-split - flex column created inside it: top / resizer / bottom
 */
export const CSS = [
  '.gjs-lsb-host{height:100%;}',
  '.gjs-lsb-split{display:flex;flex-direction:column;height:100%;min-height:0;--lsb-top:50%;}',
  '.gjs-lsb-top{flex:1 1 auto;min-height:0;overflow:auto;}',
  '.gjs-lsb-split--open .gjs-lsb-top{flex:0 0 var(--lsb-top,50%);}',
  '.gjs-lsb-resizer{display:none;flex:0 0 6px;cursor:row-resize;background:rgba(255,255,255,.08);touch-action:none;}',
  '.gjs-lsb-resizer:hover,.gjs-lsb-resizing .gjs-lsb-resizer{background:#3b97e3;}',
  '.gjs-lsb-resizing{user-select:none;}',
  '.gjs-lsb-split--open .gjs-lsb-resizer{display:block;}',
  '.gjs-lsb-bottom{display:none;flex:1 1 0;min-height:0;overflow:hidden;flex-direction:column;}',
  '.gjs-lsb-split--open .gjs-lsb-bottom{display:flex;}',
  '.gjs-lsb-tabs{display:flex;flex:0 0 auto;}',
  '.gjs-lsb-tab{flex:1 1 50%;padding:8px 6px;text-align:center;font-size:12px;background:transparent;border:none;color:#b8b8b8;cursor:pointer;border-bottom:2px solid transparent;min-width:0;line-height:1.3;overflow-wrap:break-word;}',
  '.gjs-lsb-tab:hover{color:#fff;}',
  '.gjs-lsb-tab--active{color:#fff;border-bottom-color:#3b97e3;}',
  '.gjs-lsb-tab-content{flex:1 1 auto;min-height:0;overflow:auto;}',
  '.gjs-lsb-panel{height:100%;}',
  '.gjs-lsb-panel[hidden]{display:none !important;}',
].join('');

/** Adds the plugin stylesheet once per document. */
export function injectCss(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
