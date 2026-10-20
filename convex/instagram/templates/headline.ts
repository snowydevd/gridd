import { v } from "convex/values";
import { div, h } from "./h";
import { ctaFooter, fitSize, frame, richText, wordmark } from "./parts";
import { C } from "./theme";

export const headlineData = v.object({
  // Frase principal; *así* se resalta en fluor.
  headline: v.string(),
  subline: v.optional(v.string()),
  cta: v.optional(v.string()),
});
export type HeadlineData = typeof headlineData.type;

export function headline(data: HeadlineData) {
  const size = fitSize(data.headline, [[132, 28], [112, 48], [96, 72]], 84);
  return [
    frame(
      wordmark(60),
      div(
        { flexDirection: "column", gap: 40, marginTop: "auto", marginBottom: 96 },
        richText(data.headline, size),
        data.subline &&
          h("span", { style: { fontSize: 40, fontWeight: 500, lineHeight: 1.3, color: C.muted } }, data.subline),
      ),
      ctaFooter(data.cta),
    ),
  ];
}
