import { v } from "convex/values";
import { carousel, carouselData } from "./carousel";
import { feature, featureData } from "./feature";
import type { El } from "./h";
import { headline, headlineData } from "./headline";

export const templateInput = v.union(
  v.object({ template: v.literal("headline"), data: headlineData }),
  v.object({ template: v.literal("feature"), data: featureData }),
  v.object({ template: v.literal("carousel"), data: carouselData }),
);
export type TemplateInput = typeof templateInput.type;
export type TemplateName = TemplateInput["template"];

/** Arma un elemento por slide (1 para headline/feature, 4–6 para carrusel). */
export function buildSlides(input: TemplateInput): El[] {
  switch (input.template) {
    case "headline":
      return headline(input.data);
    case "feature":
      return feature(input.data);
    case "carousel":
      return carousel(input.data);
  }
}

class TemplateDataError extends Error {}

function text(value: unknown, field: string, max: number, optional = false): void {
  if (value === undefined && optional) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TemplateDataError(`${field}: tiene que ser texto no vacío`);
  }
  if (value.length > max) throw new TemplateDataError(`${field}: máximo ${max} caracteres`);
}

function list(value: unknown, field: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TemplateDataError(`${field}: tiene que tener entre ${min} y ${max} elementos`);
  }
  return value;
}

function obj(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TemplateDataError(`${field}: tiene que ser un objeto`);
  }
  return value as Record<string, unknown>;
}

/**
 * Valida en runtime lo que los validadores de Convex no cubren (cantidades y largos),
 * y la forma completa cuando los datos vienen de un LLM. Devuelve el input tipado.
 */
export function checkTemplateData(raw: unknown): TemplateInput {
  const input = obj(raw, "input");
  const data = obj(input.data, "data");
  switch (input.template) {
    case "headline":
      text(data.headline, "headline", 90);
      text(data.subline, "subline", 120, true);
      text(data.cta, "cta", 28, true);
      break;
    case "feature":
      text(data.kicker, "kicker", 24, true);
      text(data.title, "title", 60);
      list(data.bullets, "bullets", 2, 3).forEach((b, i) => text(b, `bullets[${i}]`, 80));
      text(data.screenshot, "screenshot", 4096, true);
      text(data.cta, "cta", 28, true);
      break;
    case "carousel": {
      const cover = obj(data.cover, "cover");
      text(cover.title, "cover.title", 70);
      text(cover.subtitle, "cover.subtitle", 120, true);
      list(data.slides, "slides", 2, 4).forEach((s, i) => {
        const slide = obj(s, `slides[${i}]`);
        text(slide.title, `slides[${i}].title`, 60);
        text(slide.body, `slides[${i}].body`, 200);
      });
      const cta = obj(data.cta, "cta");
      text(cta.title, "cta.title", 60);
      text(cta.subtitle, "cta.subtitle", 120, true);
      break;
    }
    default:
      throw new TemplateDataError(`template: "${String(input.template)}" no existe`);
  }
  return input as TemplateInput;
}
