import type { CatalogRoom } from './catalog';

/**
 * The glyph of each room, for the magnet that holds its note in Plantillas. Names of the
 * MaterialCommunityIcons set, as the product icons of the Compra.
 */
const ICONS: Record<CatalogRoom, string> = {
  kitchen: 'silverware-fork-knife',
  bathroom: 'shower-head',
  living_room: 'sofa-outline',
  bedroom: 'bed-outline',
  laundry: 'washing-machine',
  outdoor: 'flower-outline',
  other: 'door',
  general: 'home-outline',
};

export function roomIcon(room: CatalogRoom): string {
  return ICONS[room];
}
