import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireAdmin, requireUser, roleOf } from "./lib/auth";
import { fail } from "./lib/errors";

export const submit = mutation({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (roleOf(user) !== "user") fail("CONFLICT", "Ya podés publicar eventos.");

    const message = args.message.trim();
    if (message.length < 10 || message.length > 500) {
      fail("INVALID", "Contanos entre 10 y 500 caracteres sobre vos o tu grupo.");
    }

    const pending = await ctx.db
      .query("publisherRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (pending) fail("CONFLICT", "Ya tenés una solicitud pendiente.");

    return await ctx.db.insert("publisherRequests", {
      userId: user._id,
      message,
      status: "pending",
    });
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("publisherRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const requests = await ctx.db
      .query("publisherRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .collect();
    return await Promise.all(
      requests.map(async (request) => {
        const user = await ctx.db.get(request.userId);
        return {
          ...request,
          user: user
            ? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }
            : null,
        };
      }),
    );
  },
});

async function resolve(
  ctx: MutationCtx,
  requestId: Id<"publisherRequests">,
  status: "approved" | "rejected",
) {
  const admin = await requireAdmin(ctx);
  const request = await ctx.db.get(requestId);
  if (!request) fail("NOT_FOUND", "La solicitud no existe.");
  if (request.status !== "pending") fail("CONFLICT", "La solicitud ya fue resuelta.");
  await ctx.db.patch(requestId, { status, reviewedBy: admin._id, reviewedAt: Date.now() });
  const requester = await ctx.db.get(request.userId);
  // Sólo se promueve a quien sigue siendo user: no le baja el rol a un admin.
  if (status === "approved" && requester && roleOf(requester) === "user") {
    await ctx.db.patch(request.userId, { role: "publisher", updatedAt: Date.now() });
  }
  return null;
}

export const approve = mutation({
  args: { requestId: v.id("publisherRequests") },
  handler: (ctx, { requestId }) => resolve(ctx, requestId, "approved"),
});

export const reject = mutation({
  args: { requestId: v.id("publisherRequests") },
  handler: (ctx, { requestId }) => resolve(ctx, requestId, "rejected"),
});
