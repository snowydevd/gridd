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

/**
 * Borra la cuenta y todo lo suyo, en una sola transacción. Si tiene eventos publicados que todavía
 * no terminaron, no deja: los tiene que cancelar antes para no dejar plantada a la gente anotada.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    const events = await ctx.db
      .query("events")
      .withIndex("by_organizer", (q) => q.eq("organizerId", user._id))
      .collect();
    const upcoming = events.filter((e) => e.status === "published" && e.endsAt >= now).length;
    if (upcoming > 0) {
      fail(
        "CONFLICT",
        upcoming === 1
          ? "Tenés un evento próximo publicado. Cancelalo antes de eliminar tu cuenta."
          : `Tenés ${upcoming} eventos próximos publicados. Cancelalos antes de eliminar tu cuenta.`,
      );
    }

    // Sus eventos (pasados, cancelados u ocultos), con la portada y lo que otros tenían en ellos.
    for (const event of events) {
      for (const table of ["attendances", "saves"] as const) {
        const rows = await ctx.db
          .query(table)
          .withIndex("by_event_user", (q) => q.eq("eventId", event._id))
          .collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
      if (event.imageId) await ctx.storage.delete(event.imageId);
      await ctx.db.delete(event._id);
    }

    // Sus anotaciones a eventos ajenos: el contador del evento baja.
    const attendances = await ctx.db
      .query("attendances")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const attendance of attendances) {
      const event = await ctx.db.get(attendance.eventId);
      if (event) await ctx.db.patch(event._id, { attendeeCount: Math.max(0, event.attendeeCount - 1) });
      await ctx.db.delete(attendance._id);
    }

    for (const table of ["saves", "cars", "publisherRequests"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }

    // Si era admin, las solicitudes que revisó quedan sin revisor.
    const reviewed = await ctx.db
      .query("publisherRequests")
      .withIndex("by_reviewer", (q) => q.eq("reviewedBy", user._id))
      .collect();
    for (const request of reviewed) await ctx.db.patch(request._id, { reviewedBy: undefined });

    // Login: cuentas con sus códigos y sesiones con sus tokens. Lo desloguea en todos lados y
    // libera el email para registrarse de nuevo.
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      const verifiers = await ctx.db
        .query("authVerifiers")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const verifier of verifiers) await ctx.db.delete(verifier._id);
      await ctx.db.delete(session._id);
    }

    if (user.avatarId) await ctx.storage.delete(user.avatarId);
    await ctx.db.delete(user._id);
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
