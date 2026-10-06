import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { fail } from "./lib/errors";
import { toEventView } from "./lib/eventView";

export const toggle = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(eventId);
    if (!event) fail("NOT_FOUND", "El evento no existe.");

    const existing = await ctx.db
      .query("attendances")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(eventId, { attendeeCount: Math.max(0, event.attendeeCount - 1) });
      return { attending: false };
    }

    if (event.status !== "published" || event.endsAt < Date.now()) {
      fail("INVALID", "Este evento ya no acepta asistencias.");
    }
    await ctx.db.insert("attendances", { eventId, userId: user._id });
    await ctx.db.patch(eventId, { attendeeCount: event.attendeeCount + 1 });
    return { attending: true };
  },
});

export const isAttending = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const row = await ctx.db
      .query("attendances")
      .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
      .first();
    return row !== null;
  },
});

export const myEvents = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("attendances")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const events = (await Promise.all(rows.map((row) => ctx.db.get(row.eventId)))).filter(
      (event): event is Doc<"events"> => event !== null && event.status !== "hidden",
    );
    events.sort((a, b) => a.startsAt - b.startsAt);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});
