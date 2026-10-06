import { ConvexError } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT";

/** Corta la función con un error que el cliente puede leer en `error.data.code`. */
export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}
