import type { TemplateName } from "../templates/index";
import type { Angle } from "./angles";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Elige `count` ángulos con hechos: primero los nunca usados, después los usados hace más
 * tiempo. `recent` va del más reciente al más viejo. Si piden más que los disponibles, rota.
 */
export function pickAngles(angles: Angle[], recent: string[], count: number): Angle[] {
  const usable = angles.filter((a) => a.facts.length > 0);
  if (usable.length === 0) {
    throw new Error("No hay ángulos con hechos verificados: completá content/angles.ts.");
  }
  const lastUse = (a: Angle) => {
    const i = recent.indexOf(a.id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // Orden estable: más "viejo" primero (índice alto en recent), los nunca usados antes que todos.
  const ordered = [...usable].sort((a, b) => lastUse(b) - lastUse(a));
  return Array.from({ length: count }, (_, i) => ordered[i % ordered.length]);
}

export function pickTemplate(angle: Angle, index: number): TemplateName {
  return angle.templates[index % angle.templates.length];
}

/** Fechas sugeridas: el primero en startAt y después uno cada `everyDays` días. */
export function schedule(startAt: number, count: number, everyDays: number): number[] {
  return Array.from({ length: count }, (_, i) => startAt + i * everyDays * DAY);
}
