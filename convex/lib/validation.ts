import type { Doc, Id } from "../_generated/dataModel";
import { fail } from "./errors";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Uruguay con margen. */
export const UY_BOUNDS = { minLat: -35.5, maxLat: -29.5, minLon: -59.0, maxLon: -52.5 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    fail("INVALID", "El nombre tiene que tener entre 2 y 50 caracteres.");
  }
  return trimmed;
}

export function validatePassword(password: string): void {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    fail(
      "INVALID",
      "La contraseña tiene que tener al menos 8 caracteres, con letras y números.",
    );
  }
}

/** `profile` del provider Password: normaliza el email y en el registro exige nombre. */
export function passwordProfile(params: Record<string, unknown>): {
  email: string;
  name?: string;
} {
  const email = String(params.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) fail("INVALID", "El email no es válido.");
  if (params.flow === "signUp") {
    return { email, name: validateName(String(params.name ?? "")) };
  }
  return { email };
}

export type EventInput = {
  title: string;
  description: string;
  kind: Doc<"events">["kind"];
  startsAt: number;
  endsAt: number;
  placeName: string;
  lat: number;
  lon: number;
  imageId?: Id<"_storage">;
};

function between(n: number, min: number, max: number) {
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Valida el estado completo de un evento (al crear o después de aplicar un update).
 * `dateChanged` evita exigir fecha futura cuando sólo se editan otros campos.
 */
export function validateEventInput(
  input: EventInput,
  now: number,
  { dateChanged }: { dateChanged: boolean },
): EventInput {
  const title = input.title.trim();
  const description = input.description.trim();
  const placeName = input.placeName.trim();

  if (title.length < 3 || title.length > 80) {
    fail("INVALID", "El título tiene que tener entre 3 y 80 caracteres.");
  }
  if (description.length > 2000) {
    fail("INVALID", "La descripción no puede pasar los 2000 caracteres.");
  }
  if (placeName.length < 2 || placeName.length > 120) {
    fail("INVALID", "El lugar tiene que tener entre 2 y 120 caracteres.");
  }
  if (dateChanged && input.startsAt <= now) {
    fail("INVALID", "La fecha de inicio tiene que ser en el futuro.");
  }
  if (input.endsAt <= input.startsAt) {
    fail("INVALID", "El evento tiene que terminar después de empezar.");
  }
  if (input.endsAt - input.startsAt > 7 * DAY) {
    fail("INVALID", "Un evento no puede durar más de 7 días.");
  }
  if (
    !between(input.lat, UY_BOUNDS.minLat, UY_BOUNDS.maxLat) ||
    !between(input.lon, UY_BOUNDS.minLon, UY_BOUNDS.maxLon)
  ) {
    fail("INVALID", "El lugar tiene que estar en Uruguay.");
  }
  return { ...input, title, description, placeName };
}
