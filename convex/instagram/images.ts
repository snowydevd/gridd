"use node";

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { checkTemplateData } from "./templates/index";
import { renderSlides } from "./templates/render";

/** Renderiza una plantilla y guarda un JPEG por slide en storage (1 o, si es carrusel, varios). */
export const renderTemplate = internalAction({
  args: {
    template: v.union(v.literal("headline"), v.literal("feature"), v.literal("carousel")),
    // Se valida con checkTemplateData: puede venir de un LLM.
    data: v.any(),
  },
  handler: async (ctx, args): Promise<Id<"_storage">[]> => {
    const slides = await renderSlides(checkTemplateData(args));
    return await Promise.all(
      slides.map((jpeg) => ctx.storage.store(new Blob([jpeg], { type: "image/jpeg" }))),
    );
  },
});
