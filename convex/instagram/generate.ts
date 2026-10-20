"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { ANGLES } from "./content/angles";
import { DEFAULT_MODEL, type GeneratedPost, generatePost, reviewPost } from "./content/llm";
import { pickAngles, pickTemplate, schedule } from "./content/plan";
import { renderSlides } from "./templates/render";

const DAY = 24 * 60 * 60 * 1000;
const templateName = v.union(v.literal("headline"), v.literal("feature"), v.literal("carousel"));

type BatchResult = { batchId: string; created: Id<"igPosts">[]; errors: string[] };

/** Renderiza y guarda cada post como draft. Un post que falla no frena al resto. */
async function saveDrafts(
  ctx: ActionCtx,
  posts: GeneratedPost[],
  startAt: number,
  everyDays: number,
  errors: string[],
): Promise<BatchResult> {
  const batchId = `batch-${new Date().toISOString()}`;
  const dates = schedule(startAt, posts.length, everyDays);
  const created: Id<"igPosts">[] = [];
  for (const [i, post] of posts.entries()) {
    try {
      const slides = await renderSlides(post);
      const images = await Promise.all(
        slides.map((jpeg) => ctx.storage.store(new Blob([jpeg], { type: "image/jpeg" }))),
      );
      created.push(
        await ctx.runMutation(internal.instagram.posts.createDraft, {
          caption: post.caption,
          angle: post.angle,
          images,
          scheduledAt: dates[i],
          batchId,
        }),
      );
    } catch (e) {
      errors.push(`Post ${i + 1} (${post.angle}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`[instagram] lote ${batchId}: ${created.length} draft(s), ${errors.length} error(es)`);
  for (const error of errors) console.error(`[instagram] ${error}`);
  return { batchId, created, errors };
}

async function runGenerate(ctx: ActionCtx, count: number, startAt: number, everyDays: number) {
  if (count < 1 || count > 10) throw new Error("count tiene que ser entre 1 y 10.");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta la env var ANTHROPIC_API_KEY.");
  const model = process.env.IG_LLM_MODEL || DEFAULT_MODEL;
  const client = new Anthropic();

  const recent = await ctx.runQuery(internal.instagram.posts.recentPosts, { limit: 20 });
  const angles = pickAngles(ANGLES, recent.map((p) => p.angle), count);
  const recentCaptions = recent.slice(0, 6).map((p) => p.caption);

  const posts: GeneratedPost[] = [];
  const errors: string[] = [];
  for (const [i, angle] of angles.entries()) {
    try {
      const post = await generatePost(client, {
        angle,
        template: pickTemplate(angle, recent.length + i),
        recentCaptions: [...posts.map((p) => p.caption), ...recentCaptions],
        model,
      });
      posts.push(post);
    } catch (e) {
      errors.push(`Post ${i + 1} (${angle.id}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return await saveDrafts(ctx, posts, startAt, everyDays, errors);
}

/** Genera un lote de drafts con el LLM. Nunca aprueba: quedan para revisión manual. */
export const generateBatch = internalAction({
  args: { count: v.number(), startAt: v.number(), everyDays: v.optional(v.number()) },
  handler: (ctx, { count, startAt, everyDays }): Promise<BatchResult> =>
    runGenerate(ctx, count, startAt, everyDays ?? 2),
});

/**
 * Lote desde JSON, sin LLM (escrito a mano o en otra herramienta). Pasa las mismas
 * validaciones que lo generado; si algún post no valida, no se crea ninguno.
 */
export const createBatch = internalAction({
  args: {
    posts: v.array(
      v.object({ angle: v.string(), caption: v.string(), template: templateName, data: v.any() }),
    ),
    startAt: v.number(),
    everyDays: v.optional(v.number()),
  },
  handler: async (ctx, { posts, startAt, everyDays }): Promise<BatchResult> => {
    const problems: string[] = [];
    const ready: GeneratedPost[] = [];
    for (const [i, p] of posts.entries()) {
      const angle = ANGLES.find((a) => a.id === p.angle);
      if (!angle) {
        problems.push(`Post ${i + 1}: el ángulo "${p.angle}" no existe en content/angles.ts.`);
        continue;
      }
      const result = reviewPost(angle, p.template, p);
      if ("post" in result) ready.push(result.post);
      else problems.push(...result.problems.map((x) => `Post ${i + 1}: ${x}`));
    }
    if (problems.length > 0) throw new Error(`El lote no pasó la validación:\n${problems.join("\n")}`);
    return await saveDrafts(ctx, ready, startAt, everyDays ?? 2, []);
  },
});

/** Próximo lunes 22:00 UTC (19:00 en Uruguay), como mínimo dentro de 2 días. */
function nextMondayEvening(now: number) {
  const d = new Date(now + 2 * DAY);
  d.setUTCHours(22, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

/** Cron semanal: sólo corre con IG_AUTOGEN_ENABLED=true. Deja drafts para la semana siguiente. */
export const generateWeekly = internalAction({
  args: {},
  handler: async (ctx): Promise<BatchResult | null> => {
    if (process.env.IG_AUTOGEN_ENABLED !== "true") return null;
    const count = Number(process.env.IG_AUTOGEN_COUNT) || 3;
    return await runGenerate(ctx, count, nextMondayEvening(Date.now()), 2);
  },
});
