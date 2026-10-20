/**
 * Renderiza las plantillas de Instagram con datos de ejemplo a ./tmp/, sin pasar por Convex.
 *
 *   bun scripts/preview-templates.ts
 *
 * Los datos salen de `convex/instagram/templates/samples.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSlides } from "../convex/instagram/templates/render";
import { SAMPLES } from "../convex/instagram/templates/samples";

const outDir = join(process.cwd(), "tmp");
mkdirSync(outDir, { recursive: true });

for (const [name, input] of Object.entries(SAMPLES)) {
  const started = Date.now();
  const slides = await renderSlides(input);
  slides.forEach((jpeg, i) => {
    const file = join(outDir, slides.length > 1 ? `${name}-${i + 1}.jpg` : `${name}.jpg`);
    writeFileSync(file, jpeg);
    console.log(`${file} (${Math.round(jpeg.length / 1024)} KB)`);
  });
  console.log(`  ${name}: ${slides.length} slide(s) en ${Date.now() - started} ms`);
}
