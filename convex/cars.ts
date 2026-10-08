import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { currentUser, requireUser } from "./lib/auth";
import { fail } from "./lib/errors";
import { isValidVehicle } from "./lib/vehicleCatalog";

/** Tope de autos por usuario en el garage. */
export const MAX_CARS = 10;
const MAX_VERSION = 40;

const carInput = {
  make: v.string(),
  model: v.string(),
  year: v.number(),
  version: v.optional(v.string()),
  isModified: v.optional(v.boolean()),
};

type CarInput = { make: string; model: string; year: number; version?: string; isModified?: boolean };

/** Valida contra el catálogo y normaliza: versión recortada (o sin versión) y `isModified` explícito. */
function validateCar(input: CarInput) {
  if (!isValidVehicle(input, new Date().getFullYear())) {
    fail("INVALID", "Elegí una marca, modelo y año del catálogo.");
  }
  const version = input.version?.trim() || undefined;
  if (version && version.length > MAX_VERSION) {
    fail("INVALID", `La versión puede tener hasta ${MAX_VERSION} caracteres.`);
  }
  return {
    make: input.make,
    model: input.model,
    year: input.year,
    version,
    isModified: input.isModified ?? false,
  };
}

async function getOwnCar(ctx: QueryCtx, user: Doc<"users">, id: Id<"cars">) {
  const car = await ctx.db.get(id);
  if (!car) fail("NOT_FOUND", "El auto no existe.");
  if (car.userId !== user._id) fail("FORBIDDEN", "Ese auto es de otro usuario.");
  return car;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("cars")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_CARS);
  },
});

export const add = mutation({
  args: carInput,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const car = validateCar(args);
    const existing = await ctx.db
      .query("cars")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_CARS);
    if (existing.length >= MAX_CARS) {
      fail("CONFLICT", `Podés tener hasta ${MAX_CARS} autos en tu garage.`);
    }
    return await ctx.db.insert("cars", { userId: user._id, ...car });
  },
});

/** Reemplaza el auto con el estado completo del formulario (una versión ausente se borra). */
export const update = mutation({
  args: { id: v.id("cars"), ...carInput },
  handler: async (ctx, { id, ...args }) => {
    const user = await requireUser(ctx);
    await getOwnCar(ctx, user, id);
    await ctx.db.replace(id, { userId: user._id, ...validateCar(args) });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("cars") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    await getOwnCar(ctx, user, id);
    await ctx.db.delete(id);
    return null;
  },
});
