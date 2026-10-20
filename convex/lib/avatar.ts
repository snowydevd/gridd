import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./errors";

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** La foto a mostrar: la subida si hay, si no la del login social. */
export async function avatarUrl(ctx: QueryCtx, user: Doc<"users">) {
  if (user.avatarId) return await ctx.storage.getUrl(user.avatarId);
  return user.image ?? null;
}

/**
 * Valida un archivo recién subido para usarlo de avatar. Un archivo inválido no se puede borrar
 * acá: al fallar, Convex deshace todo lo que hizo la mutation, `storage.delete` incluido.
 */
export async function assertAvatarFile(ctx: MutationCtx, storageId: Id<"_storage">, userId: Id<"users">) {
  const file = await ctx.db.system.get(storageId);
  if (!file) fail("INVALID", "La foto no existe. Volvé a subirla.");
  const owner = await ctx.db
    .query("users")
    .withIndex("by_avatar", (q) => q.eq("avatarId", storageId))
    .first();
  if (owner && owner._id !== userId) fail("FORBIDDEN", "Esa foto pertenece a otro usuario.");
  const event = await ctx.db
    .query("events")
    .withIndex("by_image", (q) => q.eq("imageId", storageId))
    .first();
  if (event) fail("FORBIDDEN", "Esa imagen pertenece a un evento.");
  if (!file.contentType || !AVATAR_TYPES.includes(file.contentType) || file.size > AVATAR_MAX_BYTES) {
    fail("INVALID", "La foto tiene que ser JPG, PNG o WebP de hasta 2 MB.");
  }
}
