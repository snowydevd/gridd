import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { publishOne, refreshAndSave } from "./client";

const REFRESH_MARGIN = 10 * 24 * 60 * 60 * 1000;

/** Si el token guardado vence pronto, lo refresca. Un error acá no frena la publicación. */
async function refreshIfExpiring(ctx: ActionCtx) {
  const creds = await ctx.runQuery(internal.instagram.credentials.current, {});
  if (!creds || creds.expiresAt - Date.now() > REFRESH_MARGIN) return;
  try {
    await refreshAndSave(ctx);
  } catch (e) {
    console.error(`[instagram] no se pudo refrescar el token: ${e instanceof Error ? e.message : e}`);
  }
}

/** Corre cada 15 minutos: publica los posts approved cuya fecha ya pasó, de a uno. */
export const publishDue = internalAction({
  args: {},
  handler: async (ctx) => {
    await refreshIfExpiring(ctx);
    const due = await ctx.runQuery(internal.instagram.posts.dueApproved, {});
    if (due.length === 0) return;
    console.log(`[instagram] ${due.length} post(s) para publicar`);
    for (const post of due) {
      // publishOne toma el lock; si otra ejecución ya lo agarró, lo saltea.
      const res = await publishOne(ctx, post._id);
      if (res.skipped) console.log(`[instagram] post ${post._id} ya lo tomó otra ejecución`);
    }
  },
});
