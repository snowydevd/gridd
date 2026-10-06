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
