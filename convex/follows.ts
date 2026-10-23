import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";

export const toggle = mutation({
  args: { organizerId: v.id("users") },
  handler: async (ctx, { organizerId }) => {
    const user = await requireUser(ctx);
    if (organizerId === user._id) fail("INVALID", "No te podés seguir a vos mismo.");

    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_organizer", (q) => q.eq("followerId", user._id).eq("organizerId", organizerId))
      .first();
    // Dejar de seguir siempre se puede, aunque ya no sea organizador.
    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }

    const organizer = await ctx.db.get(organizerId);
    if (!organizer || roleOf(organizer) === "user") fail("INVALID", "Sólo podés seguir a organizadores.");
    await ctx.db.insert("follows", { followerId: user._id, organizerId });
    return { following: true };
  },
});
