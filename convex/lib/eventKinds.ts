import type { Doc } from "../_generated/dataModel";

type EventKind = Doc<"events">["kind"];

/** Etiquetas en español de cada categoría, en el orden de los chips. Las usan la app y las imágenes. */
export const KIND_LABELS: Record<EventKind, string> = {
  junada: "Encuentro",
  rodada: "Rodada",
  cars_and_coffee: "Cars & Coffee",
  expo: "Exposición",
  clasicos: "Clásicos",
  jdm: "JDM",
  tuning: "Tuning",
  "4x4": "4x4",
  motos: "Motos",
  pista: "Pista",
  otro: "Otro",
};
