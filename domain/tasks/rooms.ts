export const ROOMS = [
  'kitchen',
  'bathroom',
  'living_room',
  'bedroom',
  'laundry',
  'outdoor',
  'other',
] as const;

export type Room = (typeof ROOMS)[number];
