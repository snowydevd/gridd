import { v } from "convex/values";

/**
 * Rangos de "Cerca tuyo", en km. "all" (+500 km) cubre todo Uruguay.
 * Lo usan el backend (validación) y la app (menú del perfil y filtro de Inicio).
 */
export const SEARCH_RADII = [10, 25, 50, 100, 200, 500, "all"] as const;
export type SearchRadius = (typeof SEARCH_RADII)[number];

export const DEFAULT_SEARCH_RADIUS: SearchRadius = 25;

export const searchRadius = v.union(
  v.literal(10),
  v.literal(25),
  v.literal(50),
  v.literal(100),
  v.literal(200),
  v.literal(500),
  v.literal("all"),
);

export const searchRadiusLabel = (radius: SearchRadius) => (radius === "all" ? "+500 km" : `${radius} km`);

/** Si un evento a `distanceKm` entra en el rango. */
export const withinRadius = (distanceKm: number, radius: SearchRadius) => radius === "all" || distanceKm <= radius;
