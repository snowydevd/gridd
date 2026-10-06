import { convexTest } from "convex-test";
import { expect } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import type { Role } from "./lib/validators";
import schema from "./schema";
import { modules } from "./test.setup";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export function setup() {
  return convexTest(schema, modules);
}
export type T = ReturnType<typeof setup>;

/** Inserta un usuario y devuelve un cliente autenticado como él (formato de subject de Convex Auth). */
export async function makeUser(t: T, role?: Role, name = "Ana") {
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      name,
      email: `${name.toLowerCase()}-${Math.random().toString(36).slice(2)}@test.uy`,
      role,
    }),
  );
  return { id, as: t.withIdentity({ subject: `${id}|test-session` }) };
}

type EventFields = Omit<Doc<"events">, "_id" | "_creationTime">;

/** Inserta un evento válido directo en la base, salteando las validaciones. */
export async function insertEvent(
  t: T,
  organizerId: Id<"users">,
  overrides: Partial<EventFields> = {},
) {
  const now = Date.now();
  return await t.run((ctx) =>
    ctx.db.insert("events", {
      title: "Junada en la rambla",
      description: "",
      slug: `junada-${Math.random().toString(36).slice(2)}`,
      kind: "junada",
      startsAt: now + DAY,
      endsAt: now + DAY + 3 * HOUR,
      placeName: "Rambla de Pocitos",
      lat: -34.91,
      lon: -56.15,
      organizerId,
      status: "published",
      attendeeCount: 0,
      updatedAt: now,
      ...overrides,
    }),
  );
}

/** Espera que la promesa falle con un ConvexError de ese código. */
export async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (e: unknown) => (e as { data?: { code?: string } })?.data?.code === code,
  );
}
