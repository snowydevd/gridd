import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertAvatarFile, avatarUrl } from "./lib/avatar";
import { currentUser, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";
import { validateName } from "./lib/validation";
import { DEFAULT_SEARCH_RADIUS, searchRadius } from "./lib/searchRadius";
import { eventKind, role } from "./lib/validators";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: await avatarUrl(ctx, user),
      // Foto subida por el usuario (no la del login social): se puede quitar.
      hasAvatar: !!user.avatarId,
      role: roleOf(user),
      searchRadius: user.searchRadius ?? DEFAULT_SEARCH_RADIUS,
      interests: user.interests ?? [],
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

/** Reemplaza la lista entera de intereses; los repetidos se guardan una sola vez. */
export const setInterests = mutation({
  args: { interests: v.array(eventKind) },
  handler: async (ctx, { interests }) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { interests: [...new Set(interests)], updatedAt: Date.now() });
    return null;
  },
});

/** Guarda una foto recién subida como foto de perfil y borra la anterior. */
export const setAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireUser(ctx);
    await assertAvatarFile(ctx, storageId, user._id);
    if (user.avatarId && user.avatarId !== storageId) await ctx.storage.delete(user.avatarId);
    await ctx.db.patch(user._id, { avatarId: storageId, updatedAt: Date.now() });
    return null;
  },
});

/** Quita la foto subida; vuelve a verse la del login social, si hay. */
export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.avatarId) return null;
    await ctx.storage.delete(user.avatarId);
    await ctx.db.patch(user._id, { avatarId: undefined, updatedAt: Date.now() });
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
