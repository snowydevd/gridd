import { v } from "convex/values";
import { div, h } from "./h";
import { ctaPill, fitSize, frame, kicker, richText, wordmark } from "./parts";
import { C, SITE } from "./theme";

export const carouselData = v.object({
  cover: v.object({ title: v.string(), subtitle: v.optional(v.string()) }),
  // 2–4 slides intermedias; `kicker` es una etiqueta opcional (ej. "Paso 1").
  slides: v.array(v.object({ kicker: v.optional(v.string()), title: v.string(), body: v.string() })),
  cta: v.object({ title: v.string(), subtitle: v.optional(v.string()) }),
});
export type CarouselData = typeof carouselData.type;

function counter(i: number, total: number) {
  return h(
    "span",
    { style: { fontSize: 30, fontWeight: 700, color: C.muted, letterSpacing: 2 } },
    `${String(i).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
  );
}

function header(i: number, total: number) {
  return div({ justifyContent: "space-between", alignItems: "center" }, wordmark(48), counter(i, total));
}

export function carousel(data: CarouselData) {
  const total = data.slides.length + 2;

  const cover = frame(
    header(1, total),
    div(
      { flexDirection: "column", gap: 40, marginTop: "auto" },
      richText(data.cover.title, fitSize(data.cover.title, [[128, 28], [108, 48]], 92)),
      data.cover.subtitle &&
        h("span", { style: { fontSize: 40, fontWeight: 500, lineHeight: 1.3, color: C.muted } }, data.cover.subtitle),
    ),
    div(
      { marginTop: 96, alignItems: "center", gap: 18, color: C.accent, fontSize: 34, fontWeight: 700 },
      "Deslizá",
      div({ width: 80, height: 4, backgroundColor: C.accent }),
    ),
  );

  const middle = data.slides.map((slide, i) =>
    frame(
      header(i + 2, total),
      div(
        { flexDirection: "column", gap: 44, marginTop: "auto", marginBottom: "auto" },
        slide.kicker && kicker(slide.kicker),
        richText(slide.title, fitSize(slide.title, [[96, 24], [80, 44]], 68)),
        h("span", { style: { fontSize: 42, fontWeight: 500, lineHeight: 1.35, color: C.muted } }, slide.body),
      ),
    ),
  );

  const end = frame(
    header(total, total),
    div(
      { flexDirection: "column", gap: 48, marginTop: "auto", marginBottom: "auto", alignItems: "flex-start" },
      richText(data.cta.title, fitSize(data.cta.title, [[112, 28], [96, 48]], 80)),
      // El sitio ya va abajo del botón: no lo repetimos en el subtítulo.
      data.cta.subtitle &&
        !data.cta.subtitle.toLowerCase().includes(SITE) &&
        h("span", { style: { fontSize: 40, fontWeight: 500, lineHeight: 1.3, color: C.muted } }, data.cta.subtitle),
      ctaPill(undefined, 48),
      h("span", { style: { fontSize: 34, fontWeight: 500, color: C.muted } }, SITE),
    ),
  );

  return [cover, ...middle, end];
}
