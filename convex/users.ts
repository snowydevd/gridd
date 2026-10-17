import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { currentUser, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";
import { validateName } from "./lib/validation";
import { DEFAULT_SEARCH_RADIUS, searchRadius } from "./lib/searchRadius";
import { role } from "./lib/validators";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: roleOf(user),
      searchRadius: user.searchRadius ?? DEFAULT_SEARCH_RADIUS,
    };
  },
});

export const updateProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { name: validateName(name), updatedAt: Date.now() });
    return null;
  },
});

export const setSearchRadius = mutation({
  args: { radius: searchRadius },
  handler: async (ctx, { radius }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { searchRadius: radius, updatedAt: Date.now() });
    return null;
  },
});

/** Bootstrap: `npx convex run users:setRole '{"email":"vos@mail.com","role":"admin"}'` */
export const setRole = internalMutation({
  args: { email: v.string(), role },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) fail("NOT_FOUND", `No hay usuario con email ${email}.`);
    await ctx.db.patch(user._id, { role: args.role, updatedAt: Date.now() });
    return user._id;
  },
});
