import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { roleOf } from "./lib/auth";
import { avatarUrl } from "./lib/avatar";
import { toEventView } from "./lib/eventView";

/** Perfil público de un organizador: foto, seguidores y sus eventos publicados. Lo ven también los invitados. */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const organizer = await ctx.db.get(userId);
    // Sólo los organizadores tienen perfil público: de un usuario común no se expone nada.
    if (!organizer || roleOf(organizer) === "user") return null;

    const viewerId = await getAuthUserId(ctx);
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) => q.eq("organizerId", userId))
      .collect();
    const now = Date.now();
    const published = events.filter((e) => e.status === "published");
    const upcoming = published.filter((e) => e.endsAt >= now).sort((a, b) => a.startsAt - b.startsAt);
    const past = published.filter((e) => e.endsAt < now).sort((a, b) => b.startsAt - a.startsAt);

    return {
      _id: organizer._id,
      name: organizer.name ?? null,
      image: await avatarUrl(ctx, organizer),
      verified: true,
      followerCount: followers.length,
      isFollowing: viewerId !== null && followers.some((f) => f.followerId === viewerId),
      upcoming: await Promise.all(upcoming.map((e) => toEventView(ctx, e))),
      past: await Promise.all(past.map((e) => toEventView(ctx, e))),
    };
  },
});
