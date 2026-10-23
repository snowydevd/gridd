"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { renderStory } from "./instagram/templates/render";
import { storyFromEvent } from "./instagram/templates/story";
import { fail } from "./lib/errors";

/** Portada como data URL para satori; `null` si no hay o no se pudo bajar (la historia sale igual). */
async function coverDataUrl(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const type = res.headers.get("content-type") ?? "";
    // satori dibuja JPEG y PNG.
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Imagen para historia de Instagram (JPEG 1080×1920) de un evento. Se genera en cada pedido con los
 * datos al día; no se guarda. Usa `events.getBySlug`, así que un evento oculto sólo lo ve quien puede.
 */
export const eventStory = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<ArrayBuffer> => {
    const event = await ctx.runQuery(api.events.getBySlug, { slug });
    if (!event) fail("NOT_FOUND", "El evento no existe.");
    const jpeg = await renderStory(storyFromEvent(event, await coverDataUrl(event.imageUrl)));
    return jpeg.buffer;
  },
});
