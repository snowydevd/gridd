import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { type TemplateInput, type TemplateName, checkTemplateData } from "../templates/index";
import { type Angle, BRAND_FACTS } from "./angles";
import { checkCaption, checkNumbers } from "./validate";

export type LlmClient = Pick<Anthropic, "messages">;

export const DEFAULT_MODEL = "claude-haiku-5-5";

export type GeneratedPost = TemplateInput & { angle: string; caption: string };

// Lo que le pedimos al modelo por plantilla (los opcionales de la plantilla van fijos acá).
const SCHEMAS = {
  headline: z.object({ headline: z.string(), subline: z.string() }),
  feature: z.object({ kicker: z.string(), title: z.string(), bullets: z.array(z.string()) }),
  carousel: z.object({
    cover: z.object({ title: z.string(), subtitle: z.string() }),
    slides: z.array(z.object({ title: z.string(), body: z.string() })),
    cta: z.object({ title: z.string(), subtitle: z.string() }),
  }),
} as const;

const TEMPLATE_GUIDE: Record<TemplateName, string> = {
  headline:
    "headline: frase grande (máx. 60 caracteres) con 1 o 2 palabras clave entre *asteriscos* para resaltarlas; subline: una línea que la complemente (máx. 100 caracteres).",
  feature:
    "feature: kicker de 1 o 2 palabras (ej. \"Mapa\", \"Organizadores\"); title de máx. 40 caracteres con 1 palabra entre *asteriscos*; bullets: 2 o 3 frases cortas (máx. 60 caracteres cada una).",
  carousel:
    "carousel: cover (title máx. 50 caracteres con *asteriscos* en 1 palabra, subtitle corto); slides: 2 a 4, cada una con title (máx. 40 caracteres) y body (máx. 160); cta: title de cierre (máx. 40) y subtitle corto. El botón \"Descargá Gridd\" ya va en la imagen.",
};

const SYSTEM = `Escribís posts para la cuenta de Instagram de Gridd, una app de car meets de Uruguay.

Tono: español rioplatense de Uruguay, con voseo ("descargá", "encontrá", "bajate"). Cercano y fierrero, como alguien de la escena hablándole a otro. Nada de lenguaje corporativo ni frases de IA ("descubrí el poder de", "llevá tu experiencia al siguiente nivel", "en el mundo de hoy"). Frases cortas y concretas. Como mucho 2 emojis por caption.

Reglas de contenido, sin excepción:
- Sólo podés afirmar lo que está en los HECHOS que te paso. No inventes funcionalidades, cifras, cantidades de usuarios, testimonios ni lugares.
- Si un dato no está en los hechos, no lo menciones.

Caption:
- Máximo 600 caracteres en total.
- Último párrafo de texto: la invitación a descargar Gridd, mencionando gridd.app.
- Después, en un párrafo aparte, entre 3 y 8 hashtags relevantes (car meets, autos, Uruguay). Sin repetir y sin spam.

Los textos de la imagen tienen que ser cortos: se leen en el celular de un vistazo.`;

function userPrompt(opts: {
  angle: Angle;
  template: TemplateName;
  recentCaptions: string[];
  feedback?: string[];
}) {
  const { angle, template, recentCaptions, feedback } = opts;
  const lines = [
    `ÁNGULO: ${angle.title}`,
    `OBJETIVO: ${angle.goal}`,
    "",
    "HECHOS (lo único que podés afirmar):",
    ...[...BRAND_FACTS, ...angle.facts].map((f) => `- ${f.replace(/^\(app\)\s*/, "")}`),
    "",
    `PLANTILLA: ${TEMPLATE_GUIDE[template]}`,
  ];
  if (recentCaptions.length > 0) {
    lines.push("", "Captions recientes (no repitas arranques ni frases):");
    lines.push(...recentCaptions.map((c) => `- ${c.split("\n")[0].slice(0, 120)}`));
  }
  if (feedback?.length) {
    lines.push("", "Tu respuesta anterior tuvo estos problemas; corregilos:");
    lines.push(...feedback.map((f) => `- ${f}`));
  }
  lines.push("", "Devolvé el caption y los datos de la plantilla.");
  return lines.join("\n");
}

/** Revisa un post (del modelo o escrito a mano); devuelve el post listo o la lista de problemas. */
export function reviewPost(
  angle: Angle,
  template: TemplateName,
  out: { caption: string; data: unknown },
): { post: GeneratedPost } | { problems: string[] } {
  const problems: string[] = [];
  let input: TemplateInput | null = null;
  try {
    input = checkTemplateData({ template, data: out.data });
  } catch (e) {
    problems.push(`Datos de la plantilla: ${e instanceof Error ? e.message : String(e)}`);
  }
  problems.push(...checkCaption(out.caption));
  const texts = [out.caption, ...collectStrings(out.data)];
  problems.push(...checkNumbers(texts, [...BRAND_FACTS, ...angle.facts]));
  return problems.length === 0 && input
    ? { post: { ...input, angle: angle.id, caption: out.caption.trim() } as GeneratedPost }
    : { problems };
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

/** Genera un post para un ángulo y plantilla. Reintenta una vez si no pasa las validaciones. */
export async function generatePost(
  client: LlmClient,
  opts: { angle: Angle; template: TemplateName; recentCaptions: string[]; model: string },
): Promise<GeneratedPost> {
  const { angle, template, model } = opts;
  const format = zodOutputFormat(z.object({ caption: z.string(), data: SCHEMAS[template] }));
  let feedback: string[] | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format },
      messages: [{ role: "user", content: userPrompt({ ...opts, feedback }) }],
    });

    if (res.stop_reason === "refusal") {
      feedback = ["El modelo rechazó el pedido."];
      continue;
    }
    if (!res.parsed_output) {
      feedback = [`La respuesta no tenía el formato pedido (stop_reason: ${res.stop_reason}).`];
      continue;
    }
    const result = reviewPost(angle, template, res.parsed_output);
    if ("post" in result) return result.post;
    feedback = [
      ...result.problems,
      `Respuesta anterior: ${JSON.stringify(res.parsed_output)}`,
    ];
  }
  throw new Error(
    `No se pudo generar un post válido para "${angle.id}" (${template}): ${feedback!
      .filter((f) => !f.startsWith("Respuesta anterior"))
      .join(" | ")}`,
  );
}
