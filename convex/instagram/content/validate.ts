// Chequeos del copy que no dependen del modelo. Devuelven la lista de problemas (vacía = ok).

const MAX_CAPTION = 700;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

export function checkCaption(caption: string): string[] {
  const problems: string[] = [];
  if (caption.length > MAX_CAPTION) {
    problems.push(`El caption tiene ${caption.length} caracteres; máximo ${MAX_CAPTION} (ideal ~600).`);
  }

  const tags = (caption.match(HASHTAG) ?? []).map((t) => t.toLowerCase());
  if (tags.length < 3 || tags.length > 8) {
    problems.push(`Tiene ${tags.length} hashtags; tienen que ser entre 3 y 8.`);
  }
  if (new Set(tags).size !== tags.length) problems.push("Hay hashtags repetidos.");

  // El último párrafo con texto (sin contar el de hashtags) tiene que invitar a Gridd.
  const paragraphs = caption
    .split(/\n\s*\n/)
    .map((p) => p.replace(HASHTAG, "").trim())
    .filter(Boolean);
  const last = paragraphs[paragraphs.length - 1] ?? "";
  if (!/gridd/i.test(last)) {
    problems.push("Falta el CTA a Gridd al final (antes de los hashtags).");
  }
  return problems;
}

/** Cifras inventadas: todo número del texto tiene que aparecer en los hechos. */
export function checkNumbers(texts: string[], facts: string[]): string[] {
  const allowed = new Set(facts.join(" ").match(/\d+/g) ?? []);
  const invented = new Set<string>();
  for (const text of texts) {
    for (const n of text.replace(HASHTAG, "").match(/\d+/g) ?? []) {
      if (!allowed.has(n)) invented.add(n);
    }
  }
  return [...invented].map((n) => `El número ${n} no está en los hechos verificados; sacalo.`);
}
