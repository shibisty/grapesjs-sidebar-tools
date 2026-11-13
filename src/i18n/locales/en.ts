import type { SidebarToolsMessages } from '../types';

/**
 * Canonical source — the other languages translate from here. Also the
 * text shown when a key is missing everywhere else (see `t.ts`).
 */
const messages: SidebarToolsMessages = {
  resizerTitle: 'Drag to resize (double-click to reset to 50/50)',
  zoneResizerTitle: 'Drag to resize the panel (double-click to reset)',
  dropHere: 'Drop here',
  collapse: 'Collapse panel',
  expand: 'Expand panel',
  device: 'Device',
  responsive: 'Responsive',
  width: 'Width',
  height: 'Height',
  rotate: 'Rotate',
  zoom: 'Zoom',
  zoomFit: 'Fit',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  auto: 'auto',
  canvas: 'Canvas',
  closeTab: 'Close',
  splitLayout: 'Split the workspace',
  layoutSingle: 'One area',
  layoutColumns2: 'Two columns',
  layoutRows2: 'Two rows',
  layoutColumns3: 'Three columns',
  layoutGrid4: 'Four areas (2 × 2)',
};

export default messages;
