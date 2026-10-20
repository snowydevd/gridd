import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Una sola fila con el token vigente. Nada público lee esta tabla.

export const current = internalQuery({
  args: {},
  handler: (ctx) => ctx.db.query("igCredentials").first(),
});

export const save = internalMutation({
  args: {
    accessToken: v.string(),
    igUserId: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const row = { ...args, refreshedAt: Date.now() };
    const existing = await ctx.db.query("igCredentials").first();
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("igCredentials", row);
  },
});
