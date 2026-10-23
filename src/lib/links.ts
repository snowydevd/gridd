/** Dominio de la web. Los links a gridd.app/e/… abren la app si está instalada (ver app.json). */
export const SITE_URL = 'https://gridd.app';

/** Link público de un evento: muestra la ficha en la web o la abre en la app. */
export const eventUrl = (slug: string) => `${SITE_URL}/e/${slug}`;
