import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { fail } from "./lib/errors";
import { toEventView } from "./lib/eventView";

/** Guarda o quita un evento de la lista personal del usuario. */
export const toggle = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await requireUser(ctx);

    const existing = await ctx.db
      .query("saves")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", user._id))
      .first();

    // Quitar siempre se puede, aunque el evento ya no exista o lo hayan ocultado.
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    // Cancelados y pasados se pueden guardar (es una lista personal); los ocultos son como si no existieran.
    const event = await ctx.db.get(eventId);
    if (!event || event.status === "hidden") fail("NOT_FOUND", "El evento no existe.");
    await ctx.db.insert("saves", { eventId, userId: user._id });
    return { saved: true };
  },
});

export const isSaved = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const row = await ctx.db
      .query("saves")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
      .first();
    return row !== null;
  },
});

/** Eventos guardados por el usuario, ordenados por fecha. Vacío si es invitado. */
export const mySaved = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("saves")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const events = (await Promise.all(rows.map((row) => ctx.db.get(row.eventId)))).filter(
      (event): event is Doc<"events"> => event !== null && event.status !== "hidden",
    );
    events.sort((a, b) => a.startsAt - b.startsAt);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});
