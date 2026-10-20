import { mutation } from "./_generated/server";
import { requirePublisher, requireUser } from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePublisher(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Cualquier usuario logueado puede subir su foto de perfil. */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
