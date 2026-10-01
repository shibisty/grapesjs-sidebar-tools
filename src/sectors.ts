/**
 * Remembers which Style Manager sectors are open and re-applies that
 * whenever sectors appear (initial render, `style:sector:add`, ...).
 */

export interface SectorLike {
  get(key: string): any;
  set(key: string, value: any): any;
  on(event: string, cb: (...args: any[]) => void): any;
  off?(event: string, cb?: (...args: any[]) => void): any;
  getId?(): string;
}

export interface StyleManagerLike {
  getSectors?(): unknown;
}

export function getSectorList(sm: StyleManagerLike | null | undefined): SectorLike[] {
  let collection: any;
  try {
    collection = sm?.getSectors?.();
  } catch {
    return [];
  }
  if (!collection) return [];
  if (Array.isArray(collection.models)) return collection.models;
  if (Array.isArray(collection)) return collection;
  return typeof collection.toArray === 'function' ? collection.toArray() : [];
}

export function sectorId(sector: SectorLike): string {
  return String(sector.getId ? sector.getId() : sector.get('id'));
}

export interface SectorMemory {
  sync(): void;
  destroy(): void;
}

export function createSectorMemory(
  getStyleManager: () => StyleManagerLike | null | undefined,
  stored: Record<string, boolean>,
  save: () => void,
): SectorMemory {
  const bound = new Map<SectorLike, () => void>();
  let applying = false;

  function bind(sector: SectorLike) {
    if (bound.has(sector)) return;
    const onOpen = () => {
      if (applying) return;
      stored[sectorId(sector)] = !!sector.get('open');
      save();
    };
    sector.on('change:open', onOpen);
    bound.set(sector, onOpen);
  }

  return {
    sync() {
      const list = getSectorList(getStyleManager());
      list.forEach(bind);
      applying = true;
      try {
        list.forEach((sector) => {
          const id = sectorId(sector);
          if (!Object.prototype.hasOwnProperty.call(stored, id)) return;
          const want = !!stored[id];
          if (!!sector.get('open') !== want) sector.set('open', want);
        });
      } finally {
        applying = false;
      }
    },
    destroy() {
      bound.forEach((cb, sector) => sector.off?.('change:open', cb));
      bound.clear();
    },
  };
}
