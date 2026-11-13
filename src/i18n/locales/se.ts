import type { SidebarToolsMessages } from '../types';

/**
 * `se` is not the ISO 639-1 code for Swedish (that would be `sv`), but it
 * is what GrapesJS core itself uses (`grapesjs/locale/se.js` is Swedish),
 * so the plugin uses the same code to match `i18n.locale: 'se'`.
 */
const messages: SidebarToolsMessages = {
  resizerTitle: 'Dra för att ändra storlek (dubbelklicka för att återställa till 50/50)',
  zoneResizerTitle: 'Dra för att ändra panelens storlek (dubbelklicka för att återställa)',
  dropHere: 'Släpp här',
  collapse: 'Fäll ihop panelen',
  expand: 'Fäll ut panelen',
  device: 'Enhet',
  responsive: 'Responsiv',
  width: 'Bredd',
  height: 'Höjd',
  rotate: 'Rotera',
  zoom: 'Zoom',
  zoomFit: 'Anpassa',
  zoomIn: 'Zooma in',
  zoomOut: 'Zooma ut',
  auto: 'auto',
  canvas: 'Arbetsyta',
  closeTab: 'Stäng',
  splitLayout: 'Dela arbetsområdet',
  layoutSingle: 'Ett område',
  layoutColumns2: 'Två kolumner',
  layoutRows2: 'Två rader',
  layoutColumns3: 'Tre kolumner',
  layoutGrid4: 'Fyra områden (2 × 2)',
};

export default messages;
