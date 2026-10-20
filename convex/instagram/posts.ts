import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { fail } from "../lib/errors";
import { igPostStatus } from "../lib/validators";

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY = 30 * 60 * 1000;
// Límite de Instagram para el caption.
const MAX_CAPTION = 2200;

function cleanCaption(caption: string) {
  const clean = caption.trim();
  if (clean.length === 0 || clean.length > MAX_CAPTION) {
    fail("INVALID", `El caption tiene que tener entre 1 y ${MAX_CAPTION} caracteres.`);
  }
  return clean;
}

async function getPost(ctx: MutationCtx, postId: Id<"igPosts">) {
  const post = await ctx.db.get(postId);
  if (!post) fail("NOT_FOUND", "El post no existe.");
  return post;
}

function requireStatus(post: Doc<"igPosts">, allowed: Doc<"igPosts">["status"][]) {
  if (!allowed.includes(post.status)) {
    fail("CONFLICT", `No se puede hacer esto con un post en estado ${post.status}.`);
  }
}

// ---------- Internas ----------

export const createDraft = internalMutation({
  args: {
    caption: v.string(),
    angle: v.string(),
    images: v.array(v.id("_storage")),
    scheduledAt: v.optional(v.number()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.images.length < 1 || args.images.length > 10) {
      fail("INVALID", "Un post lleva entre 1 y 10 imágenes.");
    }
    return await ctx.db.insert("igPosts", {
      ...args,
      caption: cleanCaption(args.caption),
      status: "draft",
      attempts: 0,
    });
  },
});

/** Lock contra doble publicación: sólo toma el post si sigue approved. Devuelve null si no. */
export const markPublishing = internalMutation({
  args: { postId: v.id("igPosts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "approved") return null;
    await ctx.db.patch(postId, { status: "publishing" });
    return { ...post, status: "publishing" as const };
  },
});

/** Guarda el contenedor apenas se crea, para no crear otro si el intento se corta. */
export const saveContainer = internalMutation({
  args: { postId: v.id("igPosts"), containerId: v.string() },
  handler: async (ctx, { postId, containerId }) => {
    await ctx.db.patch(postId, { containerId });
  },
});

export const markPublished = internalMutation({
  args: {
    postId: v.id("igPosts"),
    igMediaId: v.string(),
    permalink: v.optional(v.string()),
  },
  handler: async (ctx, { postId, igMediaId, permalink }) => {
    requireStatus(await getPost(ctx, postId), ["publishing"]);
    await ctx.db.patch(postId, {
      status: "published",
      igMediaId,
      permalink,
      publishedAt: Date.now(),
      lastError: undefined,
    });
  },
});

/** El permalink se pide después de publicar; si falla, el post igual queda published. */
export const savePermalink = internalMutation({
  args: { postId: v.id("igPosts"), permalink: v.string() },
  handler: async (ctx, { postId, permalink }) => {
    await ctx.db.patch(postId, { permalink });
  },
});

/**
 * Suma un intento; si quedan, lo vuelve a approved en RETRY_DELAY, si no queda failed.
 * `final` lo deja failed directo (casos que necesitan que alguien revise la cuenta).
 */
export const markFailed = internalMutation({
  args: { postId: v.id("igPosts"), error: v.string(), final: v.optional(v.boolean()) },
  handler: async (ctx, { postId, error, final }) => {
    const post = await getPost(ctx, postId);
    requireStatus(post, ["publishing"]);
    const attempts = post.attempts + 1;
    const retry = !final && attempts < MAX_ATTEMPTS;
    await ctx.db.patch(postId, {
      attempts,
      lastError: error,
      status: retry ? "approved" : "failed",
      ...(retry && { scheduledAt: Date.now() + RETRY_DELAY }),
    });
  },
});

export const getById = internalQuery({
  args: { postId: v.id("igPosts") },
  handler: (ctx, { postId }) => ctx.db.get(postId),
});

export const dueApproved = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("igPosts")
      .withIndex("by_status_scheduledAt", (q) =>
        q.eq("status", "approved").lte("scheduledAt", Date.now()),
      )
      .collect();
  },
});

// ---------- Admin ----------

export const listByStatus = query({
  args: { status: igPostStatus },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const posts = await ctx.db
      .query("igPosts")
      .withIndex("by_status_scheduledAt", (q) => q.eq("status", status))
      .collect();
    return await Promise.all(
      posts.map(async (post) => ({
        ...post,
        imageUrls: await Promise.all(post.images.map((id) => ctx.storage.getUrl(id))),
      })),
    );
  },
});

export const approve = mutation({
  args: { postId: v.id("igPosts"), scheduledAt: v.optional(v.number()) },
  handler: async (ctx, { postId, scheduledAt }) => {
    await requireAdmin(ctx);
    const post = await getPost(ctx, postId);
    requireStatus(post, ["draft", "failed"]);
    const when = scheduledAt ?? post.scheduledAt;
    if (when === undefined) fail("INVALID", "Elegí cuándo se publica.");
    await ctx.db.patch(postId, {
      status: "approved",
      scheduledAt: when,
      // Un failed re-aprobado arranca de cero.
      ...(post.status === "failed" && { attempts: 0, lastError: undefined }),
    });
    return null;
  },
});

export const reject = mutation({
  args: { postId: v.id("igPosts") },
  handler: async (ctx, { postId }) => {
    await requireAdmin(ctx);
    requireStatus(await getPost(ctx, postId), ["draft", "approved", "failed"]);
    await ctx.db.patch(postId, { status: "rejected" });
    return null;
  },
});

export const reschedule = mutation({
  args: { postId: v.id("igPosts"), scheduledAt: v.number() },
  handler: async (ctx, { postId, scheduledAt }) => {
    await requireAdmin(ctx);
    requireStatus(await getPost(ctx, postId), ["draft", "approved"]);
    await ctx.db.patch(postId, { scheduledAt });
    return null;
  },
});

export const updateCaption = mutation({
  args: { postId: v.id("igPosts"), caption: v.string() },
  handler: async (ctx, { postId, caption }) => {
    await requireAdmin(ctx);
    requireStatus(await getPost(ctx, postId), ["draft", "approved"]);
    await ctx.db.patch(postId, { caption: cleanCaption(caption) });
    return null;
  },
});
