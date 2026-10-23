import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, internalMutation, internalQuery } from "./_generated/server";
import { isValidVehicle } from "./lib/vehicleCatalog";
import { eventKind } from "./lib/validators";

/**
 * Datos de prueba para desarrollo. Todo es `internal`: sólo se puede correr con
 * `bunx convex run seed:...` (lo hace `scripts/seed-events.ts`), nunca desde la app.
 *
 * Los organizadores y la gente de prueba se reconocen por el dominio de su email, así `clear` borra sólo eso.
 */
export const SEED_EMAIL_DOMAIN = "seed.gridd.local";

/** "Montevideo Midnight Club" → "montevideo-midnight-club@seed.gridd.local". También para la gente de prueba. */
const seedEmail = (organizerName: string) =>
  `${organizerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@${SEED_EMAIL_DOMAIN}`;

export const generateUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/** Slugs que ya existen, para no volver a subir fotos de eventos ya sembrados. */
export const existingSlugs = internalQuery({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, { slugs }) => {
    const found: string[] = [];
    for (const slug of slugs) {
      const event = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (event) found.push(slug);
    }
    return found;
  },
});

/**
 * Inserta los eventos y crea un organizador de prueba por nombre. Si el slug ya existe y es de un
 * organizador de prueba, le actualiza las fechas (así correr el seed otra vez los deja próximos);
 * si es de un usuario real, no lo toca.
 */
export const insertEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        slug: v.string(),
        title: v.string(),
        description: v.string(),
        kind: eventKind,
        startsAt: v.number(),
        endsAt: v.number(),
        placeName: v.string(),
        lat: v.number(),
        lon: v.number(),
        attendeeCount: v.number(),
        organizerName: v.string(),
        imageId: v.optional(v.id("_storage")),
      }),
    ),
  },
  handler: async (ctx, { events }) => {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const { organizerName, ...event } of events) {
      const exists = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", event.slug))
        .first();
      if (exists) {
        const owner = await ctx.db.get(exists.organizerId);
        if (owner?.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
          await ctx.db.patch(exists._id, { startsAt: event.startsAt, endsAt: event.endsAt, updatedAt: Date.now() });
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      const email = seedEmail(organizerName);
      const organizer = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const organizerId =
        organizer?._id ??
        (await ctx.db.insert("users", { name: organizerName, email, role: "publisher" }));

      await ctx.db.insert("events", {
        ...event,
        organizerId,
        status: "published",
        updatedAt: Date.now(),
      });
      inserted++;
    }
    return { inserted, updated, skipped };
  },
});

/** El contador de un evento queda igual a las anotaciones que tiene de verdad. */
async function recount(ctx: MutationCtx, eventId: Id<"events">) {
  const rows = await ctx.db
    .query("attendances")
    .withIndex("by_event_user", (q) => q.eq("eventId", eventId))
    .collect();
  await ctx.db.patch(eventId, { attendeeCount: rows.length });
}

/**
 * Crea gente de prueba (rol user, sin foto, con un auto del catálogo) y la anota a eventos por slug.
 * Idempotente: no duplica gente, autos ni anotaciones. Los eventos tocados quedan con el contador real.
 */
export const insertPeople = internalMutation({
  args: {
    people: v.array(
      v.object({
        name: v.string(),
        car: v.optional(v.object({ make: v.string(), model: v.string(), year: v.number() })),
      }),
    ),
    attendances: v.array(v.object({ slug: v.string(), names: v.array(v.string()) })),
  },
  handler: async (ctx, { people, attendances }) => {
    const year = new Date().getFullYear();
    const ids = new Map<string, Id<"users">>();
    let created = 0;
    for (const { name, car } of people) {
      if (car && !isValidVehicle(car, year)) throw new Error(`Auto fuera del catálogo: ${car.make} ${car.model} ${car.year}`);
      const email = seedEmail(name);
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      const userId = existing?._id ?? (await ctx.db.insert("users", { name, email, role: "user" }));
      if (!existing) created++;
      ids.set(name, userId);
      const hasCar = await ctx.db
        .query("cars")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (car && !hasCar) await ctx.db.insert("cars", { userId, ...car });
    }

    let joined = 0;
    for (const { slug, names } of attendances) {
      const event = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!event) continue;
      for (const name of names) {
        const userId = ids.get(name);
        if (!userId) continue;
        const already = await ctx.db
          .query("attendances")
          .withIndex("by_event_user", (q) => q.eq("eventId", event._id).eq("userId", userId))
          .first();
        if (already) continue;
        await ctx.db.insert("attendances", { eventId: event._id, userId });
        joined++;
      }
      await recount(ctx, event._id);
    }
    return { people: created, attendances: joined };
  },
});

/**
 * Borra los eventos de los organizadores de prueba (con fotos y asistencias) y a los organizadores.
 * Con `personNames`, también a la gente de prueba con sus autos y anotaciones; los eventos que no se
 * borran quedan con el contador real.
 */
export const clear = internalMutation({
  args: { organizerNames: v.array(v.string()), personNames: v.optional(v.array(v.string())) },
  handler: async (ctx, { organizerNames, personNames = [] }) => {
    let events = 0;
    let organizers = 0;
    for (const name of organizerNames) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", seedEmail(name)))
        .first();
      if (!user) continue;
      const own = await ctx.db
        .query("events")
        .withIndex("by_organizer", (q) => q.eq("organizerId", user._id))
        .collect();
      for (const event of own) {
        const attendances = await ctx.db
          .query("attendances")
          .withIndex("by_event_user", (q) => q.eq("eventId", event._id))
          .collect();
        for (const a of attendances) await ctx.db.delete(a._id);
        if (event.imageId) await ctx.storage.delete(event.imageId);
        await ctx.db.delete(event._id);
        events++;
      }
      await ctx.db.delete(user._id);
      organizers++;
    }

    let people = 0;
    for (const name of personNames) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", seedEmail(name)))
        .first();
      if (!user) continue;
      const rows = await ctx.db
        .query("attendances")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        if (await ctx.db.get(row.eventId)) await recount(ctx, row.eventId);
      }
      const cars = await ctx.db
        .query("cars")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const car of cars) await ctx.db.delete(car._id);
      await ctx.db.delete(user._id);
      people++;
    }
    return { events, organizers, people };
  },
});
