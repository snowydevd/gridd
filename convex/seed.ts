import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { eventKind } from "./lib/validators";

/**
 * Datos de prueba para desarrollo. Todo es `internal`: sólo se puede correr con
 * `bunx convex run seed:...` (lo hace `scripts/seed-events.ts`), nunca desde la app.
 *
 * Los organizadores de prueba se reconocen por el dominio de su email, así `clear` borra sólo eso.
 */
export const SEED_EMAIL_DOMAIN = "seed.gridd.local";

/** "Montevideo Midnight Club" → "montevideo-midnight-club@seed.gridd.local" */
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

/** Inserta los eventos (salteando slugs existentes) y crea un organizador de prueba por nombre. */
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
    for (const { organizerName, ...event } of events) {
      const exists = await ctx.db
        .query("events")
        .withIndex("by_slug", (q) => q.eq("slug", event.slug))
        .first();
      if (exists) continue;

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
    return { inserted, skipped: events.length - inserted };
  },
});

/** Borra los eventos de los organizadores de prueba, sus fotos, asistencias y los propios organizadores. */
export const clear = internalMutation({
  args: { organizerNames: v.array(v.string()) },
  handler: async (ctx, { organizerNames }) => {
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
    return { events, organizers };
  },
});
