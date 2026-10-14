// Client-safe pieces of place creation (no database imports), shared by the server helper and the admin screens.
export const NEW_PLACE_CLIMATES = ['tropical', 'desert', 'mediterranean', 'temperate', 'highland', 'polar'] as const;
export type NewPlaceClimate = (typeof NEW_PLACE_CLIMATES)[number];

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
