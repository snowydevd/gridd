import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import type { IgPostStatus } from "../lib/validators";
import { type GraphClient, createGraphClient } from "./graph";

// Un token recién generado dura ~60 días; el refresh semanal lo mantiene vigente.
const SEED_TTL = 60 * 24 * 60 * 60 * 1000;

const isDryRun = () => process.env.IG_DRY_RUN === "true";

type Credentials = { accessToken: string; igUserId: string; expiresAt: number };

async function loadCredentials(ctx: ActionCtx): Promise<Credentials> {
  const row = await ctx.runQuery(internal.instagram.credentials.current, {});
  if (row) return row;

  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  if (!accessToken || !igUserId) {
    if (isDryRun()) return { accessToken: "dry-run", igUserId: "dry-run", expiresAt: Date.now() + SEED_TTL };
    throw new Error("Faltan IG_ACCESS_TOKEN o IG_USER_ID para inicializar las credenciales de Instagram.");
  }
  const seed = { accessToken, igUserId, expiresAt: Date.now() + SEED_TTL };
  await ctx.runMutation(internal.instagram.credentials.save, seed);
  console.log(`[instagram] credenciales inicializadas desde env para la cuenta ${igUserId}`);
  return seed;
}

/** Arma el cliente de Graph con el token vigente. Lo usan estas actions y el scheduler. */
export async function loadClient(ctx: ActionCtx): Promise<{ client: GraphClient; creds: Credentials }> {
  const creds = await loadCredentials(ctx);
  const version = process.env.IG_GRAPH_VERSION;
  if (!version && !isDryRun()) throw new Error("Falta la env var IG_GRAPH_VERSION (ej. v23.0).");
  const client = createGraphClient({
    accessToken: creds.accessToken,
    igUserId: creds.igUserId,
    version: version ?? "dry-run",
    dryRun: isDryRun(),
  });
  return { client, creds };
}

export const getCredentials = internalAction({
  args: {},
  handler: (ctx) => loadCredentials(ctx),
});

/** Pide un token nuevo a Meta y lo guarda en igCredentials. */
export async function refreshAndSave(ctx: ActionCtx) {
  const { client, creds } = await loadClient(ctx);
  const { accessToken, expiresAt } = await client.refreshToken();
  await ctx.runMutation(internal.instagram.credentials.save, {
    accessToken,
    igUserId: creds.igUserId,
    expiresAt,
  });
  console.log(`[instagram] token refrescado, vence ${new Date(expiresAt).toISOString()}`);
  return { expiresAt };
}

export const refreshToken = internalAction({
  args: {},
  handler: (ctx) => refreshAndSave(ctx),
});

/** Contenedor listo para publicar: reutiliza el guardado si sirve, si no crea uno nuevo. */
async function prepareContainer(ctx: ActionCtx, client: GraphClient, post: Doc<"igPosts">) {
  if (post.containerId) {
    const { statusCode } = await client.getContainerStatus(post.containerId);
    if (statusCode === "PUBLISHED") {
      return {
        published: true as const,
        error:
          `El contenedor ${post.containerId} ya figura publicado en Instagram pero no guardamos el media ID. ` +
          "Revisá la cuenta antes de reintentar para no duplicar el post.",
      };
    }
    if (statusCode === "FINISHED" || statusCode === "IN_PROGRESS") {
      await client.waitForContainer(post.containerId);
      return { published: false as const, containerId: post.containerId };
    }
    // ERROR o EXPIRED: se crea uno nuevo.
  }

  const urls = await Promise.all(
    post.images.map(async (id) => {
      const url = await ctx.storage.getUrl(id);
      if (!url) throw new Error(`La imagen ${id} ya no existe en storage.`);
      return url;
    }),
  );

  let containerId: string;
  if (urls.length === 1) {
    containerId = await client.createImageContainer({ imageUrl: urls[0], caption: post.caption });
  } else {
    const children: string[] = [];
    for (const imageUrl of urls) {
      const child = await client.createImageContainer({ imageUrl, isCarouselItem: true });
      await client.waitForContainer(child);
      children.push(child);
    }
    containerId = await client.createCarouselContainer({ children, caption: post.caption });
  }
  await ctx.runMutation(internal.instagram.posts.saveContainer, { postId: post._id, containerId });
  await client.waitForContainer(containerId);
  return { published: false as const, containerId };
}

/**
 * Publica un post que esté approved (ignora scheduledAt). Toma el lock con markPublishing,
 * así que dos ejecuciones simultáneas no lo publican dos veces.
 */
export async function publishOne(ctx: ActionCtx, postId: Id<"igPosts">) {
  const post = await ctx.runMutation(internal.instagram.posts.markPublishing, { postId });
  if (!post) return { skipped: true as const };

  // Un reintento después de un publish exitoso: no se vuelve a publicar.
  if (post.igMediaId) {
    await ctx.runMutation(internal.instagram.posts.markPublished, { postId, igMediaId: post.igMediaId });
    return { skipped: false as const };
  }

  try {
    const { client } = await loadClient(ctx);
    const prepared = await prepareContainer(ctx, client, post);
    if (prepared.published) {
      console.error(`[instagram] post ${postId}: ${prepared.error}`);
      await ctx.runMutation(internal.instagram.posts.markFailed, { postId, error: prepared.error, final: true });
      return { skipped: false as const };
    }

    const igMediaId = await client.publishContainer(prepared.containerId);
    await ctx.runMutation(internal.instagram.posts.markPublished, { postId, igMediaId });
    console.log(`[instagram] post ${postId} publicado como ${igMediaId}`);

    try {
      const permalink = await client.getPermalink(igMediaId);
      await ctx.runMutation(internal.instagram.posts.savePermalink, { postId, permalink });
      console.log(`[instagram] post ${postId}: ${permalink}`);
    } catch (e) {
      console.warn(`[instagram] post ${postId} publicado, pero falló el permalink: ${errorText(e)}`);
    }
  } catch (e) {
    console.error(`[instagram] post ${postId} falló: ${errorText(e)}`);
    await ctx.runMutation(internal.instagram.posts.markFailed, { postId, error: errorText(e) });
  }
  return { skipped: false as const };
}

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export const publishPost = internalAction({
  args: { postId: v.id("igPosts") },
  handler: async (ctx, { postId }) => {
    await publishOne(ctx, postId);
  },
});

/** Prueba manual desde el dashboard o `npx convex run`. Sólo publica posts ya aprobados. */
export const publishTest = internalAction({
  args: { postId: v.id("igPosts") },
  handler: async (
    ctx,
    { postId },
  ): Promise<{ status?: IgPostStatus; permalink?: string; lastError?: string }> => {
    try {
      const { client } = await loadClient(ctx);
      const limit = await client.getPublishingLimit();
      console.log(`[instagram] cupo de publicación: ${limit.quotaUsage}/${limit.quotaTotal ?? "?"}`);
    } catch (e) {
      console.warn(`[instagram] no se pudo leer el cupo: ${errorText(e)}`);
    }
    const res = await publishOne(ctx, postId);
    const post: Doc<"igPosts"> | null = await ctx.runQuery(internal.instagram.posts.getById, { postId });
    if (res.skipped) console.warn(`[instagram] post ${postId} no está approved (${post?.status}); no se publica.`);
    return { status: post?.status, permalink: post?.permalink, lastError: post?.lastError };
  },
});
